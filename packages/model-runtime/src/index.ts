import { randomUUID } from 'node:crypto';

import { createInMemoryModelExecutionRepository } from '@acme-engine/adapter-memory';
import {
  createChatCompletionsGateway,
  type ChatCompletionsControls,
  type ChatCompletionsModelProfile,
  type ProviderTransport as ChatCompletionsTransport,
} from '@acme-engine/adapter-model-chat-completions';
import { createFetchTransport as createChatCompletionsFetchTransport } from '@acme-engine/adapter-model-chat-completions/transport-fetch';
import {
  createOpenAiResponsesGateway,
  type OpenAiModelProfile,
  type ProviderTransport as OpenAiTransport,
} from '@acme-engine/adapter-model-openai';
import { createFetchTransport as createOpenAiFetchTransport } from '@acme-engine/adapter-model-openai/transport-fetch';
import {
  createModelExecutionEngine,
  createRoutedModelGateway,
  type IdGenerator,
  type ModelCapabilities,
  type ModelExecuteOptions,
  type ModelExecutionEngine,
  type ModelExecutionRepository,
  type ModelExecutionRequest,
  type ModelExecutionResult,
  type ModelGateway,
  type ModelSelection,
} from '@acme-engine/core';

export const NVIDIA_CHAT_COMPLETIONS_ENDPOINT =
  'https://integrate.api.nvidia.com/v1/chat/completions' as const;

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

export interface AcmeModelRuntimeConfig {
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

export interface AcmeModelRuntimeOptions {
  readonly config: AcmeModelRuntimeConfig;
  readonly openAiTransport?: OpenAiTransport;
  readonly chatCompletionsTransport?: ChatCompletionsTransport;
  readonly repository?: ModelExecutionRepository;
  readonly ids?: IdGenerator;
  readonly now?: () => string;
}

export interface AcmeModelRuntime {
  readonly engine: ModelExecutionEngine;
  readonly providers: readonly string[];
  execute(
    request: ModelExecutionRequest,
    options?: ModelExecuteOptions,
  ): Promise<ModelExecutionResult>;
}

function boundedText(value: string, label: string, maximum: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || Buffer.byteLength(trimmed, 'utf8') > maximum) {
    throw new Error(`${label} must be a bounded non-empty string.`);
  }
  return trimmed;
}

function boundedSecret(value: string, label: string): string {
  const byteLength = Buffer.byteLength(value, 'utf8');
  const hasLineBreak = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code === 10 || code === 13;
  });
  if (value.trim().length === 0 || hasLineBreak || byteLength > 4096) {
    throw new Error(
      `${label} must be a bounded non-empty secret without CR/LF.`,
    );
  }
  return value;
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

function requireProviderHint(selection: ModelSelection, label: string): string {
  if (selection.providerHint === undefined) {
    throw new Error(`${label} requires selection.providerHint.`);
  }
  return boundedText(selection.providerHint, `${label}.providerHint`, 200);
}

function toOpenAiProfiles(
  profiles: readonly AcmeModelRuntimeOpenAiProfileConfig[],
): readonly OpenAiModelProfile[] {
  if (profiles.length === 0) {
    throw new Error('openAi.profiles must be a non-empty array.');
  }
  return profiles.map((profile, index) =>
    Object.freeze({
      selection: profile.selection,
      model: boundedText(
        profile.model,
        `openAi.profiles[${String(index)}].model`,
        500,
      ),
      capabilities: profile.capabilities ?? defaultOpenAiCapabilities(),
    }),
  );
}

function toChatProfiles(
  profiles: readonly AcmeModelRuntimeChatProfileConfig[],
  options: {
    readonly provider: string;
    readonly endpoint: string;
    readonly headers: () => Readonly<Record<string, string>>;
  },
  label: string,
): readonly ChatCompletionsModelProfile[] {
  if (profiles.length === 0) {
    throw new Error(`${label}.profiles must be a non-empty array.`);
  }
  return profiles.map((profile, index) =>
    Object.freeze({
      selection: profile.selection,
      provider: boundedText(
        profile.provider ?? options.provider,
        `${label}.profiles[${String(index)}].provider`,
        200,
      ),
      model: boundedText(
        profile.model,
        `${label}.profiles[${String(index)}].model`,
        500,
      ),
      endpoint: options.endpoint,
      capabilities: profile.capabilities ?? defaultChatCapabilities(),
      ...(profile.controls === undefined ? {} : { controls: profile.controls }),
      headers: options.headers,
    }),
  );
}

