import {
  AcmeError,
  canonicalJson,
  defineTask,
  sha256,
  type ExecutionReadContext,
  type JsonValue,
  type MemoryCandidate,
  type ModuleResult,
  type StateDelta,
  type StateProjectionInput,
} from '@acme/core';

import { RESEARCH_OBSERVE_EVIDENCE_CONTRACT_REF } from '../contracts/observe-evidence.js';
import {
  deriveResearchPropositionKey,
  deriveResearchQuestionKey,
  deriveResearchSourceIndependenceKey,
  deriveResearchSourceKey,
  normalizeReferenceText,
  normalizeSourceUri,
  researchMemoryIdentity,
} from '../identity.js';
import { immutableJson } from '../immutable.js';
import { independentSourceCount, mergeEvidence } from '../memory-policy.js';
import {
  RESEARCH_CONTRACT_INPUT_VERSION,
  RESEARCH_DELTA_SCHEMA_VERSION,
  RESEARCH_EVIDENCE_KIND,
  RESEARCH_EVIDENCE_SCHEMA_VERSION,
  RESEARCH_IDENTITY_POLICY_VERSION,
  RESEARCH_MEMORY_SCHEMA_VERSION,
  RESEARCH_NAMESPACE,
  RESEARCH_STATE_SCHEMA_VERSION,
  RESEARCH_VERIFICATION_THRESHOLD,
  ResearchContractOutputSchema,
  ResearchDeltaSchema,
  ResearchEvidenceDocumentSchema,
  ResearchEvidenceInputSchema,
  ResearchMemoryValueSchema,
  ResearchStateSchema,
  type ResearchClaimDecision,
  type ResearchClaimEvidence,
  type ResearchClaimMemoryValue,
  type ResearchContractInput,
  type ResearchContractOutput,
  type ResearchDelta,
  type ResearchEvidenceInput,
  type ResearchMemoryValue,
  type ResearchState,
} from '../schemas.js';
import { initialResearchState } from '../state.js';

function evidenceDocument(input: ResearchEvidenceInput) {
  return ResearchEvidenceDocumentSchema.parse({
    documentKey: input.documentKey,
    source: input.source,
    text: input.text,
  });
}

export function researchEvidenceContentHash(value: unknown): string {
  return sha256(canonicalJson(value as JsonValue));
}

function readState(
  context: ExecutionReadContext<ResearchState>,
): ResearchState {
  if (context.state === null) {
    return initialResearchState();
  }
  if (
    context.state.namespace !== RESEARCH_NAMESPACE ||
    context.state.entityId !== context.entityId ||
    context.state.schemaVersion !== RESEARCH_STATE_SCHEMA_VERSION
  ) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: 'Research read context contains a foreign state snapshot.',
      stage: 'loading',
      retryable: false,
    });
  }
  return ResearchStateSchema.parse(context.state.value);
}

