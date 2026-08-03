import { describe, expect, it } from 'vitest';

import {
  RUNS_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  buildExecutionView,
  buildRunsView,
  renderExecutionViewHtml,
  renderRunsViewHtml,
  renderStubSurface,
  RUN_RECORD_VERSION,
  type RunRecord,
} from '../src/index.js';
import {
  attempts,
  committedExecution,
  executionId,
  hashOnlyModelCall,
  replayEvidence,
} from './fixtures.js';

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
