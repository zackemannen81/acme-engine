import {
  available,
  unavailable,
  FIXTURE_REVIEW_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';
import type {
  ApprovalDecision,
  FixtureApprovalRecord,
  FixtureChangeProposal,
} from '../fixture-approval.js';

/**
 * S9 — fixture review (ADR-0022).
 *
 * Shows proposed golden changes and what a human decided about them. The
 * decision is never implied by the interface: a proposal with no approval is
 * pending, and pending is a state, not a soft yes.
 *
 * Approving describes a repository change; it never writes the fixture.
 */

export interface FixtureReviewEvidence {
  readonly proposals: readonly FixtureChangeProposal[];
  readonly approvals?: readonly FixtureApprovalRecord[];
  /** Approval files that exist but did not parse. */
  readonly unreadable?: readonly string[];
}

export interface ReviewableChangeView {
  readonly fixturePath: string;
  readonly expectedDigest: string;
  readonly proposedDigest: string;
  /**
   * Stated so nobody mistakes an approval for an applied change. The
   * interface records the decision; a person applies it.
   */
  readonly applied: false;
  readonly instruction: string;
}

export interface FixtureProposalView {
  readonly proposalId: string;
  readonly fixturePath: string;
  readonly expectedDigest: string;
  readonly proposedDigest: string;
  readonly runId: string;
  readonly executionId: string;
  readonly status: 'pending' | ApprovalDecision;
  readonly decision: ViewSection<{
    readonly approver: string;
    readonly rationale: string;
    readonly decidedAt: string;
  }>;
  readonly change: ReviewableChangeView;
}

export interface FixtureReviewView {
  readonly view: typeof FIXTURE_REVIEW_VIEW_VERSION;
  readonly proposals: readonly FixtureProposalView[];
  readonly proposalCount: number;
  readonly pendingCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly unreadable: readonly string[];
}

function changeView(proposal: FixtureChangeProposal): ReviewableChangeView {
  return {
    fixturePath: proposal.fixturePath,
    expectedDigest: proposal.expectedDigest,
    proposedDigest: proposal.proposedDigest,
    applied: false,
    instruction: `Update ${proposal.fixturePath} from ${proposal.expectedDigest} to ${proposal.proposedDigest} and review it as a repository change.`,
  };
}

export function buildFixtureReviewView(
  evidence: FixtureReviewEvidence,
): FixtureReviewView {
  const approvals = new Map<string, FixtureApprovalRecord>();
  for (const approval of evidence.approvals ?? []) {
    approvals.set(approval.proposalId, approval);
  }

  const proposals = [...evidence.proposals]
    .sort((left, right) =>
      left.proposalId < right.proposalId
        ? -1
        : left.proposalId > right.proposalId
          ? 1
          : 0,
    )
    .map((proposal) => {
      const approval = approvals.get(proposal.proposalId);
      return {
        proposalId: proposal.proposalId,
        fixturePath: proposal.fixturePath,
        expectedDigest: proposal.expectedDigest,
        proposedDigest: proposal.proposedDigest,
        runId: proposal.runId,
        executionId: proposal.executionId,
        // Undecided is pending, never an implied acceptance.
        status: approval?.decision ?? 'pending',
        decision:
          approval === undefined
            ? unavailable(VIEW_UNAVAILABLE.proposalPending)
            : available({
                approver: approval.approver,
                rationale: approval.rationale,
                decidedAt: approval.decidedAt,
              }),
        change: changeView(proposal),
      } satisfies FixtureProposalView;
    });

  return {
    view: FIXTURE_REVIEW_VIEW_VERSION,
    proposals,
    proposalCount: proposals.length,
    pendingCount: proposals.filter((entry) => entry.status === 'pending')
      .length,
    approvedCount: proposals.filter((entry) => entry.status === 'approved')
      .length,
    rejectedCount: proposals.filter((entry) => entry.status === 'rejected')
      .length,
    unreadable: [...(evidence.unreadable ?? [])].sort(),
  };
}