function claimRecords(context: ExecutionReadContext<ResearchState>): readonly {
  readonly memoryId: string;
  readonly identityKey: string;
  readonly status: string;
  readonly value: ResearchClaimMemoryValue;
}[] {
  return context.memories
    .flatMap((record) => {
      if (
        record.namespace !== RESEARCH_NAMESPACE ||
        record.entityId !== context.entityId ||
        (record.status !== 'active' && record.status !== 'contested') ||
        record.schemaVersion !== RESEARCH_MEMORY_SCHEMA_VERSION
      ) {
        return [];
      }
      const parsed = ResearchMemoryValueSchema.safeParse(record.value);
      return parsed.success && parsed.data.kind === 'research.claim'
        ? [
            {
              memoryId: record.memoryId,
              identityKey: record.identityKey,
              status: record.status,
              value: parsed.data,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.identityKey.localeCompare(right.identityKey) ||
        left.memoryId.localeCompare(right.memoryId),
    );
}

function projectedClaims(
  context: ExecutionReadContext<ResearchState>,
  state: ResearchState,
): ResearchContractInput['relevantClaims'] {
  const verified = new Set(
    state.verifiedClaims.map(({ identityKey }) => identityKey),
  );
  const contested = new Set(
    state.contestedClaims.map(({ identityKey }) => identityKey),
  );
  const byIdentity = new Map<
    string,
    {
      readonly identityKey: string;
      readonly proposition: string;
      readonly statements: string[];
      readonly independenceKeys: Set<string>;
      contested: boolean;
    }
  >();

  for (const claim of claimRecords(context)) {
    const entry = byIdentity.get(claim.identityKey) ?? {
      identityKey: claim.identityKey,
      proposition: claim.value.proposition,
      statements: [],
      independenceKeys: new Set<string>(),
      contested: false,
    };
    entry.statements.push(claim.value.statement);
    for (const evidence of claim.value.evidence) {
      entry.independenceKeys.add(evidence.independenceKey);
    }
    entry.contested = entry.contested || claim.status === 'contested';
    byIdentity.set(claim.identityKey, entry);
  }

  return [...byIdentity.values()]
    .map((entry) => ({
      identityKey: entry.identityKey,
      proposition: entry.proposition,
      status: (contested.has(entry.identityKey) || entry.contested
        ? 'contested'
        : verified.has(entry.identityKey)
          ? 'verified'
          : 'deferred') as 'verified' | 'contested' | 'deferred',
      independentSourceCount: entry.independenceKeys.size,
      statements: [...new Set(entry.statements)].sort(),
    }))
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey));
}

function candidate(
  key: string,
  value: ResearchMemoryValue,
  confidence: number,
  input: ResearchEvidenceInput,
  context: ExecutionReadContext<ResearchState>,
): MemoryCandidate {
  return immutableJson({
    key,
    kind: value.kind,
    schemaVersion: RESEARCH_MEMORY_SCHEMA_VERSION,
    value: value as unknown as JsonValue,
    confidence,
    source: {
      executionId: context.executionId,
      contract: RESEARCH_OBSERVE_EVIDENCE_CONTRACT_REF,
      documentKeys: [input.documentKey],
    },
  });
}

function claimEvidence(
  input: ResearchEvidenceInput,
  sourceKey: string,
  independenceKey: string,
  locator: string | undefined,
  quote: string | undefined,
): ResearchClaimEvidence {
  return {
    sourceKey,
    independenceKey,
    documentKey: input.documentKey,
    uri: input.source.uri,
    retrievedAt: input.source.retrievedAt,
    ...(input.source.publisher === undefined
      ? {}
      : { publisher: input.source.publisher }),
    ...(locator === undefined ? {} : { sourceLocator: locator }),
    ...(quote === undefined ? {} : { evidenceQuote: quote }),
  };
}

function interpretOutput(
  output: ResearchContractOutput,
  input: ResearchEvidenceInput,
  context: ExecutionReadContext<ResearchState>,
): ModuleResult<ResearchDelta> {
  const validatedInput = ResearchEvidenceInputSchema.parse(input);
  const validatedOutput = ResearchContractOutputSchema.parse(output);
  // Reading state validates scope; it also proves the module never needs the
  // wall clock, randomness or the network to interpret evidence.
  readState(context);

  const document = evidenceDocument(validatedInput);
  const sourceKey = deriveResearchSourceKey(validatedInput.source.uri);
  const independenceKey = deriveResearchSourceIndependenceKey(
    validatedInput.source.independence.authority,
    validatedInput.source.independence.basis,
  );

  const memories: MemoryCandidate[] = [
    candidate(
      'research-source-0001',
      {
        kind: 'research.source',
        sourceKey,
        independenceKey,
        normalizedUri: normalizeSourceUri(validatedInput.source.uri),
        uri: validatedInput.source.uri,
        retrievedAt: validatedInput.source.retrievedAt,
        ...(validatedInput.source.publisher === undefined
          ? {}
          : { publisher: validatedInput.source.publisher }),
        documentKeys: [validatedInput.documentKey],
        independence: validatedInput.source.independence,
      },
      1,
      validatedInput,
      context,
    ),
  ];

  validatedOutput.claims.forEach((claim, index) => {
    memories.push(
      candidate(
        `research-claim-${String(index + 1).padStart(4, '0')}`,
        {
          kind: 'research.claim',
          propositionKey: deriveResearchPropositionKey(claim.proposition),
          proposition: claim.proposition,
          normalizedProposition: normalizeReferenceText(claim.proposition),
          statement: claim.statement,
          position: claim.position,
          evidence: [
            claimEvidence(
              validatedInput,
              sourceKey,
              independenceKey,
              claim.sourceLocator,
              claim.evidenceQuote,
            ),
          ],
        },
        claim.confidence,
        validatedInput,
        context,
      ),
    );
  });

  validatedOutput.openQuestions.forEach((question, index) => {
    memories.push(
      candidate(
        `research-question-${String(index + 1).padStart(4, '0')}`,
        {
          kind: 'research.question',
          questionKey: deriveResearchQuestionKey(question),
          normalizedQuestion: normalizeReferenceText(question),
          question,
          documentKeys: [validatedInput.documentKey],
        },
        0.5,
        validatedInput,
        context,
      ),
    );
  });

  return immutableJson({
    documents: [
      {
        key: validatedInput.documentKey,
        kind: RESEARCH_EVIDENCE_KIND,
        schemaVersion: RESEARCH_EVIDENCE_SCHEMA_VERSION,
        value: document as unknown as JsonValue,
        contentHash: researchEvidenceContentHash(document),
      },
    ],
    memories,
    stateIntent: {
      schemaVersion: RESEARCH_DELTA_SCHEMA_VERSION,
      value: {
        // Claim standing is never asserted by interpretation. It is derived
        // post-memory from applied decisions in projectState().
        claimDecisions: [],
        questions: validatedOutput.openQuestions,
      },
    },
    events: [],
    diagnostics: [
      {
        code: 'RESEARCH_EVIDENCE_OBSERVED',
        severity: 'info',
        value: {
          documentKey: validatedInput.documentKey,
          sourceKey,
          independenceKey,
          claimCount: validatedOutput.claims.length,
          questionCount: validatedOutput.openQuestions.length,
        },
      },
    ],
  });
}

interface ClaimProjection {
  readonly identityKey: string;
  readonly statements: Set<string>;
  /** `position: statement`, used when two positions share one wording. */
  readonly positionedStatements: Set<string>;
  readonly memoryIds: Set<string>;
  readonly evidence: ResearchClaimEvidence[];
  contested: boolean;
}

function claimProjection(
  projections: Map<string, ClaimProjection>,
  identityKey: string,
): ClaimProjection {
  const existing = projections.get(identityKey);
  if (existing !== undefined) {
    return existing;
  }
  const created: ClaimProjection = {
    identityKey,
    statements: new Set<string>(),
    positionedStatements: new Set<string>(),
    memoryIds: new Set<string>(),
    evidence: [],
    contested: false,
  };
  projections.set(identityKey, created);
  return created;
}

function projectResearchState(
  input: StateProjectionInput<ResearchDelta>,
  context: ExecutionReadContext<ResearchState>,
): StateDelta<ResearchDelta> | undefined {
  if (input.stateIntent === undefined) {
    return undefined;
  }
  const direct = ResearchDeltaSchema.parse(input.stateIntent.value);
  const projections = new Map<string, ClaimProjection>();

  // Prior records supply the statements and evidence a contradiction contests.
  for (const record of claimRecords(context)) {
    const projection = claimProjection(projections, record.identityKey);
    projection.statements.add(record.value.statement);
    projection.positionedStatements.add(
      `${record.value.position}: ${record.value.statement}`,
    );
    projection.memoryIds.add(record.memoryId);
    projection.evidence.push(...record.value.evidence);
    projection.contested =
      projection.contested || record.status === 'contested';
  }

  for (const decision of input.memory) {
    if (decision.candidate.schemaVersion !== RESEARCH_MEMORY_SCHEMA_VERSION) {
      throw new AcmeError({
        code: 'DOMAIN_INVALID_RESULT',
        message: 'Research state projection received an invalid candidate.',
        stage: 'preparing-commit',
        retryable: false,
      });
    }
    const value = ResearchMemoryValueSchema.parse(decision.candidate.value);
    if (
      decision.candidate.kind !== value.kind ||
      decision.identityKey !== researchMemoryIdentity(value)
    ) {
      throw new AcmeError({
        code: 'DOMAIN_INVALID_RESULT',
        message:
          'Research state projection candidate identity does not match its prepared decision.',
        stage: 'preparing-commit',
        retryable: false,
      });
    }
    if (value.kind !== 'research.claim') {
      continue;
    }

    const projection = claimProjection(projections, decision.identityKey);
    projection.statements.add(value.statement);
    projection.positionedStatements.add(
      `${value.position}: ${value.statement}`,
    );
    for (const memoryId of decision.affectedMemoryIds) {
      projection.memoryIds.add(memoryId);
    }
    if (decision.resolution.action === 'contradict') {
      projection.contested = true;
      projection.evidence.push(...value.evidence);
      continue;
    }
    if (
      decision.resolution.action === 'create' ||
      decision.resolution.action === 'merge'
    ) {
      const applied = ResearchMemoryValueSchema.parse(
        decision.resolution.value,
      );
      if (applied.kind === 'research.claim') {
        projection.evidence.push(...applied.evidence);
      }
      continue;
    }
    projection.evidence.push(...value.evidence);
  }

  const claimDecisions: ResearchClaimDecision[] = [...projections.values()]
    .map((projection): ResearchClaimDecision => {
      const memoryIds = [...projection.memoryIds].sort();
      const statements = [...projection.statements].sort();
      if (projection.contested) {
        return {
          action: 'contest',
          identityKey: projection.identityKey,
          // Every distinct wording is preserved, including the one the
          // contradiction displaced. When two opposed positions share one
          // wording, the position qualifies the variant so the contest is
          // still legible.
          variants:
            statements.length >= 2
              ? statements
              : [...projection.positionedStatements].sort(),
          memoryIds,
        };
      }
      const sources = independentSourceCount(
        mergeEvidence([], projection.evidence),
      );
      const statement = statements[0];
      if (
        sources >= RESEARCH_VERIFICATION_THRESHOLD &&
        memoryIds.length > 0 &&
        statement !== undefined
      ) {
        return {
          action: 'verify',
          identityKey: projection.identityKey,
          statement,
          independentSourceCount: sources,
          memoryIds,
        };
      }
      return { action: 'defer', identityKey: projection.identityKey };
    })
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey));

  return immutableJson({
    schemaVersion: RESEARCH_DELTA_SCHEMA_VERSION,
    value: {
      ...direct,
      claimDecisions,
    },
  });
}

