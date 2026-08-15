import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  deriveExecutionId,
  sha256,
  type ExecutionRequest,
  type ExecutionResult,
} from '../../packages/core/src/index.js';

import {
  ACME_ADAPTER_V3_CONTRACT_VERSION,
  ACME_ENGINE_V3_REVIEW_POINT,
  type AcmeAdapterV3Request,
  type AcmeAdapterV3Result,
} from './aal-acme-adapter-3.js';
import {
  createSeamHarness,
  neutralInput,
  neutralSelection,
} from './seam-fixtures.js';
import {
  toAcmeAdapterV3Result,
  toExecutionRequestV3,
} from './seam-v3-translation.js';

type CommittedExecution = Extract<ExecutionResult, { status: 'committed' }>;
type FailedExecution = Exclude<ExecutionResult, CommittedExecution>;
type CommittedV3Result = Extract<
  AcmeAdapterV3Result,
  { status: 'committed' }
>;
type FailedV3Result = Extract<
  AcmeAdapterV3Result,
  { status: 'blocked' | 'conflicted' | 'cancelled' | 'failed' }
>;

function readJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
  ) as unknown;
}

function frozenRequest(): AcmeAdapterV3Request {
  return readJson(
    './fixtures/aal-acme-adapter-v3/request.json',
  ) as AcmeAdapterV3Request;
}

function expectedEngineRequest(): ExecutionRequest {
  return readJson(
    './fixtures/aal-acme-adapter-v3/expected-engine-request.json',
  ) as ExecutionRequest;
}

function withRequestKey(
  request: AcmeAdapterV3Request,
  requestKey: string,
): AcmeAdapterV3Request {
  return { ...request, requestKey };
}

function committedExecution(result: ExecutionResult): CommittedExecution {
  if (result.status !== 'committed') {
    throw new Error(
      `Expected committed execution, got ${result.status} (${result.error.code}).`,
    );
  }
  return result;
}

function failedExecution(result: ExecutionResult): FailedExecution {
  if (result.status === 'committed') {
    throw new Error('Expected terminal failure, got committed execution.');
  }
  return result;
}

function committedV3(result: AcmeAdapterV3Result): CommittedV3Result {
  if (result.status !== 'committed') {
    throw new Error(`Expected committed v3 result, got ${result.status}.`);
  }
  return result;
}

function failedV3(result: AcmeAdapterV3Result): FailedV3Result {
  if (result.status === 'committed' || result.status === 'unavailable') {
    throw new Error(`Expected failed v3 result, got ${result.status}.`);
  }
  return result;
}

function wire(value: unknown): string {
  return JSON.stringify(value);
}

describe('aal-acme-adapter/3 frozen fixture translation', () => {
  it('matches the exact current ExecutionRequest without a supplement object', () => {
    const request = frozenRequest();
    const expected = expectedEngineRequest();

    expect(request.contractVersion).toBe(ACME_ADAPTER_V3_CONTRACT_VERSION);
    expect(request.engineTarget.repository).toBe(
      ACME_ENGINE_V3_REVIEW_POINT.repository,
    );
    expect(request.engineTarget.commit).toBe(
      ACME_ENGINE_V3_REVIEW_POINT.commit,
    );
    expect(request.task.inputSchemaSha256).toBe(
      sha256('neutral.observe/input/1.0.0'),
    );
    expect(request.task.outputSchemaSha256).toBe(
      sha256('neutral.observe/output/1.0.0'),
    );

    const translated = toExecutionRequestV3(request);
    expect(translated).toEqual(expected);
    expect(translated.model).toEqual(neutralSelection);
    expect(translated.input).toEqual(neutralInput);

    const onTheWire = wire(translated);
    for (const applicationOnly of [
      request.workspaceId,
      request.correlationId,
      request.subject.entityType,
      request.task.contractRef,
      ...request.sourceArtifactIds,
    ]) {
      expect(onTheWire).not.toContain(applicationOnly);
    }
    expect(onTheWire).not.toContain('expectedApplicationVersion');
    expect(onTheWire).not.toContain('inputSchemaSha256');
    expect(onTheWire).not.toContain('outputSchemaSha256');
  });
});

