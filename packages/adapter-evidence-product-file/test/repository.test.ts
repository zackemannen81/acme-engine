import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  recordReviewDecision,
  type EvidenceProductIds,
} from '@acme/evidence-product-contracts';
import {
  developmentObserveArtifactInput,
  developmentObserveArtifactOutput,
} from '@acme/evidence-testing';
import {
  evidenceObserveArtifactTask,
  type EvidenceObservation,
} from '@acme/module-evidence';

import { createFileEvidenceProductRepository } from '../src/index.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function observations(): Promise<readonly EvidenceObservation[]> {
  const input = developmentObserveArtifactInput();
  const result = await evidenceObserveArtifactTask.interpret(
    developmentObserveArtifactOutput(),
    input,
    {
      executionId: 'execution-product-repository-test',
      entityId: 'workspace-1',
      now: '2026-08-11T10:00:00.000Z',
      state: null,
      memories: [],
      documents: [],
    },
  );
  return result.memories.map(({ value }) => value as EvidenceObservation);
}

describe('file Evidence product repository', () => {
  it('persists immutable sources and observations separately from review decisions', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-product-'),
    );
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'product.json');
    const repository = createFileEvidenceProductRepository({ filePath });
    await repository.putWorkspace({
      schemaVersion: 'evidence-workspace/1',
      workspaceId: 'workspace-1',
      label: 'Synthetic review',
      dataPolicy: 'synthetic-only',
      evidenceRevision: 0,
      createdAt: '2026-08-11T10:00:00.000Z',
    });
    const input = developmentObserveArtifactInput();
    await repository.putSource(input.artifactVersion);
    const values = await observations();
    await repository.putObservations(values);
    await repository.advanceEvidenceRevision('workspace-1', 0, 1);
    const target = values[0];
    if (target === undefined)
      throw new Error('Missing development observation.');

    let id = 0;
    const ids: EvidenceProductIds = { next: () => `decision-${String(++id)}` };
    const command = {
      schemaVersion: 'evidence-review-command/1' as const,
      workspaceId: 'workspace-1',
      commandKey: 'review-command-1',
      targetKind: 'observation' as const,
      targetVersionId: target.observationId,
      action: 'accept' as const,
      reviewerRef: 'local-reviewer',
      rationale: 'The quote and actor label match the source.',
      basisEvidenceRevision: null,
    };
    const first = await recordReviewDecision(
      repository,
      command,
      { now: () => '2026-08-11T10:01:00.000Z' },
      ids,
    );
    const replay = await recordReviewDecision(
      repository,
      command,
      { now: () => '2026-08-11T10:02:00.000Z' },
      ids,
    );
    expect(replay).toEqual(first);
    await expect(
      recordReviewDecision(
        repository,
        { ...command, rationale: 'Different content.' },
        { now: () => '2026-08-11T10:03:00.000Z' },
        ids,
      ),
    ).rejects.toMatchObject({ code: 'EVIDENCE_PRODUCT_COMMAND_COLLISION' });

    const reopened = createFileEvidenceProductRepository({ filePath });
    const snapshot = await reopened.snapshot();
    expect(snapshot).toMatchObject({
      workspaces: [{ evidenceRevision: 1 }],
      sources: [{ artifactVersionId: input.artifactVersion.artifactVersionId }],
    });
    expect(snapshot.observations).toHaveLength(2);
    expect(snapshot.reviewDecisions).toEqual([first]);
  });
});
