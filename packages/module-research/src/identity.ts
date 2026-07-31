import { canonicalJson, sha256, type MemoryCandidate } from '@acme/core';

import {
  ResearchMemoryValueSchema,
  type ResearchMemoryValue,
} from './schemas.js';

export const REFERENCE_TEXT_NORMALIZATION_ALGORITHM =
  'reference-text-normalization-1' as const;
export const RESEARCH_PROPOSITION_KEY_ALGORITHM =
  'research-proposition-key-1' as const;
export const RESEARCH_SOURCE_KEY_ALGORITHM = 'research-source-key-1' as const;
export const RESEARCH_SOURCE_INDEPENDENCE_KEY_ALGORITHM =
  'research-source-independence-key-1' as const;
export const RESEARCH_QUESTION_KEY_ALGORITHM =
  'research-question-key-1' as const;

export function normalizeReferenceText(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/\p{White_Space}+/gu, ' ')
    .toLowerCase();

  if (normalized.length === 0) {
    throw new TypeError('Reference text must not normalize to an empty value.');
  }
  return normalized;
}

/**
 * ADR-0009 URI normalization: lowercase scheme and host, drop the fragment and
 * default port, keep the serialized path and query unchanged, and serialize an
 * empty path as `/`. The URI is never dereferenced.
 */
export function normalizeSourceUri(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError('Research sources require an absolute http(s) URI.');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new TypeError('Research source URIs must not carry credentials.');
  }
  parsed.hash = '';
  const path = parsed.pathname === '' ? '/' : parsed.pathname;
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
}

export function deriveResearchSourceKey(uri: string): string {
  return `research_source_${sha256(
    canonicalJson({
      algorithm: RESEARCH_SOURCE_KEY_ALGORITHM,
      normalizedUri: normalizeSourceUri(uri),
    }),
  )}`;
}

export function deriveResearchSourceIndependenceKey(
  authority: string,
  basis: string,
): string {
  return `research_independence_${sha256(
    canonicalJson({
      algorithm: RESEARCH_SOURCE_INDEPENDENCE_KEY_ALGORITHM,
      authority: normalizeReferenceText(authority),
      basis,
    }),
  )}`;
}

export function deriveResearchPropositionKey(proposition: string): string {
  return `research_proposition_${sha256(
    canonicalJson({
      algorithm: RESEARCH_PROPOSITION_KEY_ALGORITHM,
      normalizedProposition: normalizeReferenceText(proposition),
    }),
  )}`;
}

export function deriveResearchQuestionKey(question: string): string {
  return `research_question_${sha256(
    canonicalJson({
      algorithm: RESEARCH_QUESTION_KEY_ALGORITHM,
      normalizedQuestion: normalizeReferenceText(question),
    }),
  )}`;
}

/**
 * Memory identity. Claims share one identity across `supports` and
 * `contradicts` so contradictory evidence contests the same proposition
 * instead of creating a second record.
 */
export function researchMemoryIdentity(value: ResearchMemoryValue): string {
  switch (value.kind) {
    case 'research.claim':
      return `claim:${value.propositionKey}`;
    case 'research.source':
      return `source:${value.sourceKey}`;
    case 'research.question':
      return `question:${value.questionKey}`;
  }
}

export function researchCandidateIdentity(candidate: MemoryCandidate): string {
  return researchMemoryIdentity(
    ResearchMemoryValueSchema.parse(candidate.value),
  );
}
