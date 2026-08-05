import { parseScenario } from '@acme/testing';
import { describe, expect, it } from 'vitest';

import {
  CATALOG_VIEW_VERSION,
  RUNS_VIEW_VERSION,
  PLAN_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  buildCatalogView,
  buildExecutionView,
  buildFixtureReviewView,
  buildLiveEvaluationView,
  buildMemoryDecisionsView,
  buildMeasurementView,
  buildPlanView,
  buildReplayView,
  buildRunsView,
  buildStateView,
  captureBaseline,
  decideFixtureChange,
  renderCatalogViewHtml,
  renderExecutionViewHtml,
  renderFixtureReviewViewHtml,
  renderLiveEvaluationViewHtml,
  renderMemoryDecisionsViewHtml,
  renderMeasurementViewHtml,
  renderPlanViewHtml,
  renderReplayViewHtml,
  renderRunsViewHtml,
  renderStateViewHtml,
  RUN_RECORD_VERSION,
  type FixtureChangeProposal,
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
  brokenTransition,
  committedExecution,
  entityId,
  executionId,
  hashOnlyModelCall,
  matchReport,
  differentReport,
  preparedCommit,
  namespace,
  nextSnapshot,
  nextTransition,
  priorSnapshot,
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
    expect(html).toContain(
      `/s5?executionId=${encodeURIComponent(executionId)}`,
    );
    expect(html).toContain(
      `/s6?namespace=${encodeURIComponent(namespace)}&amp;entityId=${encodeURIComponent(entityId)}`,
    );
  });

  it('renders ordered S5 decisions, reasons and correlated mutations without revealing payloads', () => {
    const html = renderMemoryDecisionsViewHtml(
      buildMemoryDecisionsView({ executionId, preparedCommit }),
    );

    expect(html).toContain('acme-view-memory-decisions/1');
    expect(html).toContain(executionId);
    expect(html).toContain('Candidates</dt><dd>3');
    expect(html).toContain('Decisions</dt><dd>3');
    expect(html).toContain('Mutations</dt><dd>2');
    expect(html.indexOf('candidate-created')).toBeLessThan(
      html.indexOf('candidate-ignored'),
    );
    expect(html.indexOf('candidate-ignored')).toBeLessThan(
      html.indexOf('candidate-reinforced'),
    );
    expect(html).toContain('below domain confidence floor');
    expect(html).toContain('memory-created-1');
    expect(html).toContain('memory-existing-1');
    expect(html).toContain('No mutation prepared.');
    expect(html).toContain('No unattributed mutations.');
    expect(html).toContain('redacted');
    expect(html).not.toContain('confidential source text');
    expect(html).not.toContain('&quot;fact&quot;');
  });

  it('renders unavailable prepared commit evidence explicitly on S5', () => {
    const html = renderMemoryDecisionsViewHtml(
      buildMemoryDecisionsView({ executionId, preparedCommit: null }),
    );

    expect(html).toContain('Memory decisions unavailable');
    expect(html).toContain('PREPARED_COMMIT_UNAVAILABLE');
  });

  it('renders ordered S6 lineage and accepted transitions without revealing payloads', () => {
    const html = renderStateViewHtml(
      buildStateView({
        namespace,
        entityId,
        snapshots: [nextSnapshot, priorSnapshot],
        transitions: [nextTransition],
      }),
    );

    expect(html).toContain('acme-view-state/1');
    expect(html).toContain(namespace);
    expect(html).toContain(entityId);
    expect(html).toContain('Revisions</dt><dd>2');
    expect(html).toContain('Head revision</dt><dd>2');
    expect(html.indexOf('Revision 1')).toBeLessThan(html.indexOf('Revision 2'));
    expect(html).toContain('STATE_TRANSITION_UNAVAILABLE');
    expect(html).toContain('transition-2');
    expect(html).toContain('operation-1');
    expect(html).toContain('linked');
    expect(html.match(/redacted/gu)).toHaveLength(3);
    expect(html).not.toContain('<details>');
  });

  it('renders broken, empty and unavailable S6 lineage states explicitly', () => {
    const broken = renderStateViewHtml(
      buildStateView({
        namespace,
        entityId,
        snapshots: [priorSnapshot, nextSnapshot],
        transitions: [brokenTransition],
      }),
    );
    expect(broken).toContain('broken');

    const empty = renderStateViewHtml(
      buildStateView({ namespace, entityId, snapshots: [], transitions: [] }),
    );
    expect(empty).toContain('Revisions</dt><dd>0');
    expect(empty).toContain('Head revision</dt><dd>none');
    expect(empty).toContain('No state revisions recorded for this scope.');

    const unavailable = renderStateViewHtml(
      buildStateView({ namespace, entityId }),
    );
    expect(unavailable).toContain('State evidence unavailable');
    expect(unavailable).toContain('STATE_EVIDENCE_UNAVAILABLE');
  });

  it('renders S7 match and digest comparison from the supplied replay view', () => {
    const html = renderReplayViewHtml(
      buildReplayView({
        executionId,
        report: matchReport,
        recordedOperationDigest: 'digest-operation-1',
      }),
    );

    expect(html).toContain('S7 Replay inspector');
    expect(html).toContain('acme-view-replay/1');
    expect(html).toContain('match');
    expect(html).toContain('equal');
    expect(html).toContain('digest-operation-1');
    expect(html).toContain('No replay differences recorded.');
  });

  it('keeps S7 diagnostics redacted and not-run evidence explicit', () => {
    const different = renderReplayViewHtml(
      buildReplayView({ executionId, report: differentReport }),
    );
    expect(different).toContain('different');
    expect(different).toContain('REPLAY_MODEL_RESPONSE_HASH_DIFFERENT');
    expect(different).toContain('redacted');
    expect(different).not.toContain('hash-response-9');
    expect(different).not.toContain('<details>');

    const notRun = renderReplayViewHtml(
      buildReplayView({
        executionId,
        recordedOperationDigest: 'digest-operation-1',
      }),
    );
    expect(notRun).toContain('Replay outcome unavailable');
    expect(notRun).toContain('REPLAY_NOT_RUN');
  });

  it('renders S8 deterministic and live rates with configured outcomes', () => {
    const baselineView = buildMeasurementView({
      records: [
        record({
          runId: 'baseline-pass',
          steps: [
            { index: 0, kind: 'execute', status: 'passed' },
            { index: 1, kind: 'replay', status: 'passed' },
          ],
        }),
        record({ runId: 'baseline-fail', status: 'failed' }),
      ],
    });
    const baseline = captureBaseline({
      name: 'nightly',
      capturedAt: '2026-01-01T00:00:00.000Z',
      view: baselineView,
    });
    const html = renderMeasurementViewHtml(
      buildMeasurementView({
        records: [
          record({
            steps: [
              { index: 0, kind: 'execute', status: 'passed' },
              { index: 1, kind: 'replay', status: 'passed' },
            ],
          }),
          record({
            runId: 'run-live',
            composition: { repository: 'memory', gateway: 'openai' },
            status: 'failed',
            steps: [{ index: 0, kind: 'execute', status: 'failed' }],
          }),
        ],
        thresholds: { runPassRate: { min: 1 } },
        baseline,
      }),
    );

    expect(html).toContain('S8 Results and measurement');
    expect(html).toContain('acme-view-measurement/1');
    expect(html).toContain('Deterministic series');
    expect(html).toContain('Live series');
    expect(html).toContain('100.0%');
    expect(html).toContain('0.0%');
    expect(html).toContain('met');
    expect(html).toContain('not-met');
    expect(html).toContain('improved');
    expect(html).toContain('nightly');
    expect(html).toContain('runPassRate.min');
  });

  it('renders empty S8 samples as unavailable and makes no baseline claim', () => {
    const html = renderMeasurementViewHtml(
      buildMeasurementView({ records: [] }),
    );

    expect(html.match(/MEASUREMENT_SAMPLE_EMPTY/gu)).toHaveLength(6);
    expect(html).toContain('No baseline selected');
    expect(html).toContain('BASELINE_UNAVAILABLE');
    expect(html).not.toContain('<p class="measure-rate">100.0%</p>');
    expect(html).not.toContain('<p class="measure-rate">0.0%</p>');
  });

  it('renders a pending S9 proposal with explicit human decision controls', () => {
    const proposal: FixtureChangeProposal = {
      proposalId: 'proposal-web-001',
      fixturePath: 'digests/narrative.json',
      expectedDigest: 'digest-old',
      proposedDigest: 'digest-new',
      runId: 'run-web-1',
      executionId: 'exec-1',
    };
    const html = renderFixtureReviewViewHtml(
      buildFixtureReviewView({ proposals: [proposal] }),
      { csrfToken: 'fixture-token', proposal },
    );

    expect(html).toContain('S9 Fixture review');
    expect(html).toContain('acme-view-fixture-review/1');
    expect(html).toContain('proposal-web-001');
    expect(html).toContain('pending');
    expect(html).toContain('digest-old');
    expect(html).toContain('digest-new');
    expect(html).toContain('Not applied');
    expect(html).toContain('Approve proposed change');
    expect(html).toContain('Reject proposed change');
    expect(html).toContain('fixture-token');
    expect(html).toContain('PROPOSAL_PENDING_DECISION');
  });

  it('renders decided S9 history without offering to rewrite the decision', () => {
    const proposal: FixtureChangeProposal = {
      proposalId: 'proposal-web-002',
      fixturePath: 'digests/research.json',
      expectedDigest: 'digest-before',
      proposedDigest: 'digest-after',
      runId: 'run-web-1',
      executionId: 'exec-1',
    };
    const approval = decideFixtureChange({
      proposal,
      decision: 'rejected',
      approver: '<reviewer>',
      rationale: '<unsafe> insufficient evidence',
      decidedAt: '2026-08-05T20:30:00.000Z',
    });
    const html = renderFixtureReviewViewHtml(
      buildFixtureReviewView({
        proposals: [proposal],
        approvals: [approval],
        unreadable: ['<broken>.json'],
      }),
      { csrfToken: 'fixture-token' },
    );

    expect(html).toContain('rejected');
    expect(html).toContain('&lt;reviewer&gt;');
    expect(html).toContain('&lt;unsafe&gt; insufficient evidence');
    expect(html).toContain('&lt;broken&gt;.json');
    expect(html).not.toContain('<reviewer>');
    expect(html).not.toContain('action="/s9/decision"');
  });

  it('renders S10 confirmation, live-only runs and recorded cost without credentials', () => {
    const html = renderLiveEvaluationViewHtml(
      buildLiveEvaluationView({
        confirmation: {
          version: 'acme-live-confirmation/1',
          optIn: true,
          provider: 'openai',
          model: '<model-live>',
          caseCount: 1,
          maxModelCalls: 1,
          costCeilingMinor: 50,
          currency: 'USD',
          confirmer: '<reviewer>',
          rationale: '<reason> bounded smoke',
        },
        records: [
          record(),
          record({
            runId: 'live-web-1',
            composition: { repository: 'sqlite', gateway: 'openai' },
            live: {
              provider: 'openai',
              model: '<model-live>',
              confirmer: '<reviewer>',
              maxModelCalls: 1,
              costCeilingMinor: 50,
              usage: {
                totalTokens: 18,
                estimatedCostMinor: 2,
                currency: 'USD',
              },
            },
          }),
        ],
        unreadable: ['<broken>.json'],
      }),
      {
        csrfToken: 'live-token',
        processOptIn: true,
        form: {
          runId: 'live-web-2',
          requestSource: '{"requestKey":"<request>"}',
          optIn: true,
          provider: 'openai',
          model: '<model-live>',
          caseCount: '1',
          maxModelCalls: '1',
          costCeilingMinor: '50',
          currency: 'USD',
          confirmer: '<reviewer>',
          rationale: '<reason> bounded smoke',
        },
      },
    );

    expect(html).toContain('S10 Live evaluation');
    expect(html).toContain('acme-view-live-evaluation/1');
    expect(html).toContain('live-web-1');
    expect(html).not.toContain('run-web-1');
    expect(html).toContain('18');
    expect(html).toContain('2 minor units');
    expect(html).toContain('&lt;model-live&gt;');
    expect(html).toContain('&lt;reviewer&gt;');
    expect(html).toContain('&lt;reason&gt; bounded smoke');
    expect(html).toContain('&lt;broken&gt;.json');
    expect(html).toContain('live-token');
    expect(html).not.toContain('name="apiKey"');
    expect(html).not.toContain('name="token"');
    expect(html).not.toContain('<model-live>');
    expect(html).not.toContain('<reviewer>');
  });

  it('renders S10 gate, confirmation and cost absence without inventing zeros', () => {
    const html = renderLiveEvaluationViewHtml(
      buildLiveEvaluationView({ records: [] }),
      {
        csrfToken: 'live-token',
        processOptIn: false,
        form: {
          runId: '',
          requestSource: '',
          optIn: false,
          provider: 'openai',
          model: '',
          caseCount: '1',
          maxModelCalls: '1',
          costCeilingMinor: '',
          currency: '',
          confirmer: '',
          rationale: '',
        },
      },
    );

    expect(html).toContain('Process gate disabled');
    expect(html).toContain('LIVE_CONFIRMATION_UNAVAILABLE');
    expect(html).toContain('LIVE_COST_UNAVAILABLE');
    expect(html).toContain('Mock history is intentionally excluded');
    expect(html).toContain('disabled');
    expect(html).not.toContain('not rendered in the first visual slice');
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
