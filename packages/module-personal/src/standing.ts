import type { MemoryRecord } from '@acme/core';
import {
  readProvenance,
  weakestState,
  type ProvenanceState,
} from '@acme/provenance-states';

import { immutableJson } from './immutable.js';
import {
  isPersonalClaim,
  personalLiveRecords,
  type PersonalLiveRecord,
} from './memory-policy.js';
import {
  PERSONAL_REVOCATION_KIND,
  type PersonalAuthority,
  type PersonalClaimValue,
} from './schemas.js';

/**
 * What currently holds, computed when memory is read rather than decided when
 * it was written.
 *
 * This is the join between the two experiments this policy replaces. Writing
 * every distinct answer as its own record is what lets two answers coexist;
 * deciding standing here is what stops that from being useless. The engine's
 * write-time `contest` can do neither, and this needs no change to it.
 */

export const DEFAULT_CORROBORATION_THRESHOLD = 2;

export interface StandingClaim {
  readonly value: string;
  readonly statement: PersonalClaimValue;
  readonly authority: PersonalAuthority;
  readonly evidenceCount: number;
  readonly memoryId: string;
  /** Weakest provenance origin behind this claim, when any was expressed. */
  readonly originState: ProvenanceState | null;
}

export interface SlotStanding {
  readonly slotKey: string;
  readonly subject: string;
  readonly attribute: string;
  /** Claims that currently hold. More than one means the person said more than one thing. */
  readonly standing: readonly StandingClaim[];
  /** Recorded but not currently held: awaiting corroboration, or outranked by a human. */
  readonly withheldFromBelief: readonly StandingClaim[];
  readonly revoked: boolean;
  /** True once a person has written this slot. Models cannot change it afterwards. */
  readonly sealedByHuman: boolean;
  readonly contested: boolean;
}

export interface StandingOptions {
  readonly corroborationThreshold?: number;
}

function toClaim(entry: PersonalLiveRecord): StandingClaim | null {
  if (!isPersonalClaim(entry.value)) {
    return null;
  }
  const first = entry.record.provenance[0];
  return {
    value: entry.value.value,
    statement: entry.value,
    authority: entry.value.authority,
    evidenceCount: entry.value.evidenceKeys.length,
    memoryId: entry.record.memoryId,
    originState:
      first === undefined ? null : weakestState(readProvenance(first)),
  };
}

export function personalStanding(
  records: readonly MemoryRecord[],
  options: StandingOptions = {},
): readonly SlotStanding[] {
  const threshold =
    options.corroborationThreshold ?? DEFAULT_CORROBORATION_THRESHOLD;
  const bySlot = new Map<string, PersonalLiveRecord[]>();
  for (const entry of personalLiveRecords(records)) {
    const slot = bySlot.get(entry.value.slotKey) ?? [];
    slot.push(entry);
    bySlot.set(entry.value.slotKey, slot);
  }

  const result: SlotStanding[] = [];
  for (const [slotKey, entries] of [...bySlot.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    // A revocation clears what was known when it was made. It does not silence
    // the slot forever: something the person says afterwards stands on its own.
    const revokedAt = entries
      .filter(({ value }) => value.kind === PERSONAL_REVOCATION_KIND)
      .map(({ value }) =>
        value.kind === PERSONAL_REVOCATION_KIND ? value.revokedAt : '',
      )
      .sort()
      .at(-1);
    const claims = entries
      .map(toClaim)
      .filter((claim): claim is StandingClaim => claim !== null);
    const sealedByHuman = claims.some((claim) => claim.authority === 'human');
    const first = claims[0]?.statement;

    // A person's own word needs no corroboration and outranks a model's. A
    // model claim needs independent witnesses, and never counts at all once a
    // person has spoken about this slot.
    const survivesRevocation = (claim: StandingClaim): boolean =>
      revokedAt === undefined || claim.statement.statedAt > revokedAt;
    const holds = claims
      .filter(survivesRevocation)
      .filter((claim) =>
        sealedByHuman
          ? claim.authority === 'human'
          : claim.evidenceCount >= threshold,
      );

    result.push(
      immutableJson({
        slotKey,
        subject: first?.subject ?? '',
        attribute: first?.attribute ?? '',
        standing: holds,
        withheldFromBelief: claims.filter((claim) => !holds.includes(claim)),
        revoked: revokedAt !== undefined,
        sealedByHuman,
        contested: holds.length > 1,
      }),
    );
  }
  return immutableJson(result);
}

/** The flat answer a consumer asks for: what may be treated as true right now. */
export function believedPersonalClaims(
  records: readonly MemoryRecord[],
  options: StandingOptions = {},
): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const slot of personalStanding(records, options)) {
    if (slot.standing.length > 0) {
      map.set(
        `${slot.subject} ${slot.attribute}`.trim(),
        slot.standing.map((claim) => claim.value).sort(),
      );
    }
  }
  return map;
}
