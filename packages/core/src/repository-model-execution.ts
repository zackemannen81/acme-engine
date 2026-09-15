import type { IsoTimestamp } from './common.js';
import type { AcmeErrorData } from './errors.js';
import type {
  ModelCapabilities,
  ModelRequest,
  ModelSelection,
} from './model.js';
import type {
  ModelExecutionDiagnostic,
  ModelExecutionPolicy,
  ModelExecutionRecord,
  ModelExecutionResult,
  ModelExecutionStatus,
} from './model-execution-types.js';
import type {
  CompletedModelCall,
  FailedModelCall,
  ModelCallRecord,
  ModelCallReservation,
} from './repository-model-call.js';

export interface AcceptedModelExecution {
  readonly modelExecutionId: string;
  readonly requestKey: string;
  readonly requestFingerprint: string;
  readonly requestHash: string;
  readonly selection: ModelSelection;
  readonly request: ModelRequest;
  readonly requiredCapabilities: Partial<ModelCapabilities>;
  readonly effectivePolicy: ModelExecutionPolicy;
  readonly createdAt: IsoTimestamp;
}

export type ModelExecutionAcceptResult =
  | { readonly kind: 'created'; readonly execution: ModelExecutionRecord }
  | { readonly kind: 'existing'; readonly execution: ModelExecutionRecord }
  | { readonly kind: 'conflict'; readonly existingExecutionId: string };

export interface ModelExecutionResumeState {
  readonly modelExecutionId: string;
  readonly execution: ModelExecutionRecord;
  readonly modelCalls: readonly ModelCallRecord[];
}

export interface ModelExecutionTerminal {
  readonly modelExecutionId: string;
  readonly status: Extract<
    ModelExecutionStatus,
    'succeeded' | 'failed' | 'cancelled' | 'conflicted' | 'ambiguous'
  >;
  readonly result: ModelExecutionResult;
  readonly error?: AcmeErrorData;
  readonly diagnostic: ModelExecutionDiagnostic;
  readonly terminalAt: IsoTimestamp;
}

export interface ModelExecutionRepository {
  accept(input: AcceptedModelExecution): Promise<ModelExecutionAcceptResult>;
  get(modelExecutionId: string): Promise<ModelExecutionRecord | null>;
  reserveModelCall(call: ModelCallReservation): Promise<ModelCallRecord>;
  completeModelCall(call: CompletedModelCall): Promise<void>;
  failModelCall(call: FailedModelCall): Promise<void>;
  loadResumeState(
    modelExecutionId: string,
  ): Promise<ModelExecutionResumeState | null>;
  markTerminal(terminal: ModelExecutionTerminal): Promise<void>;
}
