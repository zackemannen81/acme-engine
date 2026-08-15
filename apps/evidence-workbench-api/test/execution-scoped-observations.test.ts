import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RepositoryEvidence } from '@acme/core';
import type { EvidenceObservation } from '@acme/module-evidence';

import { selectExecutionObservations } from '../src/live-observation.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

type MemoryRecord = RepositoryEvidence['memoryRecords'][number];

let directory: string;
let observations: readonly EvidenceObservation[];

// Real seeded observations, so the fixture cannot drift from the schema the
// selector actually parses.
beforeAll(async () => {
  directory = await mkdtemp(
    path.join(os.tmpdir(), 'evidence-execution-scope-'),
  );
  const local = await createLocalEvidenceWorkbench({
    dataFile: path.join(directory, 'product.json'),
    seedMode: 'development',
  });
  try {
    const snapshot = await local.productRepository.caseSnapshot(
      local.caseId,
      local.workspaceId,
    );
    observations = snapshot.observations;
  } finally {
    await local.close();
  }
  expect(observations.length).toBeGreaterThan(1);
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

function record(
  observation: EvidenceObservation,
  executionId: string,
  artifactVersionId = observation.artifactVersionId,
): MemoryRecord {
  return {
    memoryId: `memory-${observation.observationId}`,
    namespace: 'evidence',
    entityId: 'workspace-1',
    identityKey: observation.observationId,
    kind: 'observation',
    schemaVersion: observation.schemaVersion,
    value: { ...observation, artifactVersionId },
    strength: 1,
    status: 'active',
    firstSeenAt: '2026-08-15T08:00:00.000Z',
    lastSeenAt: '2026-08-15T08:00:00.000Z',
    lastReinforcedAt: '2026-08-15T08:00:00.000Z',
    provenance: [
      {
        executionId,
        contract: {
          name: 'evidence.observe-artifact',
          version: '1.6.0',
          fingerprint: 'f'.repeat(64),
        },
        documentKeys: [],
      },
    ],
    recordVersion: 1,
  } as unknown as MemoryRecord;
}

describe('selectExecutionObservations (ACME-0131)', () => {
  it('takes only the executing run and only the requested artifact', () => {
    const [first, second] = observations;
    if (first === undefined || second === undefined)
      throw new Error('The seed produced too few observations.');
    const artifactVersionId = first.artifactVersionId;

    const selected = selectExecutionObservations({
      records: [
        record(first, 'execution-1'),
        record(second, 'execution-2'),
        record(first, 'execution-2', 'evidence_artifact_other'),
      ],
      executionId: 'execution-2',
      artifactVersionId,
    });

    // A repeated analysis of the same source must not re-project the earlier
    // run's records as if this run had produced them.
    expect(selected.map((item) => item.observationId)).toEqual([
      second.observationId,
    ]);
  });

  it('still selects a resumed execution because identity is preserved', () => {
    const [first] = observations;
    if (first === undefined)
      throw new Error('The seed produced no observation.');
    expect(
      selectExecutionObservations({
        records: [record(first, 'execution-resumed')],
        executionId: 'execution-resumed',
        artifactVersionId: first.artifactVersionId,
      }),
    ).toHaveLength(1);
  });

  it('selects nothing when no record belongs to the execution', () => {
    const [first] = observations;
    if (first === undefined)
      throw new Error('The seed produced no observation.');
    expect(
      selectExecutionObservations({
        records: [record(first, 'execution-1')],
        executionId: 'execution-2',
        artifactVersionId: first.artifactVersionId,
      }),
    ).toEqual([]);
  });
});
