import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EVIDENCE_WORKSPACE_SCHEMA_VERSION,
  EvidenceProductSnapshotSchema,
  buildEvidenceCaseIntegrityReport,
  buildEvidenceCaseOverview,
} from '@acme/evidence-product-contracts';
import type { EvidenceProductSnapshot } from '@acme/evidence-product-contracts';

import { evaluationObserveCases } from '../src/evaluation-candidates.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';

const WORKSPACE_ID = 'workspace-evaluation';

function goldenSnapshot(evidenceRevision = 7): EvidenceProductSnapshot {
  const material = buildGoldenMaterial(loadSealedEvaluationTruth());
  const assessment = material.assessments.get('E-A01');
  if (assessment === undefined) throw new Error('Missing E-A01.');
  return EvidenceProductSnapshotSchema.parse({
    schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
    workspaces: [
      {
        schemaVersion: EVIDENCE_WORKSPACE_SCHEMA_VERSION,
        workspaceId: WORKSPACE_ID,
        label: 'Rillford Annex — integrity report',
        dataPolicy: 'synthetic-only',
        evidenceRevision,
        createdAt: '2026-08-12T00:00:00.000Z',
      },
    ],
    sources: evaluationObserveCases().map(({ input }) => input.artifactVersion),
    observations: [...material.observations.values()],
    relations: [...material.relations.values()],
    openQuestions: [...material.openQuestions.values()],
    assessments: [{ ...assessment, workspaceId: WORKSPACE_ID }],
    changeSets: [],
    jobs: [],
    reviewDecisions: [],
  });
}

function reversed(snapshot: EvidenceProductSnapshot): EvidenceProductSnapshot {
  return EvidenceProductSnapshotSchema.parse({
    ...snapshot,
    sources: [...snapshot.sources].reverse(),
    observations: [...snapshot.observations].reverse(),
    relations: [...snapshot.relations].reverse(),
    openQuestions: [...snapshot.openQuestions].reverse(),
  });
}

