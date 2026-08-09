import { describe, expect, it } from 'vitest';

import { AcmeError } from '../src/errors.js';
import type { ExecutionRecord, ModelCallRecord } from '../src/repository.js';
import {
  listStrandedExecutions,
  prepareOperatorDischarge,
} from '../src/stranded-execution.js';

const now = '2026-08-06T12:00:00.000Z';

function execution(
  overrides: Partial<ExecutionRecord> & Pick<ExecutionRecord, 'executionId'>,
): ExecutionRecord {
  return {
    executionId: overrides.executionId,
    request: {
      requestKey: overrides.executionId,
      namespace: 'ns',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 0,
      input: { ok: true },
      model: { profile: 'fixture' },
      ...(overrides.request ?? {}),
    },
    requestFingerprint: 'fp',
    inputHash: 'ih',
    contract: { id: 'c.observe', version: '1.0.0' },
    contractFingerprint: 'cfp',
    policy: {
      timeoutMs: 1_000,
      maxModelCalls: 1,
      maxRepairCalls: 0,
      maxRevisionCalls: 0,
      retention: 'hash-only',
    },
    status: overrides.status ?? 'accepted',
    currentStage: overrides.currentStage ?? overrides.status ?? 'accepted',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...(overrides.error === undefined ? {} : { error: overrides.error }),
    ...(overrides.result === undefined ? {} : { result: overrides.result }),
  };
}

function call(
  overrides: Partial<ModelCallRecord> &
    Pick<ModelCallRecord, 'executionId' | 'modelCallId' | 'status'>,
): ModelCallRecord {
  return {
    modelCallId: overrides.modelCallId,
    executionId: overrides.executionId,
    callKey: 'model:0',
    attempt: 1,
    purpose: 'primary',
    selection: { profile: 'fixture' },
    requestHash: 'rh',
    startedAt: now,
    status: overrides.status,
    ...(overrides.response === undefined
      ? {}
      : { response: overrides.response }),
    ...(overrides.responseHash === undefined
      ? {}
      : { responseHash: overrides.responseHash }),
    ...(overrides.error === undefined ? {} : { error: overrides.error }),
    ...(overrides.completedAt === undefined
      ? {}
      : { completedAt: overrides.completedAt }),
  };
}

describe('listStrandedExecutions', () => {
  it('lists open unobserved reservations and skips clean resume cases', () => {
    const report = listStrandedExecutions({
      executions: [
        execution({ executionId: 'exec-clean' }),
        execution({ executionId: 'exec-reserved' }),
        execution({ executionId: 'exec-readable' }),
      ],
      modelCalls: [
        call({
          executionId: 'exec-reserved',
          modelCallId: 'call-reserved',
          status: 'reserved',
        }),
        call({
          executionId: 'exec-readable',
          modelCallId: 'call-ok',
          status: 'succeeded',
          response: {
            provider: 'fixture',
            model: 'fixture',
            receivedAt: now,
            finishReason: 'stop',
            text: '{}',
            usage: {},
            metadata: {},
          },
          responseHash: 'rh2',
          completedAt: now,
        }),
      ],
    });

    expect(report.report).toBe('acme-stranded-list/1');
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]).toMatchObject({
      executionId: 'exec-reserved',
      disposition: 'open',
      reasonCode: 'unobserved-reservation',
      errorCode: 'MODEL_UNAVAILABLE',
      modelCallStatus: 'reserved',
    });
  });

  it('classifies unreadable, failed and ambiguous open calls', () => {
    const report = listStrandedExecutions({
      executions: [
        execution({ executionId: 'a-unreadable' }),
        execution({ executionId: 'b-failed' }),
        execution({ executionId: 'c-ambiguous' }),
      ],
      modelCalls: [
        call({
          executionId: 'a-unreadable',
          modelCallId: 'c1',
          status: 'succeeded',
          responseHash: 'h',
          completedAt: now,
        }),
        call({
          executionId: 'b-failed',
          modelCallId: 'c2',
          status: 'failed',
          error: {
            code: 'MODEL_RATE_LIMIT',
            message: 'rate limited',
            stage: 'calling-model',
            retryable: true,
          },
          completedAt: now,
        }),
        call({
          executionId: 'c-ambiguous',
          modelCallId: 'c3',
          status: 'ambiguous',
          error: {
            code: 'MODEL_UNAVAILABLE',
            message: 'no status line',
            stage: 'calling-model',
            retryable: false,
          },
          completedAt: now,
        }),
      ],
    });

    expect(report.entries.map((entry) => entry.reasonCode)).toEqual([
      'unreadable-response',
      'recorded-failure',
      'recorded-ambiguous',
    ]);
  });

  it('includes terminal resume-refusal failures for inventory', () => {
    const report = listStrandedExecutions({
      executions: [
        execution({
          executionId: 'exec-terminal',
          status: 'failed',
          currentStage: 'failed',
          error: {
            code: 'RESUME_EVIDENCE_UNAVAILABLE',
            message: 'not readable',
            stage: 'calling-model',
            retryable: false,
          },
        }),
        execution({
          executionId: 'exec-committed',
          status: 'committed',
          currentStage: 'committed',
        }),
      ],
      modelCalls: [],
    });

    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]).toMatchObject({
      executionId: 'exec-terminal',
      disposition: 'terminal',
      reasonCode: 'terminal-resume-refusal',
      errorCode: 'RESUME_EVIDENCE_UNAVAILABLE',
    });
  });

  it('respects limit and rejects non-positive limits', () => {
    const report = listStrandedExecutions(
      {
        executions: [
          execution({ executionId: 'exec-a' }),
          execution({ executionId: 'exec-b' }),
        ],
        modelCalls: [
          call({
            executionId: 'exec-a',
            modelCallId: 'c-a',
            status: 'in-flight',
          }),
          call({
            executionId: 'exec-b',
            modelCallId: 'c-b',
            status: 'in-flight',
          }),
        ],
      },
      { limit: 1 },
    );
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.executionId).toBe('exec-a');

    expect(() =>
      listStrandedExecutions({ executions: [], modelCalls: [] }, { limit: 0 }),
    ).toThrow(AcmeError);
  });
});

