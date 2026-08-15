import type {
  ExecutionRequest,
  ExecutionResult,
  JsonValue,
} from '../../packages/core/src/index.js';

import {
  ACME_ADAPTER_V3_CONTRACT_VERSION,
  ACME_ENGINE_V3_REVIEW_POINT,
  type AcmeAdapterV3Request,
  type AcmeAdapterV3Result,
} from './aal-acme-adapter-3.js';

function assertSupportedRequest(
  request: AcmeAdapterV3Request,
): asserts request is AcmeAdapterV3Request {
  if (request.contractVersion !== ACME_ADAPTER_V3_CONTRACT_VERSION) {
    throw new Error(
      `Unsupported AAL adapter contract ${JSON.stringify(request.contractVersion)}.`,
    );
  }
  if (
    request.engineTarget.repository !== ACME_ENGINE_V3_REVIEW_POINT.repository
  ) {
    throw new Error(
      `Unexpected engine repository ${JSON.stringify(request.engineTarget.repository)}.`,
    );
  }
  if (request.engineTarget.commit !== ACME_ENGINE_V3_REVIEW_POINT.commit) {
    throw new Error(
      `Unexpected engine commit ${JSON.stringify(request.engineTarget.commit)}.`,
    );
  }
}

/**
 * Translate the frozen application-owned v3 request to today's public engine
 * request. There is deliberately no supplement argument: model, revision and
 * policy must all arrive on the wire or the request is not v3.
 */
export function toExecutionRequestV3(
  request: AcmeAdapterV3Request,
): ExecutionRequest {
  assertSupportedRequest(request);

  return Object.freeze({
    requestKey: request.requestKey,
    namespace: request.engineTarget.namespace,
    task: request.task.engineTask,
    entityId: request.engineTarget.entityId,
    expectedRevision: request.engineTarget.expectedEngineRevision,
    input: request.input as JsonValue,
    model: Object.freeze({ ...request.engineTarget.model }),
    policy: Object.freeze({ ...request.engineTarget.policy }),
  } satisfies ExecutionRequest);
}

/**
 * Preserve today's terminal engine result instead of translating it into a
 * product suggestion. Application review materialization happens after this
 * boundary and is deliberately not represented here.
 */
export function toAcmeAdapterV3Result(
  requestKey: string,
  result: ExecutionResult,
): AcmeAdapterV3Result {
  if (result.status === 'committed') {
    return Object.freeze({
      contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
      requestKey,
      status: 'committed',
      executionId: result.executionId,
      replayed: result.replayed,
      engineRevision: result.revision,
      documentKeys: Object.freeze([...result.documentKeys]),
      eventIds: Object.freeze([...result.eventIds]),
    } satisfies AcmeAdapterV3Result);
  }

  return Object.freeze({
    contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
    requestKey,
    status: result.status,
    executionId: result.executionId,
    error: Object.freeze({
      code: result.error.code,
      message: result.error.message,
      stage: result.error.stage,
      retryable: result.error.retryable,
      ...(result.error.details === undefined
        ? {}
        : { details: result.error.details }),
      ...(result.error.causeRef === undefined
        ? {}
        : { causeRef: result.error.causeRef }),
    }),
  } satisfies AcmeAdapterV3Result);
}
