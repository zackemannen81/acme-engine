import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_RELATION_SCHEMA_VERSION,
  deriveEvidenceAssessmentContentHash,
  deriveEvidenceAssessmentId,
  deriveEvidenceRelationId,
  evidenceAssessmentInvariants,
  evidenceDeltaInvariants,
  evidenceRelationInvariants,
  evidenceStateInvariants,
  initialEvidenceState,
  reduceEvidenceState,
  type EvidenceAssessment,
  type EvidenceDelta,
  type EvidenceRelation,
  type EvidenceState,
  type SourceArtifactVersion,
} from '../src/index.js';

const sourceId = `evidence_artifact_${'a'.repeat(64)}`;
const successorSourceId = `evidence_artifact_${'b'.repeat(64)}`;
const observationId = `evidence_observation_${'c'.repeat(64)}`;
const successorObservationId = `evidence_observation_${'d'.repeat(64)}`;

function source(
  artifactVersionId: string,
  versionOrdinal: number,
  predecessorVersionId: string | null,
): SourceArtifactVersion {
  return {
    schemaVersion: 'evidence-source-artifact-version/1',
    corpusId: 'rillford-annex-review-1',
    logicalArtifactId: 'EVAL-T01',
    artifactVersionId,
    versionOrdinal,
    kind: 'interview-transcript',
    title: 'Synthetic source',
    contentHash: 'e'.repeat(64),
    locatorScheme: 'line-range-1',
    lineCount: 1,
    predecessorVersionId,
    correctionReason:
      predecessorVersionId === null ? null : 'transcription-correction',
    text: 'Synthetic source\n',
  };
}

function correctionDelta(withSuccessor = true): EvidenceDelta {
  return {
    schemaVersion: 'evidence-delta/1',
    nextEvidenceRevision: 2,
    addSourceDocumentIds: [successorSourceId],
    addAssessmentDocumentIds: [],
    addMemoryIds: withSuccessor ? [successorObservationId] : [],
    standingChanges: [
      {
        objectKind: 'statement-occurrence',
        objectId: observationId,
        from: 'current',
        to: 'superseded',
        transition: 'correction',
        correctionLineage: {
          logicalArtifactId: 'EVAL-T01',
          predecessorArtifactVersionId: sourceId,
          successorArtifactVersionId: successorSourceId,
          successorObjectId: successorObservationId,
        },
      },
      ...(withSuccessor
        ? [
            {
              objectKind: 'statement-occurrence' as const,
              objectId: successorObservationId,
              from: null,
              to: 'current' as const,
              transition: 'create' as const,
              correctionLineage: null,
            },
          ]
        : []),
    ],
    currentRelationVersionIds: [],
    currentOpenQuestionIds: [],
  };
}

