import { describe, expect, it } from 'vitest';

import type { MemoryCandidate, MemoryRecord } from '@acme/core';

import {
  EVIDENCE_MEMORY_SCHEMA_VERSION,
  deriveEvidencePropositionId,
  evidenceMemoryPolicy,
  evidenceModule,
  evidenceTasks,
} from '../src/index.js';

const observationId = `evidence_observation_${'a'.repeat(64)}`;
const proposition = {
  schemaVersion: 'evidence-proposition/1' as const,
  kind: 'proposition' as const,
  propositionId: deriveEvidencePropositionId({
    observationIds: [observationId],
    normalizedProposition: 'A source-bound maintenance proposition.',
  }),
  observationIds: [observationId],
  normalizedProposition: 'A source-bound maintenance proposition.',
};
const candidate: MemoryCandidate = {
  key: 'candidate-1',
  kind: 'evidence.proposition',
  schemaVersion: EVIDENCE_MEMORY_SCHEMA_VERSION,
  value: proposition,
  confidence: 0.8,
  source: {
    executionId: 'execution-1',
    contract: { id: 'fixture', version: '1.0.0' },
    documentKeys: [],
  },
};

describe('Evidence memory and module scaffold', () => {
  it('validates and content-addresses an Evidence memory candidate', () => {
    expect(evidenceMemoryPolicy.validate(candidate)).toEqual([]);
    expect(evidenceMemoryPolicy.identity(candidate)).toBe(
      proposition.propositionId,
    );
    expect(
      evidenceMemoryPolicy.resolve(candidate, [], {
        now: '2026-08-11T00:00:00.000Z',
      }),
    ).toMatchObject({
      action: 'create',
      candidateKey: 'candidate-1',
    });
  });

  it('ignores an identical replay without merging a changed value', () => {
    const record: MemoryRecord = {
      memoryId: 'memory-1',
      namespace: 'evidence',
      entityId: 'workspace-1',
      identityKey: proposition.propositionId,
      kind: candidate.kind,
      schemaVersion: candidate.schemaVersion,
      value: proposition,
      strength: 0.8,
      status: 'active',
      firstSeenAt: '2026-08-11T00:00:00.000Z',
      lastSeenAt: '2026-08-11T00:00:00.000Z',
      lastReinforcedAt: '2026-08-11T00:00:00.000Z',
      provenance: [candidate.source],
      recordVersion: 1,
    };
    expect(
      evidenceMemoryPolicy.resolve(candidate, [record], {
        now: '2026-08-11T00:00:00.000Z',
      }),
    ).toEqual({
      candidateKey: 'candidate-1',
      action: 'ignore',
      reason: 'evidence-idempotent-duplicate',
    });
  });

  it('publishes the executable slice-1 observation task', () => {
    expect(evidenceModule.namespace).toBe('evidence');
    expect(evidenceModule.tasks).toBe(evidenceTasks);
    expect(Object.keys(evidenceModule.tasks)).toEqual(['observe-artifact']);
  });
});
