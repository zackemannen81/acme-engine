import {
  canonicalJson,
  type DomainIssue,
  type DomainMemoryPolicy,
  type JsonValue,
  type MemoryCandidate,
  type MemoryRecord,
  type MemoryResolution,
  type RankedMemory,
} from '@acme/core';

import {
  narrativeCandidateIdentity,
  narrativeMemoryIdentity,
  normalizeReferenceText,
} from './identity.js';
import { immutableJson } from './immutable.js';
import {
  NARRATIVE_MEMORY_SCHEMA_VERSION,
  NARRATIVE_NAMESPACE,
  NarrativeMemoryValueSchema,
  type NarrativeCharacterFactMemoryValue,
  type NarrativeMemoryValue,
  type NarrativeRelationshipMemoryValue,
  type NarrativeWorldRuleMemoryValue,
} from './schemas.js';

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): DomainIssue {
  return immutableJson({ code, path, message });
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function equivalent(
  left: NarrativeMemoryValue,
  right: NarrativeMemoryValue,
): boolean {
  return (
    canonicalJson(left as unknown as JsonValue) ===
    canonicalJson(right as unknown as JsonValue)
  );
}

function semanticValueEqual(
  left: NarrativeMemoryValue,
  right: NarrativeMemoryValue,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case 'narrative.character-fact': {
      const candidate = right as NarrativeCharacterFactMemoryValue;
      return (
        left.entityKey === candidate.entityKey &&
        left.normalizedPredicate === candidate.normalizedPredicate &&
        left.value === candidate.value
      );
    }
    case 'narrative.relationship': {
      const candidate = right as NarrativeRelationshipMemoryValue;
      return (
        left.subjectEntityKey === candidate.subjectEntityKey &&
        left.normalizedRelation === candidate.normalizedRelation &&
        left.objectEntityKey === candidate.objectEntityKey
      );
    }
    case 'narrative.world-rule': {
      const candidate = right as NarrativeWorldRuleMemoryValue;
      return left.normalizedRule === candidate.normalizedRule;
    }
  }
}

function mergeValues(
  existing: NarrativeMemoryValue,
  candidate: NarrativeMemoryValue,
): NarrativeMemoryValue {
  if (
    existing.kind === 'narrative.character-fact' &&
    candidate.kind === 'narrative.character-fact'
  ) {
    return immutableJson({
      ...existing,
      observedLabels: uniqueSorted([
        ...existing.observedLabels,
        ...candidate.observedLabels,
      ]),
      ...(candidate.correction === undefined
        ? {}
        : { correction: candidate.correction }),
      ...(candidate.validatedCorrection === undefined
        ? {}
        : { validatedCorrection: candidate.validatedCorrection }),
    });
  }
  if (
    existing.kind === 'narrative.relationship' &&
    candidate.kind === 'narrative.relationship'
  ) {
    return immutableJson({
      ...existing,
      subjectLabels: uniqueSorted([
        ...existing.subjectLabels,
        ...candidate.subjectLabels,
      ]),
      objectLabels: uniqueSorted([
        ...existing.objectLabels,
        ...candidate.objectLabels,
      ]),
    });
  }
  if (
    existing.kind === 'narrative.world-rule' &&
    candidate.kind === 'narrative.world-rule'
  ) {
    return immutableJson({
      ...existing,
      observedRules: uniqueSorted([
        ...existing.observedRules,
        ...candidate.observedRules,
      ]),
    });
  }
  return candidate;
}

function reinforcedStrength(
  current: number,
  confidence: number | undefined,
): number {
  const evidence = confidence ?? 0.5;
  return Math.min(1, current + evidence * (1 - current));
}

function activeMatchingRecords(
  candidate: NarrativeMemoryValue,
  records: readonly MemoryRecord[],
): readonly {
  readonly record: MemoryRecord;
  readonly value: NarrativeMemoryValue;
}[] {
  const identity = narrativeMemoryIdentity(candidate);
  return records
    .filter(
      (record) =>
        record.namespace === NARRATIVE_NAMESPACE &&
        record.identityKey === identity &&
        (record.status === 'active' || record.status === 'contested'),
    )
    .flatMap((record) => {
      const parsed = NarrativeMemoryValueSchema.safeParse(record.value);
      return parsed.success ? [{ record, value: parsed.data }] : [];
    })
    .sort((left, right) =>
      left.record.memoryId.localeCompare(right.record.memoryId),
    );
}

