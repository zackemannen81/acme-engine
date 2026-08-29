import type {
  DiagnosticFact,
  EntityId,
  ExecutionId,
  JsonValue,
  Namespace,
  RequestKey,
} from './common.js';
import type { AcmeErrorData } from './errors.js';
import type { ModelSelection } from './model.js';

export type { ExecutionStatus } from './execution-status.js';

export interface ExecutionPolicy {
  readonly timeoutMs: number;
  readonly maxModelCalls: number;
  readonly maxRepairCalls: number;
  readonly maxRevisionCalls: number;
  readonly maxInputTokens?: number;
  readonly maxOutputTokens?: number;
  readonly maxEstimatedCostMinor?: number;
  readonly retention: 'none' | 'hash-only' | 'encrypted-payload';
}

export interface ExecutionRequest<TInput = JsonValue> {
  readonly requestKey: RequestKey;
  readonly namespace: Namespace;
  readonly task: string;
  readonly entityId: EntityId;
  readonly expectedRevision: number;
  readonly input: TInput;
  readonly model: ModelSelection;
  readonly policy?: Partial<ExecutionPolicy>;
}

/**
 * Invocation-level provenance for a committed result.
 *
 * This describes how the current `execute()` call reached its committed result;
 * it is deliberately not pricing evidence and it does not change deterministic
 * execution identity or repository commit semantics.
 */
export type ExecutionReuseReason =
  'fresh' | 'committed-execution' | 'recorded-response-resume';

export type ExecutionResult =
  | {
      readonly status: 'committed';
      readonly executionId: string;
      readonly replayed: boolean;
      /**
       * New runtime results always populate this. Historical persisted results
       * written before reuse provenance existed may omit it when loaded.
       */
      readonly reuseReason?: ExecutionReuseReason;
      readonly revision: number;
      readonly documentKeys: readonly string[];
      readonly eventIds: readonly string[];
    }
  | {
      readonly status: 'blocked' | 'conflicted' | 'cancelled' | 'failed';
      readonly executionId: string;
      readonly error: AcmeErrorData;
    };

export interface ReplayReport {
  readonly executionId: ExecutionId;
  readonly mode: 'verify';
  readonly status: 'match' | 'different' | 'unavailable';
  readonly recordedDigest?: string;
  readonly replayDigest?: string;
  readonly differences: readonly DiagnosticFact[];
}
