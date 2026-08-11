import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from '@acme/core';
import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EvidenceProductCommandCollisionError,
  EvidenceProductSnapshotSchema,
  EvidenceReviewDecisionSchema,
  EvidenceWorkspaceSchema,
  type EvidenceProductJob,
  type EvidenceProductRepository,
  type EvidenceProductSnapshot,
  type EvidenceReviewDecision,
} from '@acme/evidence-product-contracts';
import {
  EvidenceObservationSchema,
  SourceArtifactVersionSchema,
} from '@acme/module-evidence';

function emptySnapshot(): EvidenceProductSnapshot {
  return EvidenceProductSnapshotSchema.parse({
    schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
    workspaces: [],
    sources: [],
    observations: [],
    jobs: [],
    reviewDecisions: [],
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJson(left as never) === canonicalJson(right as never);
}

function decisionCommand(value: EvidenceReviewDecision): unknown {
  return {
    workspaceId: value.workspaceId,
    targetKind: value.targetKind,
    targetVersionId: value.targetVersionId,
    action: value.action,
    reviewerRef: value.reviewerRef,
    rationale: value.rationale,
    commandKey: value.commandKey,
    basisEvidenceRevision: value.basisEvidenceRevision,
  };
}

export function createFileEvidenceProductRepository(options: {
  readonly filePath: string;
}): EvidenceProductRepository {
  const filePath = path.resolve(options.filePath);
  let pending: Promise<void> = Promise.resolve();

  async function read(): Promise<EvidenceProductSnapshot> {
    try {
      return EvidenceProductSnapshotSchema.parse(
        JSON.parse(await readFile(filePath, 'utf8')),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return emptySnapshot();
      throw error;
    }
  }

  async function write(snapshot: EvidenceProductSnapshot): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    await writeFile(temporary, `${canonicalJson(snapshot as never)}\n`, 'utf8');
    await rename(temporary, filePath);
  }

  async function mutate<T>(
    operation: (snapshot: EvidenceProductSnapshot) => {
      value: T;
      snapshot: EvidenceProductSnapshot;
    },
  ): Promise<T> {
    let output!: T;
    const current = pending.then(async () => {
      const result = operation(await read());
      output = result.value;
      await write(EvidenceProductSnapshotSchema.parse(result.snapshot));
    });
    pending = current.then(
      () => undefined,
      () => undefined,
    );
    await current;
    return clone(output);
  }

  return {
    async snapshot() {
      return clone(await read());
    },
    async putWorkspace(workspace) {
      const value = EvidenceWorkspaceSchema.parse(workspace);
      return mutate((snapshot) => {
        const existing = snapshot.workspaces.find(
          ({ workspaceId }) => workspaceId === value.workspaceId,
        );
        if (existing !== undefined) {
          if (!same(existing, value))
            throw new EvidenceProductCommandCollisionError(value.workspaceId);
          return { value: existing, snapshot };
        }
        return {
          value,
          snapshot: {
            ...snapshot,
            workspaces: [...snapshot.workspaces, value].sort((a, b) =>
              a.workspaceId.localeCompare(b.workspaceId),
            ),
          },
        };
      });
    },
    async putSource(source) {
      const value = SourceArtifactVersionSchema.parse(source);
      return mutate((snapshot) => {
        const existing = snapshot.sources.find(
          ({ artifactVersionId }) =>
            artifactVersionId === value.artifactVersionId,
        );
        if (existing !== undefined) {
          if (!same(existing, value))
            throw new EvidenceProductCommandCollisionError(
              value.artifactVersionId,
            );
          return { value: existing, snapshot };
        }
        return {
          value,
          snapshot: {
            ...snapshot,
            sources: [...snapshot.sources, value].sort((a, b) =>
              a.artifactVersionId.localeCompare(b.artifactVersionId),
            ),
          },
        };
      });
    },
    async putObservations(observations) {
      const values = observations.map((value) =>
        EvidenceObservationSchema.parse(value),
      );
      return mutate((snapshot) => {
        const byId = new Map(
          snapshot.observations.map((value) => [value.observationId, value]),
        );
        for (const value of values) {
          const existing = byId.get(value.observationId);
          if (existing !== undefined && !same(existing, value))
            throw new EvidenceProductCommandCollisionError(value.observationId);
          byId.set(value.observationId, existing ?? value);
        }
        return {
          value: values,
          snapshot: {
            ...snapshot,
            observations: [...byId.values()].sort((a, b) =>
              a.observationId.localeCompare(b.observationId),
            ),
          },
        };
      });
    },
    async putJob(job: EvidenceProductJob) {
      return mutate((snapshot) => {
        const existing = snapshot.jobs.find(({ jobId }) => jobId === job.jobId);
        if (
          existing !== undefined &&
          (existing.workspaceId !== job.workspaceId ||
            existing.commandKey !== job.commandKey ||
            existing.artifactVersionId !== job.artifactVersionId)
        ) {
          throw new EvidenceProductCommandCollisionError(job.commandKey);
        }
        const jobs = snapshot.jobs.filter(({ jobId }) => jobId !== job.jobId);
        jobs.push(job);
        jobs.sort((a, b) => a.jobId.localeCompare(b.jobId));
        return { value: job, snapshot: { ...snapshot, jobs } };
      });
    },
    async appendReviewDecision(decision) {
      const value = EvidenceReviewDecisionSchema.parse(decision);
      return mutate((snapshot) => {
        const existing = snapshot.reviewDecisions.find(
          ({ workspaceId, commandKey }) =>
            workspaceId === value.workspaceId &&
            commandKey === value.commandKey,
        );
        if (existing !== undefined) {
          if (!same(decisionCommand(existing), decisionCommand(value)))
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          return { value: existing, snapshot };
        }
        return {
          value,
          snapshot: {
            ...snapshot,
            reviewDecisions: [...snapshot.reviewDecisions, value].sort(
              (a, b) =>
                a.decidedAt.localeCompare(b.decidedAt) ||
                a.reviewDecisionId.localeCompare(b.reviewDecisionId),
            ),
          },
        };
      });
    },
    async advanceEvidenceRevision(workspaceId, expectedRevision, nextRevision) {
      return mutate((snapshot) => {
        const current = snapshot.workspaces.find(
          (value) => value.workspaceId === workspaceId,
        );
        if (current === undefined)
          throw new RangeError(`Unknown workspace ${workspaceId}.`);
        if (
          current.evidenceRevision !== expectedRevision ||
          nextRevision < expectedRevision ||
          nextRevision > expectedRevision + 1
        ) {
          throw new EvidenceProductCommandCollisionError(
            `revision:${workspaceId}`,
          );
        }
        const value = EvidenceWorkspaceSchema.parse({
          ...current,
          evidenceRevision: nextRevision,
        });
        return {
          value,
          snapshot: {
            ...snapshot,
            workspaces: snapshot.workspaces.map((item) =>
              item.workspaceId === workspaceId ? value : item,
            ),
          },
        };
      });
    },
  };
}
