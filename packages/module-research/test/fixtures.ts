import type { ExecutionReadContext, MemoryRecord } from '@acme/core';

import {
  deriveResearchPropositionKey,
  deriveResearchQuestionKey,
  deriveResearchSourceIndependenceKey,
  deriveResearchSourceKey,
  normalizeReferenceText,
  normalizeSourceUri,
} from '../src/identity.js';
import {
  RESEARCH_MEMORY_SCHEMA_VERSION,
  RESEARCH_NAMESPACE,
  type ResearchClaimEvidence,
  type ResearchClaimMemoryValue,
  type ResearchContractOutput,
  type ResearchEvidenceInput,
  type ResearchState,
} from '../src/schemas.js';
import { initialResearchState } from '../src/state.js';

export const researchNow = '2026-07-31T09:00:00.000Z';
export const researchEntityId = 'research-topic-1';
export const researchExecutionId = 'execution-research-1';

export const PROPOSITION =
  'Water boils at 100 °C at standard atmospheric pressure.';
export const propositionKey = deriveResearchPropositionKey(PROPOSITION);
export const claimIdentityKey = `claim:${propositionKey}`;

/**
 * Three hand-written sources. Nothing here is fetched, captured or derived
 * from the network; the URIs are illustrative and never dereferenced.
 */
export const sourceA: ResearchEvidenceInput = {
  documentKey: 'research-document-a',
  source: {
    uri: 'https://alpha.example.org/reports/boiling?id=1',
    title: 'Alpha boiling-point report',
    retrievedAt: '2026-07-30T08:00:00.000Z',
    publisher: 'Alpha Institute Press',
    independence: { authority: 'Alpha Institute', basis: 'publisher' },
  },
  text: 'Alpha measured that water boils at 100 °C at standard atmospheric pressure.',
};

/** Same declared authority as A, different document and URI. */
export const sourceADuplicateAuthority: ResearchEvidenceInput = {
  documentKey: 'research-document-a2',
  source: {
    uri: 'https://alpha.example.org/reports/boiling?id=2',
    retrievedAt: '2026-07-30T09:00:00.000Z',
    publisher: 'Alpha Institute Press',
    independence: { authority: 'Alpha Institute', basis: 'publisher' },
  },
  text: 'Alpha restated that water boils at 100 °C at standard atmospheric pressure.',
};

/** Genuinely independent corroboration. */
export const sourceB: ResearchEvidenceInput = {
  documentKey: 'research-document-b',
  source: {
    uri: 'https://beta.example.net/notes/boiling',
    retrievedAt: '2026-07-30T10:00:00.000Z',
    publisher: 'Beta Journal',
    independence: { authority: 'Beta Journal', basis: 'publisher' },
  },
  text: 'Beta confirmed that water boils at 100 °C at standard atmospheric pressure.',
};

/** Independent contradiction. */
export const sourceC: ResearchEvidenceInput = {
  documentKey: 'research-document-c',
  source: {
    uri: 'https://gamma.example.com/review/boiling',
    retrievedAt: '2026-07-30T11:00:00.000Z',
    publisher: 'Gamma Review',
    independence: { authority: 'Gamma Review', basis: 'editorial-group' },
  },
  text: 'Gamma reported that water boils at 93 °C at standard atmospheric pressure.',
};

export function sourceKeyOf(input: ResearchEvidenceInput): string {
  return deriveResearchSourceKey(input.source.uri);
}

export function independenceKeyOf(input: ResearchEvidenceInput): string {
  return deriveResearchSourceIndependenceKey(
    input.source.independence.authority,
    input.source.independence.basis,
  );
}

export function evidenceOf(
  input: ResearchEvidenceInput,
  overrides: Partial<ResearchClaimEvidence> = {},
): ResearchClaimEvidence {
  return {
    sourceKey: sourceKeyOf(input),
    independenceKey: independenceKeyOf(input),
    documentKey: input.documentKey,
    uri: input.source.uri,
    retrievedAt: input.source.retrievedAt,
    ...(input.source.publisher === undefined
      ? {}
      : { publisher: input.source.publisher }),
    ...overrides,
  };
}

export function claimValue(
  input: ResearchEvidenceInput,
  options: {
    readonly statement: string;
    readonly position?: 'supports' | 'contradicts';
    readonly evidence?: readonly ResearchClaimEvidence[];
  },
): ResearchClaimMemoryValue {
  return {
    kind: 'research.claim',
    propositionKey,
    proposition: PROPOSITION,
    normalizedProposition: normalizeReferenceText(PROPOSITION),
    statement: options.statement,
    position: options.position ?? 'supports',
    evidence: [...(options.evidence ?? [evidenceOf(input)])],
  };
}

export function memoryRecord(
  memoryId: string,
  identityKey: string,
  kind: string,
  value: unknown,
  overrides: Partial<MemoryRecord> = {},
): MemoryRecord {
  return {
    memoryId,
    namespace: RESEARCH_NAMESPACE,
    entityId: researchEntityId,
    identityKey,
    kind,
    schemaVersion: RESEARCH_MEMORY_SCHEMA_VERSION,
    value: value as MemoryRecord['value'],
    strength: 0.6,
    status: 'active',
    firstSeenAt: researchNow,
    lastSeenAt: researchNow,
    lastReinforcedAt: researchNow,
    provenance: [],
    recordVersion: 1,
    ...overrides,
  };
}

export function readContext(
  overrides: Partial<ExecutionReadContext<ResearchState>> = {},
): ExecutionReadContext<ResearchState> {
  return {
    executionId: researchExecutionId,
    entityId: researchEntityId,
    now: researchNow,
    state: null,
    memories: [],
    documents: [],
    ...overrides,
  };
}

export function stateSnapshot(value: ResearchState, revision = 1) {
  return {
    entityId: researchEntityId,
    namespace: RESEARCH_NAMESPACE,
    schemaVersion: 'research-state/1' as const,
    revision,
    value,
    valueHash: `hash-${String(revision)}`,
    createdAt: researchNow,
    executionId: researchExecutionId,
  };
}

export const emptyResearchState = initialResearchState();

export const supportingOutput: ResearchContractOutput = {
  claims: [
    {
      proposition: PROPOSITION,
      statement: 'Water boils at 100 °C at standard atmospheric pressure.',
      position: 'supports',
      evidenceQuote: 'water boils at 100 °C at standard atmospheric pressure',
      sourceLocator: 'paragraph 1',
      confidence: 0.9,
    },
  ],
  openQuestions: ['Does altitude change the measurement?'],
};

export const contradictingOutput: ResearchContractOutput = {
  claims: [
    {
      proposition: PROPOSITION,
      statement: 'Water boils at 93 °C at standard atmospheric pressure.',
      position: 'contradicts',
      evidenceQuote: 'water boils at 93 °C at standard atmospheric pressure',
      confidence: 0.8,
    },
  ],
  openQuestions: [],
};

export const questionKeyOf = deriveResearchQuestionKey;
export const normalizedUriOf = normalizeSourceUri;
