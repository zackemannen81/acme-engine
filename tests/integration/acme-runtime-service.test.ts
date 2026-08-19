import { createServer, type Server } from 'node:http';
import { once } from 'node:events';

import { describe, expect, it } from 'vitest';

import type { ProviderTransport } from '../../packages/adapter-model-openai/src/index.js';
import { createComposition } from '../../apps/cli/src/composition.js';
import {
  createRuntimeBearerAuthorizer,
  readAcmeRuntimeServiceConfig,
  startAcmeRuntimeService,
  validateAcmeRuntimeServiceConfig,
  type AcmeRuntimeServiceConfig,
} from '../../apps/cli/src/acme-runtime-service.js';
import {
  ACME_RUNTIME_EXECUTE_PATH,
  ACME_RUNTIME_PROTOCOL_VERSION,
} from '../../apps/cli/src/acme-runtime-wire.js';

const bearerToken = 'runtime-test-bearer-token-0123456789abcdef';

function serviceConfig(
  overrides: Partial<AcmeRuntimeServiceConfig> = {},
): AcmeRuntimeServiceConfig {
  return {
    repository: 'postgres',
    modelProvider: 'openai',
    hostname: '127.0.0.1',
    port: 0,
    bearerToken,
    engineBuild: 'test-build-0169',
    openAiApiKey: 'test-openai-key-not-used',
    modelSelection: {
      profile: 'runtime-service-test',
      providerHint: 'openai',
      modelHint: 'fixture-model',
    },
    openAiModel: 'fixture-model',
    ...overrides,
  };
}

const neverTransport: ProviderTransport = {
  async send() {
    throw new Error('Runtime service test unexpectedly attempted a provider call.');
  },
};

function compatibilityHeaders(token = bearerToken): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'x-acme-runtime-protocol': ACME_RUNTIME_PROTOCOL_VERSION,
  };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}

