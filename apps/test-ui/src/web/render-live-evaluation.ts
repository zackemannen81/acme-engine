import type {
  LiveEvaluationView,
  LiveRunSummaryView,
} from '../read-model/live-evaluation.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

export interface LiveEvaluationFormValues {
  readonly runId: string;
  readonly requestSource: string;
  readonly optIn: boolean;
  readonly provider: 'openai';
  readonly model: string;
  readonly caseCount: string;
  readonly maxModelCalls: string;
  readonly costCeilingMinor: string;
  readonly currency: string;
  readonly confirmer: string;
  readonly rationale: string;
}

export interface LiveEvaluationNotice {
  readonly level: 'info' | 'error';
  readonly message: string;
}

export interface LiveEvaluationRenderOptions {
  readonly csrfToken: string;
  readonly form: LiveEvaluationFormValues;
  readonly processOptIn: boolean;
  readonly notice?: LiveEvaluationNotice;
}

function badge(value: string, kind: string): string {
  return `<span class="badge badge-${kind}">${escapeHtml(value)}</span>`;
}

function runCard(run: LiveRunSummaryView): string {
  const executions =
    run.executionIds.length === 0
      ? '<span class="empty">No execution id was recorded.</span>'
      : run.executionIds
          .map(
            (executionId) =>
              `<a href="/s4?executionId=${encodeURIComponent(executionId)}"><code>${escapeHtml(executionId)}</code></a>`,
          )
          .join(', ');
  const failure =
    run.failureMessage === null
      ? ''
      : `<div class="error-banner"><strong>Recorded failure.</strong> ${escapeHtml(run.failureMessage)}</div>`;

  return `<article class="card live-run" data-run="${escapeHtml(run.runId)}">
<div class="section-heading"><h3><a href="/s3/${encodeURIComponent(run.runId)}"><code>${escapeHtml(run.runId)}</code></a></h3>${badge(run.status, run.status === 'passed' ? 'pass' : 'fail')}</div>
<dl class="facts">
<div><dt>Gateway</dt><dd>${escapeHtml(run.gateway)}</dd></div>
<div><dt>Provider</dt><dd>${run.provider === null ? 'unavailable' : escapeHtml(run.provider)}</dd></div>
<div><dt>Model</dt><dd>${run.model === null ? 'unavailable' : `<code>${escapeHtml(run.model)}</code>`}</dd></div>
<div><dt>Started</dt><dd class="mono">${escapeHtml(run.startedAt)}</dd></div>
<div><dt>Finished</dt><dd class="mono">${escapeHtml(run.finishedAt)}</dd></div>
<div><dt>Execution</dt><dd>${executions}</dd></div>
</dl>
${failure}
</article>`;
}

function confirmation(view: LiveEvaluationView): string {
  if (view.confirmation.availability === 'unavailable') {
    return `<section class="card">
<div class="section-heading"><h3>Current confirmation</h3>${badge('unavailable', 'unavailable')}</div>
<p>No confirmation is persisted between requests. <code>${escapeHtml(view.confirmation.reason)}</code></p>
</section>`;
  }

  const cost =
    view.confirmation.costCeilingMinor === null
      ? 'No monetary ceiling declared'
      : `${String(view.confirmation.costCeilingMinor)} minor units${view.confirmation.currency === null ? '' : ` ${escapeHtml(view.confirmation.currency)}`}`;
  return `<section class="card">
<div class="section-heading"><h3>Current confirmation</h3>${badge('confirmed', 'warn')}</div>
<dl class="facts">
<div><dt>Provider</dt><dd>${escapeHtml(view.confirmation.provider)}</dd></div>
<div><dt>Model</dt><dd><code>${escapeHtml(view.confirmation.model)}</code></dd></div>
<div><dt>Cases</dt><dd>${view.confirmation.caseCount}</dd></div>
<div><dt>Model-call ceiling</dt><dd>${view.confirmation.maxModelCalls}</dd></div>
<div><dt>Cost ceiling</dt><dd>${cost}</dd></div>
<div><dt>Confirmer</dt><dd>${escapeHtml(view.confirmation.confirmer)}</dd></div>
</dl>
<p><strong>Rationale.</strong> ${escapeHtml(view.confirmation.rationale)}</p>
</section>`;
}

function cost(view: LiveEvaluationView): string {
  if (view.cost.availability === 'unavailable') {
    return `<section class="card">
<div class="section-heading"><h3>Recorded usage and cost</h3>${badge('unavailable', 'unavailable')}</div>
<p>No live run retained usage or estimated cost evidence. <code>${escapeHtml(view.cost.reason)}</code></p>
</section>`;
  }

  return `<section class="card">
<div class="section-heading"><h3>Recorded usage and cost</h3>${badge('recorded evidence', 'info')}</div>
<dl class="facts">
<div><dt>Sample size</dt><dd>${view.cost.sampleSize}</dd></div>
<div><dt>Total tokens</dt><dd>${view.cost.totalTokens === null ? 'unavailable' : String(view.cost.totalTokens)}</dd></div>
<div><dt>Estimated cost</dt><dd>${view.cost.estimatedCostMinor === null ? 'unavailable' : `${String(view.cost.estimatedCostMinor)} minor units`}</dd></div>
<div><dt>Currency</dt><dd>${view.cost.currency === null ? 'unavailable' : escapeHtml(view.cost.currency)}</dd></div>
</dl>
</section>`;
}

