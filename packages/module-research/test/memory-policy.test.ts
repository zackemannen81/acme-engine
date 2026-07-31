import type { MemoryCandidate, MemoryResolution } from '@acme/core';
import { describe, expect, it } from 'vitest';

import { RESEARCH_OBSERVE_EVIDENCE_CONTRACT_REF } from '../src/contracts/observe-evidence.js';
import {
  independentSourceCount,
  mergeEvidence,
  researchMemoryPolicy,
} from '../src/memory-policy.js';
import {
  RESEARCH_MEMORY_SCHEMA_VERSION,
  RESEARCH_NAMESPACE,
  ResearchClaimMemoryValueSchema,
  type ResearchClaimMemoryValue,
  type ResearchMemoryValue,
} from '../src/schemas.js';
import {
  claimIdentityKey,
  claimValue,
  evidenceOf,
  independenceKeyOf,
  memoryRecord,
  researchEntityId,
  researchExecutionId,
  researchNow,
  sourceA,
  sourceADuplicateAuthority,
  sourceB,
  sourceC,
  sourceKeyOf,
} from './fixtures.js';

const SUPPORTING = 'Water boils at 100 °C at standard atmospheric pressure.';
const CONTRADICTING = 'Water boils at 93 °C at standard atmospheric pressure.';

function candidate(
  value: ResearchMemoryValue,
  options: { readonly key?: string; readonly confidence?: number } = {},
): MemoryCandidate {
  return {
    key: options.key ?? 'research-claim-0001',
    kind: value.kind,
    schemaVersion: RESEARCH_MEMORY_SCHEMA_VERSION,
    value: value as unknown as MemoryCandidate['value'],
    confidence: options.confidence ?? 0.9,
    source: {
      executionId: researchExecutionId,
      contract: RESEARCH_OBSERVE_EVIDENCE_CONTRACT_REF,
      documentKeys: ['research-document-a'],
    },
  };
}

/** Narrows a resolution to the claim value it applied. */
function appliedClaim(resolution: MemoryResolution): ResearchClaimMemoryValue {
  if (resolution.action !== 'create' && resolution.action !== 'merge') {
    throw new Error(
      `Expected an applied claim value, got ${resolution.action}.`,
    );
  }
  return ResearchClaimMemoryValueSchema.parse(resolution.value);
}

const supportingA = claimValue(sourceA, { statement: SUPPORTING });