describe('aal-acme-adapter/3 against the real ExecutionEngine', () => {
  it('commits and returns every current terminal result field', async () => {
    const request = frozenRequest();
    const engineRequest = toExecutionRequestV3(request);
    const harness = createSeamHarness([{ requestKey: request.requestKey }]);

    const executed = committedExecution(
      await harness.engine.execute(engineRequest),
    );
    expect(executed).toEqual({
      status: 'committed',
      executionId: deriveExecutionId('neutral', request.requestKey),
      replayed: false,
      revision: 1,
      documentKeys: ['neutral-document-1'],
      eventIds: [],
    });
    expect(harness.gateway.invocations()).toHaveLength(1);
    harness.gateway.assertAllConsumed();

    const result = committedV3(
      toAcmeAdapterV3Result(request.requestKey, executed),
    );
    expect(result).toEqual({
      contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
      requestKey: request.requestKey,
      status: 'committed',
      executionId: deriveExecutionId('neutral', request.requestKey),
      replayed: false,
      engineRevision: 1,
      documentKeys: ['neutral-document-1'],
      eventIds: [],
    });
    expect(result.documentKeys).toEqual(executed.documentKeys);
    expect(result.eventIds).toEqual(executed.eventIds);
    expect(Object.hasOwn(result, 'suggestionSetRef')).toBe(false);
  });

  it('replays the same frozen wire request without a second model call', async () => {
    const request = withRequestKey(frozenRequest(), 'aal-v3-replay-1');
    const engineRequest = toExecutionRequestV3(request);
    const harness = createSeamHarness([{ requestKey: request.requestKey }]);

    const first = committedExecution(
      await harness.engine.execute(engineRequest),
    );
    const second = committedExecution(
      await harness.engine.execute(toExecutionRequestV3(request)),
    );

    expect(first.replayed).toBe(false);
    expect(second).toEqual({ ...first, replayed: true });
    expect(harness.gateway.invocations()).toHaveLength(1);
    harness.gateway.assertAllConsumed();

    expect(toAcmeAdapterV3Result(request.requestKey, second)).toEqual({
      contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
      requestKey: request.requestKey,
      status: 'committed',
      executionId: first.executionId,
      replayed: true,
      engineRevision: first.revision,
      documentKeys: first.documentKeys,
      eventIds: first.eventIds,
    });
  });

  it('preserves the structured revision conflict the v2 seam loses', async () => {
    const base = frozenRequest();
    const request: AcmeAdapterV3Request = {
      ...base,
      requestKey: 'aal-v3-conflict-1',
      engineTarget: {
        ...base.engineTarget,
        expectedEngineRevision: 7,
      },
    };
    const harness = createSeamHarness([]);

    const executed = failedExecution(
      await harness.engine.execute(toExecutionRequestV3(request)),
    );
    expect(executed.status).toBe('conflicted');
    expect(executed.error).toMatchObject({
      code: 'CONFLICT_STATE_REVISION',
      stage: 'preparing-commit',
      retryable: false,
      details: { expectedRevision: 7, actualRevision: 0 },
    });
    expect(harness.gateway.invocations()).toEqual([]);

    const result = failedV3(
      toAcmeAdapterV3Result(request.requestKey, executed),
    );
    expect(result.status).toBe('conflicted');
    expect(result.error).toEqual(executed.error);
    expect(result.error.stage).toBe('preparing-commit');
    expect(result.error.details).toEqual({
      expectedRevision: 7,
      actualRevision: 0,
    });
  });

  it('preserves provider failure stage, details and cause evidence', async () => {
    const request = withRequestKey(frozenRequest(), 'aal-v3-failed-1');
    const harness = createSeamHarness([
      {
        requestKey: request.requestKey,
        error: {
          code: 'MODEL_UNAVAILABLE',
          message: 'fixture provider outage',
          stage: 'calling-model',
          retryable: true,
          details: { provider: 'fixture', attempt: 1 },
          causeRef: 'model-call-evidence-1',
        },
      },
    ]);

    const executed = failedExecution(
      await harness.engine.execute(toExecutionRequestV3(request)),
    );
    expect(executed.status).toBe('failed');
    expect(harness.gateway.invocations()).toHaveLength(1);

    const result = failedV3(
      toAcmeAdapterV3Result(request.requestKey, executed),
    );
    expect(result).toEqual({
      contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
      requestKey: request.requestKey,
      status: 'failed',
      executionId: deriveExecutionId('neutral', request.requestKey),
      error: {
        code: 'MODEL_UNAVAILABLE',
        message: 'fixture provider outage',
        stage: 'calling-model',
        retryable: true,
        details: { provider: 'fixture', attempt: 1 },
        causeRef: 'model-call-evidence-1',
      },
    });
    expect(result.error).toEqual(executed.error);
  });
});
