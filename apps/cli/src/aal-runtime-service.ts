import type { ModelSelection } from '@acme/core';
import {
  createOpenAiResponsesGateway,
  type ProviderTransport,
} from '@acme/adapter-model-openai';
import { createFetchTransport } from '@acme/adapter-model-openai/transport-fetch';

import { createAcmeRuntimeHost } from './aal-runtime-host.js';
import {
  createAcmeRuntimeListener,
  createBearerAuthorizer,
  type AcmeRuntimeListenerAddress,
} from './aal-runtime-listener.js';
import { createComposition, type Composition } from './composition.js';

export interface AcmeRuntimeServiceConfig {
  readonly hostname: string;
  readonly port: number;
  readonly bearerToken: string;
  readonly openAiApiKey: string;
  readonly openAiBaseUrl?: string;
  readonly modelSelection: ModelSelection;
  readonly openAiModel: string;
}

export interface AcmeRuntimeServiceOptions {
  readonly config?: AcmeRuntimeServiceConfig;
  readonly composition?: Composition;
  readonly transport?: ProviderTransport;
  readonly now?: () => string;
}

export interface AcmeRuntimeService {
  readonly address: AcmeRuntimeListenerAddress;
  close(): Promise<void>;
}

function requiredEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  maximum = 4096,
): string {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required for ACME runtime service mode.`);
  }
  const trimmed = value.trim();
  if (Buffer.byteLength(trimmed, 'utf8') > maximum) {
    throw new Error(`${name} exceeds the runtime service configuration limit.`);
  }
  return trimmed;
}

function optionalEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  maximum = 1024,
): string | undefined {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  const trimmed = value.trim();
  if (Buffer.byteLength(trimmed, 'utf8') > maximum) {
    throw new Error(`${name} exceeds the runtime service configuration limit.`);
  }
  return trimmed;
}

function servicePort(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new Error('ACME_RUNTIME_LISTEN_PORT must be a decimal TCP port.');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('ACME_RUNTIME_LISTEN_PORT must be from 1 through 65535.');
  }
  return port;
}

function requirePostgresConfiguration(env: NodeJS.ProcessEnv): void {
  const direct = env['ACME_POSTGRES_URL'];
  const host = env['ACME_POSTGRES_HOST'];
  if (
    (direct === undefined || direct.trim().length === 0) &&
    (host === undefined || host.trim().length === 0)
  ) {
    throw new Error(
      'Runtime service mode requires ACME_POSTGRES_URL or ACME_POSTGRES_HOST.',
    );
  }
}

/**
 * Parse service-mode configuration without constructing sockets, repositories
 * or model transports. Every production choice is explicit and fail-closed.
 */
export function readAcmeRuntimeServiceConfig(
  env: NodeJS.ProcessEnv = process.env,
): AcmeRuntimeServiceConfig {
  if (requiredEnv(env, 'ACME_RUNTIME_REPOSITORY', 32) !== 'postgres') {
    throw new Error('ACME_RUNTIME_REPOSITORY must be exactly "postgres".');
  }
  if (requiredEnv(env, 'ACME_RUNTIME_MODEL_PROVIDER', 32) !== 'openai') {
    throw new Error('ACME_RUNTIME_MODEL_PROVIDER must be exactly "openai".');
  }
  requirePostgresConfiguration(env);

  const hostname = requiredEnv(env, 'ACME_RUNTIME_LISTEN_HOST', 253);
  const port = servicePort(requiredEnv(env, 'ACME_RUNTIME_LISTEN_PORT', 5));
  const bearerToken = requiredEnv(env, 'ACME_RUNTIME_BEARER_TOKEN');
  if (
    Buffer.byteLength(bearerToken, 'utf8') < 32 ||
    Buffer.byteLength(bearerToken, 'utf8') > 4096
  ) {
    throw new Error(
      'ACME_RUNTIME_BEARER_TOKEN must contain 32 through 4096 UTF-8 bytes.',
    );
  }

  const openAiApiKey = requiredEnv(env, 'OPENAI_API_KEY');
  const profile = requiredEnv(env, 'ACME_RUNTIME_MODEL_PROFILE', 200);
  const openAiModel = requiredEnv(env, 'ACME_RUNTIME_OPENAI_MODEL', 200);
  const providerHint = optionalEnv(
    env,
    'ACME_RUNTIME_MODEL_PROVIDER_HINT',
    200,
  );
  const modelHint = optionalEnv(env, 'ACME_RUNTIME_MODEL_HINT', 200);
  const openAiBaseUrl = optionalEnv(env, 'ACME_RUNTIME_OPENAI_BASE_URL', 2048);

  return Object.freeze({
    hostname,
    port,
    bearerToken,
    openAiApiKey,
    ...(openAiBaseUrl === undefined ? {} : { openAiBaseUrl }),
    modelSelection: Object.freeze({
      profile,
      ...(providerHint === undefined ? {} : { providerHint }),
      ...(modelHint === undefined ? {} : { modelHint }),
    }),
    openAiModel,
  });
}

/**
 * Compose the runnable runtime service. The default path deliberately requires
 * PostgreSQL and a live OpenAI transport; tests may inject both composition and
 * transport without changing service policy.
 */
export async function startAcmeRuntimeService(
  options: AcmeRuntimeServiceOptions = {},
): Promise<AcmeRuntimeService> {
  const config = options.config ?? readAcmeRuntimeServiceConfig();
  const composition =
    options.composition ?? createComposition('postgres', undefined);
  const transport = options.transport ?? createFetchTransport();
  const now = options.now ?? (() => new Date().toISOString());

  const gateway = createOpenAiResponsesGateway({
    transport,
    now,
    ...(config.openAiBaseUrl === undefined
      ? {}
      : { baseUrl: config.openAiBaseUrl }),
    headers: () => ({ authorization: `Bearer ${config.openAiApiKey}` }),
    profiles: [
      {
        selection: config.modelSelection,
        model: config.openAiModel,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
        },
      },
    ],
  });

  const host = createAcmeRuntimeHost({
    engine: composition.engine(gateway),
    authorize: createBearerAuthorizer(config.bearerToken),
  });
  const listener = createAcmeRuntimeListener({
    host,
    hostname: config.hostname,
    port: config.port,
  });

  let address: AcmeRuntimeListenerAddress;
  try {
    address = await listener.listen();
  } catch (error) {
    await composition.close();
    throw error;
  }

  let closed = false;
  return Object.freeze({
    address,
    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      let listenerError: unknown;
      try {
        await listener.close();
      } catch (error) {
        listenerError = error;
      }
      await composition.close();
      if (listenerError !== undefined) {
        throw listenerError;
      }
    },
  });
}