function addRoute(
  routes: Map<string, ModelGateway>,
  hint: string,
  gateway: ModelGateway,
): void {
  const key = boundedText(hint, 'providerHint', 200);
  const existing = routes.get(key);
  if (existing !== undefined && existing !== gateway) {
    throw new Error(
      `Provider route ${key} is configured on more than one gateway.`,
    );
  }
  routes.set(key, gateway);
}

function ensureConfigured(config: AcmeModelRuntimeConfig): void {
  if (
    config.openAi === undefined &&
    config.nvidia === undefined &&
    (config.compatible === undefined || config.compatible.length === 0)
  ) {
    throw new Error(
      'Model runtime requires at least one of OpenAI, NVIDIA or a compatible Chat Completions route.',
    );
  }
}

export function createAcmeModelRuntime(
  options: AcmeModelRuntimeOptions,
): AcmeModelRuntime {
  ensureConfigured(options.config);
  const now = options.now ?? (() => new Date().toISOString());
  const routes = new Map<string, ModelGateway>();
  const config = options.config;

  if (config.openAi !== undefined) {
    const apiKey = boundedSecret(config.openAi.apiKey, 'openAi.apiKey');
    const profiles = toOpenAiProfiles(config.openAi.profiles);
    const gateway = createOpenAiResponsesGateway({
      transport: options.openAiTransport ?? createOpenAiFetchTransport(),
      now,
      ...(config.openAi.baseUrl === undefined
        ? {}
        : {
            baseUrl: boundedText(config.openAi.baseUrl, 'openAi.baseUrl', 2048),
          }),
      headers: () => ({ authorization: `Bearer ${apiKey}` }),
      profiles,
    });
    for (const [index, profile] of config.openAi.profiles.entries()) {
      addRoute(
        routes,
        requireProviderHint(
          profile.selection,
          `openAi.profiles[${String(index)}]`,
        ),
        gateway,
      );
    }
  }

  if (config.nvidia !== undefined) {
    const apiKey = boundedSecret(config.nvidia.apiKey, 'nvidia.apiKey');
    const endpoint = boundedText(
      config.nvidia.endpoint ?? NVIDIA_CHAT_COMPLETIONS_ENDPOINT,
      'nvidia.endpoint',
      2048,
    );
    const gateway = createChatCompletionsGateway({
      transport:
        options.chatCompletionsTransport ??
        createChatCompletionsFetchTransport(),
      now,
      profiles: toChatProfiles(
        config.nvidia.profiles,
        {
          provider: 'nvidia',
          endpoint,
          headers: () => ({ authorization: `Bearer ${apiKey}` }),
        },
        'nvidia',
      ),
    });
    for (const [index, profile] of config.nvidia.profiles.entries()) {
      addRoute(
        routes,
        requireProviderHint(
          profile.selection,
          `nvidia.profiles[${String(index)}]`,
        ),
        gateway,
      );
    }
  }

  if (config.compatible !== undefined) {
    for (const [index, route] of config.compatible.entries()) {
      const label = `compatible[${String(index)}]`;
      const apiKey = boundedSecret(route.apiKey, `${label}.apiKey`);
      const endpoint = boundedText(route.endpoint, `${label}.endpoint`, 2048);
      const providerHint = boundedText(
        route.providerHint,
        `${label}.providerHint`,
        200,
      );
      const gateway = createChatCompletionsGateway({
        transport:
          options.chatCompletionsTransport ??
          createChatCompletionsFetchTransport(),
        now,
        profiles: toChatProfiles(
          route.profiles,
          {
            provider: route.provider ?? providerHint,
            endpoint,
            headers: () => ({ authorization: `Bearer ${apiKey}` }),
          },
          label,
        ),
      });
      addRoute(routes, providerHint, gateway);
      for (const [profileIndex, profile] of route.profiles.entries()) {
        addRoute(
          routes,
          requireProviderHint(
            profile.selection,
            `${label}.profiles[${String(profileIndex)}]`,
          ),
          gateway,
        );
      }
    }
  }

  const engine = createModelExecutionEngine({
    clock: { now },
    ids: options.ids ?? { next: (kind) => `${kind}-${randomUUID()}` },
    repository: options.repository ?? createInMemoryModelExecutionRepository(),
    gateway: createRoutedModelGateway({ routes: Object.fromEntries(routes) }),
  });

  const providers = Object.freeze([...routes.keys()].sort());
  return Object.freeze({
    engine,
    providers,
    execute(
      request: ModelExecutionRequest,
      executeOptions?: ModelExecuteOptions,
    ): Promise<ModelExecutionResult> {
      return engine.execute(request, executeOptions);
    },
  });
}
