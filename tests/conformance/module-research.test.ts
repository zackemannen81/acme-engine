import type {
  JsonValue,
  MemoryCandidate,
  ModuleResult,
  StateDelta,
  StateProjectionInput,
} from '../../packages/core/src/index.js';
import { domainModuleConformance } from '../../packages/testing/src/index.js';
import {
  RESEARCH_DELTA_SCHEMA_VERSION,
  RESEARCH_IDENTITY_POLICY_VERSION,
  RESEARCH_MEMORY_SCHEMA_VERSION,
  RESEARCH_STATE_SCHEMA_VERSION,
  RESEARCH_VERIFICATION_THRESHOLD,
  deriveResearchQuestionKey,
  normalizeReferenceText,
  normalizeSourceUri,
  researchEvidenceContentHash,
  researchModule,
  type ResearchContractInput,
  type ResearchDelta,
  type ResearchState,
} from '../../packages/module-research/src/index.js';
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
  researchEntityId,
  researchExecutionId,
  researchNow,
  sourceA,
  sourceB,
  sourceKeyOf,
  supportingOutput,
} from '../../packages/module-research/test/fixtures.js';

const SUPPORTING = 'Water boils at 100 °C at standard atmospheric pressure.';
const QUESTION = 'Does altitude change the measurement?';

const researchContext = readContext();

const expectedContractInput: ResearchContractInput = {
  contractInputVersion: 'research-observe-input/1',
  stateSchemaVersion: RESEARCH_STATE_SCHEMA_VERSION,
  identityPolicyVersion: RESEARCH_IDENTITY_POLICY_VERSION,
  verificationThreshold: RESEARCH_VERIFICATION_THRESHOLD,
  document: {
    documentKey: sourceA.documentKey,
    source: sourceA.source,
    text: sourceA.text,
  },
  sourceKey: sourceKeyOf(sourceA),
  independenceKey: independenceKeyOf(sourceA),
  relevantClaims: [],
  openQuestions: [],
};

function candidateOf(
  key: string,
  kind: string,
  value: unknown,
  confidence: number,
): MemoryCandidate {
  return {
    key,
    kind,
    schemaVersion: RESEARCH_MEMORY_SCHEMA_VERSION,
    value: value as JsonValue,
    confidence,
    source: {
      executionId: researchExecutionId,
      contract: { id: 'research.observe-evidence', version: '1.0.0' },
      documentKeys: [sourceA.documentKey],
    },
  };
}

const expectedMemories: MemoryCandidate[] = [
  candidateOf(
    'research-source-0001',
    'research.source',
    {
      kind: 'research.source',
      sourceKey: sourceKeyOf(sourceA),
      independenceKey: independenceKeyOf(sourceA),
      normalizedUri: normalizeSourceUri(sourceA.source.uri),
      uri: sourceA.source.uri,
      retrievedAt: sourceA.source.retrievedAt,
      publisher: sourceA.source.publisher,
      documentKeys: [sourceA.documentKey],
      independence: sourceA.source.independence,
    },
    1,
  ),
  candidateOf(
    'research-claim-0001',
    'research.claim',
    {
      kind: 'research.claim',
      propositionKey,
      proposition: PROPOSITION,
      normalizedProposition: normalizeReferenceText(PROPOSITION),
      statement: SUPPORTING,
      position: 'supports',
      evidence: [
        evidenceOf(sourceA, {
          sourceLocator: 'paragraph 1',
          evidenceQuote:
            'water boils at 100 °C at standard atmospheric pressure',
        }),
      ],
    },
    0.9,
  ),
  candidateOf(
    'research-question-0001',
    'research.question',
    {
      kind: 'research.question',
      questionKey: deriveResearchQuestionKey(QUESTION),
      normalizedQuestion: normalizeReferenceText(QUESTION),
      question: QUESTION,
      documentKeys: [sourceA.documentKey],
    },
    0.5,
  ),
];

const expectedStateIntent: StateDelta<ResearchDelta> = {
  schemaVersion: RESEARCH_DELTA_SCHEMA_VERSION,
  value: { claimDecisions: [], questions: [QUESTION] },
};

const expectedResult: ModuleResult<ResearchDelta> = {
  documents: [
    {
      key: sourceA.documentKey,
      kind: 'research.evidence',
      schemaVersion: 'research-evidence/1',
      value: {
        documentKey: sourceA.documentKey,
        source: sourceA.source,
        text: sourceA.text,
      } as unknown as JsonValue,
      contentHash: researchEvidenceContentHash({
        documentKey: sourceA.documentKey,
        source: sourceA.source,
        text: sourceA.text,
      }),
    },
  ],
  memories: expectedMemories,
  stateIntent: expectedStateIntent,
  events: [],
  diagnostics: [
    {
      code: 'RESEARCH_EVIDENCE_OBSERVED',
      severity: 'info',
      value: {
        documentKey: sourceA.documentKey,
        sourceKey: sourceKeyOf(sourceA),
        independenceKey: independenceKeyOf(sourceA),
        claimCount: 1,
        questionCount: 1,
      },
    },
  ],
};

