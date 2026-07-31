import { computeModelRequestHash } from '@acme/core';
import { describe, expect, it } from 'vitest';

import { researchObserveEvidenceContract } from '../src/contracts/observe-evidence.js';
import {
  researchEvidenceContentHash,
  researchObserveEvidenceTask,
} from '../src/tasks/observe-evidence.js';
import {
  RESEARCH_EVIDENCE_KIND,
  RESEARCH_MEMORY_SCHEMA_VERSION,
  type ResearchContractInput,
} from '../src/schemas.js';
import { reduceResearchState } from '../src/state.js';
import {
  claimIdentityKey,
  claimValue,
  emptyResearchState,
  evidenceOf,
  independenceKeyOf,
  memoryRecord,
  PROPOSITION,
  propositionKey,
  readContext,
  sourceA,
  sourceB,
  researchExecutionId,
  researchNow,
  sourceC,
  sourceKeyOf,
  stateSnapshot,
  supportingOutput,
} from './fixtures.js';

const SUPPORTING = 'Water boils at 100 °C at standard atmospheric pressure.';
const CONTRADICTING = 'Water boils at 93 °C at standard atmospheric pressure.';

async function project(
  context = readContext(),
): Promise<ResearchContractInput> {
  return await researchObserveEvidenceTask.project(sourceA, context);
}

describe('research.observe-evidence projection', () => {
  it('projects immutable configuration facts and the exact supplied source', async () => {
    const input = await project();
    expect(input).toEqual({
      contractInputVersion: 'research-observe-input/1',
      stateSchemaVersion: 'research-state/1',
      identityPolicyVersion: 'research-identity-policy/1',
      verificationThreshold: 2,
      document: {
        documentKey: sourceA.documentKey,
        source: sourceA.source,
        text: sourceA.text,
      },
      sourceKey: sourceKeyOf(sourceA),
      independenceKey: independenceKeyOf(sourceA),
      relevantClaims: [],
      openQuestions: [],
    });
    expect(Object.isFrozen(input)).toBe(true);
  });

  it('summarizes prior claims with their standing and independent-source count', async () => {
    const state = reduceResearchState(emptyResearchState, {
      claimDecisions: [
        {
          action: 'verify',
          identityKey: claimIdentityKey,
          statement: SUPPORTING,
          independentSourceCount: 2,
          memoryIds: ['memory-1'],
        },
      ],
      questions: ['Does altitude change the measurement?'],
    });
    const input = await project(
      readContext({
        state: stateSnapshot(state),
        memories: [
          memoryRecord(
            'memory-1',
            claimIdentityKey,
            'research.claim',
            claimValue(sourceA, {
              statement: SUPPORTING,
              evidence: [evidenceOf(sourceA), evidenceOf(sourceB)],
            }),
          ),
        ],
      }),
    );

    expect(input.relevantClaims).toEqual([
      {
        identityKey: claimIdentityKey,
        proposition: PROPOSITION,
        status: 'verified',
        independentSourceCount: 2,
        statements: [SUPPORTING],
      },
    ]);
    expect(input.openQuestions).toEqual([
      'Does altitude change the measurement?',
    ]);
  });

  it('rejects a foreign state snapshot before any effect', async () => {
    await expect(
      project(
        readContext({
          state: {
            ...stateSnapshot(emptyResearchState),
            namespace: 'narrative',
          },
        }),
      ),
    ).rejects.toMatchObject({
      data: { code: 'DOMAIN_INVALID_RESULT', stage: 'loading' },
    });
  });
});

describe('research.observe-evidence contract', () => {
  it('builds a stable request with a golden request hash', async () => {
    const input = await project();
    const buildContext = {
      executionId: researchExecutionId,
      now: researchNow,
    };
    const request = researchObserveEvidenceContract.buildRequest(
      input,
      buildContext,
    );

    expect(request.temperature).toBe(0);
    expect(request.output.schemaName).toBe('research_observe_evidence_1_0_0');
    expect(researchObserveEvidenceContract.retention).toBe('hash-only');
    expect(researchObserveEvidenceContract.requiredCapabilities).toEqual({
      structuredOutput: true,
    });
    expect(computeModelRequestHash(request)).toBe(
      computeModelRequestHash(
        researchObserveEvidenceContract.buildRequest(
          await project(),
          buildContext,
        ),
      ),
    );
    // Pinned golden. A change here means the prompt, schema or projected
    // contract input moved and needs a contract version decision.
    expect(computeModelRequestHash(request)).toBe(
      '00b4033275abc0a9f05c88b1838b7d6e2131df85e139a6c7864d305da9a3523c',
    );
  });

  it('rejects quotes absent from the supplied evidence', async () => {
    const input = await project();
    const issues = researchObserveEvidenceContract.validateSemantics(
      {
        claims: [
          {
            proposition: PROPOSITION,
            statement: SUPPORTING,
            position: 'supports',
            evidenceQuote: 'a sentence that is not in the source',
            confidence: 0.9,
          },
        ],
        openQuestions: [],
      },
      input,
    );
    expect(issues.map(({ code }) => code)).toEqual([
      'RESEARCH_QUOTE_NOT_FOUND',
    ]);
  });

  it('rejects duplicate claims and duplicate questions', async () => {
    const input = await project();
    const claim = {
      proposition: PROPOSITION,
      statement: SUPPORTING,
      position: 'supports' as const,
      sourceLocator: 'paragraph 1',
      confidence: 0.9,
    };
    const issues = researchObserveEvidenceContract.validateSemantics(
      {
        claims: [claim, { ...claim, confidence: 0.4 }],
        openQuestions: ['Same question?', '  SAME   question? '],
      },
      input,
    );
    expect(issues.map(({ code }) => code)).toEqual([
      'RESEARCH_DUPLICATE_CLAIM',
      'RESEARCH_DUPLICATE_QUESTION',
    ]);
  });

  it('accepts supporting and contradicting evidence for one proposition', async () => {
    const input = await project();
    expect(
      researchObserveEvidenceContract.validateSemantics(
        {
          claims: [
            {
              proposition: PROPOSITION,
              statement: SUPPORTING,
              position: 'supports',
              confidence: 0.9,
            },
            {
              proposition: PROPOSITION,
              statement: CONTRADICTING,
              position: 'contradicts',
              confidence: 0.8,
            },
          ],
          openQuestions: [],
        },
        input,
      ),
    ).toEqual([]);
  });
});

