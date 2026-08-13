import { canonicalJson, type ProvenanceRef } from '@acme/core';

/**
 * Five origins a fact can have, encoded inside the existing
 * `ProvenanceRef.documentKeys` without changing `@acme/core`.
 *
 * Today that field is `readonly string[]`, and an empty array is the only
 * thing distinguishable — which collapses five genuinely different situations
 * into one. Most personal memory is *asserted*: "I prefer morning meetings"
 * has no artifact and no locator, and inventing a document key for the
 * conversation it was said in makes it indistinguishable from a quote out of a
 * real document.
 *
 * Each origin becomes exactly one document key. The payload is base64url of
 * canonical JSON, so there is no delimiter to escape and the key is stable for
 * the same origin. Keys that do not carry the prefix decode to `null`, which
 * is itself information: the fact predates this convention.
 */

export const ORIGIN_KEY_PREFIX = 'acme-origin/1:' as const;

export type ProvenanceState =
  'sourced' | 'asserted' | 'derived' | 'withheld' | 'unknown';

/** An artifact version and an exact place inside it. */
export interface SourcedOrigin {
  readonly state: 'sourced';
  readonly artifactVersionId: string;
  readonly locator: string;
}

/** Someone said so. There is no artifact and there was never meant to be. */
export interface AssertedOrigin {
  readonly state: 'asserted';
  readonly principalRef: string;
}

/** Computed from a set too large or too diffuse to cite item by item. */
export interface DerivedOrigin {
  readonly state: 'derived';
  readonly method: string;
  readonly inputsDigest: string;
}

/**
 * A source exists and is deliberately not recorded — source protection.
 *
 * Only a reason class is carried, never an identity, a hint or a locator. The
 * protection is that the system does not hold the link, so no disclosure of it
 * can be compelled later.
 */
export interface WithheldOrigin {
  readonly state: 'withheld';
  readonly reasonClass: string;
}

/** Genuinely not known. Different from "not recorded on purpose". */
export interface UnknownOrigin {
  readonly state: 'unknown';
}

export type Origin =
  | SourcedOrigin
  | AssertedOrigin
  | DerivedOrigin
  | WithheldOrigin
  | UnknownOrigin;

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

function fromBase64Url(text: string): string {
  return Buffer.from(text, 'base64url').toString('utf8');
}

export function encodeOrigin(origin: Origin): string {
  return `${ORIGIN_KEY_PREFIX}${toBase64Url(canonicalJson(origin as never))}`;
}

function isOrigin(value: unknown): value is Origin {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const state = (value as { state?: unknown }).state;
  const shape = value as Record<string, unknown>;
  switch (state) {
    case 'sourced':
      return (
        typeof shape['artifactVersionId'] === 'string' &&
        typeof shape['locator'] === 'string'
      );
    case 'asserted':
      return typeof shape['principalRef'] === 'string';
    case 'derived':
      return (
        typeof shape['method'] === 'string' &&
        typeof shape['inputsDigest'] === 'string'
      );
    case 'withheld':
      return typeof shape['reasonClass'] === 'string';
    case 'unknown':
      return true;
    default:
      return false;
  }
}

/** `null` means "not an origin key" — a legacy or unstructured document key. */
export function decodeOrigin(documentKey: string): Origin | null {
  if (!documentKey.startsWith(ORIGIN_KEY_PREFIX)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      fromBase64Url(documentKey.slice(ORIGIN_KEY_PREFIX.length)),
    );
  } catch {
    return null;
  }
  return isOrigin(parsed) ? parsed : null;
}

export interface ProvenanceReading {
  readonly origins: readonly Origin[];
  /** Document keys that carry no origin. Their state is not merely unknown — it was never expressed. */
  readonly unstructuredKeys: readonly string[];
}

export function readProvenance(ref: ProvenanceRef): ProvenanceReading {
  const origins: Origin[] = [];
  const unstructuredKeys: string[] = [];
  for (const key of ref.documentKeys) {
    const origin = decodeOrigin(key);
    if (origin === null) {
      unstructuredKeys.push(key);
    } else {
      origins.push(origin);
    }
  }
  return Object.freeze({
    origins: Object.freeze(origins),
    unstructuredKeys: Object.freeze(unstructuredKeys),
  });
}

/**
 * The single weakest origin behind a fact, because a claim is only as
 * well-founded as its weakest support. Order is deliberate and is a policy
 * choice, not a truth: `unknown` is weaker than `withheld`, because withheld
 * means someone decided, and unknown means nobody knows.
 */
const STRENGTH: Readonly<Record<ProvenanceState, number>> = Object.freeze({
  unknown: 0,
  withheld: 1,
  derived: 2,
  asserted: 3,
  sourced: 4,
});

export function weakestState(
  reading: ProvenanceReading,
): ProvenanceState | null {
  if (reading.origins.length === 0) {
    return null;
  }
  return reading.origins.reduce<ProvenanceState>(
    (weakest, origin) =>
      STRENGTH[origin.state] < STRENGTH[weakest] ? origin.state : weakest,
    'sourced',
  );
}
