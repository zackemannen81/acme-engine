import { describe, expect, it } from 'vitest';

import {
  readAcmeModelRuntimeServiceConfig,
  validateAcmeModelRuntimeServiceConfig,
} from '../src/acme-model-runtime-service.js';

const bearerToken = 'model-runtime-test-bearer-token-012345';

describe('acme-model-runtime service configuration', () => {
  it('parses explicit OpenAI and NVIDIA routes from the environment', () => {
    const env: NodeJS.ProcessEnv = {
      ACME_MODEL_RUNTIME_LISTEN_HOST: '127.0.0.1',
      ACME_MODEL_RUNTIME_LISTEN_PORT: '0',
      ACME_MODEL_RUNTIME_BEARER_TOKEN: bearerToken,
      ACME_MODEL_RUNTIME_ENGINE_BUILD: 'build-from-env',
      OPENAI_API_KEY: 'openai-test-key',
      ACME_MODEL_RUNTIME_OPENAI_PROFILES: JSON.stringify([
        {
          selection: {
            profile: 'default',
            providerHint: 'openai',
            modelHint: 'luna',
          },
          model: 'gpt-5',
        },
      ]),
      NVIDIA_API_KEY: 'nvidia-test-key',
      ACME_MODEL_RUNTIME_NVIDIA_PROFILES: JSON.stringify([
        {
          selection: {
            profile: 'default',
            providerHint: 'nvidia',
            modelHint: 'nemotron',
          },
          model: 'nvidia/llama-fixture',
          controls: {
            temperature: true,
            topP: true,
            maxOutputTokens: true,
            enableThinking: 'enable_thinking',
            seed: true,
          },
        },
      ]),
    };

    const config = readAcmeModelRuntimeServiceConfig(env);
    expect(config.engineBuild).toBe('build-from-env');
    expect(config.openAi?.profiles[0]?.selection).toEqual({
      profile: 'default',
      providerHint: 'openai',
      modelHint: 'luna',
    });
    expect(config.nvidia?.profiles[0]?.controls).toMatchObject({
      enableThinking: 'enable_thinking',
      topP: true,
    });
  });

  it('fails closed when no provider route is configured', () => {
    expect(() =>
      validateAcmeModelRuntimeServiceConfig({
        hostname: '127.0.0.1',
        port: 0,
        bearerToken,
        engineBuild: 'build',
      }),
    ).toThrowError(/at least one/u);
  });

  it('fails closed when a credential is present without profiles', () => {
    expect(() =>
      readAcmeModelRuntimeServiceConfig({
        ACME_MODEL_RUNTIME_LISTEN_HOST: '127.0.0.1',
        ACME_MODEL_RUNTIME_LISTEN_PORT: '0',
        ACME_MODEL_RUNTIME_BEARER_TOKEN: bearerToken,
        ACME_MODEL_RUNTIME_ENGINE_BUILD: 'build',
        OPENAI_API_KEY: 'openai-test-key',
      }),
    ).toThrowError(/OPENAI_PROFILES/u);
  });
});
