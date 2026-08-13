import type { JsonValue, RankedMemory, StateSnapshot } from '@acme/core';

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

export interface DisclosedMemory {
  readonly kind: string;
  readonly identityKey: string;
  readonly status: string;
  readonly score: number;
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
