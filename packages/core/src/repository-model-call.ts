import type { ExecutionId, IsoTimestamp, ModelCallId } from './common.js';
import type { AcmeErrorData } from './errors.js';
import type { ModelSelection, NormalizedModelResponse } from './model.js';

export interface ModelCallReservation {
  readonly modelCallId: ModelCallId;
  readonly executionId: ExecutionId;
  readonly callKey: string;
  readonly attempt: number;
  readonly purpose: 'primary' | 'repair' | 'revision';
  readonly selection: ModelSelection;
  readonly requestHash: string;
  readonly protectedRequest?: string;
  readonly startedAt: IsoTimestamp;
}

export interface ModelCallRecord extends ModelCallReservation {
  readonly status:
    'reserved' | 'in-flight' | 'succeeded' | 'failed' | 'ambiguous';
  readonly response?: NormalizedModelResponse;
  readonly responseHash?: string;
  readonly protectedResponse?: string;
  readonly error?: AcmeErrorData;
  readonly completedAt?: IsoTimestamp;
}

export interface CompletedModelCall {
  readonly modelCallId: ModelCallId;
  readonly response: NormalizedModelResponse;
  readonly responseHash: string;
  readonly protectedResponse?: string;
  readonly completedAt: IsoTimestamp;
}

export interface FailedModelCall {
  readonly modelCallId: ModelCallId;
  readonly error: AcmeErrorData;
  readonly ambiguous: boolean;
  readonly completedAt: IsoTimestamp;
}