function value(value: string): string {
  return escapeHtml(value);
}

function launchForm(options: LiveEvaluationRenderOptions): string {
  const form = options.form;
  const disabled = options.processOptIn ? '' : ' disabled';
  const processGate = options.processOptIn
    ? `<div class="info-banner"><strong>Process gate enabled.</strong> A valid per-launch confirmation and budget are still required.</div>`
    : `<div class="error-banner"><strong>Process gate disabled.</strong> Restart with <code>ACME_TEST_UI_LIVE=1</code> to permit live launch. Credentials remain process-only.</div>`;

  return `<section class="card live-launch">
<div class="section-heading"><h3>Confirm one live execution</h3>${badge(options.processOptIn ? 'gate enabled' : 'gate disabled', options.processOptIn ? 'warn' : 'unavailable')}</div>
${processGate}
<p>This form contains no credential field. The local process reads <code>OPENAI_API_KEY</code> only after both gates pass.</p>
<form method="post" action="/s10/launch" class="live-form">
<input type="hidden" name="csrfToken" value="${escapeHtml(options.csrfToken)}"/>
<fieldset>
<legend>Run</legend>
<label>Unique run id
<input name="runId" required value="${value(form.runId)}" placeholder="live-smoke-001"/>
</label>
</fieldset>
<fieldset>
<legend>Confirmation · <code>acme-live-confirmation/1</code></legend>
<label class="checkbox-label"><input type="checkbox" name="optIn" value="true"${form.optIn ? ' checked' : ''}/> I explicitly confirm this live provider call.</label>
<label>Provider
<input name="provider" readonly value="openai"/>
</label>
<label>Model id
<input name="model" required value="${value(form.model)}" placeholder="gpt-5.6-luna"/>
</label>
<div class="live-form-grid">
<label>Case count (v1)
<input name="caseCount" readonly value="1"/>
</label>
<label>Maximum model calls
<input name="maxModelCalls" required inputmode="numeric" value="${value(form.maxModelCalls)}"/>
</label>
<label>Optional cost ceiling (minor units)
<input name="costCeilingMinor" inputmode="decimal" value="${value(form.costCeilingMinor)}"/>
</label>
<label>Currency when cost is set
<input name="currency" value="${value(form.currency)}" placeholder="USD"/>
</label>
</div>
<label>Confirmer identity
<input name="confirmer" required autocomplete="name" value="${value(form.confirmer)}"/>
</label>
<label>Rationale
<textarea name="rationale" required rows="4" placeholder="Explain why this bounded live call is needed.">${value(form.rationale)}</textarea>
</label>
</fieldset>
<fieldset>
<legend>Single ExecutionRequest · YAML or JSON</legend>
<p class="meta">The request policy remains authoritative and its <code>maxModelCalls</code> may not exceed the confirmation above.</p>
<label>Request document
<textarea name="requestSource" required spellcheck="false" placeholder="requestKey: live-smoke-001&#10;namespace: narrative&#10;...">${value(form.requestSource)}</textarea>
</label>
</fieldset>
<div class="actions"><button class="primary" type="submit"${disabled}>Launch one live execution</button></div>
</form>
</section>`;
}

/** Pure S10 renderer over the supplied live-evaluation view and form state. */
export function renderLiveEvaluationViewHtml(
  view: LiveEvaluationView,
  options: LiveEvaluationRenderOptions,
): string {
  const notice =
    options.notice === undefined
      ? ''
      : `<div class="${options.notice.level === 'error' ? 'error-banner' : 'info-banner'}" role="status">${escapeHtml(options.notice.message)}</div>`;
  const unreadable =
    view.unreadable.length === 0
      ? ''
      : `<section class="card error-banner"><h3>Unreadable run records</h3><p>No file was hidden: ${view.unreadable.map((name) => `<code>${escapeHtml(name)}</code>`).join(', ')}</p></section>`;
  const runs =
    view.runs.items.length === 0
      ? '<section class="card"><p class="empty">No live runs recorded. Mock history is intentionally excluded from S10.</p></section>'
      : view.runs.items.map(runCard).join('');
  const summary = `<section class="card">
<p class="meta">View <code>${escapeHtml(view.view)}</code> · series <code>${escapeHtml(view.series)}</code></p>
<dl class="facts"><div><dt>Live runs</dt><dd>${view.runs.runCount}</dd></div></dl>
</section>`;

  return renderShell({
    title: 'S10 Live evaluation',
    surface: 's10',
    subtitle:
      'Two explicit gates, one ExecutionRequest, live-only recorded history.',
    body: `${notice}${launchForm(options)}${summary}${confirmation(view)}${cost(view)}${unreadable}${runs}`,
  });
}
