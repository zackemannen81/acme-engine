/**
 * `@acme/test-ui` — Domain Test UI (ADR-0019 to ADR-0023).
 *
 * This entry point is pure: functions from recorded evidence and configured
 * rules to versioned view contracts. It performs no I/O, opens no database,
 * reads no clock and makes no network call, which is what keeps every surface
 * assertable as JSON without a browser or a disk.
 *
 * Anything that touches a filesystem or selects an adapter lives elsewhere:
 * `@acme/test-ui/node-source` for catalog discovery, `@acme/test-ui/local`
 * for the workspace, the composition and launching (including gated live).
 *
 * Surfaces: S1 catalog, S2 plan designer, S3 run console and history, S4–S7
 * execution, memory, state and replay inspection, S8 measurement, S9 fixture
 * review and S10 live evaluation. Pure HTML renderers for the local workbench
 * live under `./web` exports. I/O and the loopback server live on `./local`.
 * It is a leaf — nothing in the workspace imports it, and deleting it loses
 * no canonical fact.
 */

export const ACME_TEST_UI_PACKAGE = '@acme/test-ui' as const;

export {
  CATALOG_VIEW_VERSION,
  EXECUTION_VIEW_VERSION,
  FIXTURE_REVIEW_VIEW_VERSION,
  LIVE_EVALUATION_VIEW_VERSION,
  MEASUREMENT_VIEW_VERSION,
  MEMORY_DECISION_VIEW_VERSION,
  PLAN_VIEW_VERSION,
  REPLAY_VIEW_VERSION,
  RUNS_VIEW_VERSION,
  STATE_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  available,
  isAvailable,
  unavailable,
  type ViewSection,
  type ViewUnavailable,
} from './view.js';

export {
  contentView,
  optionalContentView,
  retainedContentView,
  type PayloadView,
  type RedactionOptions,
  type RetentionMode,
} from './redaction.js';

export {
  contractRefView,
  diagnosticView,
  documentView,
  errorView,
  memoryRecordView,
  modelSelectionView,
  rankedMemoryView,
  stateSnapshotView,
  type ContractRefView,
  type DiagnosticView,
  type DocumentView,
  type ErrorView,
  type MemoryRecordView,
  type ModelSelectionView,
  type RankedMemoryView,
  type StateSnapshotView,
} from './read-model/shared.js';

export {
  buildExecutionView,
  type AttemptView,
  type ExecutionEvidence,
  type ExecutionHeaderView,
  type ExecutionTerminalView,
  type ExecutionView,
  type ExecutionViewOptions,
  type ModelCallView,
  type PipelineIssueView,
  type PolicyView,
  type PreparedCommitView,
  type PreparedStateView,
  type ReadSetView,
  type ResponseValidationView,
  type TrustStage,
  type TrustStageOutcome,
  type TrustStageView,
} from './read-model/execution.js';

export {
  buildMemoryDecisionsView,
  type MemoryCandidateView,
  type MemoryDecisionEvidence,
  type MemoryDecisionView,
  type MemoryDecisionViewOptions,
  type MemoryDecisionsView,
  type MemoryMutationView,
} from './read-model/memory.js';

export {
  buildStateView,
  type StateEvidence,
  type StateRevisionView,
  type StateTransitionView,
  type StateView,
  type StateViewOptions,
} from './read-model/state.js';

export {
  buildReplayView,
  type DigestComparisonView,
  type ReplayEvidence,
  type ReplayView,
  type ReplayViewOptions,
} from './read-model/replay.js';

export {
  ADAPTER_KITS,
  buildCatalogView,
  type AdapterKit,
  type AdapterTargetDeclaration,
  type AdapterTargetView,
  type CatalogDiagnostic,
  type CatalogDiagnosticView,
  type CatalogEvidence,
  type CatalogView,
  type CatalogViewOptions,
  type ContractCatalogView,
  type DiscoveredFixtureFile,
  type DiscoveredScenarioFile,
  type FixtureCatalogView,
  type ModuleCatalogView,
  type ReferenceResolutionStatus,
  type ScenarioCatalogView,
  type ScenarioDocumentShape,
  type ScenarioReferenceView,
  type ScenarioTargetView,
  type ScenarioValidator,
  type TaskCatalogView,
} from './read-model/catalog.js';