describe('Evidence state', () => {
  it('starts compact and applies identifier-only deltas immutably', () => {
    const initial = initialEvidenceState();
    const delta: EvidenceDelta = {
      schemaVersion: 'evidence-delta/1',
      nextEvidenceRevision: 1,
      addSourceDocumentIds: [sourceId],
      addAssessmentDocumentIds: [],
      addMemoryIds: [observationId],
      standingChanges: [
        {
          objectKind: 'statement-occurrence',
          objectId: observationId,
          from: null,
          to: 'current',
          transition: 'create',
          correctionLineage: null,
        },
      ],
      currentRelationVersionIds: [],
      currentOpenQuestionIds: [],
    };
    expect(evidenceDeltaInvariants(initial, delta)).toEqual([]);
    const next = reduceEvidenceState(initial, delta);
    expect(next.evidenceRevision).toBe(1);
    expect(next.sourceDocumentIds).toEqual([sourceId]);
    expect(next.memoryIds).toEqual([observationId]);
    expect(Object.isFrozen(next)).toBe(true);
    expect(initial.evidenceRevision).toBe(0);
  });

  it('requires explicit source lineage and a current correction successor', () => {
    const previous: EvidenceState = {
      ...initialEvidenceState(),
      evidenceRevision: 1,
      sourceDocumentIds: [sourceId],
      memoryIds: [observationId],
      standings: [
        {
          objectKind: 'statement-occurrence',
          objectId: observationId,
          standing: 'current',
        },
      ],
    };
    expect(
      evidenceDeltaInvariants(previous, correctionDelta(), [
        source(sourceId, 1, null),
        source(successorSourceId, 2, sourceId),
      ]),
    ).toEqual([]);
    expect(
      evidenceDeltaInvariants(previous, correctionDelta(false), [
        source(sourceId, 1, null),
        source(successorSourceId, 2, sourceId),
      ]).map(({ code }) => code),
    ).toContain('EVIDENCE_CORRECTION_SUCCESSOR_NOT_CURRENT');
  });

  it('rejects skipped revisions, missing references and source-content leakage', () => {
    const skipped = {
      ...initialEvidenceState(),
      evidenceRevision: 2,
    };
    expect(
      evidenceStateInvariants(skipped, initialEvidenceState()).map(
        ({ code }) => code,
      ),
    ).toContain('EVIDENCE_REVISION_NON_MONOTONIC');
    const missing = {
      ...initialEvidenceState(),
      standings: [
        {
          objectKind: 'statement-occurrence' as const,
          objectId: observationId,
          standing: 'current' as const,
        },
      ],
    };
    expect(
      evidenceStateInvariants(missing, null).map(({ code }) => code),
    ).toContain('EVIDENCE_STANDING_REFERENCE_MISSING');
    const leaked = { ...initialEvidenceState(), sourceText: 'forbidden' };
    expect(
      evidenceStateInvariants(leaked as unknown as EvidenceState, null).map(
        ({ code }) => code,
      ),
    ).toContain('EVIDENCE_STATE_CONTENT_LEAK');
  });

  it('rejects relations with missing endpoints and assessments from the future', () => {
    const endpoints = [
      { kind: 'observation' as const, id: observationId },
      { kind: 'observation' as const, id: successorObservationId },
    ];
    const comparableScope = {
      subject: 'panel',
      aspect: 'position',
      actorReferenceKeys: [],
      temporalBounds: [],
    };
    const relation: EvidenceRelation = {
      schemaVersion: EVIDENCE_RELATION_SCHEMA_VERSION,
      kind: 'evidence-relation',
      relationId: deriveEvidenceRelationId({
        relationKind: 'contradicts',
        endpoints,
        comparableScope,
        rationale: 'The scoped positions differ.',
        predecessorRelationId: null,
      }),
      relationKind: 'contradicts',
      endpoints,
      comparableScope,
      rationaleCode: 'POSITION_DIFFERS',
      rationale: 'The scoped positions differ.',
      predecessorRelationId: null,
    };
    expect(
      evidenceRelationInvariants(relation, [observationId]).map(
        ({ code }) => code,
      ),
    ).toContain('EVIDENCE_RELATION_ENDPOINT_MISSING');

    const claims = [
      {
        claimKey: 'claim-1',
        text: 'A source-bound claim.',
        supportObservationIds: [observationId],
        conflictRelationIds: [],
        qualificationRelationIds: [],
        supportUnresolved: false,
        uncertainty: 'low' as const,
        uncertaintyRationale: 'One accepted source-bound observation.',
      },
    ];
    const citations = [
      {
        evidenceId: observationId,
        artifactVersionId: sourceId,
        locatorId: `evidence_locator_${'f'.repeat(64)}`,
      },
    ];
    const contentHash = deriveEvidenceAssessmentContentHash({
      claims,
      openQuestionIds: [],
      citations,
      predecessorAssessmentVersionId: null,
    });
    const assessmentInput = {
      workspaceId: 'workspace-1',
      sequence: 1,
      basisEvidenceRevision: 2,
      contentHash,
    };
    const assessment: EvidenceAssessment = {
      schemaVersion: EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
      assessmentVersionId: deriveEvidenceAssessmentId(assessmentInput),
      ...assessmentInput,
      claims,
      openQuestionIds: [],
      citations,
      predecessorAssessmentVersionId: null,
    };
    expect(
      evidenceAssessmentInvariants(assessment, 1, [observationId]).map(
        ({ code }) => code,
      ),
    ).toContain('EVIDENCE_ASSESSMENT_FUTURE_BASIS');
  });
});
