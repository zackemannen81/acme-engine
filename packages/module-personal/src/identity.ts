import { canonicalJson, sha256 } from '@acme/core';

import { PERSONAL_IDENTITY_POLICY_VERSION } from './schemas.js';

/**
 * Personal memory is spoken, not filed. "my home city", "My Home City" and
 * "  my  home city " are the same attribute, so normalization is part of
 * identity rather than a display concern.
 *
 * Deliberately conservative: case folding, whitespace collapse, trim. No
 * stemming, no synonyms, no language awareness. Anything cleverer would merge
 * two things a person meant to keep apart, and a silent merge is one they
 * cannot audit.
 */
export function normalizePersonalText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function digest(parts: readonly string[]): string {
  return sha256(canonicalJson([PERSONAL_IDENTITY_POLICY_VERSION, ...parts]));
}

/**
 * One thing a person can have an answer to: kind + subject + attribute. The
 * key is an opaque digest so a revocation can name a slot without naming it.
 */
export function derivePersonalSlotKey(
  claimKind: string,
  normalizedSubject: string,
  normalizedAttribute: string,
): string {
  return `slot_${digest([claimKind, normalizedSubject, normalizedAttribute])}`;
}

/** One specific answer in a slot. The same answer twice is one record. */
export function derivePersonalAssertionKey(
  slotKey: string,
  normalizedValue: string,
): string {
  return `assertion_${digest([slotKey, normalizedValue])}`;
}
