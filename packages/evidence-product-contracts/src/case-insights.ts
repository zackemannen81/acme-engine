import { canonicalJson, sha256 } from '@acme/core';
import { z } from 'zod';

import { effectiveReviewDecision } from './review.js';
import type { EvidenceProductSnapshot } from './schemas.js';

const NonBlank = z.string().trim().min(1);
const Citation = z.object({
  observationId: NonBlank,
  artifactVersionId: NonBlank,
  locatorId: NonBlank,
  exactQuote: NonBlank,
}).strict();

export const EvidenceCaseOverviewSchema = z.object({
  schemaVersion: z.literal('evidence-case-overview/1'),
  snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  counts: z.object({
    sources: z.number().int().nonnegative(),
    pendingObservations: z.number().int().nonnegative(),
    pendingRelations: z.number().int().nonnegative(),
    openQuestions: z.number().int().nonnegative(),
    assessmentsNeedingReview: z.number().int().nonnegative(),
  }).strict(),
  recentActivity: z.array(z.object({
    activityId: NonBlank,
    action: NonBlank,
    targetKind: NonBlank,
    targetVersionId: NonBlank,
    principalRef: NonBlank,
    occurredAt: z.iso.datetime({ offset: true }),
  }).strict()).max(20),
}).strict();

export const EvidenceCaseIntegrityReportSchema = z.object({
  schemaVersion: z.literal('evidence-case-integrity-report/1'),
  reportId: NonBlank,
  snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  counts: z.object({
    sourceBoundObservations: z.number().int().nonnegative(),
    changedAccountPairs: z.number().int().nonnegative(),
    scopedContradictions: z.number().int().nonnegative(),
    qualifications: z.number().int().nonnegative(),
    corrections: z.number().int().nonnegative(),
    temporalConflicts: z.number().int().nonnegative(),
    unresolvedQuestions: z.number().int().nonnegative(),
    assessmentsAffectedByNewEvidence: z.number().int().nonnegative(),
  }).strict(),
  rows: z.array(z.object({
    rowId: NonBlank,
    kind: z.enum(['changed-account','contradiction','qualification','correction','temporal-conflict','unresolved-question','assessment-attention']),
    title: NonBlank,
    summary: NonBlank,
    relationId: NonBlank.nullable(),
    openQuestionId: NonBlank.nullable(),
    assessmentVersionId: NonBlank.nullable(),
    citations: z.array(Citation).min(1),
  }).strict()),
}).strict();

function digest(snapshot: EvidenceProductSnapshot): string {
  return sha256(canonicalJson(snapshot as never));
}

function citation(snapshot: EvidenceProductSnapshot, id: string) {
  const item = snapshot.observations.find((value) => value.observationId === id);
  return item === undefined ? null : {
    observationId: item.observationId,
    artifactVersionId: item.artifactVersionId,
    locatorId: item.locator.locatorId,
    exactQuote: item.exactQuote,
  };
}

function assessmentNeedsReview(snapshot: EvidenceProductSnapshot, id: string): boolean {
  const assessment = snapshot.assessments.find((item) => item.assessmentVersionId === id);
  const revision = snapshot.workspaces[0]?.evidenceRevision ?? 0;
  const decision = effectiveReviewDecision(
    snapshot.reviewDecisions.filter((item) => item.targetKind === 'assessment'),
    id,
  );
  return assessment !== undefined && (assessment.basisEvidenceRevision < revision || decision?.action === 'request-revision');
}

export function buildEvidenceCaseOverview(snapshot: EvidenceProductSnapshot) {
  const reviewed = (kind: 'observation'|'relation', id: string) => effectiveReviewDecision(
    snapshot.reviewDecisions.filter((item) => item.targetKind === kind), id,
  ) !== null;
  const value = {
    schemaVersion: 'evidence-case-overview/1' as const,
    snapshotDigest: digest(snapshot),
    counts: {
      sources: snapshot.sources.length,
      pendingObservations: snapshot.observations.filter((item) => !reviewed('observation', item.observationId)).length,
      pendingRelations: snapshot.relations.filter((item) => !reviewed('relation', item.relationId)).length,
      openQuestions: snapshot.openQuestions.length,
      assessmentsNeedingReview: snapshot.assessments.filter((item) => assessmentNeedsReview(snapshot, item.assessmentVersionId)).length,
    },
    recentActivity: [...snapshot.reviewActivity].sort((a,b) => b.occurredAt.localeCompare(a.occurredAt) || b.activityId.localeCompare(a.activityId)).slice(0,20).map(({activityId,action,targetKind,targetVersionId,principalRef,occurredAt}) => ({activityId,action,targetKind,targetVersionId,principalRef,occurredAt})),
  };
  return EvidenceCaseOverviewSchema.parse(value);
}

