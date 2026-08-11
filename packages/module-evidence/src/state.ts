import type { DomainIssue, JsonValue } from '@acme/core';

import {
  deriveEvidenceAssessmentContentHash,
  deriveEvidenceAssessmentId,
  deriveEvidenceRelationId,
} from './identity.js';
import { immutableEvidence } from './immutable.js';
import {
  EVIDENCE_STATE_SCHEMA_VERSION,
  EvidenceAssessmentSchema,
  EvidenceDeltaSchema,
  EvidenceRelationSchema,
  EvidenceStateSchema,
  type EvidenceAssessment,
  type EvidenceDelta,
  type EvidenceObjectKind,
  type EvidenceObjectStanding,
  type EvidenceRelation,
  type EvidenceState,
  type EvidenceStanding,
  type SourceArtifactVersion,
} from './schemas.js';

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): DomainIssue {
  return immutableEvidence({ code, path, message });
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function standingKey(value: {
  readonly objectKind: EvidenceObjectKind;
  readonly objectId: string;
}): string {
  return `${value.objectKind}:${value.objectId}`;
}

function sortedStandings(
  values: Iterable<EvidenceObjectStanding>,
): EvidenceObjectStanding[] {
  return [...values].sort((left, right) =>
    standingKey(left).localeCompare(standingKey(right)),
  );
}

function isDocumentKind(kind: EvidenceObjectKind): boolean {
  return kind === 'source-artifact-version' || kind === 'assessment-version';
}

function expectedDocumentSet(state: EvidenceState): Set<string> {
  return new Set([...state.sourceDocumentIds, ...state.assessmentDocumentIds]);
}

function hasSourceContentKey(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return false;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key === 'string' &&
      [
        'text',
        'sourceText',
        'quote',
        'exactQuote',
        'rationale',
        'content',
      ].includes(key)
    ) {
      return true;
    }
    if (
      hasSourceContentKey((value as Record<PropertyKey, unknown>)[key], seen)
    ) {
      return true;
    }
  }
  return false;
}

export function initialEvidenceState(): EvidenceState {
  return immutableEvidence({
    schemaVersion: EVIDENCE_STATE_SCHEMA_VERSION,
    evidenceRevision: 0,
    sourceDocumentIds: [],
    assessmentDocumentIds: [],
    memoryIds: [],
    standings: [],
    currentRelationVersionIds: [],
    currentOpenQuestionIds: [],
  });
}

export function reduceEvidenceState(
  state: EvidenceState,
  delta: EvidenceDelta,
): EvidenceState {
  EvidenceStateSchema.parse(state);
  EvidenceDeltaSchema.parse(delta);

  const standings = new Map(
    state.standings.map((entry) => [standingKey(entry), entry]),
  );
  for (const change of delta.standingChanges) {
    standings.set(standingKey(change), {
      objectKind: change.objectKind,
      objectId: change.objectId,
      standing: change.to,
    });
  }

  return immutableEvidence({
    schemaVersion: EVIDENCE_STATE_SCHEMA_VERSION,
    evidenceRevision: delta.nextEvidenceRevision,
    sourceDocumentIds: uniqueSorted([
      ...state.sourceDocumentIds,
      ...delta.addSourceDocumentIds,
    ]),
    assessmentDocumentIds: uniqueSorted([
      ...state.assessmentDocumentIds,
      ...delta.addAssessmentDocumentIds,
    ]),
    memoryIds: uniqueSorted([...state.memoryIds, ...delta.addMemoryIds]),
    standings: sortedStandings(standings.values()),
    currentRelationVersionIds: uniqueSorted(delta.currentRelationVersionIds),
    currentOpenQuestionIds: uniqueSorted(delta.currentOpenQuestionIds),
  });
}