export {
  comparePaths,
  normalizeDiscoveredPath,
  resolveReference,
  PATH_REFUSAL,
  type PathRefusalReason,
  type ResolvedReference,
} from './catalog/paths.js';

export {
  defaultRequestKey,
  parseTestPlan,
  TEST_PLAN_SCHEMA_VERSION,
  type TestPlan,
  type TestPlanCase,
  type TestPlanComposition,
  type TestPlanExpectation,
  type TestPlanReplay,
  type TestPlanSeed,
} from './plan/schema.js';

export {
  buildPlanView,
  type PlanCaseView,
  type PlanDetailView,
  type PlanView,
  type PlanViewOptions,
} from './read-model/plan.js';

export {
  buildRunDetailView,
  buildRunsView,
  type RunDetailView,
  type RunSummaryView,
  type RunsEvidence,
  type RunsView,
} from './read-model/runs.js';

export {
  buildMeasurementView,
  captureBaseline,
  BASELINE_VERSION,
  MEASURE_IDS,
  type BaselineComparison,
  type MeasureId,
  type MeasureThreshold,
  type MeasureView,
  type MeasurementBaseline,
  type MeasurementEvidence,
  type MeasurementSeriesView,
  type MeasurementThresholds,
  type MeasurementView,
  type ThresholdOutcome,
} from './read-model/measurement.js';

export {
  buildFixtureReviewView,
  type FixtureProposalView,
  type FixtureReviewEvidence,
  type FixtureReviewView,
  type ReviewableChangeView,
} from './read-model/fixture-review.js';

export {
  decideFixtureChange,
  parseFixtureApproval,
  ApprovalRefused,
  APPROVAL_REFUSAL,
  FIXTURE_APPROVAL_VERSION,
  type ApprovalDecision,
  type ApprovalInput,
  type FixtureApprovalRecord,
  type FixtureChangeProposal,
} from './fixture-approval.js';

export {
  buildLiveEvaluationView,
  type LiveConfirmationView,
  type LiveCostView,
  type LiveEvaluationEvidence,
  type LiveEvaluationView,
  type LiveRunSummaryView,
} from './read-model/live-evaluation.js';

export {
  assertWithinBudget,
  isLiveOptInEnv,
  LIVE_CONFIRMATION_VERSION,
  LIVE_GATE_REFUSAL,
  LiveGateRefused,
  parseLiveConfirmation,
  requireLiveGate,
  type LiveEvaluationConfirmation,
  type LiveProvider,
} from './live-gate.js';

export {
  isSafeRunId,
  parseRunRecord,
  RUN_RECORD_VERSION,
  type LiveRunMetadata,
  type RunCaseRecord,
  type RunRecord,
  type RunStepRecord,
} from './run-record.js';

export {
  escapeHtml,
  renderCatalogViewHtml,
  renderExecutionViewHtml,
  renderFixtureReviewViewHtml,
  renderMemoryDecisionsViewHtml,
  renderMeasurementViewHtml,
  renderReplayViewHtml,
  renderStateViewHtml,
  renderPlanViewHtml,
  renderRunsViewHtml,
  renderShell,
  renderStubSurface,
  WORKBENCH_CSS,
  type PlanWorkbenchNotice,
  type PlanWorkbenchRenderOptions,
  type FixtureReviewNotice,
  type FixtureReviewRenderOptions,
  type WorkbenchSurface,
} from './web/index.js';

export {
  compileTestPlan,
  SCENARIO_SCHEMA_VERSION,
  type CompileOptions,
  type CompiledAssertDigestStep,
  type CompiledAssertStep,
  type CompiledExecuteStep,
  type CompiledPlan,
  type CompiledReplayStep,
  type CompiledScenario,
  type CompiledStep,
} from './plan/compile.js';
