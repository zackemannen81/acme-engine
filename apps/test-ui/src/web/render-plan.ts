import { PLAN_VIEW_VERSION } from '../view.js';
import type { PlanView } from '../read-model/plan.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

export interface PlanWorkbenchNotice {
  readonly level: 'error' | 'info';
  readonly message: string;
}

export interface PlanWorkbenchRenderOptions {
  readonly source: string;
  readonly runId: string;
  readonly csrfToken: string;
  readonly launchAvailable: boolean;
  readonly launchUnavailableReason?: string;
  readonly notice?: PlanWorkbenchNotice;
}

function badge(status: 'valid' | 'invalid'): string {
  const kind = status === 'valid' ? 'pass' : 'fail';
  return `<span class="badge badge-${kind}">${status}</span>`;
}

function renderCases(view: PlanView): string {
  if (view.plan.availability === 'unavailable') {
    return '';
  }
  const rows = view.plan.cases
    .map(
      (entry) => `<tr>
<td><code>${escapeHtml(entry.id)}</code></td>
<td>${escapeHtml(entry.namespace)}.<wbr/>${escapeHtml(entry.task)}</td>
<td><code>${escapeHtml(entry.entityId)}</code></td>
<td>${entry.expectedRevision}</td>
<td><code>${escapeHtml(entry.requestKey)}</code></td>
<td>${escapeHtml(entry.expectsStatus ?? '—')}</td>
</tr>`,
    )
    .join('\n');

  return `<section class="card">
<h3>Cases</h3>
<p class="meta">${view.plan.caseCount} case(s) compile to ${view.plan.stepCount} scenario step(s).</p>
<div class="table-scroll">
<table>
<thead><tr><th>Case</th><th>Task</th><th>Entity</th><th>Revision</th><th>Request key</th><th>Expected</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</section>`;
}

function renderPreview(view: PlanView | null): string {
  if (view === null) {
    return `<section class="card">
<p class="empty">Paste an <code>acme-test-plan/1</code> document and preview it before launching.</p>
</section>`;
  }

  if (view.status === 'invalid' || view.plan.availability === 'unavailable') {
    const message = view.error?.message ?? 'The plan was rejected.';
    const code =
      view.error?.code ??
      (view.plan.availability === 'unavailable'
        ? view.plan.reason
        : 'INVALID_REQUEST');
    const reason =
      view.plan.availability === 'unavailable'
        ? ` · Section: <code>${escapeHtml(view.plan.reason)}</code>`
        : '';
    return `<section class="card error-banner" role="alert">
<p>${badge('invalid')} ${escapeHtml(message)}</p>
<p class="meta">Code: <code>${escapeHtml(code)}</code>${reason}</p>
</section>`;
  }

  const compiled = escapeHtml(JSON.stringify(view.plan.compiled, null, 2));
  return `<section class="card">
<p>${badge('valid')} <strong>${escapeHtml(view.plan.name)}</strong></p>
<dl class="facts">
<div><dt>Schema</dt><dd><code>${escapeHtml(view.plan.schemaVersion)}</code></dd></div>
<div><dt>Repository</dt><dd><code>${escapeHtml(view.plan.composition.repository)}</code></dd></div>
<div><dt>Gateway</dt><dd><code>${escapeHtml(view.plan.composition.gateway)}</code></dd></div>
<div><dt>Seed clock</dt><dd><code>${escapeHtml(view.plan.seed.clock)}</code></dd></div>
</dl>
</section>
${renderCases(view)}
<section class="card">
<h3>Compiled canonical scenario</h3>
<p class="meta">This <code>acme-scenario/1</code> artifact—not the authoring form—is what the runner executes and reviewers approve.</p>
<pre><code>${compiled}</code></pre>
</section>`;
}

/** Pure S2 renderer. Plan validity and compilation come only from PlanView. */
export function renderPlanViewHtml(
  view: PlanView | null,
  options: PlanWorkbenchRenderOptions,
): string {
  const notice =
    options.notice === undefined
      ? ''
      : `<section class="card ${options.notice.level === 'error' ? 'error-banner' : 'info-banner'}" role="status">
<p>${escapeHtml(options.notice.message)}</p>
</section>`;
  const disabled = options.launchAvailable ? '' : ' disabled';
  const launchReason =
    options.launchAvailable || options.launchUnavailableReason === undefined
      ? ''
      : `<p class="meta">Launch unavailable: ${escapeHtml(options.launchUnavailableReason)}</p>`;

  const form = `<section class="card">
<form method="post" action="/s2/preview" class="stack">
<input type="hidden" name="csrfToken" value="${escapeHtml(options.csrfToken)}"/>
<label for="runId">Run identifier</label>
<input id="runId" name="runId" required pattern="[A-Za-z0-9._-]+" value="${escapeHtml(options.runId)}" autocomplete="off"/>
<label for="planSource">Plan YAML or JSON</label>
<textarea id="planSource" name="planSource" required spellcheck="false">${escapeHtml(options.source)}</textarea>
<div class="actions">
<button type="submit" formaction="/s2/preview">Preview</button>
<button type="submit" class="primary" formaction="/s2/launch"${disabled}>Launch offline run</button>
</div>
${launchReason}
</form>
</section>`;

  return renderShell({
    title: 'S2 Test plan designer',
    surface: 's2',
    subtitle: `View ${view?.view ?? PLAN_VIEW_VERSION} · offline mock launch only`,
    body: `${notice}${form}${renderPreview(view)}`,
  });
}
