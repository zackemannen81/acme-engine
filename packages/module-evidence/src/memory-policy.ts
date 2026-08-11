import {
  canonicalJson,
  type DomainIssue,
  type DomainMemoryPolicy,
  type JsonValue,
  type MemoryCandidate,
  type MemoryRecord,
  type RankedMemory,
} from '@acme/core';

import {
  deriveEvidenceEventId,
  deriveEvidenceObservationId,
  deriveEvidenceOpenQuestionId,
  deriveEvidencePropositionId,
  deriveEvidenceRelationId,
  evidenceMemoryIdentity,
} from './identity.js';
import { immutableEvidence } from './immutable.js';
import {
  EVIDENCE_MEMORY_SCHEMA_VERSION,
  EVIDENCE_NAMESPACE,
  EvidenceMemoryValueSchema,
  type EvidenceMemoryValue,
} from './schemas.js';

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): DomainIssue {
  return immutableEvidence({ code, path, message });
}

function expectedCandidateKind(value: EvidenceMemoryValue): string {
  switch (value.kind) {
    case 'statement-occurrence':
      return 'evidence.statement-occurrence';
    case 'exhibit-assertion':
      return 'evidence.exhibit-assertion';
    case 'proposition':
      return 'evidence.proposition';
    case 'event-occurrence':
      return 'evidence.event-occurrence';
    case 'evidence-relation':
      return 'evidence.relation';
    case 'open-question':
      return 'evidence.open-question';
  }
}

function expectedValueIdentity(value: EvidenceMemoryValue): string {
  switch (value.kind) {
    case 'statement-occurrence':
      return deriveEvidenceObservationId({
        kind: value.kind,
        artifactVersionId: value.artifactVersionId,
        locatorId: value.locator.locatorId,
        exactQuote: value.exactQuote,
        sourceActorReference: value.actorReference,
        temporalBound: value.temporalBound,
      });
    case 'exhibit-assertion':
      return deriveEvidenceObservationId({
        kind: value.kind,
        artifactVersionId: value.artifactVersionId,
        locatorId: value.locator.locatorId,
        exactQuote: value.exactQuote,
        sourceActorReference: value.sourceActorReference,
        temporalBound: value.temporalBound,
      });
    case 'proposition':
      return deriveEvidencePropositionId(value);
    case 'event-occurrence':
      return deriveEvidenceEventId(value);
    case 'evidence-relation':
      return deriveEvidenceRelationId(value);
    case 'open-question':
      return deriveEvidenceOpenQuestionId(value);
  }
}

function parsedCandidate(
  candidate: MemoryCandidate,
): EvidenceMemoryValue | null {
  const parsed = EvidenceMemoryValueSchema.safeParse(candidate.value);
  return parsed.success ? parsed.data : null;
}

function matchingRecords(
  identityKey: string,
  records: readonly MemoryRecord[],
): readonly MemoryRecord[] {
  return records
    .filter(
      (record) =>
        record.namespace === EVIDENCE_NAMESPACE &&
        record.identityKey === identityKey &&
        (record.status === 'active' || record.status === 'contested'),
    )
    .sort((left, right) => left.memoryId.localeCompare(right.memoryId));
}

export const evidenceMemoryPolicy: DomainMemoryPolicy = {
  validate(candidate) {
    const issues: DomainIssue[] = [];
    if (candidate.schemaVersion !== EVIDENCE_MEMORY_SCHEMA_VERSION) {
      issues.push(
        issue(
          'EVIDENCE_MEMORY_SCHEMA_VERSION',
          ['schemaVersion'],
          `Expected ${EVIDENCE_MEMORY_SCHEMA_VERSION}.`,
        ),
      );
    }
    const value = parsedCandidate(candidate);
    if (value === null) {
      issues.push(
        issue(
          'EVIDENCE_MEMORY_VALUE_SCHEMA',
          ['value'],
          'Evidence memory value schema validation failed.',
        ),
      );
      return immutableEvidence(issues);
    }
    if (candidate.kind !== expectedCandidateKind(value)) {
      issues.push(
        issue(
          'EVIDENCE_MEMORY_KIND',
          ['kind'],
          'Memory candidate kind does not match its Evidence value.',
        ),
      );
    }
    if (evidenceMemoryIdentity(value) !== expectedValueIdentity(value)) {
      issues.push(
        issue(
          'EVIDENCE_MEMORY_IDENTITY',
          ['value'],
          'Evidence value identity does not match its named V1 algorithm.',
        ),
      );
    }
    return immutableEvidence(issues);
  },

  identity(candidate) {
    const value = EvidenceMemoryValueSchema.parse(candidate.value);
    return evidenceMemoryIdentity(value);
  },

  retrieve(query, records) {
    const ranked: RankedMemory[] = records
      .filter(
        (record) =>
          record.namespace === EVIDENCE_NAMESPACE &&
          record.entityId === query.entityId &&
          (record.status === 'active' || record.status === 'contested'),
      )
      .map((record) => {
        const statusScore = record.status === 'active' ? 2 : 1;
        const taskScore = query.task.startsWith('evidence.') ? 1 : 0;
        return {
          record,
          score: statusScore + taskScore + record.strength,
          reasons: [
            `status:${record.status}`,
            ...(taskScore === 0 ? [] : [`task:${query.task}`]),
            'strength',
          ],
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.record.memoryId.localeCompare(right.record.memoryId),
      )
      .slice(0, query.limit);
    return immutableEvidence(ranked);
  },

  resolve(candidate, existing) {
    const value = EvidenceMemoryValueSchema.parse(candidate.value);
    const identityKey = evidenceMemoryIdentity(value);
    const matching = matchingRecords(identityKey, existing);
    if (matching.length === 0) {
      return immutableEvidence({
        candidateKey: candidate.key,
        action: 'create',
        value: value as unknown as JsonValue,
        strength: candidate.confidence ?? 1,
      });
    }
    const canonicalValue = canonicalJson(value as unknown as JsonValue);
    const identical = matching.find(
      (record) => canonicalJson(record.value) === canonicalValue,
    );
    if (identical !== undefined) {
      return immutableEvidence({
        candidateKey: candidate.key,
        action: 'ignore',
        reason: 'evidence-idempotent-duplicate',
      });
    }
    return immutableEvidence({
      candidateKey: candidate.key,
      action: 'ignore',
      reason: 'evidence-identity-collision',
    });
  },

  lifecycle() {
    return immutableEvidence({ action: 'retain' });
  },
};
