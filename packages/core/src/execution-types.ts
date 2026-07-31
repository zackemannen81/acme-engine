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

export type ExecutionResult =
  | {
      readonly status: 'committed';
      readonly executionId: string;
      readonly replayed: boolean;
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
