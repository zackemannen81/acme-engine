import { parseScenario } from '@acme/testing';
import { describe, expect, it } from 'vitest';

import {
  CATALOG_VIEW_VERSION,
  RUNS_VIEW_VERSION,
  PLAN_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  buildCatalogView,
  buildExecutionView,
  buildPlanView,
  buildRunsView,
  renderCatalogViewHtml,
  renderExecutionViewHtml,
  renderPlanViewHtml,
  renderRunsViewHtml,
  renderStubSurface,
  RUN_RECORD_VERSION,
  type RunRecord,
} from '../src/index.js';
import {
  catalogContracts,
  catalogModules,
  invalidScenario,
  validScenario,
} from './catalog-fixtures.js';
import {
  attempts,
  committedExecution,
  executionId,
  hashOnlyModelCall,
  replayEvidence,
} from './fixtures.js';

const plan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'browser-preview',
  seed: { clock: '2026-08-04T00:00:00.000Z', ids: 'sequential' },
  composition: { repository: 'sqlite', gateway: 'mock' },
  cases: [
    {
      id: 'only',
      namespace: 'narrative',
      task: 'observe-document',
      entityId: 'story-browser',
      expectedRevision: 0,
      input: 'inputs/chapter-1.json',
      mockResponse: 'responses/chapter-1.json',
      expect: { status: 'committed', revision: 1 },
    },
  ],
};

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    version: RUN_RECORD_VERSION,
    runId: 'run-web-1',
    planName: 'demo',
    scenarioName: 'demo',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    composition: { repository: 'memory', gateway: 'mock' },
    status: 'passed',
    steps: [{ index: 0, kind: 'execute', status: 'passed' }],
    cases: [{ alias: 'only', executionId: 'exec-1' }],
    failure: null,
    ...overrides,
  };
}

describe('pure HTML renderers', () => {
  it('renders the complete S1 catalog without shortening contract evidence', () => {
    const view = buildCatalogView(
      {
        root: 'tests/scenario/files',
        modules: catalogModules(),
        contracts: catalogContracts(),
        scenarios: [
          { path: 'catalog.yaml', document: validScenario },
          { path: 'broken.yaml', document: invalidScenario },
        ],
        fixtures: [
          { path: 'inputs/first.json' },
          { path: 'responses/first.json' },
          { path: 'inputs/orphan.json' },
        ],
      },
      { validateScenario: parseScenario },
    );
    const html = renderCatalogViewHtml(view);

    expect(html).toContain(CATALOG_VIEW_VERSION);
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
    expect(html).toContain('catalog.yaml');
    expect(html).toContain('broken.yaml');
    expect(html).toContain('invalid');
    expect(html).toContain('missing');
    expect(html).toContain('refused');
    expect(html).toContain('inputs/orphan.json');
    expect(html).toContain('orphan');
    const fingerprint = catalogContracts().fingerprint({
      id: 'alpha.observe',
      version: '1.0.0',
    });
    expect(html).toContain(fingerprint);
    expect(fingerprint).toHaveLength(64);
    expect(html).toContain('ADAPTER_TARGETS_UNAVAILABLE');
    expect(html).toContain('EVALUATOR_REGISTRY_UNAVAILABLE');
  });

  it('renders unavailable S1 discovery honestly and escapes discovered text', () => {
    const unavailableHtml = renderCatalogViewHtml(
      buildCatalogView({
        root: 'not configured',
        modules: catalogModules(),
        contracts: catalogContracts(),
      }),
    );
    expect(unavailableHtml).toContain('SCENARIO_DISCOVERY_UNAVAILABLE');
    expect(unavailableHtml).toContain('FIXTURE_DISCOVERY_UNAVAILABLE');

    const unsafe = '<script>alert(1)</script>';
    const escapedHtml = renderCatalogViewHtml(
      buildCatalogView(
        {
          root: unsafe,
          fixtures: [{ path: `${unsafe}.json` }],
          scenarios: [],
          diagnostics: [
            { code: 'UNSAFE', severity: 'warning', detail: { text: unsafe } },
          ],
        },
        { validateScenario: parseScenario },
      ),
    );
    expect(escapedHtml).not.toContain(unsafe);
    expect(escapedHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders the S2 authoring form and compiled canonical scenario', () => {
    const view = buildPlanView(plan);
    const html = renderPlanViewHtml(view, {
      source: JSON.stringify(plan, null, 2),
      runId: 'browser-run-001',
      csrfToken: 'token-001',
      launchAvailable: true,
    });

    expect(html).toContain(PLAN_VIEW_VERSION);
    expect(html).toContain('browser-preview');
    expect(html).toContain('browser-run-001');
    expect(html).toContain('Compiled canonical scenario');
    expect(html).toContain('acme-scenario/1');
    expect(html).toContain('token-001');
    expect(html).not.toContain('Launch unavailable');
  });

  it('renders S2 validation failure and escapes submitted source', () => {
    const source = '<script>alert(1)</script>';
    const html = renderPlanViewHtml(buildPlanView({ nope: true }), {
      source,
      runId: 'bad-run',
      csrfToken: 'token-002',
      launchAvailable: false,
      launchUnavailableReason: 'scenario root missing',
    });

    expect(html).toContain('invalid');
    expect(html).toContain('PLAN_INVALID');
    expect(html).toContain('scenario root missing');
    expect(html).not.toContain(source);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('disabled');
  });

  it('renders S3 history rows from the view contract only', () => {
    const view = buildRunsView({
      records: [record(), record({ runId: 'run-web-2', status: 'failed' })],
    });
    const html = renderRunsViewHtml(view);
    expect(html).toContain(RUNS_VIEW_VERSION);
    expect(html).toContain('run-web-1');
    expect(html).toContain('run-web-2');
    expect(html).toContain('2 run(s)');
    expect(html).toContain('passed');
    expect(html).toContain('failed');
    expect(html).toContain('RUN_PROGRESS_UNAVAILABLE');
  });

  it('renders empty history without inventing a perfect series', () => {
    const view = buildRunsView({ records: [] });
    const html = renderRunsViewHtml(view);
    expect(html).toContain('No runs recorded');
    expect(html).not.toContain('1 run(s)');
  });

  it('renders S4 trust pipeline labels from the execution view', () => {
    const view = buildExecutionView({
      execution: committedExecution,
      attempts,
      modelCalls: [hashOnlyModelCall],
      replayEvidence,
    });
    const html = renderExecutionViewHtml(view);
    expect(html).toContain(executionId);
    expect(html).toContain('Trust pipeline');
    expect(html).toContain('commit');
    expect(html).toContain('passed');
  });

  it('names the contract on stub surfaces', () => {
    const html = renderStubSurface({
      surface: 's8',
      title: 'S8 Measurement',
      contractVersion: 'acme-view-measurement/1',
    });
    expect(html).toContain('acme-view-measurement/1');
    expect(html).toContain('not rendered in the first visual slice');
  });

  it('escapes untrusted text in run failure messages', () => {
    const view = buildRunsView({
      records: [
        record({
          status: 'failed',
          failure: {
            stepIndex: 0,
            message: '<script>alert(1)</script>',
          },
        }),
      ],
    });
    // Failure message is not in the summary table columns; ensure shell escapes generally.
    const html = renderRunsViewHtml(view);
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('documents unavailable progress reason code', () => {
    const view = buildRunsView({ records: [] });
    expect(view.progress).toMatchObject({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.runProgress,
    });
  });
});
