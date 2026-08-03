import type { RunsView } from '../read-model/runs.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

function statusBadge(status: string): string {
  const kind =
    status === 'passed' ? 'pass' : status === 'failed' ? 'fail' : 'info';
  return `<span class="badge badge-${kind}">${escapeHtml(status)}</span>`;
}

/**
 * Pure S3 renderer (ADR-0024). Copies fields from `acme-view-runs/1` only.
 */
export function renderRunsViewHtml(view: RunsView): string {
  let body: string;

  if (view.history.availability === 'unavailable') {
    body = `<section class="card error-banner" role="status">
<p><span class="badge badge-unavailable">unavailable</span>
History cannot be shown.</p>
<p class="meta">Reason: <code>${escapeHtml(view.history.reason)}</code></p>
</section>`;
  } else {
    const { runs, runCount, passedCount, failedCount, unreadable } =
      view.history;
    if (runCount === 0) {
      body = `<section class="card"><p class="empty">No runs recorded in this workspace.</p></section>`;
    } else {
      const rows = runs
        .map(
          (run) => `<tr>
<td><a href="/s3/${encodeURIComponent(run.runId)}"><code>${escapeHtml(run.runId)}</code></a></td>
<td>${escapeHtml(run.planName)}</td>
<td>${statusBadge(run.status)}</td>
<td class="mono">${escapeHtml(run.gateway)}</td>
<td class="mono">${escapeHtml(run.startedAt)}</td>
<td>${run.passedSteps}/${run.stepCount}</td>
</tr>`,
        )
        .join('\n');
      body = `<section class="card">
<p class="meta">${runCount} run(s) · ${passedCount} passed · ${failedCount} failed</p>
<table>
<thead><tr><th>Run</th><th>Plan</th><th>Status</th><th>Gateway</th><th>Started</th><th>Steps</th></tr></thead>
<tbody>${rows}</tbody>
</table>
${
  unreadable.length === 0
    ? ''
    : `<p class="meta">Unreadable files: ${unreadable.map(escapeHtml).join(', ')}</p>`
}
</section>`;
    }
  }

  const progressNote =
    view.progress.availability === 'unavailable'
      ? `<p class="meta">Live progress: unavailable (<code>${escapeHtml(view.progress.reason)}</code>) — launch is synchronous.</p>`
      : '';

  return renderShell({
    title: 'S3 Run console and history',
    surface: 's3',
    subtitle: `View ${view.view}`,
    body: `${progressNote}${body}`,
  });
}