export const researchObserveEvidenceTask = defineTask<
  ResearchEvidenceInput,
  ResearchContractInput,
  ResearchContractOutput,
  ResearchState,
  ResearchDelta
>({
  role: 'analyzer',
  inputSchema: ResearchEvidenceInputSchema,
  contract: RESEARCH_OBSERVE_EVIDENCE_CONTRACT_REF,

  project(input, context) {
    const validated = ResearchEvidenceInputSchema.parse(input);
    const state = readState(context);
    return immutableJson({
      contractInputVersion: RESEARCH_CONTRACT_INPUT_VERSION,
      stateSchemaVersion: RESEARCH_STATE_SCHEMA_VERSION,
      identityPolicyVersion: RESEARCH_IDENTITY_POLICY_VERSION,
      verificationThreshold: RESEARCH_VERIFICATION_THRESHOLD,
      document: evidenceDocument(validated),
      sourceKey: deriveResearchSourceKey(validated.source.uri),
      independenceKey: deriveResearchSourceIndependenceKey(
        validated.source.independence.authority,
        validated.source.independence.basis,
      ),
      relevantClaims: projectedClaims(context, state),
      openQuestions: state.openQuestions,
    });
  },

  interpret(output, input, context) {
    return interpretOutput(output, input, context);
  },

  projectState(input, context) {
    return projectResearchState(input, context);
  },
});
