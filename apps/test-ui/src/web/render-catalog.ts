import type {
  AdapterTargetView,
  CatalogView,
  ScenarioCatalogView,
} from '../read-model/catalog.js';
import type { ViewSection } from '../view.js';
import { escapeHtml } from './escape.js';
import { renderShell } from './shell.js';

function badge(label: string, kind: 'pass' | 'fail' | 'warn' | 'info'): string {
  return `<span class="badge badge-${kind}">${escapeHtml(label)}</span>`;
}

function unavailable(title: string, reason: string): string {
  const id = title.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-');
  return `<section class="card" id="${id}">
<h3>${escapeHtml(title)}</h3>
<p><span class="badge badge-unavailable">unavailable</span></p>
<p class="meta">Reason: <code>${escapeHtml(reason)}</code></p>
</section>`;
}

function renderModules(view: CatalogView): string {
  if (view.modules.availability === 'unavailable') {
    return unavailable('Modules', view.modules.reason);
  }
  const cards = view.modules.modules
    .map((module) => {
      const tasks = module.tasks
        .map(
          (task) => `<tr>
<td><code>${escapeHtml(task.name)}</code></td>
<td>${escapeHtml(task.role)}</td>
<td><code>${escapeHtml(task.contract.id)}@${escapeHtml(task.contract.version)}</code></td>
<td>${task.contractRegistered ? badge('registered', 'pass') : badge('missing', 'fail')}</td>
</tr>`,
        )
        .join('\n');
      return `<article class="catalog-item">
<h4><code>${escapeHtml(module.namespace)}</code></h4>
<p class="meta">State <code>${escapeHtml(module.stateSchemaVersion)}</code> · Delta <code>${escapeHtml(module.deltaSchemaVersion)}</code> · ${module.taskCount} task(s)</p>
<div class="table-scroll"><table>
<thead><tr><th>Task</th><th>Role</th><th>Contract</th><th>Registry</th></tr></thead>
<tbody>${tasks}</tbody>
</table></div>
</article>`;
    })
    .join('\n');
  return `<section class="card" id="modules">
<div class="section-heading"><h3>Modules</h3><span class="meta">${view.modules.moduleCount} registered</span></div>
<div class="catalog-grid">${cards}</div>
</section>`;
}

function renderContracts(view: CatalogView): string {
  if (view.contracts.availability === 'unavailable') {
    return unavailable('Contracts', view.contracts.reason);
  }
  const rows = view.contracts.contracts
    .map(
      (contract) => `<tr>
<td><code>${escapeHtml(contract.id)}@${escapeHtml(contract.version)}</code></td>
<td>${escapeHtml(contract.retention)}</td>
<td>${contract.referencedByTasks.length === 0 ? '<span class="empty">unreferenced</span>' : contract.referencedByTasks.map((task) => `<code>${escapeHtml(task)}</code>`).join('<br/>')}</td>
<td><code class="fingerprint">${escapeHtml(contract.fingerprint)}</code></td>
</tr>`,
    )
    .join('\n');
  return `<section class="card" id="contracts">
<div class="section-heading"><h3>Prompt contracts</h3><span class="meta">${view.contracts.contractCount} registered</span></div>
<div class="table-scroll"><table>
<thead><tr><th>Contract</th><th>Retention</th><th>Referenced by</th><th>Full fingerprint</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>
</section>`;
}

function renderScenarioReferences(scenario: ScenarioCatalogView): string {
  if (scenario.references.length === 0) {
    return '<p class="meta">No fixture references.</p>';
  }
  const rows = scenario.references
    .map((reference) => {
      const kind =
        reference.status === 'resolved'
          ? 'pass'
          : reference.status === 'missing'
            ? 'warn'
            : 'fail';
      return `<tr>
<td>${reference.stepIndex}</td>
<td><code>${escapeHtml(reference.field)}</code></td>
<td><code>${escapeHtml(reference.requested)}</code></td>
<td>${badge(reference.status, kind)}</td>
<td>${reference.reason === null ? '—' : `<code>${escapeHtml(reference.reason)}</code>`}</td>
</tr>`;
    })
    .join('\n');
  return `<div class="table-scroll"><table>
<thead><tr><th>Step</th><th>Field</th><th>Requested</th><th>Status</th><th>Reason</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>`;
}

function renderScenario(scenario: ScenarioCatalogView): string {
  if (scenario.status === 'invalid') {
    return `<article class="catalog-item catalog-invalid">
<div class="section-heading"><h4><code>${escapeHtml(scenario.path)}</code></h4>${badge('invalid', 'fail')}</div>
<p>${escapeHtml(scenario.error?.message ?? 'Scenario rejected.')}</p>
<p class="meta">Code: <code>${escapeHtml(scenario.error?.code ?? 'INVALID_REQUEST')}</code></p>
</article>`;
  }
  const targets = scenario.targets
    .map((target) => {
      const registration =
        target.moduleRegistered === null
          ? badge('unknown', 'info')
          : target.moduleRegistered && target.taskRegistered
            ? badge('registered', 'pass')
            : badge('missing', 'fail');
      return `<li>Step ${target.stepIndex}: <code>${escapeHtml(target.namespace)}.${escapeHtml(target.task)}</code> → <code>${escapeHtml(target.entityId)}</code> ${registration}</li>`;
    })
    .join('\n');
  return `<article class="catalog-item">
<div class="section-heading"><h4><code>${escapeHtml(scenario.path)}</code></h4>${badge('valid', 'pass')}</div>
<dl class="facts">
<div><dt>Name</dt><dd>${escapeHtml(scenario.name ?? '—')}</dd></div>
<div><dt>Schema</dt><dd><code>${escapeHtml(scenario.schemaVersion ?? '—')}</code></dd></div>
<div><dt>Composition</dt><dd><code>${escapeHtml(scenario.composition?.repository ?? '—')} / ${escapeHtml(scenario.composition?.gateway ?? '—')}</code></dd></div>
<div><dt>Steps</dt><dd>${scenario.stepCount ?? 0}</dd></div>
</dl>
${targets.length === 0 ? '<p class="meta">No execution targets.</p>' : `<ul class="compact-list">${targets}</ul>`}
${renderScenarioReferences(scenario)}
</article>`;
}

