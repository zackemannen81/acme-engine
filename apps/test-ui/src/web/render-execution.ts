import type { ExecutionView } from '../read-model/execution.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

function badge(status: string): string {
  const kind =
    status === 'committed' || status === 'passed' || status === 'match'
      ? 'pass'
      : status === 'failed' || status === 'different'
        ? 'fail'
        : 'info';
  return `<span class="badge badge-${kind}">${escapeHtml(status)}</span>`;
}

/**
 * Pure S4 renderer (ADR-0024). Never invents stages or counts.
 */
export function renderExecutionViewHtml(view: ExecutionView): string {
  const header = view.header;
  const terminal = view.terminal;

  const pipeline = view.trustPipeline
    .map((stage) => {
      const cls = escapeHtml(stage.outcome);
      return `<span class="${cls}" title="${escapeHtml(stage.stage)}">${escapeHtml(stage.stage)}: ${escapeHtml(stage.outcome)}</span>`;
    })
    .join('');

  const modelCalls =
    view.modelCalls.length === 0
      ? `<p class="empty">No model calls recorded.</p>`
      : `<ul class="stack">${view.modelCalls
          .map(
            (call) =>
              `<li><code>${escapeHtml(call.modelCallId)}</code> · ${badge(call.status)} · purpose ${escapeHtml(call.purpose)}</li>`,
          )
          .join('')}</ul>`;

  const terminalBlock = `<p>Terminal ${badge(terminal.status)}${
    terminal.committed ? ' · committed' : ''
  }${
    terminal.revision === null
      ? ''
      : ` · revision <code>${terminal.revision}</code>`
  }</p>`;

  const body = `
<section class="card">
<p class="meta">View <code>${escapeHtml(view.view)}</code></p>
<p><strong>${escapeHtml(header.namespace)}</strong> /
<code>${escapeHtml(header.task)}</code> · entity
<code>${escapeHtml(header.entityId)}</code></p>
<p>Status ${badge(header.status)} · stage
<code>${escapeHtml(header.currentStage)}</code> · id
<code>${escapeHtml(header.executionId)}</code></p>
${terminalBlock}
<p class="actions"><a class="button-link" href="/s5?executionId=${encodeURIComponent(header.executionId)}">Inspect memory decisions</a></p>
</section>
<section class="card">
<h3>Trust pipeline</h3>
<div class="pipeline" aria-label="Trust pipeline stages">${pipeline}</div>
</section>
<section class="card">
<h3>Model calls <span class="meta">(${view.modelCalls.length})</span></h3>
${modelCalls}
</section>`;

  return renderShell({
    title: 'S4 Execution inspector',
    surface: 's4',
    subtitle: `Execution ${header.executionId}`,
    body,
  });
}