describe('prepareOperatorDischarge', () => {
  it('builds a failed terminal with operator audit details', () => {
    const evidence = {
      executions: [execution({ executionId: 'exec-open' })],
      modelCalls: [
        call({
          executionId: 'exec-open',
          modelCallId: 'call-1',
          status: 'reserved',
        }),
      ],
    };

    const result = prepareOperatorDischarge(evidence, {
      executionId: 'exec-open',
      dischargedBy: 'ops-alice',
      rationale: 'provider invoice closed; abandon run',
      dischargedAt: now,
    });

    expect(result.reasonCode).toBe('unobserved-reservation');
    expect(result.terminal).toMatchObject({
      executionId: 'exec-open',
      status: 'failed',
      terminalAt: now,
      error: {
        code: 'MODEL_UNAVAILABLE',
        retryable: false,
        details: {
          operatorDischarge: true,
          dischargedBy: 'ops-alice',
          rationale: 'provider invoice closed; abandon run',
          strandedReason: 'unobserved-reservation',
          modelCallId: 'call-1',
        },
      },
    });
  });

  it('refuses terminal, unknown and non-stranded executions', () => {
    const evidence = {
      executions: [
        execution({
          executionId: 'exec-failed',
          status: 'failed',
          error: {
            code: 'MODEL_UNAVAILABLE',
            message: 'x',
            stage: 'calling-model',
            retryable: false,
          },
        }),
        execution({ executionId: 'exec-clean' }),
      ],
      modelCalls: [
        call({
          executionId: 'exec-clean',
          modelCallId: 'c-ok',
          status: 'succeeded',
          response: {
            provider: 'fixture',
            model: 'fixture',
            receivedAt: now,
            finishReason: 'stop',
            text: '{}',
            usage: {},
            metadata: {},
          },
          completedAt: now,
        }),
      ],
    };

    expect(() =>
      prepareOperatorDischarge(evidence, {
        executionId: 'missing',
        dischargedBy: 'ops',
        rationale: 'why',
        dischargedAt: now,
      }),
    ).toThrow(/Unknown execution/);

    expect(() =>
      prepareOperatorDischarge(evidence, {
        executionId: 'exec-failed',
        dischargedBy: 'ops',
        rationale: 'why',
        dischargedAt: now,
      }),
    ).toThrow(/Only non-terminal/);

    expect(() =>
      prepareOperatorDischarge(evidence, {
        executionId: 'exec-clean',
        dischargedBy: 'ops',
        rationale: 'why',
        dischargedAt: now,
      }),
    ).toThrow(/not stranded/);
  });
});