function renderScenarios(view: CatalogView): string {
  if (view.scenarios.availability === 'unavailable') {
    return unavailable('Scenarios', view.scenarios.reason);
  }
  const items = view.scenarios.scenarios.map(renderScenario).join('\n');
  return `<section class="card" id="scenarios">
<div class="section-heading"><h3>Scenarios</h3><span class="meta">${view.scenarios.scenarioCount} total · ${view.scenarios.validCount} valid · ${view.scenarios.invalidCount} invalid</span></div>
${items.length === 0 ? '<p class="empty">No scenario documents discovered.</p>' : `<div class="catalog-stack">${items}</div>`}
</section>`;
}

function renderFixtures(view: CatalogView): string {
  if (view.fixtures.availability === 'unavailable') {
    return unavailable('Fixtures', view.fixtures.reason);
  }
  const rows = view.fixtures.fixtures
    .map(
      (fixture) => `<tr>
<td><code>${escapeHtml(fixture.path)}</code></td>
<td>${fixture.orphan ? badge('orphan', 'warn') : badge('referenced', 'pass')}</td>
<td>${fixture.referencedBy.length === 0 ? '—' : fixture.referencedBy.map((path) => `<code>${escapeHtml(path)}</code>`).join('<br/>')}</td>
</tr>`,
    )
    .join('\n');
  return `<section class="card" id="fixtures">
<div class="section-heading"><h3>Fixtures</h3><span class="meta">${view.fixtures.fixtureCount} files · ${view.fixtures.orphanCount} orphan(s)</span></div>
${view.fixtures.fixtureCount === 0 ? '<p class="empty">No fixture files discovered.</p>' : `<div class="table-scroll"><table><thead><tr><th>Path</th><th>Status</th><th>Referenced by</th></tr></thead><tbody>${rows}</tbody></table></div>`}
</section>`;
}

function renderAdapterTargets(section: CatalogView['adapterTargets']): string {
  if (section.availability === 'unavailable') {
    return unavailable('Adapter targets', section.reason);
  }
  const target = (entry: AdapterTargetView): string =>
    `<li><code>${escapeHtml(entry.id)}</code> · ${escapeHtml(entry.package)} · ${escapeHtml(entry.kit)} ${badge(entry.kitStatus, entry.kitStatus === 'known' ? 'pass' : 'warn')}</li>`;
  return `<section class="card" id="adapter-targets"><h3>Adapter targets</h3><ul class="compact-list">${section.targets.map(target).join('\n')}</ul></section>`;
}

function renderUnavailableSection<T>(
  title: string,
  section: ViewSection<T>,
): string {
  return section.availability === 'unavailable'
    ? unavailable(title, section.reason)
    : '';
}

function renderDiagnostics(view: CatalogView): string {
  if (view.diagnostics.length === 0) {
    return `<section class="card" id="diagnostics"><h3>Discovery diagnostics</h3><p class="empty">No discovery diagnostics.</p></section>`;
  }
  const items = view.diagnostics
    .map(
      (entry) =>
        `<li>${badge(entry.severity, entry.severity === 'error' ? 'fail' : entry.severity === 'warning' ? 'warn' : 'info')} <code>${escapeHtml(entry.code)}</code>${entry.detail === null ? '' : ` <code>${escapeHtml(JSON.stringify(entry.detail))}</code>`}</li>`,
    )
    .join('\n');
  return `<section class="card" id="diagnostics"><h3>Discovery diagnostics</h3><ul class="compact-list">${items}</ul></section>`;
}

/** Pure S1 renderer. Classification comes only from `acme-view-catalog/1`. */
export function renderCatalogViewHtml(view: CatalogView): string {
  const navigation = `<nav class="section-nav" aria-label="Catalog sections">
<a href="#modules">Modules</a><a href="#contracts">Contracts</a><a href="#scenarios">Scenarios</a><a href="#fixtures">Fixtures</a><a href="#diagnostics">Diagnostics</a>
</nav>`;
  const evaluator = renderUnavailableSection('Evaluators', view.evaluators);
  return renderShell({
    title: 'S1 Catalog',
    surface: 's1',
    subtitle: `View ${view.view} · root ${view.root}`,
    body: `${navigation}${renderModules(view)}${renderContracts(view)}${renderScenarios(view)}${renderFixtures(view)}${renderAdapterTargets(view.adapterTargets)}${evaluator}${renderDiagnostics(view)}`,
  });
}
