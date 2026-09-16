import { timingSafeEqual } from 'node:crypto';

import {
  type ChatCompletionsControls,
  type ProviderTransport as ChatCompletionsTransport,
} from '@acme-engine/adapter-model-chat-completions';
import type { ProviderTransport as OpenAiTransport } from '@acme-engine/adapter-model-openai';
import type { ModelCapabilities, ModelSelection } from '@acme-engine/core';
import {
  createAcmeModelRuntime,
  NVIDIA_CHAT_COMPLETIONS_ENDPOINT,
} from '@acme-engine/model-runtime';

import {
  createAcmeModelRuntimeHost,
  type AcmeModelRuntimeAuthorizer,
} from './acme-model-runtime-host.js';
import {
  ACME_MODEL_RUNTIME_EXECUTE_PATH,
  ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
} from './acme-model-runtime-wire.js';
import {
  createAcmeRuntimeListener,
  type AcmeRuntimeListenerAddress,
} from './acme-runtime-listener.js';

export { NVIDIA_CHAT_COMPLETIONS_ENDPOINT };

export interface AcmeModelRuntimeOpenAiProfileConfig {
  readonly selection: ModelSelection;
  readonly model: string;
  readonly capabilities?: ModelCapabilities;
}

export interface AcmeModelRuntimeChatProfileConfig {
  readonly selection: ModelSelection;
  readonly model: string;
  readonly provider?: string;
  readonly capabilities?: ModelCapabilities;
  readonly controls?: ChatCompletionsControls;
}

export interface AcmeModelRuntimeCompatibleRouteConfig {
  readonly providerHint: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly provider?: string;
  readonly profiles: readonly AcmeModelRuntimeChatProfileConfig[];
}

export interface AcmeModelRuntimeServiceConfig {
  readonly hostname: string;
  readonly port: number;
  readonly bearerToken: string;
  readonly engineBuild: string;
  readonly openAi?: {
    readonly apiKey: string;
    readonly baseUrl?: string;
    readonly profiles: readonly AcmeModelRuntimeOpenAiProfileConfig[];
  };
  readonly nvidia?: {
    readonly apiKey: string;
    readonly endpoint?: string;
    readonly profiles: readonly AcmeModelRuntimeChatProfileConfig[];
  };
  readonly compatible?: readonly AcmeModelRuntimeCompatibleRouteConfig[];
}

export interface AcmeModelRuntimeServiceOptions {
  readonly config?: AcmeModelRuntimeServiceConfig;
  readonly openAiTransport?: OpenAiTransport;
  readonly chatCompletionsTransport?: ChatCompletionsTransport;
  readonly now?: () => string;
}

export interface AcmeModelRuntimeService {
  readonly address: AcmeRuntimeListenerAddress;
  readonly engineBuild: string;
  readonly protocolVersion: typeof ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION;
  readonly providers: readonly string[];
  close(): Promise<void>;
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
  const hasLineBreak = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code === 10 || code === 13;
  });
  if (hasLineBreak) {
    throw new Error(`${label} must not contain CR or LF characters.`);
  }
  if (byteLength < minimum) {
    throw new Error(`${label} must contain at least ${minimum} UTF-8 bytes.`);
  }
  if (byteLength > maximum) {
    throw new Error(
      `${label} exceeds the model runtime service configuration limit.`,
    );
  }
  return value;
}

function requiredEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  maximum = 4096,
): string {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required for ACME model runtime service mode.`);
  }
  return boundedText(value, name, maximum);
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
  return boundedText(value, name, maximum);
}

function requiredSecretEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
): string {
  const value = env[name];
  if (value === undefined) {
    throw new Error(`${name} is required for ACME model runtime service mode.`);
  }
  return boundedSecret(value, name, minimum);
}

function servicePort(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new Error(
      'ACME_MODEL_RUNTIME_LISTEN_PORT must be a decimal TCP port.',
    );
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error(
      'ACME_MODEL_RUNTIME_LISTEN_PORT must be from 0 through 65535.',
    );
  }
  return port;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonValue(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function parseJsonArray(raw: string, label: string): readonly unknown[] {
  const parsed = parseJsonValue(raw, label);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${label} must be a non-empty JSON array.`);
  }
  return parsed;
}

