import { timingSafeEqual } from 'node:crypto';

import type { ModelSelection } from '@acme/core';
import {
  createOpenAiResponsesGateway,
  type ProviderTransport,
} from '@acme/adapter-model-openai';
import { createFetchTransport } from '@acme/adapter-model-openai/transport-fetch';

import {
  createAcmeRuntimeHost,
  type AcmeRuntimeAuthorizer,
} from './acme-runtime-host.js';
import {
  createAcmeRuntimeListener,
  type AcmeRuntimeListenerAddress,
} from './acme-runtime-listener.js';
import {
  ACME_RUNTIME_EXECUTE_PATH,
  ACME_RUNTIME_PROTOCOL_VERSION,
} from './acme-runtime-wire.js';
import { createComposition, type Composition } from './composition.js';

export interface AcmeRuntimeServiceConfig {
  readonly repository: 'postgres';
  readonly modelProvider: 'openai';
  readonly hostname: string;
  readonly port: number;
  readonly bearerToken: string;
  readonly engineBuild: string;
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
  readonly engineBuild: string;
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
  maximum = 2048,
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

function boundedText(value: string, label: string, maximum: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || Buffer.byteLength(trimmed, 'utf8') > maximum) {
    throw new Error(`${label} must be a bounded non-empty string.`);
  }
  return trimmed;
}

