import type { FixtureChangeProposal } from '../fixture-approval.js';
import type {
  FixtureProposalView,
  FixtureReviewView,
} from '../read-model/fixture-review.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

export interface FixtureReviewNotice {
  readonly level: 'info' | 'error';
  readonly message: string;
}

export interface FixtureReviewRenderOptions {
  readonly csrfToken: string;
  readonly proposal?: FixtureChangeProposal | null;
  readonly notice?: FixtureReviewNotice;
}

function badge(value: string, kind: string): string {
  return `<span class="badge badge-${kind}">${escapeHtml(value)}</span>`;
}

function statusBadge(status: FixtureProposalView['status']): string {
  const kind =
    status === 'approved' ? 'pass' : status === 'rejected' ? 'fail' : 'warn';
  return badge(status, kind);
}

function proposalValue(
  proposal: FixtureChangeProposal | null | undefined,
  field: keyof FixtureChangeProposal,
): string {
  return proposal === null || proposal === undefined
    ? ''
    : escapeHtml(proposal[field]);
}

function hiddenProposal(proposal: FixtureProposalView): string {
  const fields: readonly (keyof FixtureChangeProposal)[] = [
    'proposalId',
    'fixturePath',
    'expectedDigest',
    'proposedDigest',
    'runId',
    'executionId',
  ];
  return fields
    .map(
      (field) =>
        `<input type="hidden" name="${field}" value="${escapeHtml(proposal[field])}"/>`,
    )
    .join('');
}

function decision(proposal: FixtureProposalView, csrfToken: string): string {
  if (proposal.decision.availability === 'available') {
    return `<section class="decision-panel">
<h4>Recorded decision</h4>
<dl class="facts">
<div><dt>Reviewer</dt><dd>${escapeHtml(proposal.decision.approver)}</dd></div>
<div><dt>Decided at</dt><dd class="mono">${escapeHtml(proposal.decision.decidedAt)}</dd></div>
<div><dt>Rationale</dt><dd>${escapeHtml(proposal.decision.rationale)}</dd></div>
</dl>
</section>`;
  }

  return `<section class="decision-panel">
<h4>Record a human decision</h4>
<p class="meta">Pending remains pending until a named reviewer submits one of these explicit decisions. <code>${escapeHtml(proposal.decision.reason)}</code></p>
<form method="post" action="/s9/decision" class="decision-form">
<input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}"/>
${hiddenProposal(proposal)}
<label>Reviewer identity
<input name="approver" required autocomplete="name"/>
</label>
<label>Rationale
<textarea name="rationale" required rows="4" placeholder="Explain the evidence you reviewed and why this change should be accepted or rejected."></textarea>
</label>
<div class="actions">
<button class="primary" type="submit" name="decision" value="approved">Approve proposed change</button>
<button type="submit" name="decision" value="rejected">Reject proposed change</button>
</div>
</form>
</section>`;
}

function proposalCard(
  proposal: FixtureProposalView,
  csrfToken: string,
): string {
  return `<article class="card fixture-proposal" data-proposal="${escapeHtml(proposal.proposalId)}">
<div class="section-heading"><h3><code>${escapeHtml(proposal.proposalId)}</code></h3>${statusBadge(proposal.status)}</div>
<dl class="facts">
<div><dt>Fixture</dt><dd><code>${escapeHtml(proposal.fixturePath)}</code></dd></div>
<div><dt>Run</dt><dd><code>${escapeHtml(proposal.runId)}</code></dd></div>
<div><dt>Execution</dt><dd><code>${escapeHtml(proposal.executionId)}</code></dd></div>
</dl>
<div class="digest-change" aria-label="Digest change">
<div><span class="meta">Pinned digest</span><code>${escapeHtml(proposal.expectedDigest)}</code></div>
<span aria-hidden="true">→</span>
<div><span class="meta">Proposed digest</span><code>${escapeHtml(proposal.proposedDigest)}</code></div>
</div>
<div class="info-banner fixture-instruction"><strong>Not applied.</strong> ${escapeHtml(proposal.change.instruction)}</div>
${decision(proposal, csrfToken)}
</article>`;
}

/** Pure S9 renderer over the supplied fixture-review view and form options. */
export function renderFixtureReviewViewHtml(
  view: FixtureReviewView,
  options: FixtureReviewRenderOptions,
): string {
  const staged = options.proposal;
  const notice =
    options.notice === undefined
      ? ''
      : `<div class="${options.notice.level === 'error' ? 'error-banner' : 'info-banner'}" role="status">${escapeHtml(options.notice.message)}</div>`;
  const unreadable =
    view.unreadable.length === 0
      ? ''
      : `<section class="card error-banner"><h3>Unreadable approval records</h3><p>No file was hidden: ${view.unreadable.map((name) => `<code>${escapeHtml(name)}</code>`).join(', ')}</p></section>`;
  const proposals =
    view.proposals.length === 0
      ? '<section class="card"><p class="empty">No fixture proposals or recorded decisions in this workspace.</p></section>'
      : view.proposals
          .map((proposal) => proposalCard(proposal, options.csrfToken))
          .join('');

  const staging = `<section class="card">
<div class="section-heading"><h3>Stage a proposal for review</h3><span class="meta">request-local · not persisted</span></div>
<p>Supply the exact proposal produced by your test tooling. S9 checks the run/execution link, but it does not infer or verify digest values against fixture contents.</p>
<form method="get" action="/s9" class="fixture-form">
<label>Proposal id
<input name="proposalId" required value="${proposalValue(staged, 'proposalId')}" placeholder="proposal-001"/>
</label>
<label>Fixture path below scenario root
<input name="fixturePath" required value="${proposalValue(staged, 'fixturePath')}" placeholder="digests/narrative.json"/>
</label>
<label>Expected (currently pinned) digest
<input name="expectedDigest" required value="${proposalValue(staged, 'expectedDigest')}"/>
</label>
<label>Proposed (observed) digest
<input name="proposedDigest" required value="${proposalValue(staged, 'proposedDigest')}"/>
</label>
<label>Workspace run id
<input name="runId" required value="${proposalValue(staged, 'runId')}"/>
</label>
<label>Recorded execution id
<input name="executionId" required value="${proposalValue(staged, 'executionId')}"/>
</label>
<div class="actions"><button class="primary" type="submit">Review proposal</button><a class="button-link" href="/s9">Clear</a></div>
</form>
</section>`;

  const summary = `<section class="card">
<p class="meta">View <code>${escapeHtml(view.view)}</code></p>
<dl class="facts">
<div><dt>Proposals</dt><dd>${view.proposalCount}</dd></div>
<div><dt>Pending</dt><dd>${view.pendingCount}</dd></div>
<div><dt>Approved</dt><dd>${view.approvedCount}</dd></div>
<div><dt>Rejected</dt><dd>${view.rejectedCount}</dd></div>
</dl>
</section>`;

  return renderShell({
    title: 'S9 Fixture review',
    surface: 's9',
    subtitle: 'Human decisions only — fixture files are never changed here.',
    body: `${notice}${staging}${summary}${unreadable}${proposals}`,
  });
}
