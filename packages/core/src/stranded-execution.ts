import type { ExecutionId, IsoTimestamp, JsonValue } from './common.js';
import { AcmeError, type AcmeErrorData } from './errors.js';
import type { ExecutionStatus } from './execution-status.js';
import type {
  ExecutionRecord,
  ModelCallRecord,
  NonCommitTerminalRecord,
  RepositoryEvidence,
} from './repository.js';

/** Versioned list document identity. */
export const ACME_STRANDED_LIST = 'acme-stranded-list/1' as const;

/**
 * Why an execution needs a human decision rather than automatic resume.
 * Aligns with ADR-0017 resume refusals and ADR-0014 terminal ambiguity.
 */
export type StrandedReasonCode =
  | 'unobserved-reservation'
  | 'unreadable-response'
  | 'recorded-failure'
  | 'recorded-ambiguous'
  | 'terminal-resume-refusal';

export type StrandedDisposition = 'open' | 'terminal';

export interface StrandedExecutionEntry {
  readonly executionId: ExecutionId;
  readonly disposition: StrandedDisposition;
  readonly status: ExecutionStatus;
  readonly namespace: string;
  readonly task: string;
  readonly requestKey: string;
  readonly entityId: string;
  readonly reasonCode: StrandedReasonCode;
  readonly modelCallId?: string;
  readonly modelCallStatus?: ModelCallRecord['status'];
  readonly errorCode?: AcmeErrorData['code'];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface StrandedListReport {
  readonly report: typeof ACME_STRANDED_LIST;
  readonly count: number;
  readonly entries: readonly StrandedExecutionEntry[];
}

export interface OperatorDischargeInput {
  readonly executionId: ExecutionId;
  /** Non-empty operator identity (human or system account name). */
  readonly dischargedBy: string;
  /** Non-empty rationale for the discharge decision. */
  readonly rationale: string;
  readonly dischargedAt: IsoTimestamp;
}

export interface OperatorDischargeResult {
  readonly executionId: ExecutionId;
  readonly reasonCode: StrandedReasonCode;
  readonly terminal: NonCommitTerminalRecord;
}

const PRIMARY = {
  callKey: 'model:0',
  attempt: 1,
  purpose: 'primary' as const,
};

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'accepted',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function requireNonEmpty(value: string, field: string): string {
  if (value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
  return value;
}

function requireTimestamp(value: string): IsoTimestamp {
  if (
    !TIMESTAMP.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    invalid('dischargedAt must be a canonical UTC ISO-8601 timestamp.');
  }
  return value;
}

function isMutable(status: ExecutionStatus): boolean {
  return (
    status !== 'committed' &&
    status !== 'blocked' &&
    status !== 'conflicted' &&
    status !== 'cancelled' &&
    status !== 'failed'
  );
}

function primaryCall(
  modelCalls: readonly ModelCallRecord[],
  executionId: ExecutionId,
): ModelCallRecord | undefined {
  return modelCalls.find(
    (call) =>
      call.executionId === executionId &&
      call.callKey === PRIMARY.callKey &&
      call.attempt === PRIMARY.attempt &&
      call.purpose === PRIMARY.purpose,
  );
}

function openReason(call: ModelCallRecord):
  | {
      readonly reasonCode: Exclude<
        StrandedReasonCode,
        'terminal-resume-refusal'
      >;
      readonly errorCode?: AcmeErrorData['code'];
    }
  | undefined {
  if (call.status === 'reserved' || call.status === 'in-flight') {
    return {
      reasonCode: 'unobserved-reservation',
      errorCode: 'MODEL_UNAVAILABLE',
    };
  }
  if (call.status === 'succeeded' && call.response === undefined) {
    return {
      reasonCode: 'unreadable-response',
      errorCode: 'RESUME_EVIDENCE_UNAVAILABLE',
    };
  }
  if (call.status === 'failed') {
    return {
      reasonCode: 'recorded-failure',
      ...(call.error === undefined ? {} : { errorCode: call.error.code }),
    };
  }
  if (call.status === 'ambiguous') {
    return {
      reasonCode: 'recorded-ambiguous',
      ...(call.error === undefined ? {} : { errorCode: call.error.code }),
    };
  }
  return undefined;
}

function terminalStrandedReason(
  execution: ExecutionRecord,
): StrandedReasonCode | undefined {
  if (execution.status !== 'failed' || execution.error === undefined) {
    return undefined;
  }
  const code = execution.error.code;
  if (code === 'MODEL_UNAVAILABLE' || code === 'RESUME_EVIDENCE_UNAVAILABLE') {
    return 'terminal-resume-refusal';
  }
  const details = execution.error.details;
  if (
    details !== null &&
    typeof details === 'object' &&
    !Array.isArray(details) &&
    (details as Record<string, unknown>)['operatorDischarge'] === true
  ) {
    const reason = (details as Record<string, unknown>)['strandedReason'];
    if (typeof reason === 'string') {
      return reason as StrandedReasonCode;
    }
    return 'terminal-resume-refusal';
  }
  return undefined;
}

function entryFrom(
  execution: ExecutionRecord,
  call: ModelCallRecord | undefined,
  disposition: StrandedDisposition,
  reasonCode: StrandedReasonCode,
  errorCode?: AcmeErrorData['code'],
): StrandedExecutionEntry {
  return Object.freeze({
    executionId: execution.executionId,
    disposition,
    status: execution.status,
    namespace: execution.request.namespace,
    task: execution.request.task,
    requestKey: execution.request.requestKey,
    entityId: execution.request.entityId,
    reasonCode,
    ...(call === undefined ? {} : { modelCallId: call.modelCallId }),
    ...(call === undefined ? {} : { modelCallStatus: call.status }),
    ...(errorCode === undefined ? {} : { errorCode }),
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
  });
}

/**
 * Inventory executions that need a human decision for resume/outcome
 * (ADR-0017). Deterministic order: `executionId` ascending.
 */
export function listStrandedExecutions(
  evidence: Pick<RepositoryEvidence, 'executions' | 'modelCalls'>,
  options: { readonly limit?: number } = {},
): StrandedListReport {
  const limit = options.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    invalid('limit must be a positive safe integer.', { limit });
  }

  const entries: StrandedExecutionEntry[] = [];
  const ordered = [...evidence.executions].sort((left, right) =>
    left.executionId < right.executionId
      ? -1
      : left.executionId > right.executionId
        ? 1
        : 0,
  );

  for (const execution of ordered) {
    if (entries.length >= limit) {
      break;
    }
    const call = primaryCall(evidence.modelCalls, execution.executionId);

    if (isMutable(execution.status)) {
      // No primary reservation: resume runs from the beginning (not stranded).
      if (call === undefined) {
        continue;
      }
      const open = openReason(call);
      if (open === undefined) {
        // Succeeded with readable response: engine can resume without a human.
        continue;
      }
      entries.push(
        entryFrom(
          execution,
          call,
          'open',
          open.reasonCode,
          open.errorCode ?? execution.error?.code,
        ),
      );
      continue;
    }

    const terminalReason = terminalStrandedReason(execution);
    if (terminalReason !== undefined) {
      entries.push(
        entryFrom(
          execution,
          call,
          'terminal',
          terminalReason,
          execution.error?.code,
        ),
      );
    }
  }

  return Object.freeze({
    report: ACME_STRANDED_LIST,
    count: entries.length,
    entries: Object.freeze(entries),
  });
}

function dischargeError(
  reasonCode: Exclude<StrandedReasonCode, 'terminal-resume-refusal'>,
  call: ModelCallRecord,
  input: OperatorDischargeInput,
): AcmeErrorData {
  const baseCode: AcmeErrorData['code'] =
    reasonCode === 'unobserved-reservation'
      ? 'MODEL_UNAVAILABLE'
      : reasonCode === 'unreadable-response'
        ? 'RESUME_EVIDENCE_UNAVAILABLE'
        : (call.error?.code ?? 'MODEL_UNAVAILABLE');

  const stage: ExecutionStatus =
    call.error?.stage ??
    (reasonCode === 'unreadable-response' ? 'calling-model' : 'calling-model');

  const message =
    reasonCode === 'unobserved-reservation'
      ? 'Operator discharged an execution whose model-call outcome was never observed.'
      : reasonCode === 'unreadable-response'
        ? 'Operator discharged an execution whose model response is not readable.'
        : reasonCode === 'recorded-ambiguous'
          ? 'Operator discharged an execution with a recorded ambiguous model call.'
          : 'Operator discharged an execution with a recorded failed model call.';

  return Object.freeze({
    code: baseCode,
    message,
    stage,
    retryable: false,
    details: Object.freeze({
      operatorDischarge: true,
      dischargedBy: input.dischargedBy,
      rationale: input.rationale,
      dischargedAt: input.dischargedAt,
      strandedReason: reasonCode,
      modelCallId: call.modelCallId,
      modelCallStatus: call.status,
      ...(call.error === undefined
        ? {}
        : { recordedErrorCode: call.error.code }),
    }),
  });
}

/**
 * Build a non-commit terminal record for an **open** stranded execution.
 * Does not write; the caller persists via `markTerminal` (and optional
 * attempt append). Refuses committed, non-stranded and already-terminal rows.
 */
export function prepareOperatorDischarge(
  evidence: Pick<RepositoryEvidence, 'executions' | 'modelCalls'>,
  input: OperatorDischargeInput,
): OperatorDischargeResult {
  const executionId = requireNonEmpty(input.executionId, 'executionId');
  const dischargedBy = requireNonEmpty(input.dischargedBy, 'dischargedBy');
  const rationale = requireNonEmpty(input.rationale, 'rationale');
  const dischargedAt = requireTimestamp(input.dischargedAt);

  const execution = evidence.executions.find(
    (entry) => entry.executionId === executionId,
  );
  if (execution === undefined) {
    invalid('Unknown execution.', { executionId });
  }

  if (!isMutable(execution.status)) {
    invalid('Only non-terminal stranded executions can be discharged.', {
      executionId,
      status: execution.status,
    });
  }

  const call = primaryCall(evidence.modelCalls, executionId);
  if (call === undefined) {
    invalid(
      'Execution is not stranded: no primary model-call reservation exists.',
      { executionId },
    );
  }

  const open = openReason(call);
  if (open === undefined) {
    invalid(
      'Execution is not stranded: the primary model call can be resumed from recorded evidence.',
      { executionId, modelCallStatus: call.status },
    );
  }

  const error = dischargeError(open.reasonCode, call, {
    executionId,
    dischargedBy,
    rationale,
    dischargedAt,
  });

  const terminal: NonCommitTerminalRecord = Object.freeze({
    executionId,
    status: 'failed',
    error,
    terminalAt: dischargedAt,
  });

  return Object.freeze({
    executionId,
    reasonCode: open.reasonCode,
    terminal,
  });
}
