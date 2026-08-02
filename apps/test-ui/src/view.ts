/**
 * Shared view-contract primitives (ADR-0019).
 *
 * Every surface publishes a versioned, JSON-serializable value. Two rules are
 * encoded here rather than left to each builder:
 *
 * 1. Absence is a value. A section the interface could not read is
 *    `unavailable` with a reason code, never an empty array or a zero.
 * 2. The interface never computes a verdict. Builders copy verdicts produced
 *    by the engine, the runner or a conformance kit.
 */

export const EXECUTION_VIEW_VERSION = 'acme-view-execution/1' as const;
export const MEMORY_DECISION_VIEW_VERSION =
  'acme-view-memory-decisions/1' as const;
export const STATE_VIEW_VERSION = 'acme-view-state/1' as const;
export const REPLAY_VIEW_VERSION = 'acme-view-replay/1' as const;
export const CATALOG_VIEW_VERSION = 'acme-view-catalog/1' as const;

/**
 * Reason codes for an unavailable section. They are part of the view
 * contract, so a renderer can explain absence without guessing.
 */
export const VIEW_UNAVAILABLE = {
  /** The execution has no recorded replay evidence to read. */
  replayEvidence: 'REPLAY_EVIDENCE_UNAVAILABLE',
  /** No prepared commit was recorded; the execution never reached commit. */
  preparedCommit: 'PREPARED_COMMIT_UNAVAILABLE',
  /** No state was prepared by this execution. */
  preparedState: 'PREPARED_STATE_UNAVAILABLE',
  /** State evidence for the entity was not loaded by the caller. */
  stateEvidence: 'STATE_EVIDENCE_UNAVAILABLE',
  /** The transition that produced a revision was not recorded. */
  stateTransition: 'STATE_TRANSITION_UNAVAILABLE',
  /** No replay was run, which is not the engine's `unavailable` verdict. */
  replayNotRun: 'REPLAY_NOT_RUN',
  /** A protected payload exists but could not be read back. */
  payloadUnreadable: 'PAYLOAD_UNREADABLE',
  /** The execution recorded no response-pipeline failure to describe. */
  responseValidation: 'RESPONSE_VALIDATION_NOT_RECORDED',
  /** The validated task input was not recorded for this execution. */
  taskInput: 'TASK_INPUT_UNAVAILABLE',
  /** A decision references a candidate the prepared commit does not hold. */
  memoryCandidate: 'MEMORY_CANDIDATE_UNAVAILABLE',
  /** No module registry was supplied to the catalog. */
  moduleRegistry: 'MODULE_REGISTRY_UNAVAILABLE',
  /** No contract registry was supplied to the catalog. */
  contractRegistry: 'CONTRACT_REGISTRY_UNAVAILABLE',
  /**
   * The engine has no evaluator registry. Evaluator evidence exists per run
   * (`PreparedEvaluatorRun`), but nothing enumerates evaluators, so the
   * catalog states that rather than rendering an empty list.
   */
  evaluatorRegistry: 'EVALUATOR_REGISTRY_UNAVAILABLE',
  /** Scenario discovery did not run. */
  scenarioDiscovery: 'SCENARIO_DISCOVERY_UNAVAILABLE',
  /** Fixture discovery did not run. */
  fixtureDiscovery: 'FIXTURE_DISCOVERY_UNAVAILABLE',
  /**
   * No scenario validator was supplied. The catalog owns no schema of its
   * own, so without the runner's validator it cannot classify a document.
   */
  scenarioValidator: 'SCENARIO_VALIDATOR_UNAVAILABLE',
  /** The caller declared no adapter kit targets. */
  adapterTargets: 'ADAPTER_TARGETS_UNAVAILABLE',
} as const;

export interface ViewUnavailable {
  readonly availability: 'unavailable';
  readonly reason: string;
}

export type ViewSection<T> =
  ({ readonly availability: 'available' } & T) | ViewUnavailable;

export function unavailable(reason: string): ViewUnavailable {
  return { availability: 'unavailable', reason };
}

export function available<T>(
  value: T,
): { readonly availability: 'available' } & T {
  return { availability: 'available', ...value };
}

export function isAvailable<T>(
  section: ViewSection<T>,
): section is { readonly availability: 'available' } & T {
  return section.availability === 'available';
}
