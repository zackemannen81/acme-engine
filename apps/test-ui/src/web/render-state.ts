import type { PayloadView } from '../redaction.js';
import type {
  StateRevisionView,
  StateTransitionView,
  StateView,
} from '../read-model/state.js';
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

function continuityBadge(continuity: StateRevisionView['continuity']): string {
  const kind =
    continuity === 'linked'
      ? 'pass'
      : continuity === 'broken'
        ? 'fail'
        : 'unavailable';
  return badge(continuity, kind);
}

function transition(transitionView: StateTransitionView): string {
  return `<dl class="facts">
<div><dt>Transition id</dt><dd><code>${escapeHtml(transitionView.transitionId)}</code></dd></div>
<div><dt>Operation key</dt><dd><code>${escapeHtml(transitionView.operationKey)}</code></dd></div>
<div><dt>Revision change</dt><dd>${transitionView.fromRevision} → ${transitionView.toRevision}</dd></div>
<div><dt>Delta schema</dt><dd><code>${escapeHtml(transitionView.deltaSchemaVersion)}</code></dd></div>
<div><dt>Previous hash</dt><dd>${transitionView.previousHash === null ? 'none (initial revision)' : `<code>${escapeHtml(transitionView.previousHash)}</code>`}</dd></div>
<div><dt>Next hash</dt><dd><code>${escapeHtml(transitionView.nextHash)}</code></dd></div>
<div><dt>Execution</dt><dd><code>${escapeHtml(transitionView.executionId)}</code></dd></div>
<div><dt>Created</dt><dd><time datetime="${escapeHtml(transitionView.createdAt)}">${escapeHtml(transitionView.createdAt)}</time></dd></div>
<div><dt>Accepted delta</dt><dd>${payload(transitionView.delta)}</dd></div>
</dl>`;
}

function revision(revisionView: StateRevisionView): string {
  const transitionBlock =
    revisionView.transition.availability === 'unavailable'
      ? `<div class="info-banner"><strong>Transition unavailable.</strong> <code>${escapeHtml(revisionView.transition.reason)}</code></div>`
      : transition(revisionView.transition);

  return `<article class="card" data-state-revision="${revisionView.revision}">
<div class="section-heading"><h3>Revision ${revisionView.revision}</h3><p>Continuity ${continuityBadge(revisionView.continuity)}</p></div>
<dl class="facts">
<div><dt>Schema version</dt><dd><code>${escapeHtml(revisionView.schemaVersion)}</code></dd></div>
<div><dt>Value hash</dt><dd><code>${escapeHtml(revisionView.valueHash)}</code></dd></div>
<div><dt>Created</dt><dd><time datetime="${escapeHtml(revisionView.createdAt)}">${escapeHtml(revisionView.createdAt)}</time></dd></div>
<div><dt>Execution</dt><dd><code>${escapeHtml(revisionView.executionId)}</code></dd></div>
<div><dt>State value</dt><dd>${payload(revisionView.value)}</dd></div>
</dl>
<h4>Accepted transition</h4>
${transitionBlock}
</article>`;
}

/** Pure S6 renderer. It displays only the supplied, versioned view contract. */
export function renderStateViewHtml(view: StateView): string {
  let body: string;
  if (view.lineage.availability === 'unavailable') {
    body = `<section class="card"><p class="meta">View <code>${escapeHtml(view.view)}</code></p><div class="info-banner"><strong>State evidence unavailable.</strong> <code>${escapeHtml(view.lineage.reason)}</code></div></section>`;
  } else {
    body = `<section class="card">
<p class="meta">View <code>${escapeHtml(view.view)}</code></p>
<dl class="facts">
<div><dt>Revisions</dt><dd>${view.lineage.revisionCount}</dd></div>
<div><dt>Head revision</dt><dd>${view.lineage.headRevision ?? 'none'}</dd></div>
</dl>
</section>
${view.lineage.revisions.length === 0 ? '<section class="card"><p class="empty">No state revisions recorded for this scope.</p></section>' : view.lineage.revisions.map(revision).join('')}`;
  }

  return renderShell({
    title: 'S6 State inspector',
    surface: 's6',
    subtitle: `${view.namespace} / ${view.entityId}`,
    body,
  });
}
