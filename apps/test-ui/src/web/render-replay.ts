import type { PayloadView } from '../redaction.js';
import type { ReplayView } from '../read-model/replay.js';
import type { DiagnosticView } from '../read-model/shared.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

function badge(value: string, kind = 'info'): string {
  return `<span class="badge badge-${kind}">${escapeHtml(value)}</span>`;
}

function outcomeBadge(status: 'match' | 'different' | 'unavailable'): string {
  const kind =
    status === 'match'
      ? 'pass'
      : status === 'different'
        ? 'fail'
        : 'unavailable';
  return badge(status, kind);
}

function comparisonBadge(
  comparison: 'equal' | 'different' | 'unavailable',
): string {
  const kind =
    comparison === 'equal'
      ? 'pass'
      : comparison === 'different'
        ? 'fail'
        : 'unavailable';
  return badge(comparison, kind);
}

function payload(value: PayloadView | null): string {
  if (value === null) {
    return '<span class="meta">No diagnostic value recorded.</span>';
  }
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

function diagnostic(entry: DiagnosticView, index: number): string {
  const severityKind = entry.severity === 'error' ? 'fail' : 'warn';
  return `<article class="catalog-item" data-replay-difference="${index}">
<div class="section-heading"><h4><code>${escapeHtml(entry.code)}</code></h4>${badge(entry.severity, severityKind)}</div>
<p>Diagnostic value: ${payload(entry.value)}</p>
</article>`;
}

/** Pure S7 renderer. It displays only the supplied replay view contract. */
export function renderReplayViewHtml(view: ReplayView): string {
  let body: string;
  if (view.outcome.availability === 'unavailable') {
    body = `<section class="card">
<p class="meta">View <code>${escapeHtml(view.view)}</code></p>
<div class="info-banner"><strong>Replay outcome unavailable.</strong> <code>${escapeHtml(view.outcome.reason)}</code></div>
<dl class="facts"><div><dt>Recorded operation digest</dt><dd>${view.recordedOperationDigest === null ? 'unavailable' : `<code>${escapeHtml(view.recordedOperationDigest)}</code>`}</dd></div></dl>
</section>`;
  } else {
    const outcome = view.outcome;
    body = `<section class="card">
<p class="meta">View <code>${escapeHtml(view.view)}</code></p>
<div class="section-heading"><h3>Replay ${outcomeBadge(outcome.status)}</h3><p>Mode <code>${escapeHtml(outcome.mode)}</code></p></div>
<dl class="facts">
<div><dt>Commit-time digest</dt><dd>${view.recordedOperationDigest === null ? 'unavailable' : `<code>${escapeHtml(view.recordedOperationDigest)}</code>`}</dd></div>
<div><dt>Report recorded digest</dt><dd>${outcome.digest.recorded === null ? 'unavailable' : `<code>${escapeHtml(outcome.digest.recorded)}</code>`}</dd></div>
<div><dt>Replay digest</dt><dd>${outcome.digest.replayed === null ? 'unavailable' : `<code>${escapeHtml(outcome.digest.replayed)}</code>`}</dd></div>
<div><dt>Digest comparison</dt><dd>${comparisonBadge(outcome.digest.comparison)}</dd></div>
<div><dt>Differences</dt><dd>${outcome.differenceCount}</dd></div>
</dl>
</section>
<section class="card">
<h3>Replay diagnostics <span class="meta">(${outcome.differenceCount})</span></h3>
${outcome.differences.length === 0 ? '<p class="empty">No replay differences recorded.</p>' : `<div class="catalog-stack">${outcome.differences.map(diagnostic).join('')}</div>`}
</section>`;
  }

  return renderShell({
    title: 'S7 Replay inspector',
    surface: 's7',
    subtitle: `Execution ${view.executionId}`,
    body,
  });
}