function requireSelection(value: unknown, label: string): ModelSelection {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const profile = boundedText(
    String(value.profile ?? ''),
    `${label}.profile`,
    200,
  );
  const providerHint = boundedText(
    String(value.providerHint ?? ''),
    `${label}.providerHint`,
    200,
  );
  const modelHint =
    value.modelHint === undefined
      ? undefined
      : boundedText(String(value.modelHint), `${label}.modelHint`, 200);
  return Object.freeze({
    profile,
    providerHint,
    ...(modelHint === undefined ? {} : { modelHint }),
  });
}

function defaultOpenAiCapabilities(): ModelCapabilities {
  return Object.freeze({
    structuredOutput: true,
    tools: true,
    vision: false,
  });
}

function defaultChatCapabilities(): ModelCapabilities {
  return Object.freeze({
    structuredOutput: false,
    tools: true,
    vision: false,
  });
}

function parseCapabilities(
  value: unknown,
  fallback: ModelCapabilities,
  label: string,
): ModelCapabilities {
  if (value === undefined) {
    return fallback;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  for (const key of ['structuredOutput', 'tools', 'vision'] as const) {
    if (typeof value[key] !== 'boolean') {
      throw new Error(`${label}.${key} must be a boolean.`);
    }
  }
  return Object.freeze({
    structuredOutput: value.structuredOutput as boolean,
    tools: value.tools as boolean,
    vision: value.vision as boolean,
  });
}

function parseThinkingMode(
  value: unknown,
  label: string,
): 'enable_thinking' | 'thinking' | false {
  if (value === false) {
    return false;
  }
  if (value === 'enable_thinking' || value === 'thinking') {
    return value;
  }
  throw new Error(`${label} must be false, "enable_thinking" or "thinking".`);
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function parseControls(
  value: unknown,
  label: string,
): ChatCompletionsControls | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const controls: ChatCompletionsControls = {
    ...(value.temperature === undefined
      ? {}
      : {
          temperature: requireBoolean(
            value.temperature,
            `${label}.temperature`,
          ),
        }),
    ...(value.topP === undefined
      ? {}
      : { topP: requireBoolean(value.topP, `${label}.topP`) }),
    ...(value.maxOutputTokens === undefined
      ? {}
      : {
          maxOutputTokens: requireBoolean(
            value.maxOutputTokens,
            `${label}.maxOutputTokens`,
          ),
        }),
    ...(value.stop === undefined
      ? {}
      : { stop: requireBoolean(value.stop, `${label}.stop`) }),
    ...(value.reasoningBudget === undefined
      ? {}
      : {
          reasoningBudget: requireBoolean(
            value.reasoningBudget,
            `${label}.reasoningBudget`,
          ),
        }),
    ...(value.enableThinking === undefined
      ? {}
      : {
          enableThinking: parseThinkingMode(
            value.enableThinking,
            `${label}.enableThinking`,
          ),
        }),
    ...(value.reasoningEffort === undefined
      ? {}
      : {
          reasoningEffort: requireBoolean(
            value.reasoningEffort,
            `${label}.reasoningEffort`,
          ),
        }),
    ...(value.seed === undefined
      ? {}
      : { seed: requireBoolean(value.seed, `${label}.seed`) }),
  };
  return Object.freeze(controls);
}

function parseOpenAiProfile(
  value: unknown,
  index: number,
): AcmeModelRuntimeOpenAiProfileConfig {
  const label = `ACME_MODEL_RUNTIME_OPENAI_PROFILES[${String(index)}]`;
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return Object.freeze({
    selection: requireSelection(value.selection, `${label}.selection`),
    model: boundedText(String(value.model ?? ''), `${label}.model`, 200),
    capabilities: parseCapabilities(
      value.capabilities,
      defaultOpenAiCapabilities(),
      `${label}.capabilities`,
    ),
  });
}

function parseChatProfile(
  value: unknown,
  label: string,
): AcmeModelRuntimeChatProfileConfig {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const provider =
    value.provider === undefined
      ? undefined
      : boundedText(String(value.provider), `${label}.provider`, 200);
  const controls = parseControls(value.controls, `${label}.controls`);
  return Object.freeze({
    selection: requireSelection(value.selection, `${label}.selection`),
    model: boundedText(String(value.model ?? ''), `${label}.model`, 200),
    ...(provider === undefined ? {} : { provider }),
    capabilities: parseCapabilities(
      value.capabilities,
      defaultChatCapabilities(),
      `${label}.capabilities`,
    ),
    ...(controls === undefined ? {} : { controls }),
  });
}

function parseCompatibleRoute(
  value: unknown,
  index: number,
): AcmeModelRuntimeCompatibleRouteConfig {
  const label = `ACME_MODEL_RUNTIME_COMPATIBLE_ROUTES[${String(index)}]`;
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  if (!Array.isArray(value.profiles) || value.profiles.length === 0) {
    throw new Error(`${label}.profiles must be a non-empty array.`);
  }
  const provider =
    value.provider === undefined
      ? undefined
      : boundedText(String(value.provider), `${label}.provider`, 200);
  return Object.freeze({
    providerHint: boundedText(
      String(value.providerHint ?? ''),
      `${label}.providerHint`,
      200,
    ),
    endpoint: boundedText(
      String(value.endpoint ?? ''),
      `${label}.endpoint`,
      2048,
    ),
    apiKey: boundedSecret(String(value.apiKey ?? ''), `${label}.apiKey`, 1),
    ...(provider === undefined ? {} : { provider }),
    profiles: value.profiles.map((profile, profileIndex) =>
      parseChatProfile(profile, `${label}.profiles[${String(profileIndex)}]`),
    ),
  });
}

export function validateAcmeModelRuntimeServiceConfig(
  value: AcmeModelRuntimeServiceConfig,
): AcmeModelRuntimeServiceConfig {
  if (
    !Number.isSafeInteger(value.port) ||
    value.port < 0 ||
    value.port > 65_535
  ) {
    throw new Error('Model runtime service port must be from 0 through 65535.');
  }
  const openAi =
    value.openAi === undefined
      ? undefined
      : Object.freeze({
          apiKey: boundedSecret(value.openAi.apiKey, 'openAi.apiKey', 1),
          ...(value.openAi.baseUrl === undefined
            ? {}
            : {
                baseUrl: boundedText(
                  value.openAi.baseUrl,
                  'openAi.baseUrl',
                  2048,
                ),
              }),
          profiles: value.openAi.profiles.map((profile, index) =>
            parseOpenAiProfile(profile, index),
          ),
        });
  const nvidia =
    value.nvidia === undefined
      ? undefined
      : Object.freeze({
          apiKey: boundedSecret(value.nvidia.apiKey, 'nvidia.apiKey', 1),
          ...(value.nvidia.endpoint === undefined
            ? {}
            : {
                endpoint: boundedText(
                  value.nvidia.endpoint,
                  'nvidia.endpoint',
                  2048,
                ),
              }),
          profiles: value.nvidia.profiles.map((profile, index) =>
            parseChatProfile(profile, `nvidia.profiles[${String(index)}]`),
          ),
        });
  const compatible =
    value.compatible === undefined
      ? undefined
      : value.compatible.map((route, index) =>
          parseCompatibleRoute(route, index),
        );
  if (
    openAi === undefined &&
    nvidia === undefined &&
    (compatible === undefined || compatible.length === 0)
  ) {
    throw new Error(
      'Model runtime service requires at least one of OpenAI, NVIDIA or a compatible Chat Completions route.',
    );
  }
  return Object.freeze({
    hostname: boundedText(value.hostname, 'hostname', 253),
    port: value.port,
    bearerToken: boundedSecret(value.bearerToken, 'bearerToken', 32),
    engineBuild: boundedText(value.engineBuild, 'engineBuild', 300),
    ...(openAi === undefined ? {} : { openAi }),
    ...(nvidia === undefined ? {} : { nvidia }),
    ...(compatible === undefined ? {} : { compatible }),
  });
}

export function readAcmeModelRuntimeServiceConfig(
  env: NodeJS.ProcessEnv = process.env,
): AcmeModelRuntimeServiceConfig {
  const openAiProfilesRaw = optionalEnv(
    env,
    'ACME_MODEL_RUNTIME_OPENAI_PROFILES',
    16_384,
  );
  const nvidiaProfilesRaw = optionalEnv(
    env,
    'ACME_MODEL_RUNTIME_NVIDIA_PROFILES',
    16_384,
  );
  const compatibleRaw = optionalEnv(
    env,
    'ACME_MODEL_RUNTIME_COMPATIBLE_ROUTES',
    16_384,
  );
  const openAiKey = optionalEnv(env, 'OPENAI_API_KEY', 4096);
  const nvidiaKey = optionalEnv(env, 'NVIDIA_API_KEY', 4096);
  const openAiBaseUrl = optionalEnv(
    env,
    'ACME_MODEL_RUNTIME_OPENAI_BASE_URL',
    2048,
  );
  const nvidiaEndpoint = optionalEnv(
    env,
    'ACME_MODEL_RUNTIME_NVIDIA_ENDPOINT',
    2048,
  );

  const openAi =
    openAiProfilesRaw === undefined
      ? undefined
      : {
          apiKey: requiredSecretEnv(env, 'OPENAI_API_KEY', 1),
          ...(openAiBaseUrl === undefined ? {} : { baseUrl: openAiBaseUrl }),
          profiles: parseJsonArray(
            openAiProfilesRaw,
            'ACME_MODEL_RUNTIME_OPENAI_PROFILES',
          ).map((profile, index) => parseOpenAiProfile(profile, index)),
        };
  if (openAiKey !== undefined && openAiProfilesRaw === undefined) {
    throw new Error(
      'OPENAI_API_KEY requires ACME_MODEL_RUNTIME_OPENAI_PROFILES.',
    );
  }

  const nvidia =
    nvidiaProfilesRaw === undefined
      ? undefined
      : {
          apiKey: requiredSecretEnv(env, 'NVIDIA_API_KEY', 1),
          ...(nvidiaEndpoint === undefined ? {} : { endpoint: nvidiaEndpoint }),
          profiles: parseJsonArray(
            nvidiaProfilesRaw,
            'ACME_MODEL_RUNTIME_NVIDIA_PROFILES',
          ).map((profile, index) =>
            parseChatProfile(
              profile,
              `ACME_MODEL_RUNTIME_NVIDIA_PROFILES[${String(index)}]`,
            ),
          ),
        };
  if (nvidiaKey !== undefined && nvidiaProfilesRaw === undefined) {
    throw new Error(
      'NVIDIA_API_KEY requires ACME_MODEL_RUNTIME_NVIDIA_PROFILES.',
    );
  }

  const compatible =
    compatibleRaw === undefined
      ? undefined
      : parseJsonArray(
          compatibleRaw,
          'ACME_MODEL_RUNTIME_COMPATIBLE_ROUTES',
        ).map((route, index) => parseCompatibleRoute(route, index));

  return validateAcmeModelRuntimeServiceConfig({
    hostname: requiredEnv(env, 'ACME_MODEL_RUNTIME_LISTEN_HOST', 253),
    port: servicePort(requiredEnv(env, 'ACME_MODEL_RUNTIME_LISTEN_PORT', 5)),
    bearerToken: requiredSecretEnv(env, 'ACME_MODEL_RUNTIME_BEARER_TOKEN', 32),
    engineBuild: requiredEnv(env, 'ACME_MODEL_RUNTIME_ENGINE_BUILD', 300),
    ...(openAi === undefined ? {} : { openAi }),
    ...(nvidia === undefined ? {} : { nvidia }),
    ...(compatible === undefined ? {} : { compatible }),
  });
}

export function createModelRuntimeBearerAuthorizer(
  token: string,
): AcmeModelRuntimeAuthorizer {
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

export async function startAcmeModelRuntimeService(
  options: AcmeModelRuntimeServiceOptions = {},
): Promise<AcmeModelRuntimeService> {
  const config = validateAcmeModelRuntimeServiceConfig(
    options.config ?? readAcmeModelRuntimeServiceConfig(),
  );
  const now = options.now ?? (() => new Date().toISOString());
  const runtime = createAcmeModelRuntime({
    config: {
      ...(config.openAi === undefined ? {} : { openAi: config.openAi }),
      ...(config.nvidia === undefined ? {} : { nvidia: config.nvidia }),
      ...(config.compatible === undefined
        ? {}
        : { compatible: config.compatible }),
    },
    now,
    ...(options.openAiTransport === undefined
      ? {}
      : { openAiTransport: options.openAiTransport }),
    ...(options.chatCompletionsTransport === undefined
      ? {}
      : { chatCompletionsTransport: options.chatCompletionsTransport }),
  });
  const engine = runtime.engine;

  const host = createAcmeModelRuntimeHost({
    engine,
    authorize: createModelRuntimeBearerAuthorizer(config.bearerToken),
    descriptor: Object.freeze({
      protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
      engineBuild: config.engineBuild,
      executePath: ACME_MODEL_RUNTIME_EXECUTE_PATH,
    }),
  });
  const listener = createAcmeRuntimeListener({
    host,
    hostname: config.hostname,
    port: config.port,
    transportErrorProtocolVersion: 'acme-model-runtime-error/1',
  });
  const address = await listener.listen();
  const providers = runtime.providers;

  let closed = false;
  return Object.freeze({
    address,
    engineBuild: config.engineBuild,
    protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
    providers,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await listener.close();
    },
  });
}