export function buildEvidenceCaseIntegrityReport(snapshot: EvidenceProductSnapshot) {
  const snapshotDigest = digest(snapshot);
  const rows: z.input<typeof EvidenceCaseIntegrityReportSchema>['rows'] = [];
  for (const relation of snapshot.relations) {
    const citations = relation.endpoints.map((endpoint) => citation(snapshot, endpoint.id)).filter((item): item is NonNullable<typeof item> => item !== null);
    if (citations.length === 0) continue;
    const temporal = /time|date|temporal/iu.test(`${relation.comparableScope.aspect} ${relation.rationaleCode}`);
    const changed = /changed-account/iu.test(relation.rationaleCode);
    const kind = changed ? 'changed-account' : temporal && relation.relationKind === 'contradicts' ? 'temporal-conflict' : relation.relationKind === 'contradicts' ? 'contradiction' : relation.relationKind === 'qualifies' ? 'qualification' : relation.relationKind === 'correction' ? 'correction' : null;
    if (kind === null) continue;
    rows.push({ rowId: `integrity-${sha256(canonicalJson({kind,id:relation.relationId}))}`, kind, title: `${kind.replaceAll('-', ' ')}: ${relation.comparableScope.subject}`, summary: relation.rationale, relationId: relation.relationId, openQuestionId: null, assessmentVersionId: null, citations });
  }
  for (const question of snapshot.openQuestions) {
    const citations = question.triggeringEvidenceIds.map((id) => citation(snapshot,id)).filter((item): item is NonNullable<typeof item> => item !== null);
    if (citations.length > 0) rows.push({ rowId: `integrity-${sha256(canonicalJson({kind:'unresolved-question',id:question.openQuestionId}))}`, kind:'unresolved-question', title: question.questionCode, summary: question.questionText, relationId:null, openQuestionId:question.openQuestionId, assessmentVersionId:null, citations });
  }
  for (const assessment of snapshot.assessments.filter((item) => assessmentNeedsReview(snapshot,item.assessmentVersionId))) {
    const citations = assessment.citations.map((item) => citation(snapshot,item.evidenceId)).filter((item): item is NonNullable<typeof item> => item !== null);
    if (citations.length > 0) rows.push({ rowId: `integrity-${sha256(canonicalJson({kind:'assessment-attention',id:assessment.assessmentVersionId}))}`, kind:'assessment-attention', title:`Assessment ${assessment.sequence} needs re-review`, summary:'New evidence or an explicit review decision requires renewed assessment review.', relationId:null, openQuestionId:null, assessmentVersionId:assessment.assessmentVersionId, citations });
  }
  rows.sort((a,b) => `${a.kind}\0${a.rowId}`.localeCompare(`${b.kind}\0${b.rowId}`));
  const count = (kind: typeof rows[number]['kind']) => rows.filter((row) => row.kind === kind).length;
  return EvidenceCaseIntegrityReportSchema.parse({ schemaVersion:'evidence-case-integrity-report/1', reportId:`integrity-report-${sha256(canonicalJson({schemaVersion:'evidence-case-integrity-report/1',snapshotDigest,rows}))}`, snapshotDigest, counts:{sourceBoundObservations:snapshot.observations.length,changedAccountPairs:count('changed-account'),scopedContradictions:count('contradiction'),qualifications:count('qualification'),corrections:count('correction'),temporalConflicts:count('temporal-conflict'),unresolvedQuestions:count('unresolved-question'),assessmentsAffectedByNewEvidence:count('assessment-attention')}, rows });
}

export type EvidenceCaseOverview = z.infer<typeof EvidenceCaseOverviewSchema>;
export type EvidenceCaseIntegrityReport = z.infer<typeof EvidenceCaseIntegrityReportSchema>;
