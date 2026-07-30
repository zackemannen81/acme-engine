import { describe, expect, it } from 'vitest';

import type { MemoryCandidate, MemoryRecord } from '@acme/core';

import {
  NARRATIVE_ENTITY_KEY_ALGORITHM,
  deriveNarrativeEntityKey,
  narrativeMemoryPolicy,
  normalizeReferenceText,
} from '../src/index.js';
import {
  characterCandidate,
  existingCharacterRecord,
  fixtureEntityId,
  fixtureNow,
  miraEntityKey,
  provenance,
} from './fixtures.js';

function record(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    ...existingCharacterRecord,
    ...overrides,
  };
}

describe('Narrative identity and memory policy', () => {
  it('implements reference normalization and the ADR-0009 golden vector', () => {
    expect(NARRATIVE_ENTITY_KEY_ALGORITHM).toBe('narrative-entity-key-1');
    expect(normalizeReferenceText('  Dr.\tMira  Vale ')).toBe('dr. mira vale');
    expect(deriveNarrativeEntityKey('Dr. Mira Vale')).toBe(
      'narrative_entity_e9c378a3081e2771f6c2653fed130d1f437bba404ad0988376acf81a498fd253',
    );
  });

  it('validates kind/schema/provenance and derives stable identity', () => {
    const candidate = characterCandidate();
    expect(narrativeMemoryPolicy.validate(candidate)).toEqual([]);
    expect(narrativeMemoryPolicy.identity(candidate)).toBe(
      `character:${miraEntityKey}:eye color`,
    );
    expect(
      narrativeMemoryPolicy.validate({
        ...candidate,
        schemaVersion: 'wrong',
        source: { ...candidate.source, documentKeys: [] },
      }),
    ).toHaveLength(2);
    expect(
      narrativeMemoryPolicy
        .validate(
          characterCandidate({
            value: {
              ...(candidate.value as Record<string, unknown>),
              normalizedPredicate: 'wrong',
            },
          }),
        )
        .map(({ code }) => code),
    ).toContain('NARRATIVE_PREDICATE_NORMALIZATION');
  });

  it('creates, ignores low-confidence noise, and contests contradiction', () => {
    const candidate = characterCandidate();
    expect(
      narrativeMemoryPolicy.resolve(candidate, [], { now: fixtureNow }),
    ).toEqual({
      candidateKey: candidate.key,
      action: 'create',
      value: candidate.value,
      strength: 0.9,
    });
    expect(
      narrativeMemoryPolicy.resolve({ ...candidate, confidence: 0.1 }, [], {
        now: fixtureNow,
      }),
    ).toEqual({
      candidateKey: candidate.key,
      action: 'ignore',
      reason: 'low-confidence',
    });
    expect(
      narrativeMemoryPolicy.resolve(candidate, [existingCharacterRecord], {
        now: fixtureNow,
      }),
    ).toEqual({
      candidateKey: candidate.key,
      action: 'contradict',
      memoryIds: [existingCharacterRecord.memoryId],
      disposition: 'contest',
    });
  });

  it('reinforces exact values and merges compatible observed labels', () => {
    const exact = characterCandidate({
      value: existingCharacterRecord.value,
      confidence: 0.5,
    });
    expect(
      narrativeMemoryPolicy.resolve(exact, [existingCharacterRecord], {
        now: fixtureNow,
      }),
    ).toEqual({
      candidateKey: exact.key,
      action: 'reinforce',
      memoryId: existingCharacterRecord.memoryId,
      strength: 0.8,
    });

    const compatible = characterCandidate({
      value: {
        ...(existingCharacterRecord.value as Record<string, unknown>),
        observedLabels: ['Doctor Mira'],
      },
      confidence: 0.5,
    });
    const merged = narrativeMemoryPolicy.resolve(
      compatible,
      [existingCharacterRecord],
      { now: fixtureNow },
    );
    expect(merged.action).toBe('merge');
    if (merged.action === 'merge') {
      expect(merged.value).toMatchObject({
        observedLabels: ['Doctor Mira', 'Mira'],
      });
    }
  });

  it('supersedes only with exact input-validated correction evidence', () => {
    const correction: MemoryCandidate = characterCandidate({
      value: {
        kind: 'narrative.character-fact',
        entityKey: miraEntityKey,
        observedLabels: ['Mira'],
        predicate: 'eye color',
        normalizedPredicate: 'eye color',
        value: 'green',
        correction: {
          targetIdentityKey: existingCharacterRecord.identityKey,
          supersedesValue: 'blue',
          evidenceQuote: 'eyes are green',
        },
        validatedCorrection: {
          targetIdentityKey: existingCharacterRecord.identityKey,
          supersedesValue: 'blue',
          evidenceQuote: 'eyes are green',
          documentKey: 'chapter-beta',
          correctionEvidenceValidated: true,
        },
      },
    });
    const resolution = narrativeMemoryPolicy.resolve(
      correction,
      [existingCharacterRecord],
      { now: fixtureNow },
    );

    expect(resolution).toMatchObject({
      candidateKey: correction.key,
      action: 'contradict',
      memoryIds: [existingCharacterRecord.memoryId],
      disposition: 'supersede-existing',
      replacement: { strength: 0.9 },
    });

    const wrongPrior = characterCandidate({
      value: {
        ...(correction.value as Record<string, unknown>),
        correction: {
          ...(
            correction.value as {
              correction: Record<string, unknown>;
            }
          ).correction,
          supersedesValue: 'brown',
        },
        validatedCorrection: {
          ...(
            correction.value as {
              validatedCorrection: Record<string, unknown>;
            }
          ).validatedCorrection,
          supersedesValue: 'brown',
        },
      },
    });
    expect(
      narrativeMemoryPolicy.resolve(wrongPrior, [existingCharacterRecord], {
        now: fixtureNow,
      }),
    ).toMatchObject({ disposition: 'contest' });

    const correctionValue = correction.value as Record<string, unknown>;
    const {
      validatedCorrection: _validatedCorrection,
      ...withoutValidatedCorrection
    } = correctionValue;
    void _validatedCorrection;
    const rawCorrection = correctionValue.correction as Record<string, unknown>;
    const validatedCorrection = correctionValue.validatedCorrection as Record<
      string,
      unknown
    >;
    const failedCandidates = [
      characterCandidate({
        value: withoutValidatedCorrection as MemoryCandidate['value'],
      }),
      characterCandidate({
        value: {
          ...correctionValue,
          correction: { ...rawCorrection, targetIdentityKey: 'wrong' },
          validatedCorrection: {
            ...validatedCorrection,
            targetIdentityKey: 'wrong',
          },
        },
      }),
      characterCandidate({
        value: {
          ...correctionValue,
          validatedCorrection: {
            ...validatedCorrection,
            documentKey: 'chapter-missing',
          },
        },
      }),
    ];
    for (const failed of failedCandidates) {
      expect(
        narrativeMemoryPolicy.resolve(failed, [existingCharacterRecord], {
          now: fixtureNow,
        }),
      ).toMatchObject({ disposition: 'contest' });
    }
  });

  it('ranks deterministically and applies explicit lifecycle decisions', () => {
    const contested = record({
      memoryId: 'memory-contested',
      status: 'contested',
      strength: 0.8,
    });
    const active = record({
      memoryId: 'memory-active',
      strength: 0.4,
    });
    const ranked = narrativeMemoryPolicy.retrieve(
      {
        namespace: 'narrative',
        entityId: fixtureEntityId,
        task: 'observe-document',
        limit: 10,
      },
      [contested, active],
    );
    expect(ranked.map(({ record }) => record.memoryId)).toEqual([
      'memory-active',
      'memory-contested',
    ]);

    expect(
      narrativeMemoryPolicy.lifecycle(
        record({ strength: 0.05 }),
        'maintenance',
        { now: fixtureNow },
      ),
    ).toMatchObject({ action: 'forget' });
    expect(
      narrativeMemoryPolicy.lifecycle(contested, 'maintenance', {
        now: fixtureNow,
      }),
    ).toEqual({ action: 'update-strength', strength: 0.72 });
    expect(
      narrativeMemoryPolicy.lifecycle(
        record({ provenance: [provenance] }),
        'execution-commit',
        { now: fixtureNow },
      ),
    ).toEqual({ action: 'retain' });
  });
});