export function evidenceDeltaInvariants(
  state: EvidenceState,
  delta: EvidenceDelta,
  artifactVersions: readonly SourceArtifactVersion[] = [],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const changesCanonicalEvidence =
    delta.addSourceDocumentIds.length > 0 ||
    delta.addMemoryIds.length > 0 ||
    delta.standingChanges.length > 0;
  const expectedRevision =
    state.evidenceRevision + (changesCanonicalEvidence ? 1 : 0);
  if (delta.nextEvidenceRevision !== expectedRevision) {
    issues.push(
      issue(
        'EVIDENCE_REVISION_STEP',
        ['nextEvidenceRevision'],
        `Evidence revision must be ${String(expectedRevision)} for this delta.`,
      ),
    );
  }

  const standings = new Map(
    state.standings.map((entry) => [standingKey(entry), entry.standing]),
  );
  const versions = new Map(
    artifactVersions.map((version) => [version.artifactVersionId, version]),
  );
  delta.standingChanges.forEach((change, index) => {
    const current = standings.get(standingKey(change)) ?? null;
    if (current !== change.from) {
      issues.push(
        issue(
          'EVIDENCE_STANDING_PRECONDITION',
          ['standingChanges', index, 'from'],
          'Standing change must name the exact current standing.',
        ),
      );
    }
    if (change.transition === 'correction') {
      const lineage = change.correctionLineage;
      if (lineage === null) {
        return;
      }
      const predecessor = versions.get(lineage.predecessorArtifactVersionId);
      const successor = versions.get(lineage.successorArtifactVersionId);
      if (
        predecessor === undefined ||
        successor === undefined ||
        predecessor.logicalArtifactId !== lineage.logicalArtifactId ||
        successor.logicalArtifactId !== lineage.logicalArtifactId ||
        successor.predecessorVersionId !== predecessor.artifactVersionId
      ) {
        issues.push(
          issue(
            'EVIDENCE_CORRECTION_LINEAGE',
            ['standingChanges', index, 'correctionLineage'],
            'Correction supersession requires explicit adjacent versions of the same logical artifact.',
          ),
        );
      }
      const successorChange = delta.standingChanges.find(
        (candidate) =>
          candidate.objectKind === change.objectKind &&
          candidate.objectId === lineage.successorObjectId,
      );
      if (
        successorChange?.transition !== 'create' ||
        successorChange.to !== 'current'
      ) {
        issues.push(
          issue(
            'EVIDENCE_CORRECTION_SUCCESSOR_NOT_CURRENT',
            [
              'standingChanges',
              index,
              'correctionLineage',
              'successorObjectId',
            ],
            'Correction supersession requires the successor occurrence to become current in the same delta.',
          ),
        );
      }
    }
  });

  return immutableEvidence(issues);
}

function validStandingTransition(
  before: EvidenceStanding,
  after: EvidenceStanding,
): boolean {
  if (before === after) {
    return true;
  }
  switch (before) {
    case 'current':
      return ['contested', 'superseded', 'rejected'].includes(after);
    case 'contested':
      return ['superseded', 'rejected'].includes(after);
    case 'superseded':
    case 'rejected':
      return false;
  }
}