function boundedSecret(
  value: string,
  label: string,
  minimum: number,
  maximum = 4096,
): string {
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty secret.`);
  }
  if (/[
]/u.test(value)) {
    throw new Error(`${label} must not contain CR or LF characters.`);
  }
  if (byteLength < minimum) {
    throw new Error(`${label} must contain at least ${minimum} UTF-8 bytes.`);
  }
  if (byteLength > maximum) {
    throw new Error(`${label} exceeds the runtime service configuration limit.`);
  }
  return value;
}

function requiredSecretEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
): string {
  const value = env[name];
  if (value === undefined) {
    throw new Error(`${name} is required for ACME runtime service mode.`);
  }
  return boundedSecret(value, name, minimum);
}

function servicePort(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new Error('ACME_RUNTIME_LISTEN_PORT must be a decimal TCP port.');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error('ACME_RUNTIME_LISTEN_PORT must be from 0 through 65535.');
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

function validateModelSelection(value: ModelSelection): ModelSelection {
  const profile = boundedText(value.profile, 'modelSelection.profile', 200);
  const providerHint =
    value.providerHint === undefined
      ? undefined
      : boundedText(value.providerHint, 'modelSelection.providerHint', 200);
  const modelHint =
    value.modelHint === undefined
      ? undefined
      : boundedText(value.modelHint, 'modelSelection.modelHint', 200);
  return Object.freeze({
    profile,
    ...(providerHint === undefined ? {} : { providerHint }),
    ...(modelHint === undefined ? {} : { modelHint }),
  });
}

export function validateAcmeRuntimeServiceConfig(
  value: AcmeRuntimeServiceConfig,
): AcmeRuntimeServiceConfig {
  if (value.repository !== 'postgres') {
    throw new Error('Runtime service repository must be exactly "postgres".');
  }
  if (value.modelProvider !== 'openai') {
    throw new Error('Runtime service modelProvider must be exactly "openai".');
  }
  if (
    !Number.isSafeInteger(value.port) ||
    value.port < 0 ||
    value.port > 65_535
  ) {
    throw new Error('Runtime service port must be from 0 through 65535.');
  }

  const openAiBaseUrl =
    value.openAiBaseUrl === undefined
      ? undefined
      : boundedText(value.openAiBaseUrl, 'openAiBaseUrl', 2048);

  return Object.freeze({
    repository: 'postgres',
    modelProvider: 'openai',
    hostname: boundedText(value.hostname, 'hostname', 253),
    port: value.port,
    bearerToken: boundedSecret(value.bearerToken, 'bearerToken', 32),
    engineBuild: boundedText(value.engineBuild, 'engineBuild', 300),
    openAiApiKey: boundedSecret(value.openAiApiKey, 'openAiApiKey', 1),
    ...(openAiBaseUrl === undefined ? {} : { openAiBaseUrl }),
    modelSelection: validateModelSelection(value.modelSelection),
    openAiModel: boundedText(value.openAiModel, 'openAiModel', 200),
  });
}

/**
 * Parse service-mode configuration without constructing sockets, repositories
 * or model transports. Production choices are explicit and fail closed.
 */
export function readAcmeRuntimeServiceConfig(
  env: NodeJS.ProcessEnv = process.env,
): AcmeRuntimeServiceConfig {
  const repository = requiredEnv(env, 'ACME_RUNTIME_REPOSITORY', 32);
  if (repository !== 'postgres') {
    throw new Error('ACME_RUNTIME_REPOSITORY must be exactly "postgres".');
  }
  const modelProvider = requiredEnv(env, 'ACME_RUNTIME_MODEL_PROVIDER', 32);
  if (modelProvider !== 'openai') {
    throw new Error('ACME_RUNTIME_MODEL_PROVIDER must be exactly "openai".');
  }
  requirePostgresConfiguration(env);

  const providerHint = optionalEnv(
    env,
    'ACME_RUNTIME_MODEL_PROVIDER_HINT',
    200,
  );
  const modelHint = optionalEnv(env, 'ACME_RUNTIME_MODEL_HINT', 200);
  const openAiBaseUrl = optionalEnv(env, 'ACME_RUNTIME_OPENAI_BASE_URL', 2048);

  return validateAcmeRuntimeServiceConfig({
    repository: 'postgres',
    modelProvider: 'openai',
    hostname: requiredEnv(env, 'ACME_RUNTIME_LISTEN_HOST', 253),
    port: servicePort(requiredEnv(env, 'ACME_RUNTIME_LISTEN_PORT', 5)),
    bearerToken: requiredSecretEnv(env, 'ACME_RUNTIME_BEARER_TOKEN', 32),
    engineBuild: requiredEnv(env, 'ACME_RUNTIME_ENGINE_BUILD', 300),
    openAiApiKey: requiredSecretEnv(env, 'OPENAI_API_KEY', 1),
    ...(openAiBaseUrl === undefined ? {} : { openAiBaseUrl }),
    modelSelection: {
      profile: requiredEnv(env, 'ACME_RUNTIME_MODEL_PROFILE', 200),
      ...(providerHint === undefined ? {} : { providerHint }),
      ...(modelHint === undefined ? {} : { modelHint }),
    },
    openAiModel: requiredEnv(env, 'ACME_RUNTIME_OPENAI_MODEL', 200),
  });
}

/**
 * Optional bearer scheme for private/local runnable composition. The canonical
 * runtime host remains authorization-scheme agnostic through its injected port.
 */
export function createRuntimeBearerAuthorizer(
  token: string,
): AcmeRuntimeAuthorizer {
  const expected = Buffer.from(boundedSecret(token, 'bearerToken', 32), 'utf8');

  return (request: Request): boolean => {
    const authorization = request.headers.get('authorization');
    if (authorization === null || !authorization.startsWith('Bearer ')) {
      return false;
    }
    const actual = Buffer.from(authorization.slice('Bearer '.length), 'utf8');
    return (
      actual.byteLength === expected.byteLength &&
      timingSafeEqual(actual, expected)
    );
  };
}

/**
 * Compose the optional runnable runtime process. The default path deliberately
 * requires PostgreSQL and OpenAI; tests may inject composition/transport while
 * retaining the same explicit service configuration and host contract.
 */
export async function startAcmeRuntimeService(
  options: AcmeRuntimeServiceOptions = {},
): Promise<AcmeRuntimeService> {
  const config = validateAcmeRuntimeServiceConfig(
    options.config ?? readAcmeRuntimeServiceConfig(),
  );
  const composition =
    options.composition ?? createComposition(config.repository, undefined);

  try {
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
      authorize: createRuntimeBearerAuthorizer(config.bearerToken),
      descriptor: Object.freeze({
        protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
        engineBuild: config.engineBuild,
        executePath: ACME_RUNTIME_EXECUTE_PATH,
      }),
    });
    const listener = createAcmeRuntimeListener({
      host,
      hostname: config.hostname,
      port: config.port,
    });
    const address = await listener.listen();

    let closed = false;
    return Object.freeze({
      address,
      engineBuild: config.engineBuild,
      async close(): Promise<void> {
        if (closed) return;
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
  } catch (error) {
    await composition.close();
    throw error;
  }
}
