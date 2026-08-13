import type {
  DomainIssue,
  DomainMemoryPolicy,
  JsonValue,
  MemoryCandidate,
  MemoryRecord,
  MemoryResolution,
  RankedMemory,
} from '@acme/core';

import { normalizePersonalText } from './identity.js';
import { immutableJson } from './immutable.js';
import {
  PERSONAL_CLAIM_KIND,
  PERSONAL_MEMORY_SCHEMA_VERSION,
  PERSONAL_NAMESPACE,
  PersonalMemoryValueSchema,
  type PersonalClaimValue,
  type PersonalMemoryValue,
} from './schemas.js';

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): DomainIssue {
  return immutableJson({ code, path, message });
}

function parse(value: JsonValue): PersonalMemoryValue | null {
  const parsed = PersonalMemoryValueSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isPersonalClaim(
  value: PersonalMemoryValue,
): value is PersonalClaimValue {
  return value.kind === PERSONAL_CLAIM_KIND;
}

export interface PersonalLiveRecord {
  readonly record: MemoryRecord;
  readonly value: PersonalMemoryValue;
}

/** Records the repository still considers live, parsed and slot-filtered. */
export function personalLiveRecords(
  records: readonly MemoryRecord[],
  slotKey?: string,
): readonly PersonalLiveRecord[] {
  return records
    .flatMap((record) => {
      if (
        record.namespace !== PERSONAL_NAMESPACE ||
        (record.status !== 'active' && record.status !== 'contested')
      ) {
        return [];
      }
      const value = parse(record.value);
      if (value === null) {
        return [];
      }
      return slotKey === undefined || value.slotKey === slotKey
        ? [{ record, value }]
        : [];
    })
    .sort((left, right) =>
      left.record.memoryId.localeCompare(right.record.memoryId),
    );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

const policy: DomainMemoryPolicy = {
  validate(candidate: MemoryCandidate) {
    const issues: DomainIssue[] = [];
    if (candidate.schemaVersion !== PERSONAL_MEMORY_SCHEMA_VERSION) {
      issues.push(
        issue(
          'PERSONAL_MEMORY_SCHEMA_VERSION',
          ['schemaVersion'],
          `Expected ${PERSONAL_MEMORY_SCHEMA_VERSION}.`,
        ),
      );
    }
    const value = parse(candidate.value);
    if (value === null) {
      issues.push(
        issue('PERSONAL_MEMORY_VALUE', ['value'], 'Personal value is invalid.'),
      );
      return immutableJson(issues);
    }
    if (candidate.kind !== value.kind) {
      issues.push(
        issue(
          'PERSONAL_MEMORY_KIND',
          ['kind'],
          'Candidate kind must match its value kind.',
        ),
      );
    }
    if (isPersonalClaim(value)) {
      // Normalization is part of identity, so a candidate that disagrees with
      // it would produce a record nothing can find again.
      const checks: readonly [string, string, string][] = [
        ['normalizedSubject', value.normalizedSubject, value.subject],
        ['normalizedAttribute', value.normalizedAttribute, value.attribute],
        ['normalizedValue', value.normalizedValue, value.value],
      ];
      for (const [field, normalized, raw] of checks) {
        if (normalized !== normalizePersonalText(raw)) {
          issues.push(
            issue(
              'PERSONAL_NORMALIZATION',
              ['value', field],
              `${field} does not match the identity policy.`,
            ),
          );
        }
      }
      if (
        uniqueSorted(value.evidenceKeys).length !== value.evidenceKeys.length
      ) {
        issues.push(
          issue(
            'PERSONAL_DUPLICATE_EVIDENCE',
            ['value', 'evidenceKeys'],
            'Evidence keys must be distinct: a repeated source is not a second witness.',
          ),
        );
      }
    }
    return immutableJson(issues);
  },

  identity(candidate: MemoryCandidate) {
    const value = PersonalMemoryValueSchema.parse(candidate.value);
    return isPersonalClaim(value)
      ? `claim:${value.assertionKey}`
      : `revocation:${value.slotKey}`;
  },

  retrieve(query, records): readonly RankedMemory[] {
    if (query.namespace !== PERSONAL_NAMESPACE) {
      return immutableJson([]);
    }
    const kinds = new Set(query.kinds ?? []);
    const text = query.text?.trim().toLowerCase();
    const ranked = personalLiveRecords(records)
      .filter(({ record }) => {
        if (record.entityId !== query.entityId) {
          return false;
        }
        if (kinds.size > 0 && !kinds.has(record.kind)) {
          return false;
        }
        return (
          text === undefined ||
          JSON.stringify(record.value).toLowerCase().includes(text)
        );
      })
      .map(({ record, value }) => ({
        record,
        // A human write outranks a model write at retrieval too, so a
        // consumer that ignores standing still sees the better source first.
        score:
          (record.status === 'active' ? 2 : 1) +
          record.strength +
          (isPersonalClaim(value) && value.authority === 'human' ? 1 : 0),
        reasons: [`status:${record.status}`, 'strength'],
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.record.identityKey.localeCompare(right.record.identityKey) ||
          left.record.memoryId.localeCompare(right.record.memoryId),
      );
    return immutableJson(ranked);
  },

  resolve(candidate, existing): MemoryResolution {
    if (policy.validate(candidate).length > 0) {
      return immutableJson({
        candidateKey: candidate.key,
        action: 'ignore',
        reason: 'invalid-personal-candidate',
      });
    }
    const value = PersonalMemoryValueSchema.parse(candidate.value);
    const strength = candidate.confidence ?? 0.5;
    const inSlot = personalLiveRecords(existing, value.slotKey);

    if (!isPersonalClaim(value)) {
      const targets = inSlot.filter(({ value: current }) =>
        isPersonalClaim(current),
      );
      if (targets.length === 0) {
        return immutableJson({
          candidateKey: candidate.key,
          action: 'ignore',
          reason: 'nothing-to-forget',
        });
      }
      // Forgetting retires every account in the slot and leaves behind a
      // record that names none of them.
      return immutableJson({
        candidateKey: candidate.key,
        action: 'contradict',
        memoryIds: targets.map(({ record }) => record.memoryId),
        disposition: 'supersede-existing',
        replacement: { value: value as unknown as JsonValue, strength },
      });
    }

    const same = inSlot.find(
      ({ value: current }) =>
        isPersonalClaim(current) && current.assertionKey === value.assertionKey,
    );

    if (same !== undefined && isPersonalClaim(same.value)) {
      const merged = uniqueSorted([
        ...same.value.evidenceKeys,
        ...value.evidenceKeys,
      ]);
      const gainedEvidence = merged.length > same.value.evidenceKeys.length;
      // A human write upgrades an existing model claim's authority; the
      // reverse never happens.
      const authority =
        same.value.authority === 'human' || value.authority === 'human'
          ? 'human'
          : 'model';
      return immutableJson({
        candidateKey: candidate.key,
        action: 'merge',
        memoryId: same.record.memoryId,
        value: {
          ...same.value,
          authority,
          evidenceKeys: merged,
        } as unknown as JsonValue,
        strength: gainedEvidence
          ? Math.min(
              1,
              same.record.strength + strength * (1 - same.record.strength),
            )
          : same.record.strength,
      });
    }

    // The engine builds its identity map over every loaded record regardless
    // of status, and `merge` never restores a status. So an identity that has
    // been superseded is permanently spent: `create` would be refused with
    // CONFLICT, and nothing can bring the old record back.
    //
    // For a model re-asserting something a person revoked, refusing is exactly
    // right. For a person restating it in the same words, it is not — but the
    // engine offers no third option. See the pair of tests naming both.
    const retired = existing.find((record) => {
      const current = parse(record.value);
      return (
        record.namespace === PERSONAL_NAMESPACE &&
        current !== null &&
        isPersonalClaim(current) &&
        current.assertionKey === value.assertionKey
      );
    });
    if (retired !== undefined) {
      return immutableJson({
        candidateKey: candidate.key,
        action: 'ignore',
        reason: 'identity-retired',
      });
    }

    // A different answer in a slot that already has one.
    //
    // Deliberately `create`, never `contest`. The engine's `contest` marks the
    // existing record and DISCARDS this candidate, so it cannot express "both
    // accounts stand". Creating a second record and deciding what currently
    // holds at read time (see standing.ts) expresses it exactly, and needs no
    // change to the engine.
    return immutableJson({
      candidateKey: candidate.key,
      action: 'create',
      value: value as unknown as JsonValue,
      strength,
    });
  },

  lifecycle() {
    return immutableJson({ action: 'retain' });
  },
};

export const personalMemoryPolicy: DomainMemoryPolicy = Object.freeze(policy);