describe('canonical runnable ACME runtime service', () => {
  it('parses only explicit PostgreSQL/OpenAI service configuration', () => {
    const env: NodeJS.ProcessEnv = {
      ACME_RUNTIME_REPOSITORY: 'postgres',
      ACME_RUNTIME_MODEL_PROVIDER: 'openai',
      ACME_POSTGRES_URL: 'postgresql://example.invalid/acme',
      ACME_RUNTIME_LISTEN_HOST: '127.0.0.1',
      ACME_RUNTIME_LISTEN_PORT: '0',
      ACME_RUNTIME_BEARER_TOKEN: bearerToken,
      ACME_RUNTIME_ENGINE_BUILD: 'build-from-env',
      OPENAI_API_KEY: 'test-key',
      ACME_RUNTIME_MODEL_PROFILE: 'profile-from-env',
      ACME_RUNTIME_MODEL_PROVIDER_HINT: 'openai',
      ACME_RUNTIME_MODEL_HINT: 'model-hint',
      ACME_RUNTIME_OPENAI_MODEL: 'provider-model',
      ACME_RUNTIME_OPENAI_BASE_URL: 'https://example.invalid/v1',
    };

    expect(readAcmeRuntimeServiceConfig(env)).toEqual({
      repository: 'postgres',
      modelProvider: 'openai',
      hostname: '127.0.0.1',
      port: 0,
      bearerToken,
      engineBuild: 'build-from-env',
      openAiApiKey: 'test-key',
      openAiBaseUrl: 'https://example.invalid/v1',
      modelSelection: {
        profile: 'profile-from-env',
        providerHint: 'openai',
        modelHint: 'model-hint',
      },
      openAiModel: 'provider-model',
    });
  });

  it('fails closed instead of inventing repository, provider, build or model defaults', () => {
    const base: NodeJS.ProcessEnv = {
      ACME_RUNTIME_REPOSITORY: 'postgres',
      ACME_RUNTIME_MODEL_PROVIDER: 'openai',
      ACME_POSTGRES_URL: 'postgresql://example.invalid/acme',
      ACME_RUNTIME_LISTEN_HOST: '127.0.0.1',
      ACME_RUNTIME_LISTEN_PORT: '3000',
      ACME_RUNTIME_BEARER_TOKEN: bearerToken,
      ACME_RUNTIME_ENGINE_BUILD: 'build-from-env',
      OPENAI_API_KEY: 'test-key',
      ACME_RUNTIME_MODEL_PROFILE: 'profile-from-env',
      ACME_RUNTIME_OPENAI_MODEL: 'provider-model',
    };

    expect(() =>
      readAcmeRuntimeServiceConfig({ ...base, ACME_RUNTIME_REPOSITORY: 'memory' }),
    ).toThrow(/must be exactly "postgres"/u);
    expect(() =>
      readAcmeRuntimeServiceConfig({ ...base, ACME_RUNTIME_MODEL_PROVIDER: 'mock' }),
    ).toThrow(/must be exactly "openai"/u);

    const withoutBuild = { ...base };
    delete withoutBuild['ACME_RUNTIME_ENGINE_BUILD'];
    expect(() => readAcmeRuntimeServiceConfig(withoutBuild)).toThrow(
      /ACME_RUNTIME_ENGINE_BUILD is required/u,
    );

    const withoutModel = { ...base };
    delete withoutModel['ACME_RUNTIME_OPENAI_MODEL'];
    expect(() => readAcmeRuntimeServiceConfig(withoutModel)).toThrow(
      /ACME_RUNTIME_OPENAI_MODEL is required/u,
    );
  });

  it('keeps bearer authorization optional to composition but constant-time for equal-length secrets', async () => {
    const authorize = createRuntimeBearerAuthorizer(bearerToken);
    expect(
      await authorize(
        new Request('http://runtime.invalid/v1/compatibility', {
          headers: { authorization: `Bearer ${bearerToken}` },
        }),
      ),
    ).toBe(true);
    expect(
      await authorize(
        new Request('http://runtime.invalid/v1/compatibility', {
          headers: {
            authorization: `Bearer ${'x'.repeat(Buffer.byteLength(bearerToken, 'utf8'))}`,
          },
        }),
      ),
    ).toBe(false);
    expect(
      await authorize(new Request('http://runtime.invalid/v1/compatibility')),
    ).toBe(false);
    expect(() => createRuntimeBearerAuthorizer('too-short')).toThrow(
      /at least 32 UTF-8 bytes/u,
    );
  });

  it('serves the canonical compatibility descriptor and closes idempotently without a live provider call', async () => {
    const composition = createComposition('memory', undefined);
    const service = await startAcmeRuntimeService({
      config: serviceConfig(),
      composition,
      transport: neverTransport,
      now: () => '2026-08-19T10:00:00.000Z',
    });

    try {
      const authorized = await fetch(
        `${service.address.origin}/v1/compatibility`,
        { headers: compatibilityHeaders() },
      );
      expect(authorized.status).toBe(200);
      expect(await authorized.json()).toEqual({
        protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
        engineBuild: 'test-build-0169',
        executePath: ACME_RUNTIME_EXECUTE_PATH,
      });

      const denied = await fetch(
        `${service.address.origin}/v1/compatibility`,
        { headers: compatibilityHeaders('wrong-token-of-a-different-length') },
      );
      expect(denied.status).toBe(401);
    } finally {
      await service.close();
      await service.close();
    }
  });

  it('closes composition resources when the listener cannot bind', async () => {
    const blocker = createServer();
    blocker.listen({ host: '127.0.0.1', port: 0 });
    await once(blocker, 'listening');
    const address = blocker.address();
    if (address === null || typeof address === 'string') {
      await closeServer(blocker);
      throw new Error('Test blocker did not expose a TCP port.');
    }

    const base = createComposition('memory', undefined);
    let closeCalls = 0;
    const composition = {
      ...base,
      async close(): Promise<void> {
        closeCalls += 1;
        await base.close();
      },
    };

    try {
      await expect(
        startAcmeRuntimeService({
          config: serviceConfig({ port: address.port }),
          composition,
          transport: neverTransport,
        }),
      ).rejects.toBeDefined();
      expect(closeCalls).toBe(1);
    } finally {
      await closeServer(blocker);
    }
  });

  it('rejects invalid direct configuration before constructing service resources', () => {
    expect(() =>
      validateAcmeRuntimeServiceConfig(
        serviceConfig({ bearerToken: 'short', engineBuild: 'build' }),
      ),
    ).toThrow(/at least 32 UTF-8 bytes/u);
    expect(() =>
      validateAcmeRuntimeServiceConfig(serviceConfig({ engineBuild: '   ' })),
    ).toThrow(/engineBuild must be a bounded non-empty string/u);
  });
});
