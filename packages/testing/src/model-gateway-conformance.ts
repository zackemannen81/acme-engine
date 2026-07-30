import {
  AcmeError,
  type AcmeErrorData,
  type GatewayCallContext,
  type ModelCapabilities,
  type ModelGateway,
  type ModelRequest,
  type ModelSelection,
  type NormalizedModelResponse,
} from '@acme/core';
import { describe, expect, it } from 'vitest';

export interface ModelGatewayConformanceCall {
  readonly request: ModelRequest;
  readonly context: GatewayCallContext;
}

export interface ModelGatewayConformanceSubject {
  readonly gateway: ModelGateway;
  readonly selection: ModelSelection;
  readonly expectedCapabilities: ModelCapabilities;
  readonly unsupportedRequiredCapabilities: Partial<ModelCapabilities>;
  readonly success: ModelGatewayConformanceCall & {
    readonly expectedResponse: NormalizedModelResponse;
  };
  readonly failure: ModelGatewayConformanceCall & {
    readonly expectedError: AcmeErrorData;
  };
}

export interface ModelGatewayConformanceOptions {
  readonly createSubject: () => ModelGatewayConformanceSubject;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') {
    return;
  }
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeeplyFrozen(child);
  }
}

export function modelGatewayConformance(
  name: string,
  options: ModelGatewayConformanceOptions,
): void {
  describe(`ModelGateway conformance: ${name}`, () => {
    it('reports deterministic immutable capabilities for a supplied selection', async () => {
      const subject = options.createSubject();
      const first = await subject.gateway.capabilities(subject.selection);
      const second = await subject.gateway.capabilities(subject.selection);

      expect(first).toEqual(subject.expectedCapabilities);
      expect(second).toEqual(first);
      expectDeeplyFrozen(first);
      expectDeeplyFrozen(second);
    });

    it('rejects unsupported required capabilities before the call', async () => {
      const subject = options.createSubject();
      await expect(
        subject.gateway.generate(subject.success.request, {
          ...subject.success.context,
          requiredCapabilities: subject.unsupportedRequiredCapabilities,
        }),
      ).rejects.toMatchObject({
        data: {
          code: 'UNSUPPORTED_CAPABILITY',
          stage: 'calling-model',
          retryable: false,
        },
      });

      await expect(
        subject.gateway.generate(
          subject.success.request,
          subject.success.context,
        ),
      ).resolves.toEqual(subject.success.expectedResponse);
    });

    it('rejects pre-call cancellation without consuming the call', async () => {
      const subject = options.createSubject();
      const controller = new AbortController();
      controller.abort();
      await expect(
        subject.gateway.generate(subject.success.request, {
          ...subject.success.context,
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({
        data: {
          code: 'CANCELLED',
          stage: 'calling-model',
          retryable: false,
        },
      });

      await expect(
        subject.gateway.generate(
          subject.success.request,
          subject.success.context,
        ),
      ).resolves.toEqual(subject.success.expectedResponse);
    });

    it('returns an exact detached and deeply frozen normalized response', async () => {
      const subject = options.createSubject();
      const response = await subject.gateway.generate(
        subject.success.request,
        subject.success.context,
      );

      expect(response).toEqual(subject.success.expectedResponse);
      expect(response).not.toBe(subject.success.expectedResponse);
      expectDeeplyFrozen(response);
    });

    it('throws exact structured model-stage error data', async () => {
      const subject = options.createSubject();
      let caught: unknown;
      try {
        await subject.gateway.generate(
          subject.failure.request,
          subject.failure.context,
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AcmeError);
      expect((caught as AcmeError).data).toEqual(subject.failure.expectedError);
      expectDeeplyFrozen((caught as AcmeError).data);
    });
  });
}
