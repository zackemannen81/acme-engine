import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EVIDENCE_WORKSPACE_SCHEMA_VERSION,
  EvidenceProductSnapshotSchema,
} from '@acme/evidence-product-contracts';
import {
  buildEvidencePrimaryAccountComparisonView,
  buildEvidencePrimaryObservationLedgerView,
  scanPrimaryViewVocabulary,
} from '@acme/evidence-views';
import {
  EVIDENCE_STATE_SCHEMA_VERSION,
  EvidenceStateSchema,
} from '@acme/module-evidence';

import { evaluationObserveCases } from '../src/evaluation-candidates.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';

describe('Evidence slice-2 primary views', () => {
  it('shows correction lineage and later changed accounts without overwriting prior versions', () => {
    const cases = evaluationObserveCases();
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const observations = [...material.observations.values()].sort(
      (left, right) => left.observationId.localeCompare(right.observationId),
    );
    const sources = cases
      .map(({ input }) => input.artifactVersion)
      .sort((left, right) =>
        left.artifactVersionId.localeCompare(right.artifactVersionId),
      );
    const superseded = new Set(
      ['E-O01', 'E-O02'].map((truthId) => {
        const value = material.observations.get(truthId);
        if (value === undefined) throw new Error(`Missing ${truthId}.`);
        return value.observationId;
      }),
    );
    const state = EvidenceStateSchema.parse({
      schemaVersion: EVIDENCE_STATE_SCHEMA_VERSION,
      evidenceRevision: 5,
      sourceDocumentIds: sources
        .map(({ artifactVersionId }) => artifactVersionId)
        .sort(),
      assessmentDocumentIds: [],
      memoryIds: observations.map(({ observationId }) => observationId).sort(),
      standings: observations
        .map((observation) => ({
          objectKind: observation.kind,
          objectId: observation.observationId,
          standing: superseded.has(observation.observationId)
            ? ('superseded' as const)
            : ('current' as const),
        }))
        .sort((left, right) =>
          `${left.objectKind}:${left.objectId}`.localeCompare(
            `${right.objectKind}:${right.objectId}`,
          ),
        ),
      currentRelationVersionIds: [],
      currentOpenQuestionIds: [],
    });
    const snapshot = EvidenceProductSnapshotSchema.parse({
      schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
      workspaces: [
        {
          schemaVersion: EVIDENCE_WORKSPACE_SCHEMA_VERSION,
          workspaceId: 'workspace-evaluation',
          label: 'Rillford Annex — account review',
          dataPolicy: 'synthetic-only',
          evidenceRevision: 5,
          createdAt: '2026-08-11T12:00:00.000Z',
        },
      ],
      sources,
      observations,
      relations: [],
      openQuestions: [],
      assessments: [],
      changeSets: [],
      jobs: [],
      reviewDecisions: [],
    });

    const ledger = buildEvidencePrimaryObservationLedgerView({
      workspaceId: 'workspace-evaluation',
      snapshot,
      evidenceState: state,
    });
    const comparison = buildEvidencePrimaryAccountComparisonView({
      workspaceId: 'workspace-evaluation',
      correctionLogicalArtifactId: 'EVAL-T01',
      changedAccountLogicalArtifactIds: ['EVAL-T02'],
      snapshot,
      evidenceState: state,
    });

    expect(ledger.summary).toEqual({
      total: 10,
      current: 8,
      contested: 0,
      superseded: 2,
      rejected: 0,
    });
    const first = ledger.entries[0];
    if (first === undefined) throw new Error('Missing ledger entry.');
    expect(first.card.schemaVersion).toBe('evidence-observation-card/1');
    expect(first.card.observationVersionId).toBe(first.observationVersionId);
    expect(first.card.exactQuote).toBe(first.exactQuote);
    expect(first.card.citation).toEqual(first.citation);
    expect(comparison.correction.pairs).toHaveLength(2);
    expect(
      comparison.correction.pairs.map(
        ({ predecessorStanding, successorStanding }) => [
          predecessorStanding,
          successorStanding,
        ],
      ),
    ).toEqual([
      ['superseded', 'current'],
      ['superseded', 'current'],
    ]);
    expect(comparison.laterAccounts).toHaveLength(1);
    expect(comparison.laterAccounts[0]?.observations).toHaveLength(2);
    expect(comparison.priorVersionNavigation).toHaveLength(3);
    expect(scanPrimaryViewVocabulary({ ledger, comparison })).toEqual([]);
    expect(Object.isFrozen(ledger.entries)).toBe(true);
    expect(Object.isFrozen(comparison.correction.pairs)).toBe(true);
  });
});