function resolveCharacterCorrection(
  candidate: NarrativeCharacterFactMemoryValue,
  matching: readonly {
    readonly record: MemoryRecord;
    readonly value: NarrativeMemoryValue;
  }[],
  source: MemoryCandidate,
): MemoryResolution | undefined {
  const evidence = candidate.validatedCorrection;
  if (
    evidence === undefined ||
    evidence.targetIdentityKey !== narrativeMemoryIdentity(candidate) ||
    !source.source.documentKeys.includes(evidence.documentKey) ||
    candidate.value === evidence.supersedesValue
  ) {
    return undefined;
  }

  const superseded = matching.filter(
    ({ value }) =>
      value.kind === 'narrative.character-fact' &&
      value.value === evidence.supersedesValue,
  );
  if (superseded.length === 0) {
    return undefined;
  }
  return immutableJson({
    candidateKey: source.key,
    action: 'contradict',
    memoryIds: superseded.map(({ record }) => record.memoryId),
    disposition: 'supersede-existing',
    replacement: {
      value: candidate as unknown as JsonValue,
      strength: source.confidence ?? 0.5,
    },
  });
}

const policy: DomainMemoryPolicy = {
  validate(candidate) {
    const issues: DomainIssue[] = [];
    if (candidate.schemaVersion !== NARRATIVE_MEMORY_SCHEMA_VERSION) {
      issues.push(
        issue(
          'NARRATIVE_MEMORY_SCHEMA_VERSION',
          ['schemaVersion'],
          `Expected ${NARRATIVE_MEMORY_SCHEMA_VERSION}.`,
        ),
      );
    }
    const parsed = NarrativeMemoryValueSchema.safeParse(candidate.value);
    if (!parsed.success) {
      issues.push(
        issue(
          'NARRATIVE_MEMORY_VALUE',
          ['value'],
          'Narrative memory candidate value is invalid.',
        ),
      );
    } else if (candidate.kind !== parsed.data.kind) {
      issues.push(
        issue(
          'NARRATIVE_MEMORY_KIND',
          ['kind'],
          'Narrative candidate kind must match its value kind.',
        ),
      );
    } else {
      switch (parsed.data.kind) {
        case 'narrative.character-fact': {
          if (
            new Set(parsed.data.observedLabels).size !==
            parsed.data.observedLabels.length
          ) {
            issues.push(
              issue(
                'NARRATIVE_DUPLICATE_OBSERVED_LABEL',
                ['value', 'observedLabels'],
                'Observed labels must be unique.',
              ),
            );
          }
          if (
            parsed.data.normalizedPredicate !==
            normalizeReferenceText(parsed.data.predicate)
          ) {
            issues.push(
              issue(
                'NARRATIVE_PREDICATE_NORMALIZATION',
                ['value', 'normalizedPredicate'],
                'Character predicate normalization is invalid.',
              ),
            );
          }
          if (parsed.data.validatedCorrection !== undefined) {
            const validated = parsed.data.validatedCorrection;
            const retained = parsed.data.correction;
            const comparable = {
              targetIdentityKey: validated.targetIdentityKey,
              supersedesValue: validated.supersedesValue,
              evidenceQuote: validated.evidenceQuote,
              ...(validated.sourceLocator === undefined
                ? {}
                : { sourceLocator: validated.sourceLocator }),
            };
            if (
              retained === undefined ||
              canonicalJson(retained as unknown as JsonValue) !==
                canonicalJson(comparable)
            ) {
              issues.push(
                issue(
                  'NARRATIVE_CORRECTION_VALIDATION_MISMATCH',
                  ['value', 'validatedCorrection'],
                  'Validated correction must exactly match retained correction evidence.',
                ),
              );
            }
          }
          break;
        }
        case 'narrative.relationship':
          if (
            parsed.data.normalizedRelation !==
            normalizeReferenceText(parsed.data.relation)
          ) {
            issues.push(
              issue(
                'NARRATIVE_RELATION_NORMALIZATION',
                ['value', 'normalizedRelation'],
                'Relationship normalization is invalid.',
              ),
            );
          }
          if (parsed.data.subjectEntityKey === parsed.data.objectEntityKey) {
            issues.push(
              issue(
                'NARRATIVE_SELF_RELATIONSHIP',
                ['value'],
                'A v1 relationship requires distinct entity keys.',
              ),
            );
          }
          break;
        case 'narrative.world-rule': {
          const normalizedRule = parsed.data.normalizedRule;
          if (
            parsed.data.observedRules.some(
              (rule) => normalizeReferenceText(rule) !== normalizedRule,
            )
          ) {
            issues.push(
              issue(
                'NARRATIVE_WORLD_RULE_NORMALIZATION',
                ['value', 'normalizedRule'],
                'World-rule normalization is invalid.',
              ),
            );
          }
          break;
        }
      }
    }
    if (
      candidate.source.documentKeys.length === 0 ||
      candidate.source.documentKeys.some((key) => key.trim().length === 0)
    ) {
      issues.push(
        issue(
          'NARRATIVE_MEMORY_PROVENANCE',
          ['source', 'documentKeys'],
          'Narrative candidates require non-empty source document keys.',
        ),
      );
    }
    return immutableJson(issues);
  },

  identity(candidate) {
    return narrativeCandidateIdentity(candidate);
  },

  retrieve(query, records): readonly RankedMemory[] {
    if (query.namespace !== NARRATIVE_NAMESPACE) {
      return immutableJson([]);
    }
    const requestedKinds = new Set(query.kinds ?? []);
    const normalizedText = query.text?.trim().toLowerCase();
    const ranked = records
      .filter(
        (record) =>
          record.namespace === NARRATIVE_NAMESPACE &&
          record.entityId === query.entityId &&
          (record.status === 'active' || record.status === 'contested') &&
          (requestedKinds.size === 0 || requestedKinds.has(record.kind)) &&
          NarrativeMemoryValueSchema.safeParse(record.value).success &&
          (normalizedText === undefined ||
            canonicalJson(record.value).toLowerCase().includes(normalizedText)),
      )
      .map((record) => {
        const statusScore = record.status === 'active' ? 2 : 1;
        const taskScore =
          query.task === 'observe-document' &&
          (record.kind === 'narrative.character-fact' ||
            record.kind === 'narrative.relationship' ||
            record.kind === 'narrative.world-rule')
            ? 1
            : 0;
        return {
          record,
          score: statusScore + taskScore + record.strength,
          reasons: [
            `status:${record.status}`,
            'strength',
            ...(taskScore === 0 ? [] : ['task:observe-document']),
          ],
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.record.identityKey.localeCompare(right.record.identityKey) ||
          left.record.memoryId.localeCompare(right.record.memoryId),
      );
    return immutableJson(ranked);
  },

  resolve(candidate, existing) {
    const validation = narrativeMemoryPolicy.validate(candidate);
    if (validation.length > 0) {
      return immutableJson({
        candidateKey: candidate.key,
        action: 'ignore',
        reason: 'invalid-narrative-candidate',
      });
    }
    const value = NarrativeMemoryValueSchema.parse(candidate.value);
    if ((candidate.confidence ?? 0.5) < 0.2) {
      return immutableJson({
        candidateKey: candidate.key,
        action: 'ignore',
        reason: 'low-confidence',
      });
    }

    const matching = activeMatchingRecords(value, existing);
    if (matching.length === 0) {
      return immutableJson({
        candidateKey: candidate.key,
        action: 'create',
        value: value as unknown as JsonValue,
        strength: candidate.confidence ?? 0.5,
      });
    }

    if (value.kind === 'narrative.character-fact') {
      const correction = resolveCharacterCorrection(value, matching, candidate);
      if (correction !== undefined) {
        return correction;
      }
      if (value.correction !== undefined) {
        return immutableJson({
          candidateKey: candidate.key,
          action: 'contradict',
          memoryIds: matching.map(({ record }) => record.memoryId),
          disposition: 'contest',
        });
      }
    }

    const exact = matching.find(({ value: current }) =>
      equivalent(current, value),
    );
    if (exact !== undefined) {
      return immutableJson({
        candidateKey: candidate.key,
        action: 'reinforce',
        memoryId: exact.record.memoryId,
        strength: reinforcedStrength(
          exact.record.strength,
          candidate.confidence,
        ),
      });
    }

    const compatible = matching.find(({ value: current }) =>
      semanticValueEqual(current, value),
    );
    if (compatible !== undefined) {
      return immutableJson({
        candidateKey: candidate.key,
        action: 'merge',
        memoryId: compatible.record.memoryId,
        value: mergeValues(compatible.value, value) as unknown as JsonValue,
        strength: reinforcedStrength(
          compatible.record.strength,
          candidate.confidence,
        ),
      });
    }

    return immutableJson({
      candidateKey: candidate.key,
      action: 'contradict',
      memoryIds: matching.map(({ record }) => record.memoryId),
      disposition: 'contest',
    });
  },

  lifecycle(record, hook) {
    if (hook !== 'maintenance' || record.status === 'forgotten') {
      return immutableJson({ action: 'retain' });
    }
    if (record.strength < 0.1) {
      return immutableJson({
        action: 'forget',
        reason: 'narrative-strength-below-maintenance-floor',
      });
    }
    if (record.status === 'contested') {
      return immutableJson({
        action: 'update-strength',
        strength: Math.max(0, Number((record.strength * 0.9).toFixed(12))),
      });
    }
    return immutableJson({ action: 'retain' });
  },
};

export const narrativeMemoryPolicy: DomainMemoryPolicy = Object.freeze(policy);