// Evidence is stored in ADR-0009 order: independence key first. Beta's
// independence key sorts before Alpha's, so the merge order is not arrival
// order.
const mergedClaim = claimValue(sourceA, {
  statement: SUPPORTING,
  evidence: [
    evidenceOf(sourceB),
    evidenceOf(sourceA, {
      sourceLocator: 'paragraph 1',
      evidenceQuote: 'water boils at 100 °C at standard atmospheric pressure',
    }),
  ],
});

const projectionInput: StateProjectionInput<ResearchDelta> = {
  stateIntent: expectedStateIntent,
  memory: expectedMemories.map((candidate, index) => ({
    candidate,
    identityKey: researchModule.memoryPolicy.identity(candidate),
    resolution:
      candidate.kind === 'research.claim'
        ? {
            candidateKey: candidate.key,
            action: 'merge' as const,
            memoryId: 'memory-claim-1',
            value: mergedClaim as unknown as JsonValue,
            strength: 0.95,
          }
        : {
            candidateKey: candidate.key,
            action: 'create' as const,
            value: candidate.value,
            strength: candidate.confidence ?? 0.5,
          },
    affectedMemoryIds: [
      candidate.kind === 'research.claim'
        ? 'memory-claim-1'
        : `memory-created-${String(index)}`,
    ],
  })),
};

const expectedStateDelta: StateDelta<ResearchDelta> = {
  schemaVersion: RESEARCH_DELTA_SCHEMA_VERSION,
  value: {
    claimDecisions: [
      {
        action: 'verify',
        identityKey: claimIdentityKey,
        statement: SUPPORTING,
        independentSourceCount: 2,
        memoryIds: ['memory-claim-1'],
      },
    ],
    questions: [QUESTION],
  },
};

const conformanceState: ResearchState = {
  identityPolicyVersion: RESEARCH_IDENTITY_POLICY_VERSION,
  verificationThreshold: RESEARCH_VERIFICATION_THRESHOLD,
  verifiedClaims: [],
  contestedClaims: [],
  openQuestions: ['Existing question?'],
};

const conformanceDelta: ResearchDelta = {
  claimDecisions: [
    {
      action: 'verify',
      identityKey: claimIdentityKey,
      statement: SUPPORTING,
      independentSourceCount: 2,
      memoryIds: ['memory-claim-1'],
    },
  ],
  questions: [QUESTION],
};

const expectedReducedState: ResearchState = {
  identityPolicyVersion: RESEARCH_IDENTITY_POLICY_VERSION,
  verificationThreshold: RESEARCH_VERIFICATION_THRESHOLD,
  verifiedClaims: [
    {
      identityKey: claimIdentityKey,
      statement: SUPPORTING,
      independentSourceCount: 2,
      memoryIds: ['memory-claim-1'],
    },
  ],
  contestedClaims: [],
  openQuestions: [QUESTION, 'Existing question?'],
};

const memoryCandidate = expectedMemories[1] as MemoryCandidate;
const existingClaimRecord = memoryRecord(
  'memory-claim-1',
  claimIdentityKey,
  'research.claim',
  claimValue(sourceB, { statement: SUPPORTING }),
  { strength: 0.5 },
);

domainModuleConformance('research module', {
  createSubject: () => ({
    module: researchModule,
    task: {
      taskName: 'observe-evidence' as const,
      input: sourceA,
      invalidInput: { ...sourceA, source: { ...sourceA.source, uri: 'nope' } },
      contractOutput: supportingOutput,
      context: researchContext,
      expectedContractInput,
      expectedResult,
      projectionInput,
      expectedStateDelta,
    },
    state: {
      initialContext: { entityId: researchEntityId, now: researchNow },
      expectedInitialState: emptyResearchState,
      state: conformanceState,
      invalidState: { ...conformanceState, verificationThreshold: 1 },
      delta: conformanceDelta,
      invalidDelta: { claimDecisions: [{ action: 'promote' }], questions: [] },
      expectedReducedState,
      previousState: conformanceState,
      expectedInvariantIssues: [],
    },
    memory: {
      candidate: memoryCandidate,
      expectedValidationIssues: [],
      expectedIdentityKey: claimIdentityKey,
      existing: [existingClaimRecord],
      query: {
        namespace: 'research',
        entityId: researchEntityId,
        task: 'observe-evidence',
        limit: 10,
      },
      expectedRanked: [
        {
          record: existingClaimRecord,
          // active status + task relevance + one independent source
          // + evidence coverage + record strength
          score: 2 + 1 + 1 + 1 / 10 + 0.5,
          reasons: [
            'status:deferred',
            'independent-sources:1',
            'evidence-entries:1',
            'strength',
            'task:observe-evidence',
          ],
        },
      ],
      now: researchNow,
      expectedResolution: {
        candidateKey: 'research-claim-0001',
        action: 'merge',
        memoryId: 'memory-claim-1',
        value: mergedClaim as unknown as JsonValue,
        strength: 0.95,
      },
      lifecycleRecord: existingClaimRecord,
      lifecycleHook: 'maintenance',
      expectedLifecycleDecision: { action: 'retain' },
    },
  }),
});