describe('research memory policy resolution', () => {
  it('creates a deferred claim from the first source and never verifies it', () => {
    const resolution = researchMemoryPolicy.resolve(
      candidate(supportingA),
      [],
      { now: researchNow },
    );
    expect(resolution).toMatchObject({
      action: 'create',
      candidateKey: 'research-claim-0001',
      strength: 0.9,
    });
    expect(Object.keys(resolution)).not.toContain('verified');
    expect(independentSourceCount(appliedClaim(resolution).evidence)).toBe(1);
  });

  it('does not raise the independent-source count for the same independence key', () => {
    const existing = memoryRecord(
      'memory-1',
      claimIdentityKey,
      'research.claim',
      supportingA,
    );
    const duplicate = claimValue(sourceADuplicateAuthority, {
      statement: SUPPORTING,
    });
    const resolution = researchMemoryPolicy.resolve(
      candidate(duplicate),
      [existing],
      { now: researchNow },
    );

    expect(resolution).toMatchObject({
      action: 'merge',
      strength: existing.strength,
    });
    const merged = appliedClaim(resolution);
    // Both documents stay auditable, but they share one declared authority.
    expect(merged.evidence).toHaveLength(2);
    expect(independentSourceCount(merged.evidence)).toBe(1);
  });

  it('collapses byte-identical evidence instead of duplicating it', () => {
    const existing = memoryRecord(
      'memory-1',
      claimIdentityKey,
      'research.claim',
      supportingA,
    );
    const resolution = researchMemoryPolicy.resolve(
      candidate(supportingA),
      [existing],
      { now: researchNow },
    );
    expect(appliedClaim(resolution).evidence).toHaveLength(1);
  });

  it('reinforces the claim when a genuinely independent source agrees', () => {
    const existing = memoryRecord(
      'memory-1',
      claimIdentityKey,
      'research.claim',
      supportingA,
      { strength: 0.5 },
    );
    const resolution = researchMemoryPolicy.resolve(
      candidate(claimValue(sourceB, { statement: SUPPORTING })),
      [existing],
      { now: researchNow },
    );
    expect(resolution).toMatchObject({ action: 'merge', memoryId: 'memory-1' });
    expect(independentSourceCount(appliedClaim(resolution).evidence)).toBe(2);
    expect(
      (resolution as { readonly strength: number }).strength,
    ).toBeGreaterThan(0.5);
  });

  it('contests the claim when an independent source contradicts it', () => {
    const existing = memoryRecord(
      'memory-1',
      claimIdentityKey,
      'research.claim',
      supportingA,
    );
    const resolution = researchMemoryPolicy.resolve(
      candidate(
        claimValue(sourceC, {
          statement: CONTRADICTING,
          position: 'contradicts',
        }),
      ),
      [existing],
      { now: researchNow },
    );

    expect(resolution).toEqual({
      candidateKey: 'research-claim-0001',
      action: 'contradict',
      memoryIds: ['memory-1'],
      disposition: 'contest',
    });
  });

  it('targets the same identity for supporting and contradicting evidence', () => {
    expect(researchMemoryPolicy.identity(candidate(supportingA))).toBe(
      researchMemoryPolicy.identity(
        candidate(
          claimValue(sourceC, {
            statement: CONTRADICTING,
            position: 'contradicts',
          }),
        ),
      ),
    );
  });

  it('ignores low-confidence and structurally invalid candidates', () => {
    expect(
      researchMemoryPolicy.resolve(
        candidate(supportingA, { confidence: 0.1 }),
        [],
        {
          now: researchNow,
        },
      ),
    ).toEqual({
      candidateKey: 'research-claim-0001',
      action: 'ignore',
      reason: 'low-confidence',
    });

    const tampered = {
      ...supportingA,
      propositionKey: 'research_proposition_tampered',
    };
    expect(
      researchMemoryPolicy.resolve(
        candidate(tampered as ResearchMemoryValue),
        [],
        { now: researchNow },
      ),
    ).toEqual({
      candidateKey: 'research-claim-0001',
      action: 'ignore',
      reason: 'invalid-research-candidate',
    });
  });

  it('merges source document keys and reinforces repeated questions', () => {
    const sourceValue: ResearchMemoryValue = {
      kind: 'research.source',
      sourceKey: sourceKeyOf(sourceA),
      independenceKey: independenceKeyOf(sourceA),
      normalizedUri: 'https://alpha.example.org/reports/boiling?id=1',
      uri: sourceA.source.uri,
      retrievedAt: sourceA.source.retrievedAt,
      publisher: sourceA.source.publisher,
      documentKeys: ['research-document-a'],
      independence: sourceA.source.independence,
    };
    const existing = memoryRecord(
      'memory-source-1',
      `source:${sourceKeyOf(sourceA)}`,
      'research.source',
      sourceValue,
    );
    const resolution = researchMemoryPolicy.resolve(
      candidate(
        { ...sourceValue, documentKeys: ['research-document-z'] },
        { key: 'research-source-0001' },
      ),
      [existing],
      { now: researchNow },
    );
    expect(resolution).toMatchObject({
      action: 'merge',
      value: { documentKeys: ['research-document-a', 'research-document-z'] },
    });
  });
});

