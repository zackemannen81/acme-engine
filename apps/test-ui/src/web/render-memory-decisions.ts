import type { PayloadView } from '../redaction.js';
import type {
  MemoryDecisionView,
  MemoryDecisionsView,
  MemoryMutationView,
} from '../read-model/memory.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

function badge(value: string, kind = 'info'): string {
  return `<span class="badge badge-${kind}">${escapeHtml(value)}</span>`;
}

function payload(value: PayloadView): string {
  switch (value.disclosure) {
    case 'revealed':
      return `<details><summary>${badge('revealed', 'warn')}</summary><pre>${escapeHtml(JSON.stringify(value.value, null, 2))}</pre></details>`;
    case 'redacted':
      return badge('redacted', 'unavailable');
    case 'not-retained':
      return `${badge('not retained', 'unavailable')} <span class="meta">policy ${escapeHtml(value.retention)}</span>`;
    case 'unavailable':
      return `${badge('unavailable', 'unavailable')} <code>${escapeHtml(value.reason)}</code>`;
  }
}

function mutation(mutationView: MemoryMutationView): string {
  return `<li class="catalog-item">
<p>${badge(mutationView.action)} <code>${escapeHtml(mutationView.memoryId)}</code> · ${badge(mutationView.status)}</p>
<dl class="facts">
<div><dt>Identity key</dt><dd><code>${escapeHtml(mutationView.identityKey)}</code></dd></div>
<div><dt>Strength</dt><dd>${mutationView.strength}</dd></div>
<div><dt>Record version</dt><dd>${mutationView.recordVersion}</dd></div>
<div><dt>Expected version</dt><dd>${mutationView.expectedRecordVersion ?? 'not applicable'}</dd></div>
<div><dt>Value</dt><dd>${payload(mutationView.value)}</dd></div>
</dl>
</li>`;
}

function decision(decisionView: MemoryDecisionView): string {
  const candidate =
    decisionView.candidate.availability === 'unavailable'
      ? `<div class="info-banner"><strong>Candidate unavailable.</strong> <code>${escapeHtml(decisionView.candidate.reason)}</code></div>`
      : `<dl class="facts">
<div><dt>Kind</dt><dd>${escapeHtml(decisionView.candidate.candidate.kind)}</dd></div>
<div><dt>Schema version</dt><dd><code>${escapeHtml(decisionView.candidate.candidate.schemaVersion)}</code></dd></div>
<div><dt>Confidence</dt><dd>${decisionView.candidate.candidate.confidence ?? 'not recorded'}</dd></div>
<div><dt>Source execution</dt><dd><code>${escapeHtml(decisionView.candidate.candidate.sourceExecutionId)}</code></dd></div>
<div><dt>Source contract</dt><dd><code>${escapeHtml(decisionView.candidate.candidate.sourceContract.id)}@${escapeHtml(decisionView.candidate.candidate.sourceContract.version)}</code></dd></div>
<div><dt>Source model call</dt><dd>${decisionView.candidate.candidate.sourceModelCallId === null ? 'not recorded' : `<code>${escapeHtml(decisionView.candidate.candidate.sourceModelCallId)}</code>`}</dd></div>
<div><dt>Source documents</dt><dd>${decisionView.candidate.candidate.sourceDocumentKeys.length === 0 ? 'none' : decisionView.candidate.candidate.sourceDocumentKeys.map((key) => `<code>${escapeHtml(key)}</code>`).join(', ')}</dd></div>
<div><dt>Candidate value</dt><dd>${payload(decisionView.candidate.candidate.value)}</dd></div>
</dl>`;

  const affected =
    decisionView.affectedMemoryIds.length === 0
      ? 'none'
      : decisionView.affectedMemoryIds
          .map((id) => `<code>${escapeHtml(id)}</code>`)
          .join(', ');
  const mutations =
    decisionView.mutations.length === 0
      ? '<p class="empty">No mutation prepared.</p>'
      : `<ul class="catalog-stack">${decisionView.mutations.map(mutation).join('')}</ul>`;

  return `<article class="card" data-decision-order="${decisionView.order}">
<div class="section-heading"><h3>Decision ${decisionView.order + 1}: <code>${escapeHtml(decisionView.candidateKey)}</code></h3><p>${badge(decisionView.action)} ${badge(decisionView.applied ? 'applied' : 'not applied', decisionView.applied ? 'pass' : 'unavailable')}</p></div>
<dl class="facts">
<div><dt>Identity key</dt><dd><code>${escapeHtml(decisionView.identityKey)}</code></dd></div>
<div><dt>Disposition</dt><dd>${decisionView.disposition === null ? 'not applicable' : escapeHtml(decisionView.disposition)}</dd></div>
<div><dt>Reason</dt><dd>${decisionView.reason === null ? 'not recorded' : escapeHtml(decisionView.reason)}</dd></div>
<div><dt>Affected memory IDs</dt><dd>${affected}</dd></div>
</dl>
<h4>Candidate</h4>
${candidate}
<h4>Prepared mutations <span class="meta">(${decisionView.mutations.length})</span></h4>
${mutations}
</article>`;
}

/** Pure S5 renderer. It displays only the supplied, versioned view contract. */
export function renderMemoryDecisionsViewHtml(
  view: MemoryDecisionsView,
): string {
  let body: string;
  if (view.decisions.availability === 'unavailable') {
    body = `<section class="card"><p class="meta">View <code>${escapeHtml(view.view)}</code></p><div class="info-banner"><strong>Memory decisions unavailable.</strong> <code>${escapeHtml(view.decisions.reason)}</code></div></section>`;
  } else {
    const evidence = view.decisions;
    const unattributed =
      evidence.unattributedMutations.length === 0
        ? '<p class="empty">No unattributed mutations.</p>'
        : `<div class="error-banner"><strong>${evidence.unattributedMutations.length} unattributed mutation(s).</strong></div><ul class="catalog-stack">${evidence.unattributedMutations.map(mutation).join('')}</ul>`;
    body = `<section class="card">
<p class="meta">View <code>${escapeHtml(view.view)}</code></p>
<dl class="facts">
<div><dt>Candidates</dt><dd>${evidence.candidateCount}</dd></div>
<div><dt>Decisions</dt><dd>${evidence.decisionCount}</dd></div>
<div><dt>Mutations</dt><dd>${evidence.mutationCount}</dd></div>
</dl>
</section>
${evidence.decisions.length === 0 ? '<section class="card"><p class="empty">No memory decisions recorded.</p></section>' : evidence.decisions.map(decision).join('')}
<section class="card"><h3>Unattributed mutations</h3>${unattributed}</section>`;
  }

  return renderShell({
    title: 'S5 Memory decisions',
    surface: 's5',
    subtitle: `Execution ${view.executionId}`,
    body,
  });
}
