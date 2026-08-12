import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { listenEvidenceWorkbenchApi } from '../../apps/evidence-workbench-api/src/index.js';
import { createLocalEvidenceWorkbench } from '../../apps/evidence-workbench-api/src/local.js';
import { developmentObserveArtifactInput } from '../../packages/evidence-testing/src/development-observe.js';
import {
  EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
  EVIDENCE_LOCATOR_SCHEMA_VERSION,
  EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
  EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
  deriveEvidenceActorReferenceKey,
  deriveEvidenceLocatorId,
  deriveEvidenceObservationId,
} from '../../packages/module-evidence/src/index.js';

function countingIds(prefix: string) {
  const counts = new Map<string, number>();
  return {
    next(kind: string) {
      const next = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, next);
      return `${prefix}-${kind}-${String(next)}-${randomUUID().slice(0, 8)}`;
    },
  };
}

async function stopWorkbench(local: {
  readonly server: {
    readonly listening: boolean;
    close: (cb: (err?: Error) => void) => void;
  };
  readonly close: () => Promise<void>;
}): Promise<void> {
  if (local.server.listening) {
    await new Promise<void>((resolve, reject) => {
      local.server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await local.close();
}

function developmentObservation() {
  const source = developmentObserveArtifactInput().artifactVersion;
  const startLine = 4;
  const endLine = 4;
  const exactQuote =
    'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.';
  const locatorId = deriveEvidenceLocatorId({
    artifactVersionId: source.artifactVersionId,
    startLine,
    endLine,
  });
  const actorBase = {
    schemaVersion: EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
    artifactVersionId: source.artifactVersionId,
    locatorId,
    sourceLabel: 'Nera Sol',
    sourceRole: 'speaker' as const,
  };
  const actorReference = {
    ...actorBase,
    actorReferenceKey: deriveEvidenceActorReferenceKey(actorBase),
    resolution: {
      status: 'resolved' as const,
      actorKey: 'development-actor-nera-sol',
    },
  };
  const temporalBound = {
    schemaVersion: EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
    artifactVersionId: source.artifactVersionId,
    locatorId,
    kind: 'range' as const,
    role: 'claimed-event-time' as const,
    from: '2026-03-12T14:00:00Z',
    to: '2026-03-12T14:10:00Z',
  };
  const observationId = deriveEvidenceObservationId({
    kind: 'statement-occurrence',
    artifactVersionId: source.artifactVersionId,
    locatorId,
    exactQuote,
    sourceActorReference: actorReference,
    temporalBound,
  });
  return {
    source,
    observation: {
      schemaVersion: EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
      kind: 'statement-occurrence' as const,
      observationId,
      artifactVersionId: source.artifactVersionId,
      locator: {
        schemaVersion: EVIDENCE_LOCATOR_SCHEMA_VERSION,
        locatorId,
        artifactVersionId: source.artifactVersionId,
        startLine,
        endLine,
      },
      exactQuote,
      actorReference,
      temporalBound,
    },
  };
}

/**
 * Hosted-shell restart durability: two sequential process compositions against
 * the same PostgreSQL product store continue the same workspace (ACME-0086).
 */
describe('Evidence workbench PostgreSQL restart', () => {
  it('retains sources and review decisions across process close and reopen', async () => {
    if (
      process.env['ACME_POSTGRES_URL'] === undefined ||
      process.env['ACME_POSTGRES_URL'].trim().length === 0
    ) {
      throw new Error('ACME_POSTGRES_URL is required for test:postgres.');
    }

    const commandKey = `restart-proof-review-${randomUUID()}`;
    const { source, observation } = developmentObservation();

    const first = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      clock: { now: () => '2026-08-12T12:00:00.000Z' },
      ids: countingIds('restart-a'),
      reviewIds: { next: () => `review-${randomUUID()}` },
    });
    const address = await listenEvidenceWorkbenchApi(first.server, {
      port: 0,
    });
    try {
      const health = await fetch(`${address.url}health`);
      expect(health.status).toBe(200);
      expect((await health.json()) as { status: string }).toMatchObject({
        status: 'ok',
      });

      await first.productRepository.putSource(source);
      await first.productRepository.putObservations([observation]);

      const review = await fetch(`${address.url}api/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-review-command/1',
          workspaceId: first.workspaceId,
          commandKey,
          targetKind: 'observation',
          targetVersionId: observation.observationId,
          action: 'accept',
          reviewerRef: 'local-reviewer',
          rationale: 'Restart durability review.',
          basisEvidenceRevision: null,
        }),
      });
      expect(review.status).toBe(201);

      const afterReview = await first.productRepository.snapshot();
      expect(afterReview.sources.length).toBeGreaterThan(0);
      expect(
        afterReview.reviewDecisions.some(
          (decision) => decision.commandKey === commandKey,
        ),
      ).toBe(true);
    } finally {
      await stopWorkbench(first);
    }

    const second = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      clock: { now: () => '2026-08-12T12:05:00.000Z' },
      ids: countingIds('restart-b'),
      reviewIds: { next: () => `review-${randomUUID()}` },
    });
    try {
      const snapshotAfter = await second.productRepository.snapshot();
      expect(snapshotAfter.sources.length).toBeGreaterThan(0);
      expect(
        snapshotAfter.reviewDecisions.some(
          (decision) => decision.commandKey === commandKey,
        ),
      ).toBe(true);
      expect(snapshotAfter.workspaces[0]?.dataPolicy).toBe('synthetic-only');
    } finally {
      await stopWorkbench(second);
    }
  });
});
