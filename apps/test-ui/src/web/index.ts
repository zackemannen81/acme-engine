/**
 * Pure HTML renderers for the local workbench (ADR-0024).
 *
 * No I/O, no network, no verdict computation — only markup from view contracts.
 */

export { escapeHtml } from './escape.js';
export { WORKBENCH_CSS } from './styles.js';
export {
  renderShell,
  renderStubSurface,
  type WorkbenchSurface,
} from './shell.js';
export { renderRunsViewHtml } from './render-runs.js';
export { renderExecutionViewHtml } from './render-execution.js';
export { renderCatalogViewHtml } from './render-catalog.js';
export {
  renderPlanViewHtml,
  type PlanWorkbenchNotice,
  type PlanWorkbenchRenderOptions,
} from './render-plan.js';
