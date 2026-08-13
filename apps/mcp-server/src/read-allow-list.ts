import type {
  JsonValue,
  MemoryRecord,
  RankedMemory,
  StateSnapshot,
} from '@acme/core';
import {
  readProvenance,
  weakestState,
  type ProvenanceState,
} from '@acme/provenance-states';

/**
 * ## Why this file exists, and why it is not a disclosure primitive
 *
 * An MCP server is a boundary to an arbitrary external consumer. Today's
 * engine has no consumer identity to reason about: `ExecutionRequest` has no
 * principal field and rejects unknown top-level keys, and `MemoryEngine.retrieve`
 * returns complete `MemoryRecord` values — full `value`, full `provenance`
 * (execution ids, contract refs, document keys), `strength` and timestamps.
 * Nothing in core can be asked "may *this* caller see *this* field".
 *
 * So this app has exactly two honest options at the read boundary: refuse the
 * read, or disclose under a static allow-list that a human wrote into the
 * server configuration ahead of time. This file is the second option. It is
 * deliberately *not* a permission model:
 *
 * - It has no notion of who is calling. A grant is a property of the server
 *   deployment, not of the consumer.
 * - It is not consulted by the engine and cannot be. It runs strictly after
 *   the engine has already produced the complete record.
 * - It cannot make a per-request decision, only replay a fixed decision.
 *
 * `withheld` below is the point of the design: every read reports what the
 * engine handed over and this app then dropped, so the gap is visible in the
 * response instead of being quietly closed.
 */

export interface EntityReadGrant {
  readonly namespace: string;
  readonly entityId: string;
  /** Whether the committed state value may leave the process. */
  readonly state: boolean;
  /** Exact memory `kind` values that may be named. Empty denies all memory. */
  readonly memoryKinds: readonly string[];
  /**
   * Whether a disclosed memory's `value` may leave the process. When false the
   * record is named (kind, identity, status) with no content.
   */
  readonly memoryValues: boolean;
}

export interface ReadAllowList {
  readonly grants: readonly EntityReadGrant[];
}

export const EMPTY_READ_ALLOW_LIST: ReadAllowList = Object.freeze({
  grants: Object.freeze([]),
});

export function findGrant(
  allowList: ReadAllowList,
  namespace: string,
  entityId: string,
): EntityReadGrant | undefined {
  return allowList.grants.find(
    (grant) => grant.namespace === namespace && grant.entityId === entityId,
  );
}

/**
 * Where a fact came from, read out of `ProvenanceRef.documentKeys` by
 * `@acme/provenance-states`. This is the one piece of provenance an MCP client
 * genuinely needs and can safely have: a client asked to act on a remembered
 * fact should know whether it was quoted from an artifact, asserted by someone,
 * derived, or deliberately unsourced.
 *
 * Only the states travel. The keys themselves are locators into the deployment's
 * documents and stay behind, so this adds a signal without widening the leak
 * the `withheld` report below describes.
 */
export interface DisclosedOrigin {
  /**
   * The weakest origin behind the record, because a claim is only as
   * well-founded as its weakest support. `null` means no key carried a
   * structured origin at all — not "unknown", but "never expressed".
   */
  readonly weakestState: ProvenanceState | null;
  /** Every distinct state present, sorted, so a mixed-support fact is visible. */
  readonly states: readonly ProvenanceState[];
  /**
   * Document keys written before this convention existed. A count, never the
   * keys: the count says "support exists and is unclassified", the keys would
   * say where to look.
   */
  readonly unstructuredKeys: number;
}

export interface DisclosedMemory {
  readonly kind: string;
  readonly identityKey: string;
  readonly status: string;
  readonly score: number;
  readonly origin: DisclosedOrigin;
  readonly value?: JsonValue;
}

export interface DisclosedState {
  readonly revision: number;
  readonly schemaVersion: string;
  readonly valueHash: string;
  readonly value?: JsonValue;
}

/**
 * What the engine produced but the server did not pass on. Reported per read so
 * the missing disclosure decision is legible to the consumer rather than
 * invisible.
 */
