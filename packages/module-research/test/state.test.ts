import { describe, expect, it } from 'vitest';

import {
  initialResearchState,
  reduceResearchState,
  researchStateInvariants,
} from '../src/state.js';
import {
  RESEARCH_IDENTITY_POLICY_VERSION,
  RESEARCH_VERIFICATION_THRESHOLD,
  ResearchStateSchema,
  type ResearchState,
} from '../src/schemas.js';

const claimA = 'claim:research_proposition_aaa';
const claimB = 'claim:research_proposition_bbb';

function state(overrides: Partial<ResearchState> = {}): ResearchState {
  return {
    identityPolicyVersion: RESEARCH_IDENTITY_POLICY_VERSION,
    verificationThreshold: RESEARCH_VERIFICATION_THRESHOLD,
    verifiedClaims: [],
    contestedClaims: [],
    openQuestions: [],
    ...overrides,
  };
}

describe('research state', () => {
  it('starts empty, valid and deeply frozen', () => {
    const initial = initialResearchState();
    expect(initial).toEqual(state());
    expect(ResearchStateSchema.safeParse(initial).success).toBe(true);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial.verifiedClaims)).toBe(true);
  });

  it('applies verify, contest and defer without mutating its inputs', () => {
    const before = state();
    const delta = {
      claimDecisions: [
        {
          action: 'verify' as const,
          identityKey: claimA,
          statement: 'Water boils at 100 °C.',
          independentSourceCount: 2,
          memoryIds: ['memory-2', 'memory-1', 'memory-1'],
        },
        { action: 'defer' as const, identityKey: claimB },
      ],
      questions: ['Which sources agree?'],
    };
    const next = reduceResearchState(before, delta);

    expect(next.verifiedClaims).toEqual([
      {
        identityKey: claimA,
        statement: 'Water boils at 100 °C.',
        independentSourceCount: 2,
        memoryIds: ['memory-1', 'memory-2'],
      },
    ]);
    expect(next.contestedClaims).toEqual([]);
    expect(next.openQuestions).toEqual(['Which sources agree?']);
    expect(before).toEqual(state());
    expect(researchStateInvariants(next, before)).toEqual([]);
  });

  it('moves a verified claim to contested and preserves every variant', () => {
    const verified = reduceResearchState(state(), {
      claimDecisions: [
        {
          action: 'verify',
          identityKey: claimA,
          statement: 'Water boils at 100 °C.',
          independentSourceCount: 2,
          memoryIds: ['memory-1', 'memory-2'],
        },
      ],
      questions: [],
    });
    const contested = reduceResearchState(verified, {
      claimDecisions: [
        {
          action: 'contest',
          identityKey: claimA,
          variants: ['Water boils at 100 °C.', 'Water boils at 95 °C.'],
          memoryIds: ['memory-3', 'memory-1'],
        },
      ],
      questions: [],
    });

    expect(contested.verifiedClaims).toEqual([]);
    expect(contested.contestedClaims).toEqual([
      {
        identityKey: claimA,
        variants: ['Water boils at 100 °C.', 'Water boils at 95 °C.'],
        memoryIds: ['memory-1', 'memory-3'],
      },
    ]);
    expect(researchStateInvariants(contested, verified)).toEqual([]);
  });

  it('refuses to re-verify a contested claim inside the same reduction', () => {
    const contested = reduceResearchState(state(), {
      claimDecisions: [
        {
          action: 'contest',
          identityKey: claimA,
          variants: ['a variant', 'another variant'],
          memoryIds: ['memory-1'],
        },
      ],
      questions: [],
    });
    const next = reduceResearchState(contested, {
      claimDecisions: [
        {
          action: 'verify',
          identityKey: claimA,
          statement: 'a variant',
          independentSourceCount: 3,
          memoryIds: ['memory-9'],
        },
      ],
      questions: [],
    });

    expect(next.verifiedClaims).toEqual([]);
    expect(next.contestedClaims).toHaveLength(1);
    expect(researchStateInvariants(next, contested)).toEqual([]);
  });

  it('deduplicates open questions by research-question-key-1 and orders them stably', () => {
    const next = reduceResearchState(state({ openQuestions: ['Zeta open?'] }), {
      claimDecisions: [],
      questions: ['  ZETA   Open? ', 'Alpha open?', 'Alpha open?'],
    });
    expect(next.openQuestions).toEqual(['Alpha open?', 'Zeta open?']);
  });

  it('sorts claim collections by identity for replay stability', () => {
    const next = reduceResearchState(state(), {
      claimDecisions: [
        {
          action: 'verify',
          identityKey: claimB,
          statement: 'second',
          independentSourceCount: 2,
          memoryIds: ['memory-2'],
        },
        {
          action: 'verify',
          identityKey: claimA,
          statement: 'first',
          independentSourceCount: 2,
          memoryIds: ['memory-1'],
        },
      ],
      questions: [],
    });
    expect(next.verifiedClaims.map(({ identityKey }) => identityKey)).toEqual([
      claimA,
      claimB,
    ]);
  });

  it('rejects dual status, sub-threshold verification and missing evidence', () => {
    const invalid = state({
      verifiedClaims: [
        {
          identityKey: claimA,
          statement: 'Water boils at 100 °C.',
          independentSourceCount: 1,
          memoryIds: [],
        },
      ],
      contestedClaims: [
        {
          identityKey: claimA,
          variants: ['only one'],
          memoryIds: ['memory-1'],
        },
      ],
    });
    const codes = researchStateInvariants(invalid, null).map(
      (issueValue) => issueValue.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        'RESEARCH_DUAL_CLAIM_STATUS',
        'RESEARCH_VERIFIED_BELOW_THRESHOLD',
        'RESEARCH_VERIFIED_WITHOUT_EVIDENCE',
        'RESEARCH_CONTESTED_WITHOUT_VARIANTS',
      ]),
    );
  });

  it('rejects duplicate identities, unstable references and blank text', () => {
    const invalid = state({
      verifiedClaims: [
        {
          identityKey: claimA,
          statement: '   ',
          independentSourceCount: 2,
          memoryIds: ['memory-2', 'memory-1'],
        },
        {
          identityKey: claimA,
          statement: 'duplicate identity',
          independentSourceCount: 2,
          memoryIds: ['memory-3'],
        },
      ],
      openQuestions: ['Same question?', '  same   QUESTION? ', '   '],
    });
    const codes = researchStateInvariants(invalid, null).map(
      (issueValue) => issueValue.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        'RESEARCH_DUPLICATE_VERIFIED_CLAIM',
        'RESEARCH_UNSTABLE_MEMORY_REFERENCES',
        'RESEARCH_EMPTY_STATEMENT',
        'RESEARCH_EMPTY_QUESTION',
        'RESEARCH_DUPLICATE_QUESTION',
      ]),
    );
  });

  it('rejects dropped claims and questions against the previous state', () => {
    const previous = state({
      verifiedClaims: [
        {
          identityKey: claimA,
          statement: 'kept',
          independentSourceCount: 2,
          memoryIds: ['memory-1'],
        },
      ],
      contestedClaims: [
        {
          identityKey: claimB,
          variants: ['one', 'two'],
          memoryIds: ['memory-2'],
        },
      ],
      openQuestions: ['Still open?'],
    });
    const codes = researchStateInvariants(state(), previous).map(
      (issueValue) => issueValue.code,
    );
    expect(codes).toEqual([
      'RESEARCH_VERIFIED_CLAIM_DROPPED',
      'RESEARCH_CONTESTED_CLAIM_DROPPED',
      'RESEARCH_QUESTION_DROPPED',
    ]);
  });

  it('rejects a tampered identity policy version or threshold', () => {
    const codes = researchStateInvariants(
      {
        ...state(),
        identityPolicyVersion: 'research-identity-policy/2',
        verificationThreshold: 1,
      } as unknown as ResearchState,
      null,
    ).map((issueValue) => issueValue.code);
    expect(codes).toEqual([
      'RESEARCH_IDENTITY_POLICY_VERSION',
      'RESEARCH_VERIFICATION_THRESHOLD',
    ]);
  });
});
