import type { RunsView } from '../read-model/runs.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

function statusBadge(status: string): string {
  const kind =
    status === 'passed' || status === 'completed'
      ? 'pass'
      : status === 'failed' ||
          status === 'cancelled' ||
          status === 'interrupted'
        ? 'fail'
        : 'info';
  return `<span class="badge badge-${kind}">${escapeHtml(status)}</span>`;
}

export interface RunsRenderOptions {
  readonly csrfToken?: string;
  readonly focusJobId?: string;
  /** When set, emit a meta refresh for in-flight job polling (ADR-0027). */
  readonly refreshSeconds?: number;
}

/**
 * Pure S3 renderer (ADR-0024 / ADR-0027). Copies fields from `acme-view-runs/1` only.
 */
export function renderRunsViewHtml(
  view: RunsView,
  options: RunsRenderOptions = {},
): string {
  let progressBlock: string;
  if (view.progress.availability === 'unavailable') {
    progressBlock = `<section class="card">
<p class="meta">Live progress: unavailable (<code>${escapeHtml(view.progress.reason)}</code>) — no job runner evidence was supplied.</p>
</section>`;
  } else {
    const { jobs, activeCount, queuedCount, unreadable } = view.progress;
    if (jobs.length === 0) {
      progressBlock = `<section class="card"><p class="empty">No jobs in the queue.</p>
<p class="meta">${activeCount} active · ${queuedCount} queued</p></section>`;
    } else {
      const rows = jobs
        .map((job) => {
          const focused =
            options.focusJobId !== undefined && job.jobId === options.focusJobId
              ? ' class="focus"'
              : '';
          const step =
            job.stepIndex === null
              ? '—'
              : `${job.stepIndex}${job.stepTotal === null ? '' : ` / ${job.stepTotal}`}${job.stepKind === null ? '' : ` (${escapeHtml(job.stepKind)})`}`;
          const cancelForm =
            options.csrfToken !== undefined &&
            (job.status === 'queued' ||
              job.status === 'running' ||
              job.status === 'cancelling')
              ? `<form method="post" action="/s3/${encodeURIComponent(job.runId)}/cancel" style="display:inline">
<input type="hidden" name="csrfToken" value="${escapeHtml(options.csrfToken)}" />
<button type="submit"${job.status === 'cancelling' ? ' disabled' : ''}>Cancel</button>
</form>`
              : '';
          return `<tr${focused}>
<td><code>${escapeHtml(job.jobId)}</code></td>
<td>${escapeHtml(job.planName)}</td>
<td>${statusBadge(job.status)}</td>
<td class="mono">${step}</td>
<td>${escapeHtml(job.message ?? '—')}</td>
<td class="mono">${escapeHtml(job.updatedAt)}</td>
<td>${cancelForm}</td>
</tr>`;
        })
        .join('\n');
      progressBlock = `<section class="card">
<h2>Live progress</h2>
<p class="meta">${activeCount} active · ${queuedCount} queued · ${jobs.length} job(s)</p>
<table>
<thead><tr><th>Job</th><th>Plan</th><th>Status</th><th>Step</th><th>Message</th><th>Updated</th><th></th></tr></thead>
<tbody>${rows}</tbody>
</table>
${
  unreadable.length === 0
    ? ''
    : `<p class="meta">Unreadable job files: ${unreadable.map(escapeHtml).join(', ')}</p>`
}
</section>`;
    }
  }

  let body: string;
  if (view.history.availability === 'unavailable') {
    body = `<section class="card error-banner" role="status">
<p><span class="badge badge-unavailable">unavailable</span>
History cannot be shown.</p>
<p class="meta">Reason: <code>${escapeHtml(view.history.reason)}</code></p>
</section>`;
  } else {
    const {
      runs,
      runCount,
      passedCount,
      failedCount,
      cancelledCount,
      unreadable,
    } = view.history;
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
<h2>History</h2>
<p class="meta">${runCount} run(s) · ${passedCount} passed · ${failedCount} failed · ${cancelledCount} cancelled</p>
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

  const refreshMeta =
    options.refreshSeconds !== undefined && options.refreshSeconds > 0
      ? `<meta http-equiv="refresh" content="${options.refreshSeconds}" />`
      : '';

  return renderShell({
    title: 'S3 Run console and history',
    surface: 's3',
    subtitle: `View ${view.view}`,
    body: `${refreshMeta}${progressBlock}${body}`,
  });
}