export interface WithheldReport {
  /** Memory records the engine ranked whose `kind` is outside the grant. */
  readonly memoryRecords: number;
  /** Field names the engine returned on every disclosed record and the app dropped. */
  readonly memoryFields: readonly string[];
  readonly stateValue: boolean;
  readonly reason: string;
}

const WITHHELD_REASON =
  'The engine returns complete records and has no consumer identity or ' +
  'per-field disclosure decision. These fields were removed by ' +
  'apps/mcp-server after the fact, under a static configured allow-list.';

/**
 * Fields present on every `MemoryRecord` the engine returns that this server
 * never discloses, because nothing downstream of an MCP client should receive
 * internal execution provenance.
 *
 * `provenance` stays on this list even though `origin` above is computed from
 * it. The raw refs carry execution ids, contract refs and document keys, which
 * are locators into the deployment; the origin states are a classification of
 * the support and carry no locator.
 */
const ALWAYS_WITHHELD_MEMORY_FIELDS: readonly string[] = Object.freeze([
  'firstSeenAt',
  'lastReinforcedAt',
  'lastSeenAt',
  'memoryId',
  'provenance',
  'reasons',
  'recordVersion',
  'schemaVersion',
  'strength',
]);

/**
 * A `MemoryRecord` carries an array of `ProvenanceRef`, one per supporting
 * execution, and each ref carries its own document keys. The origins of all of
 * them together are the support for the record.
 */
export function readOrigin(record: MemoryRecord): DisclosedOrigin {
  const readings = record.provenance.map((ref) => readProvenance(ref));
  const states = [
    ...new Set(
      readings.flatMap((reading) => reading.origins.map((o) => o.state)),
    ),
  ].sort();
  const weakest = readings
    .map((reading) => weakestState(reading))
    .filter((state): state is ProvenanceState => state !== null)
    .reduce<ProvenanceState | null>(
      (lowest, state) =>
        lowest === null || STATE_STRENGTH[state] < STATE_STRENGTH[lowest]
          ? state
          : lowest,
      null,
    );
  return {
    weakestState: weakest,
    states: Object.freeze(states),
    unstructuredKeys: readings.reduce(
      (total, reading) => total + reading.unstructuredKeys.length,
      0,
    ),
  };
}

/**
 * Mirrors the ordering `@acme/provenance-states` uses inside one ref, so
 * combining refs cannot silently disagree with combining keys.
 */
const STATE_STRENGTH: Readonly<Record<ProvenanceState, number>> = Object.freeze(
  {
    unknown: 0,
    withheld: 1,
    derived: 2,
    asserted: 3,
    sourced: 4,
  },
);

export interface DisclosedRead {
  readonly memories: readonly DisclosedMemory[];
  readonly state: DisclosedState | null;
  readonly withheld: WithheldReport;
}

export function discloseRead(
  grant: EntityReadGrant,
  ranked: readonly RankedMemory[],
  state: StateSnapshot<JsonValue> | null,
): DisclosedRead {
  const allowedKinds = new Set(grant.memoryKinds);
  const permitted = ranked.filter(({ record }) =>
    allowedKinds.has(record.kind),
  );
  const memories = permitted.map(({ record, score }) => ({
    kind: record.kind,
    identityKey: record.identityKey,
    status: record.status,
    score,
    origin: readOrigin(record),
    ...(grant.memoryValues ? { value: record.value } : {}),
  }));
  const disclosedState =
    state === null || !grant.state
      ? null
      : {
          revision: state.revision,
          schemaVersion: state.schemaVersion,
          valueHash: state.valueHash,
          value: state.value,
        };
  return {
    memories,
    state: disclosedState,
    withheld: {
      memoryRecords: ranked.length - permitted.length,
      memoryFields: Object.freeze([
        ...ALWAYS_WITHHELD_MEMORY_FIELDS,
        ...(grant.memoryValues ? [] : ['value']),
      ]),
      stateValue: state !== null && !grant.state,
      reason: WITHHELD_REASON,
    },
  };
}