export function evidenceStateInvariants(
  next: EvidenceState,
  previous: EvidenceState | null,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];

  if (next.schemaVersion !== EVIDENCE_STATE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'EVIDENCE_STATE_SCHEMA_VERSION',
        ['schemaVersion'],
        `Evidence state must use ${EVIDENCE_STATE_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (hasSourceContentKey(next)) {
    issues.push(
      issue(
        'EVIDENCE_STATE_CONTENT_LEAK',
        [],
        'Evidence state must not copy source, quote or rationale content.',
      ),
    );
  }

  const documents = expectedDocumentSet(next);
  const memories = new Set(next.memoryIds);
  const standingById = new Map(
    next.standings.map((entry) => [entry.objectId, entry]),
  );
  next.standings.forEach((entry, index) => {
    const available = isDocumentKind(entry.objectKind)
      ? documents.has(entry.objectId)
      : memories.has(entry.objectId);
    if (!available) {
      issues.push(
        issue(
          'EVIDENCE_STANDING_REFERENCE_MISSING',
          ['standings', index, 'objectId'],
          'Every standing must reference an indexed document or memory id.',
        ),
      );
    }
  });

  next.currentRelationVersionIds.forEach((relationId, index) => {
    const standing = standingById.get(relationId);
    if (
      standing?.objectKind !== 'evidence-relation' ||
      standing.standing === 'rejected' ||
      standing.standing === 'superseded'
    ) {
      issues.push(
        issue(
          'EVIDENCE_CURRENT_RELATION_INVALID',
          ['currentRelationVersionIds', index],
          'Current relation pointers require a non-rejected relation standing.',
        ),
      );
    }
  });
  next.currentOpenQuestionIds.forEach((questionId, index) => {
    const standing = standingById.get(questionId);
    if (
      standing?.objectKind !== 'open-question' ||
      standing.standing === 'rejected' ||
      standing.standing === 'superseded'
    ) {
      issues.push(
        issue(
          'EVIDENCE_CURRENT_QUESTION_INVALID',
          ['currentOpenQuestionIds', index],
          'Current question pointers require a non-rejected question standing.',
        ),
      );
    }
  });

  if (previous !== null) {
    if (
      next.evidenceRevision < previous.evidenceRevision ||
      next.evidenceRevision > previous.evidenceRevision + 1
    ) {
      issues.push(
        issue(
          'EVIDENCE_REVISION_NON_MONOTONIC',
          ['evidenceRevision'],
          'Evidence revision may stay equal or advance by exactly one.',
        ),
      );
    }
    for (const [path, before, after] of [
      ['sourceDocumentIds', previous.sourceDocumentIds, next.sourceDocumentIds],
      [
        'assessmentDocumentIds',
        previous.assessmentDocumentIds,
        next.assessmentDocumentIds,
      ],
      ['memoryIds', previous.memoryIds, next.memoryIds],
    ] as const) {
      for (const id of before) {
        if (!after.includes(id)) {
          issues.push(
            issue(
              'EVIDENCE_INDEX_ENTRY_DROPPED',
              [path, id],
              'Evidence indexes are append-only.',
            ),
          );
        }
      }
    }

    const nextStandings = new Map(
      next.standings.map((entry) => [standingKey(entry), entry]),
    );
    for (const prior of previous.standings) {
      const current = nextStandings.get(standingKey(prior));
      if (current === undefined) {
        issues.push(
          issue(
            'EVIDENCE_STANDING_DROPPED',
            ['standings', standingKey(prior)],
            'Evidence standings cannot disappear.',
          ),
        );
      } else if (!validStandingTransition(prior.standing, current.standing)) {
        issues.push(
          issue(
            'EVIDENCE_STANDING_TRANSITION',
            ['standings', standingKey(prior)],
            `Standing cannot move from ${prior.standing} to ${current.standing}.`,
          ),
        );
      }
    }
  }

  return immutableEvidence(issues);
}

export function evidenceRelationInvariants(
  relation: EvidenceRelation,
  availableEndpointIds: readonly string[],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const parsed = EvidenceRelationSchema.safeParse(relation);
  if (!parsed.success) {
    return immutableEvidence([
      issue(
        'EVIDENCE_RELATION_SCHEMA',
        [],
        'Evidence relation schema validation failed.',
      ),
    ]);
  }
  const available = new Set(availableEndpointIds);
  parsed.data.endpoints.forEach((endpoint, index) => {
    if (!available.has(endpoint.id)) {
      issues.push(
        issue(
          'EVIDENCE_RELATION_ENDPOINT_MISSING',
          ['endpoints', index, 'id'],
          'Every relation endpoint must resolve before canonicalization.',
        ),
      );
    }
  });
  const expected = deriveEvidenceRelationId(parsed.data);
  if (parsed.data.relationId !== expected) {
    issues.push(
      issue(
        'EVIDENCE_RELATION_ID',
        ['relationId'],
        'Relation identity does not match evidence-relation-id-1.',
      ),
    );
  }
  return immutableEvidence(issues);
}

function assessmentContent(value: EvidenceAssessment): JsonValue {
  return {
    claims: value.claims as unknown as JsonValue,
    openQuestionIds: value.openQuestionIds,
    citations: value.citations as unknown as JsonValue,
    predecessorAssessmentVersionId: value.predecessorAssessmentVersionId,
  };
}

export function evidenceAssessmentInvariants(
  assessment: EvidenceAssessment,
  currentEvidenceRevision: number,
  acceptedEvidenceIds: readonly string[],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const parsed = EvidenceAssessmentSchema.safeParse(assessment);
  if (!parsed.success) {
    return immutableEvidence([
      issue(
        'EVIDENCE_ASSESSMENT_SCHEMA',
        [],
        'Evidence assessment schema validation failed.',
      ),
    ]);
  }
  if (assessment.basisEvidenceRevision > currentEvidenceRevision) {
    issues.push(
      issue(
        'EVIDENCE_ASSESSMENT_FUTURE_BASIS',
        ['basisEvidenceRevision'],
        'Assessment basis cannot exceed current evidence revision.',
      ),
    );
  }
  const expectedHash = deriveEvidenceAssessmentContentHash(
    assessmentContent(assessment),
  );
  if (assessment.contentHash !== expectedHash) {
    issues.push(
      issue(
        'EVIDENCE_ASSESSMENT_CONTENT_HASH',
        ['contentHash'],
        'Assessment content hash is invalid.',
      ),
    );
  }
  if (
    assessment.assessmentVersionId !== deriveEvidenceAssessmentId(assessment)
  ) {
    issues.push(
      issue(
        'EVIDENCE_ASSESSMENT_ID',
        ['assessmentVersionId'],
        'Assessment identity does not match evidence-assessment-id-1.',
      ),
    );
  }
  const accepted = new Set(acceptedEvidenceIds);
  const citedIds = assessment.citations.map(({ evidenceId }) => evidenceId);
  for (const claim of assessment.claims) {
    for (const id of [
      ...claim.supportObservationIds,
      ...claim.conflictRelationIds,
      ...claim.qualificationRelationIds,
    ]) {
      if (!accepted.has(id) || !citedIds.includes(id)) {
        issues.push(
          issue(
            'EVIDENCE_ASSESSMENT_CITATION_MISSING',
            ['claims', claim.claimKey, id],
            'Every assessment reference must be accepted and cited.',
          ),
        );
      }
    }
  }
  return immutableEvidence(issues);
}