describe('research memory policy validation, retrieval and lifecycle', () => {
  it('rejects tampered identity keys and missing provenance', () => {
    const issues = researchMemoryPolicy.validate({
      ...candidate({
        ...supportingA,
        evidence: [{ ...evidenceOf(sourceA), sourceKey: 'research_source_x' }],
      }),
      source: {
        executionId: researchExecutionId,
        contract: RESEARCH_OBSERVE_EVIDENCE_CONTRACT_REF,
        documentKeys: [],
      },
    });
    expect(issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'RESEARCH_SOURCE_KEY',
        'RESEARCH_MEMORY_PROVENANCE',
      ]),
    );
  });

  it('rejects a candidate whose kind disagrees with its value', () => {
    const issues = researchMemoryPolicy.validate({
      ...candidate(supportingA),
      kind: 'research.question',
    });
    expect(issues.map((entry) => entry.code)).toContain('RESEARCH_MEMORY_KIND');
  });

  it('ranks contested claims first and explains the standing', () => {
    const corroborated = memoryRecord(
      'memory-2',
      'claim:research_proposition_b',
      'research.claim',
      claimValue(sourceA, {
        statement: SUPPORTING,
        evidence: [evidenceOf(sourceA), evidenceOf(sourceB)],
      }),
    );
    const contested = memoryRecord(
      'memory-1',
      claimIdentityKey,
      'research.claim',
      supportingA,
      { status: 'contested' },
    );
    const ranked = researchMemoryPolicy.retrieve(
      {
        namespace: RESEARCH_NAMESPACE,
        entityId: researchEntityId,
        task: 'observe-evidence',
        limit: 10,
      },
      [corroborated, contested],
    );

    expect(ranked.map(({ record }) => record.memoryId)).toEqual([
      'memory-2',
      'memory-1',
    ]);
    expect(ranked[0]?.reasons).toEqual(
      expect.arrayContaining([
        'status:corroborated',
        'independent-sources:2',
        'task:observe-evidence',
      ]),
    );
    expect(ranked[1]?.reasons).toContain('status:contested');
  });

  it('returns nothing for a foreign namespace', () => {
    expect(
      researchMemoryPolicy.retrieve(
        {
          namespace: 'narrative',
          entityId: researchEntityId,
          task: 'observe-evidence',
          limit: 10,
        },
        [
          memoryRecord(
            'memory-1',
            claimIdentityKey,
            'research.claim',
            supportingA,
          ),
        ],
      ),
    ).toEqual([]);
  });

  it('never decays claim evidence and ages only questions at maintenance', () => {
    const claim = memoryRecord(
      'memory-1',
      claimIdentityKey,
      'research.claim',
      supportingA,
      { strength: 0.05 },
    );
    expect(
      researchMemoryPolicy.lifecycle(claim, 'maintenance', {
        now: researchNow,
      }),
    ).toEqual({ action: 'retain' });
    expect(
      researchMemoryPolicy.lifecycle(claim, 'execution-commit', {
        now: researchNow,
      }),
    ).toEqual({ action: 'retain' });

    const question = memoryRecord(
      'memory-q',
      'question:research_question_x',
      'research.question',
      {
        kind: 'research.question',
        questionKey: 'research_question_x',
        normalizedQuestion: 'does altitude change the measurement?',
        question: 'Does altitude change the measurement?',
        documentKeys: ['research-document-a'],
      },
      { strength: 0.5 },
    );
    expect(
      researchMemoryPolicy.lifecycle(question, 'maintenance', {
        now: researchNow,
      }),
    ).toEqual({ action: 'update-strength', strength: 0.45 });
    expect(
      researchMemoryPolicy.lifecycle(
        { ...question, strength: 0.05 },
        'maintenance',
        { now: researchNow },
      ),
    ).toEqual({
      action: 'forget',
      reason: 'research-question-below-maintenance-floor',
    });
  });

  it('orders merged evidence stably regardless of arrival order', () => {
    const forward = mergeEvidence(
      [evidenceOf(sourceA)],
      [evidenceOf(sourceB), evidenceOf(sourceC)],
    );
    const reverse = mergeEvidence(
      [evidenceOf(sourceC)],
      [evidenceOf(sourceB), evidenceOf(sourceA)],
    );
    expect(forward).toEqual(reverse);
    expect(independentSourceCount(forward)).toBe(3);
  });
});
