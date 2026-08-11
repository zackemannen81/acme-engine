import { describe, expect, it } from 'vitest';

import type { MemoryCandidate } from '../../packages/core/src/index.js';
import {
  EVIDENCE_MEMORY_SCHEMA_VERSION,
  EVIDENCE_TASK_CATALOGUE,
  deriveEvidencePropositionId,
  evidenceModule,
  initialEvidenceState,
} from '../../packages/module-evidence/src/index.js';

describe('Evidence module foundation conformance', () => {
  it('conforms to the domain module state and reserved-task boundaries', () => {
    expect(evidenceModule.namespace).toBe('evidence');
    expect(
      evidenceModule.stateSchema.safeParse(initialEvidenceState()).success,
    ).toBe(true);
    expect(Object.keys(evidenceModule.tasks)).toEqual(['observe-artifact']);
    expect(EVIDENCE_TASK_CATALOGUE).toHaveLength(4);
  });

  it('conforms to deterministic memory validation and identity', () => {
    const observationId = `evidence_observation_${'a'.repeat(64)}`;
    const value = {
      schemaVersion: 'evidence-proposition/1' as const,
      kind: 'proposition' as const,
      propositionId: deriveEvidencePropositionId({
        observationIds: [observationId],
        normalizedProposition: 'A conformance proposition.',
      }),
      observationIds: [observationId],
      normalizedProposition: 'A conformance proposition.',
    };
    const candidate: MemoryCandidate = {
      key: 'evidence-conformance-memory',
      kind: 'evidence.proposition',
      schemaVersion: EVIDENCE_MEMORY_SCHEMA_VERSION,
      value,
      source: {
        executionId: 'execution-conformance',
        contract: { id: 'fixture', version: '1.0.0' },
        documentKeys: [],
      },
    };
    expect(evidenceModule.memoryPolicy.validate(candidate)).toEqual([]);
    expect(evidenceModule.memoryPolicy.identity(candidate)).toBe(
      value.propositionId,
    );
    expect(
      evidenceModule.memoryPolicy.lifecycle(
        {
          memoryId: 'memory-1',
          namespace: 'evidence',
          entityId: 'workspace-1',
          identityKey: value.propositionId,
          kind: candidate.kind,
          schemaVersion: candidate.schemaVersion,
          value,
          strength: 1,
          status: 'active',
          firstSeenAt: '2026-08-11T00:00:00.000Z',
          lastSeenAt: '2026-08-11T00:00:00.000Z',
          lastReinforcedAt: '2026-08-11T00:00:00.000Z',
          provenance: [candidate.source],
          recordVersion: 1,
        },
        'maintenance',
        { now: '2026-08-11T00:00:00.000Z' },
      ),
    ).toEqual({ action: 'retain' });
  });
});
