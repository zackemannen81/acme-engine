import { canonicalJson, sha256, type MemoryCandidate } from '@acme/core';

import {
  NarrativeMemoryValueSchema,
  type NarrativeMemoryValue,
  type NarrativeState,
} from './schemas.js';

export const REFERENCE_TEXT_NORMALIZATION_ALGORITHM =
  'reference-text-normalization-1' as const;
export const NARRATIVE_ENTITY_KEY_ALGORITHM = 'narrative-entity-key-1' as const;

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

export function deriveNarrativeEntityKey(label: string): string {
  const normalizedLabel = normalizeReferenceText(label);
  return `narrative_entity_${sha256(
    canonicalJson({
      algorithm: NARRATIVE_ENTITY_KEY_ALGORITHM,
      normalizedLabel,
    }),
  )}`;
}

export function resolveNarrativeEntity(
  label: string,
  state: NarrativeState,
): {
  readonly normalizedLabel: string;
  readonly entityKey: string;
} {
  const normalizedLabel = normalizeReferenceText(label);
  return Object.freeze({
    normalizedLabel,
    entityKey:
      state.entityAliases[normalizedLabel] ??
      deriveNarrativeEntityKey(normalizedLabel),
  });
}

export function narrativeMemoryIdentity(value: NarrativeMemoryValue): string {
  switch (value.kind) {
    case 'narrative.character-fact':
      return `character:${value.entityKey}:${value.normalizedPredicate}`;
    case 'narrative.relationship':
      return `relationship:${value.subjectEntityKey}:${value.normalizedRelation}:${value.objectEntityKey}`;
    case 'narrative.world-rule':
      return `world-rule:${value.normalizedRule}`;
  }
}

export function narrativeCandidateIdentity(candidate: MemoryCandidate): string {
  return narrativeMemoryIdentity(
    NarrativeMemoryValueSchema.parse(candidate.value),
  );
}
