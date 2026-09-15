import type { JsonValue } from './common.js';
import { AcmeError, type AcmeErrorCode } from './errors.js';
import {
  type GatewayCallContext,
  type ModelCapabilities,
  type ModelGateway,
  type ModelRequest,
  type ModelSelection,
  type ModelStreamEvent,
  type NormalizedModelResponse,
} from './model.js';
import { validateModelSelection } from './model-validation.js';

export interface RoutedModelGatewayOptions {
  readonly routes: Readonly<Record<string, ModelGateway>>;
}

function fail(
  code: AcmeErrorCode,
  message: string,
  details?: JsonValue,
): never {
  throw new AcmeError({
    code,
    message,
    stage: 'calling-model',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function resolveRoute(
  routes: ReadonlyMap<string, ModelGateway>,
  selection: ModelSelection,
): ModelGateway {
  const normalized = validateModelSelection(selection);
  const hint = normalized.providerHint;
  if (hint === undefined) {
    fail(
      'INVALID_REQUEST',
      'Routed model execution requires an explicit providerHint.',
      { selection: normalized as unknown as JsonValue },
    );
  }
  const gateway = routes.get(hint);
  if (gateway === undefined) {
    fail(
      'INVALID_REQUEST',
      'No configured provider route matches the selection.',
      {
        providerHint: hint,
        configured: [...routes.keys()],
      },
    );
  }
  return gateway;
}

/**
 * Composition-time ModelGateway that delegates only to a route whose key
 * equals the caller-owned providerHint. Missing and unknown hints fail
 * before dispatch. Core does not infer a provider from the model name.
 */
export function createRoutedModelGateway(
  options: RoutedModelGatewayOptions,
): ModelGateway {
  const routes = new Map<string, ModelGateway>();
  for (const [key, gateway] of Object.entries(options.routes)) {
    const trimmed = key.trim();
    if (trimmed.length === 0) {
      throw new Error('Routed model gateway route keys must be non-empty.');
    }
    if (routes.has(trimmed)) {
      throw new Error(`Duplicate routed model gateway route: ${trimmed}`);
    }
    routes.set(trimmed, gateway);
  }
  if (routes.size === 0) {
    throw new Error('Routed model gateway requires at least one route.');
  }

  return {
    async capabilities(selection: ModelSelection): Promise<ModelCapabilities> {
      return resolveRoute(routes, selection).capabilities(selection);
    },
    async generate(
      request: ModelRequest,
      context: GatewayCallContext,
    ): Promise<NormalizedModelResponse> {
      return resolveRoute(routes, context.selection).generate(request, context);
    },
    async *stream(
      request: ModelRequest,
      context: GatewayCallContext,
    ): AsyncIterable<ModelStreamEvent> {
      const gateway = resolveRoute(routes, context.selection);
      const stream = gateway.stream?.bind(gateway);
      if (stream === undefined) {
        fail(
          'UNSUPPORTED_CAPABILITY',
          'The selected provider route cannot stream.',
          {
            ...(context.selection.providerHint === undefined
              ? {}
              : { providerHint: context.selection.providerHint }),
          },
        );
      }
      yield* stream(request, context);
    },
  };
}
