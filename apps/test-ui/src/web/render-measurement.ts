import type {
  MeasureId,
  MeasurementSeriesView,
  MeasurementView,
  MeasureView,
} from '../read-model/measurement.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

const MEASURE_LABELS: Record<MeasureId, string> = {
  runPassRate: 'Run pass rate',
  stepPassRate: 'Step pass rate',
  replayMatchRate: 'Replay match rate',
};

function badge(value: string, kind: string): string {
  return `<span class="badge badge-${kind}">${escapeHtml(value)}</span>`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function outcome(view: MeasureView): string {
  if (view.outcome === null) {
    return '<span class="meta">no threshold</span>';
  }
  const kind =
    view.outcome === 'met'
      ? 'pass'
      : view.outcome === 'not-met'
        ? 'fail'
        : 'unavailable';
  return badge(view.outcome, kind);
}

function threshold(view: MeasureView): string {
  if (view.threshold === null) {
    return 'not configured';
  }
  const bounds: string[] = [];
  if (view.threshold.min !== undefined) {
    bounds.push(`min ${percent(view.threshold.min)}`);
  }
  if (view.threshold.max !== undefined) {
    bounds.push(`max ${percent(view.threshold.max)}`);
  }
  return bounds.length === 0 ? 'no bounds' : bounds.join(' · ');
}

function baseline(view: MeasureView): string {
  if (view.baseline.availability === 'unavailable') {
    return `${badge('unavailable', 'unavailable')} <code>${escapeHtml(view.baseline.reason)}</code>`;
  }
  const delta = view.baseline.delta;
  const signedDelta = `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)} pp`;
  const kind =
    view.baseline.comparison === 'improved'
      ? 'pass'
      : view.baseline.comparison === 'regressed'
        ? 'fail'
        : 'info';
  return `${badge(view.baseline.comparison, kind)} <span class="meta">from ${percent(view.baseline.value)} · ${signedDelta}</span>`;
}

function measureCard(view: MeasureView): string {
  const rate =
    view.rate.availability === 'unavailable'
      ? `<p class="measure-rate">—</p><p class="meta"><code>${escapeHtml(view.rate.reason)}</code></p>`
      : `<p class="measure-rate">${percent(view.rate.value)}</p><meter min="0" max="1" value="${String(view.rate.value)}" aria-label="${escapeHtml(MEASURE_LABELS[view.id])}">${percent(view.rate.value)}</meter>`;

  return `<article class="catalog-item measure-card" data-measure="${escapeHtml(view.id)}">
<div class="section-heading"><h4>${escapeHtml(MEASURE_LABELS[view.id])}</h4>${outcome(view)}</div>
${rate}
<dl class="facts">
<div><dt>Evidence</dt><dd>${view.observed} / ${view.sampleSize}</dd></div>
<div><dt>Threshold</dt><dd>${escapeHtml(threshold(view))}</dd></div>
<div><dt>Baseline</dt><dd>${baseline(view)}</dd></div>
</dl>
</article>`;
}

function series(
  title: string,
  description: string,
  view: MeasurementSeriesView,
): string {
  return `<section class="card measurement-series">
<div class="section-heading"><h3>${escapeHtml(title)}</h3>${badge(`${String(view.runCount)} run(s)`, 'info')}</div>
<p class="meta">${escapeHtml(description)}</p>
<div class="measure-grid">${view.measures.map(measureCard).join('')}</div>
</section>`;
}

function thresholdInput(view: MeasureView): string {
  const min = view.threshold?.min;
  const max = view.threshold?.max;
  return `<fieldset>
<legend>${escapeHtml(MEASURE_LABELS[view.id])}</legend>
<label>Minimum rate (0–1)
<input type="number" name="${escapeHtml(view.id)}.min" min="0" max="1" step="any" value="${min === undefined ? '' : String(min)}"/>
</label>
<label>Maximum rate (0–1)
<input type="number" name="${escapeHtml(view.id)}.max" min="0" max="1" step="any" value="${max === undefined ? '' : String(max)}"/>
</label>
</fieldset>`;
}

/** Pure S8 renderer. It displays only the supplied measurement view contract. */
export function renderMeasurementViewHtml(view: MeasurementView): string {
  const controls = `<section class="card">
<div class="section-heading"><h3>Measurement rules</h3><span class="meta">request-local · read-only</span></div>
<p>Set optional rate bounds or name an existing stored baseline. Empty fields do not create an outcome, and nothing here is persisted.</p>
<form method="get" action="/s8" class="measurement-form">
<label>Stored baseline name
<input name="baseline" value="${view.baselineName === null ? '' : escapeHtml(view.baselineName)}" placeholder="for example nightly"/>
</label>
<div class="threshold-grid">${view.deterministic.measures.map(thresholdInput).join('')}</div>
<div class="actions"><button class="primary" type="submit">Apply measurement rules</button><a class="button-link" href="/s8">Clear</a></div>
</form>
</section>`;

  const baselineNote =
    view.baselineName === null
      ? '<div class="info-banner"><strong>No baseline selected.</strong> This measurement makes no improvement or regression claim.</div>'
      : `<div class="info-banner"><strong>Baseline:</strong> <code>${escapeHtml(view.baselineName)}</code></div>`;

  return renderShell({
    title: 'S8 Results and measurement',
    surface: 's8',
    subtitle: `View ${view.view}`,
    body: `${controls}${baselineNote}${series(
      'Deterministic series',
      'Runs recorded with the mock gateway only.',
      view.deterministic,
    )}${series(
      'Live series',
      'Runs recorded with any non-mock gateway. Never mixed into the deterministic rates.',
      view.live,
    )}`,
  });
}
