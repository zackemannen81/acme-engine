/**
 * `@acme/test-ui` — Domain Test UI (ADR-0019).
 *
 * Phase 1 is the read model only: pure functions from recorded evidence to
 * versioned view contracts. This package performs no I/O, opens no database,
 * reads no clock and makes no network call. It is a leaf — nothing in the
 * workspace imports it, and deleting it loses no canonical fact.
 *
 * Later phases add the catalog (S1), the plan compiler, the composition
 * process that loads evidence, and the browser surface.
 */

export const ACME_TEST_UI_PACKAGE = '@acme/test-ui' as const;

export {
  CATALOG_VIEW_VERSION,
  EXECUTION_VIEW_VERSION,
  MEMORY_DECISION_VIEW_VERSION,
  REPLAY_VIEW_VERSION,
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