describe('Evidence Stage 7 case insights', () => {
  it('classifies every reviewed relation from typed evidence rather than rationale text', () => {
    const snapshot = goldenSnapshot();
    const report = buildEvidenceCaseIntegrityReport(snapshot);
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const relationId = (truthId: string) => {
      const relation = material.relations.get(truthId);
      if (relation === undefined) throw new Error(`Missing ${truthId}.`);
      return relation.relationId;
    };
    const kindOf = (truthId: string) =>
      report.rows.find((row) => row.relationId === relationId(truthId))?.kind ??
      null;

    // The two same-logical-artifact transcription corrections stay corrections.
    expect(kindOf('E-R01')).toBe('correction');
    expect(kindOf('E-R02')).toBe('correction');
    // EVAL-T02 is the same actor's later account, not a correction of EVAL-T01.
    expect(kindOf('E-R03')).toBe('changed-account');
    // Two distinct actors qualify each other; that is not a changed account.
    expect(kindOf('E-R04')).toBe('qualification');
    // The access log sets a recorded document time against claimed event times.
    expect(kindOf('E-R05')).toBe('temporal-conflict');
    expect(kindOf('E-R06')).toBe('temporal-conflict');
    // Scope mismatch and unresolved actor identity are not integrity findings.
    expect(kindOf('E-R07')).toBeNull();
    expect(kindOf('E-R08')).toBeNull();

    expect(report.counts).toEqual({
      sourceBoundObservations: 10,
      changedAccountPairs: 1,
      scopedContradictions: 0,
      qualifications: 1,
      corrections: 2,
      temporalConflicts: 2,
      unresolvedQuestions: 3,
      assessmentsAffectedByNewEvidence: 1,
    });
    expect(report.rows).toHaveLength(
      report.counts.changedAccountPairs +
        report.counts.scopedContradictions +
        report.counts.qualifications +
        report.counts.corrections +
        report.counts.temporalConflicts +
        report.counts.unresolvedQuestions +
        report.counts.assessmentsAffectedByNewEvidence,
    );
  });

  it('names the exact source-bound observation behind every row', () => {
    const snapshot = goldenSnapshot();
    const report = buildEvidenceCaseIntegrityReport(snapshot);
    expect(report.rows.length).toBeGreaterThan(0);
    for (const row of report.rows) {
      expect(row.citations.length).toBeGreaterThan(0);
      for (const cited of row.citations) {
        const observation = snapshot.observations.find(
          (item) => item.observationId === cited.observationId,
        );
        expect(observation).toBeDefined();
        expect(cited.artifactVersionId).toBe(observation?.artifactVersionId);
        expect(cited.locatorId).toBe(observation?.locator.locatorId);
        expect(cited.exactQuote).toBe(observation?.exactQuote);
        expect(
          snapshot.sources.some(
            (source) => source.artifactVersionId === cited.artifactVersionId,
          ),
        ).toBe(true);
      }
    }
  });

  it('derives identities and ordering from content, not snapshot input order', () => {
    const snapshot = goldenSnapshot();
    const report = buildEvidenceCaseIntegrityReport(snapshot);
    const overview = buildEvidenceCaseOverview(snapshot);

    expect(buildEvidenceCaseIntegrityReport(snapshot)).toEqual(report);
    expect(buildEvidenceCaseIntegrityReport(reversed(snapshot))).toEqual(
      report,
    );
    expect(buildEvidenceCaseOverview(reversed(snapshot))).toEqual(overview);
    expect(report.snapshotDigest).toBe(overview.snapshotDigest);
    expect(report.rows.map((row) => `${row.kind} ${row.rowId}`)).toEqual(
      [...report.rows.map((row) => `${row.kind} ${row.rowId}`)].sort(),
    );
    expect(new Set(report.rows.map((row) => row.rowId)).size).toBe(
      report.rows.length,
    );
  });

  it('changes the report basis when the case evidence or review overlay changes', () => {
    const report = buildEvidenceCaseIntegrityReport(goldenSnapshot());
    const laterBasis = buildEvidenceCaseIntegrityReport(goldenSnapshot(8));
    expect(laterBasis.snapshotDigest).not.toBe(report.snapshotDigest);
    expect(laterBasis.reportId).not.toBe(report.reportId);

    const snapshot = goldenSnapshot();
    const [observation] = snapshot.observations;
    if (observation === undefined) throw new Error('Missing observation.');
    const reviewed = EvidenceProductSnapshotSchema.parse({
      ...snapshot,
      reviewDecisions: [
        {
          schemaVersion: 'evidence-review-decision/1',
          reviewDecisionId: 'review-observation-accept',
          workspaceId: WORKSPACE_ID,
          targetKind: 'observation',
          targetVersionId: observation.observationId,
          action: 'accept',
          reviewerRef: 'local-reviewer',
          principalAssurance: 'unauthenticated-local',
          rationale: 'Checked against the exact cited source lines.',
          decidedAt: '2026-08-12T01:00:00.000Z',
          commandKey: 'review-observation-accept',
          basisEvidenceRevision: null,
        },
      ],
    });
    const afterReview = buildEvidenceCaseIntegrityReport(reviewed);
    expect(afterReview.snapshotDigest).not.toBe(report.snapshotDigest);
    expect(afterReview.rows).toEqual(report.rows);
    expect(buildEvidenceCaseOverview(reviewed).counts).toMatchObject({
      pendingObservations: 9,
    });
  });

  it('counts the case entry point from one authorized snapshot', () => {
    const overview = buildEvidenceCaseOverview(goldenSnapshot());
    expect(overview.counts).toEqual({
      sources: 5,
      pendingObservations: 10,
      pendingRelations: 8,
      openQuestions: 3,
      assessmentsNeedingReview: 1,
    });
    expect(overview.recentActivity).toEqual([]);
  });
});
