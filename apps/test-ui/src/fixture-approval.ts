import { resolveReference } from './catalog/paths.js';
import { isSafeRunId } from './run-record.js';

/**
 * Golden-fixture change proposals and their approvals (ADR-0022).
 *
 * Approving a change records that a human accepted it. It does not write the
 * fixture. A golden is a pinned expectation, and an interface that could
 * rewrite one would become the author of the answer it is supposed to be
 * checking against.
 */

export const FIXTURE_APPROVAL_VERSION = 'acme-fixture-approval/1' as const;

export interface FixtureChangeProposal {
  /** Identifies the proposal; becomes a file name, so it is validated. */
  readonly proposalId: string;
  /** Fixture path, relative to the scenario root. */
  readonly fixturePath: string;
  /** The digest the fixture pins today. */
  readonly expectedDigest: string;
  /** The digest a run actually produced. */
  readonly proposedDigest: string;
  /** The run that produced the difference. */
  readonly runId: string;
  readonly executionId: string;
}

export type ApprovalDecision = 'approved' | 'rejected';

export interface FixtureApprovalRecord {
  readonly version: typeof FIXTURE_APPROVAL_VERSION;
  readonly proposalId: string;
  readonly fixturePath: string;
  readonly expectedDigest: string;
  readonly proposedDigest: string;
  readonly runId: string;
  readonly executionId: string;
  readonly decision: ApprovalDecision;
  readonly approver: string;
  readonly rationale: string;
  readonly decidedAt: string;
}

export interface ApprovalInput {
  readonly proposal: FixtureChangeProposal;
  readonly decision: ApprovalDecision;
  readonly approver: string;
  readonly rationale: string;
  readonly decidedAt: string;
}

export class ApprovalRefused extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.name = 'ApprovalRefused';
    this.reason = reason;
  }
}

export const APPROVAL_REFUSAL = {
  proposalId: 'APPROVAL_PROPOSAL_ID_UNSAFE',
  fixturePath: 'APPROVAL_FIXTURE_PATH_REFUSED',
  approver: 'APPROVAL_APPROVER_REQUIRED',
  rationale: 'APPROVAL_RATIONALE_REQUIRED',
  identicalDigests: 'APPROVAL_NOTHING_TO_DECIDE',
} as const;

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Build an approval record, or refuse.
 *
 * There is no automatic acceptance path: no threshold, no "identical except
 * timestamps", no batch mode. Every decision names a person and a reason.
 */
export function decideFixtureChange(
  input: ApprovalInput,
): FixtureApprovalRecord {
  const { proposal } = input;

  if (!isSafeRunId(proposal.proposalId)) {
    throw new ApprovalRefused(
      APPROVAL_REFUSAL.proposalId,
      `A proposal identifier must be a safe file name: ${JSON.stringify(
        proposal.proposalId,
      )}`,
    );
  }
  if (resolveReference(proposal.fixturePath).status === 'refused') {
    throw new ApprovalRefused(
      APPROVAL_REFUSAL.fixturePath,
      `A fixture path must stay below the scenario root: ${proposal.fixturePath}`,
    );
  }
  if (!nonEmpty(input.approver)) {
    throw new ApprovalRefused(
      APPROVAL_REFUSAL.approver,
      'An approval requires an approver identity.',
    );
  }
  if (!nonEmpty(input.rationale)) {
    throw new ApprovalRefused(
      APPROVAL_REFUSAL.rationale,
      'An approval requires a non-empty rationale.',
    );
  }
  if (proposal.expectedDigest === proposal.proposedDigest) {
    // Nothing changed, so there is no decision to record. Accepting one would
    // create an approval that claims a human reviewed a difference.
    throw new ApprovalRefused(
      APPROVAL_REFUSAL.identicalDigests,
      'The proposed digest equals the pinned digest; there is nothing to decide.',
    );
  }

  return {
    version: FIXTURE_APPROVAL_VERSION,
    proposalId: proposal.proposalId,
    fixturePath: proposal.fixturePath,
    expectedDigest: proposal.expectedDigest,
    proposedDigest: proposal.proposedDigest,
    runId: proposal.runId,
    executionId: proposal.executionId,
    decision: input.decision,
    approver: input.approver,
    rationale: input.rationale,
    decidedAt: input.decidedAt,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** Read a stored approval back, or `null` so one bad file is not fatal. */
export function parseFixtureApproval(
  raw: unknown,
): FixtureApprovalRecord | null {
  if (!isObject(raw) || raw['version'] !== FIXTURE_APPROVAL_VERSION) {
    return null;
  }
  const fields = {
    proposalId: text(raw['proposalId']),
    fixturePath: text(raw['fixturePath']),
    expectedDigest: text(raw['expectedDigest']),
    proposedDigest: text(raw['proposedDigest']),
    runId: text(raw['runId']),
    executionId: text(raw['executionId']),
    approver: text(raw['approver']),
    rationale: text(raw['rationale']),
    decidedAt: text(raw['decidedAt']),
  };
  const decision = raw['decision'];

  if (
    Object.values(fields).some((value) => value === null) ||
    (decision !== 'approved' && decision !== 'rejected') ||
    fields.proposalId === null ||
    !isSafeRunId(fields.proposalId)
  ) {
    return null;
  }

  return {
    version: FIXTURE_APPROVAL_VERSION,
    proposalId: fields.proposalId,
    fixturePath: fields.fixturePath ?? '',
    expectedDigest: fields.expectedDigest ?? '',
    proposedDigest: fields.proposedDigest ?? '',
    runId: fields.runId ?? '',
    executionId: fields.executionId ?? '',
    decision,
    approver: fields.approver ?? '',
    rationale: fields.rationale ?? '',
    decidedAt: fields.decidedAt ?? '',
  };
}
