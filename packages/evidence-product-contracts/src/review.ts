import type { EvidenceReviewDecision } from './schemas.js';

export function orderedReviewDecisions(
  decisions: readonly EvidenceReviewDecision[],
): readonly EvidenceReviewDecision[] {
  return Object.freeze(
    [...decisions].sort(
      (left, right) =>
        left.decidedAt.localeCompare(right.decidedAt) ||
        left.reviewDecisionId.localeCompare(right.reviewDecisionId),
    ),
  );
}

export function effectiveReviewDecision(
  decisions: readonly EvidenceReviewDecision[],
  targetVersionId: string,
): EvidenceReviewDecision | null {
  return (
    orderedReviewDecisions(
      decisions.filter(
        (decision) => decision.targetVersionId === targetVersionId,
      ),
    ).at(-1) ?? null
  );
}