describe('research.observe-evidence interpretation', () => {
  it('produces the exact evidence document, source, claim and question candidates', async () => {
    const context = readContext();
    const result = await researchObserveEvidenceTask.interpret(
      supportingOutput,
      sourceA,
      context,
    );

    expect(result.documents).toEqual([
      {
        key: sourceA.documentKey,
        kind: RESEARCH_EVIDENCE_KIND,
        schemaVersion: 'research-evidence/1',
        value: {
          documentKey: sourceA.documentKey,
          source: sourceA.source,
          text: sourceA.text,
        },
        contentHash: researchEvidenceContentHash({
          documentKey: sourceA.documentKey,
          source: sourceA.source,
          text: sourceA.text,
        }),
      },
    ]);
    expect(result.memories.map(({ key, kind }) => ({ key, kind }))).toEqual([
      { key: 'research-source-0001', kind: 'research.source' },
      { key: 'research-claim-0001', kind: 'research.claim' },
      { key: 'research-question-0001', kind: 'research.question' },
    ]);

    const claim = result.memories[1];
    expect(claim?.schemaVersion).toBe(RESEARCH_MEMORY_SCHEMA_VERSION);
    expect(claim?.value).toMatchObject({
      propositionKey,
      position: 'supports',
      evidence: [
        {
          sourceKey: sourceKeyOf(sourceA),
          independenceKey: independenceKeyOf(sourceA),
          documentKey: sourceA.documentKey,
          uri: sourceA.source.uri,
          retrievedAt: sourceA.source.retrievedAt,
          publisher: sourceA.source.publisher,
          sourceLocator: 'paragraph 1',
        },
      ],
    });
    expect(claim?.source).toEqual({
      executionId: context.executionId,
      contract: { id: 'research.observe-evidence', version: '1.0.0' },
      documentKeys: [sourceA.documentKey],
    });
    expect(result.events).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('never asserts a claim decision during interpretation', async () => {
    const result = await researchObserveEvidenceTask.interpret(
      supportingOutput,
      sourceA,
      readContext(),
    );
    expect(result.stateIntent?.value.claimDecisions).toEqual([]);
    expect(result.stateIntent?.value.questions).toEqual([
      'Does altitude change the measurement?',
    ]);
  });

  it('is deterministic for the same evidence and context', async () => {
    const first = await researchObserveEvidenceTask.interpret(
      supportingOutput,
      sourceA,
      readContext(),
    );
    const second = await researchObserveEvidenceTask.interpret(
      supportingOutput,
      sourceA,
      readContext(),
    );
    expect(first).toEqual(second);
  });
});

describe('research.observe-evidence post-memory state projection', () => {
  const claimCandidate = {
    key: 'research-claim-0001',
    kind: 'research.claim',
    schemaVersion: RESEARCH_MEMORY_SCHEMA_VERSION,
    confidence: 0.9,
    source: {
      executionId: 'execution-research-1',
      contract: { id: 'research.observe-evidence', version: '1.0.0' },
      documentKeys: [sourceB.documentKey],
    },
  } as const;

  it('defers a claim backed by a single independence key', () => {
    const value = claimValue(sourceA, { statement: SUPPORTING });
    const delta = researchObserveEvidenceTask.projectState(
      {
        stateIntent: {
          schemaVersion: 'research-delta/1',
          value: { claimDecisions: [], questions: [] },
        },
        memory: [
          {
            candidate: { ...claimCandidate, value } as never,
            identityKey: claimIdentityKey,
            resolution: {
              candidateKey: 'research-claim-0001',
              action: 'create',
              value: value as never,
              strength: 0.9,
            },
            affectedMemoryIds: ['memory-1'],
          },
        ],
      },
      readContext(),
    );

    expect(delta?.value.claimDecisions).toEqual([
      { action: 'defer', identityKey: claimIdentityKey },
    ]);
  });

  it('verifies once two independent sources back the same proposition', () => {
    const merged = claimValue(sourceA, {
      statement: SUPPORTING,
      evidence: [evidenceOf(sourceA), evidenceOf(sourceB)],
    });
    const delta = researchObserveEvidenceTask.projectState(
      {
        stateIntent: {
          schemaVersion: 'research-delta/1',
          value: { claimDecisions: [], questions: [] },
        },
        memory: [
          {
            candidate: {
              ...claimCandidate,
              value: claimValue(sourceB, { statement: SUPPORTING }),
            } as never,
            identityKey: claimIdentityKey,
            resolution: {
              candidateKey: 'research-claim-0001',
              action: 'merge',
              memoryId: 'memory-1',
              value: merged as never,
              strength: 0.95,
            },
            affectedMemoryIds: ['memory-1'],
          },
        ],
      },
      readContext(),
    );

    expect(delta?.value.claimDecisions).toEqual([
      {
        action: 'verify',
        identityKey: claimIdentityKey,
        statement: SUPPORTING,
        independentSourceCount: 2,
        memoryIds: ['memory-1'],
      },
    ]);
  });

  it('contests the claim and keeps both variants when evidence contradicts', () => {
    const contradicting = claimValue(sourceC, {
      statement: CONTRADICTING,
      position: 'contradicts',
    });
    const delta = researchObserveEvidenceTask.projectState(
      {
        stateIntent: {
          schemaVersion: 'research-delta/1',
          value: { claimDecisions: [], questions: [] },
        },
        memory: [
          {
            candidate: { ...claimCandidate, value: contradicting } as never,
            identityKey: claimIdentityKey,
            resolution: {
              candidateKey: 'research-claim-0001',
              action: 'contradict',
              memoryIds: ['memory-1'],
              disposition: 'contest',
            },
            affectedMemoryIds: ['memory-1'],
          },
        ],
      },
      readContext({
        memories: [
          memoryRecord(
            'memory-1',
            claimIdentityKey,
            'research.claim',
            claimValue(sourceA, {
              statement: SUPPORTING,
              evidence: [evidenceOf(sourceA), evidenceOf(sourceB)],
            }),
          ),
        ],
      }),
    );

    expect(delta?.value.claimDecisions).toEqual([
      {
        action: 'contest',
        identityKey: claimIdentityKey,
        variants: [CONTRADICTING, SUPPORTING].sort(),
        memoryIds: ['memory-1'],
      },
    ]);
  });

  it('rejects a candidate whose identity does not match its prepared decision', () => {
    expect(() =>
      researchObserveEvidenceTask.projectState(
        {
          stateIntent: {
            schemaVersion: 'research-delta/1',
            value: { claimDecisions: [], questions: [] },
          },
          memory: [
            {
              candidate: {
                ...claimCandidate,
                value: claimValue(sourceA, { statement: SUPPORTING }),
              } as never,
              identityKey: 'claim:research_proposition_other',
              resolution: {
                candidateKey: 'research-claim-0001',
                action: 'create',
                value: claimValue(sourceA, { statement: SUPPORTING }) as never,
                strength: 0.9,
              },
              affectedMemoryIds: ['memory-1'],
            },
          ],
        },
        readContext(),
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'DOMAIN_INVALID_RESULT' }),
      }),
    );
  });

  it('returns undefined without a state intent', () => {
    expect(
      researchObserveEvidenceTask.projectState({ memory: [] }, readContext()),
    ).toBeUndefined();
  });

  it('produces a delta the reducer accepts end to end', () => {
    const merged = claimValue(sourceA, {
      statement: SUPPORTING,
      evidence: [evidenceOf(sourceA), evidenceOf(sourceB)],
    });
    const delta = researchObserveEvidenceTask.projectState(
      {
        stateIntent: {
          schemaVersion: 'research-delta/1',
          value: { claimDecisions: [], questions: ['Still open?'] },
        },
        memory: [
          {
            candidate: {
              ...claimCandidate,
              value: claimValue(sourceB, { statement: SUPPORTING }),
            } as never,
            identityKey: claimIdentityKey,
            resolution: {
              candidateKey: 'research-claim-0001',
              action: 'merge',
              memoryId: 'memory-1',
              value: merged as never,
              strength: 0.95,
            },
            affectedMemoryIds: ['memory-1'],
          },
        ],
      },
      readContext(),
    );
    expect(delta).toBeDefined();
    const next = reduceResearchState(
      emptyResearchState,
      delta?.value ?? { claimDecisions: [], questions: [] },
    );
    expect(next.verifiedClaims).toEqual([
      {
        identityKey: claimIdentityKey,
        statement: SUPPORTING,
        independentSourceCount: 2,
        memoryIds: ['memory-1'],
      },
    ]);
    expect(next.openQuestions).toEqual(['Still open?']);
  });
});
