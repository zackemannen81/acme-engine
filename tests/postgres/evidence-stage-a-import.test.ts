import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { listenEvidenceWorkbenchApi } from '../../apps/evidence-workbench-api/src/index.js';
import { createLocalEvidenceWorkbench } from '../../apps/evidence-workbench-api/src/local.js';
import type { ProviderTransport } from '../../packages/adapter-model-openai/src/index.js';

const transport: ProviderTransport = {
  async send() {
    throw new Error('Stage A import must not contact the provider.');
  },
};

const live = {
  liveOptIn: true,
  hosted: true,
  profile: 'evidence-poc1-live/1',
  model: 'gpt-stage-a-test',
  apiKey: 'postgres-stage-a-test-key',
  payloadKey: new Uint8Array(32).fill(19),
  payloadKeyId: 'postgres-stage-a-test-payload-key',
  deploymentMaxModelCalls: 2,
  deploymentCostCeilingMinor: 100,
  deploymentCurrency: 'SEK',
  transport,
} as const;

async function stop(
  local: Awaited<ReturnType<typeof createLocalEvidenceWorkbench>>,
) {
  if (local.server.listening)
    await new Promise<void>((resolve, reject) =>
      local.server.close((error) => (error ? reject(error) : resolve())),
    );
  await local.close();
}

async function authenticatedRequest(
  address: string,
  credentials: {
    readonly email: string;
    readonly password: string | undefined;
  },
) {
  const origin = address.slice(0, -1);
  const login = await fetch(`${address}auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(credentials),
  });
  expect(login.status, await login.clone().text()).toBe(201);
  const cookies = login.headers.getSetCookie();
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const csrfPart = cookies
    .map((value) => value.split(';')[0])
    .find((value) => value?.startsWith('acme_csrf='));
  if (csrfPart === undefined) throw new Error('Missing CSRF cookie.');
  const csrf = decodeURIComponent(csrfPart.slice('acme_csrf='.length));
  return (pathname: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    headers.set('cookie', cookie);
    if (!['GET', 'HEAD'].includes(method)) {
      headers.set('origin', origin);
      headers.set('x-acme-csrf', csrf);
    }
    return fetch(`${address}${pathname}`, { ...init, headers });
  };
}

describe('Evidence Stage A PostgreSQL import', () => {
  it('persists exact provenance and source hashes through a full composition restart', async () => {
    const suffix = randomUUID();
    const first = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      live,
    });
    let caseId: string;
    let artifactVersionId: string;
    let canonicalSha256: string;
    try {
      expect(first.liveCapability?.deployment.profile).toBe(
        'evidence-poc1-live/1',
      );
      const address = await listenEvidenceWorkbenchApi(first.server, {
        port: 0,
      });
      const request = await authenticatedRequest(
        address.url,
        first.authCredentials,
      );
      const identity = await first.identityRepository.snapshot();
      const organizationId = identity.organizations[0]?.organizationId;
      if (organizationId === undefined)
        throw new Error('Missing organization.');
      const createdResponse = await request(
        `api/organizations/${organizationId}/cases`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-create-case-command/2',
            commandKey: `postgres-stage-a-${suffix}`,
            title: 'PostgreSQL Stage A acceptance',
            caseReference: suffix,
            metadata: {},
            dataPolicy: 'stage-a-authorized-judicial-text',
          }),
        },
      );
      expect(createdResponse.status, await createdResponse.clone().text()).toBe(
        201,
      );
      caseId = ((await createdResponse.json()) as { caseId: string }).caseId;
      const importedResponse = await request(
        `api/cases/${encodeURIComponent(caseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              schemaVersion: 'evidence-text-import-metadata/2',
              commandKey: `postgres-stage-a-import-${suffix}`,
              intent: { kind: 'create' },
              title: 'Anonymized judicial text',
              artifactKind: 'structured-exhibit-text',
              declaredMediaType: 'text/plain; charset=utf-8',
              dataClass: 'stage-a-anonymized-judicial-text/1',
              attestationVersion: 'evidence-stage-a-source-attestation/1',
              anonymizationAttested: true,
              operatorAuthorityAttested: true,
              providerTransmissionAuthorized: true,
              sourceProvenance: {
                schemaVersion: 'evidence-external-source-provenance/1',
                sourceKind: 'judicial-document',
                externalSourceRef: `postgres-test:${suffix}`,
                acquiredAt: '2026-08-15T10:00:00.000Z',
                parentContainer: {
                  kind: 'pdf',
                  sha256: 'b'.repeat(64),
                  byteLength: 12_345,
                },
                extraction: {
                  method: 'pypdf-text-extraction',
                  version: 'test-version',
                  extractedAt: '2026-08-15T10:01:00.000Z',
                  pageCount: 3,
                },
              },
            },
            text: 'AUTHORIZED ANONYMIZED TEXT\nExact immutable source.\n',
          }),
        },
      );
      expect(
        importedResponse.status,
        await importedResponse.clone().text(),
      ).toBe(201);
      const imported = (await importedResponse.json()) as {
        artifactVersionId: string;
        canonicalSha256: string;
      };
      artifactVersionId = imported.artifactVersionId;
      canonicalSha256 = imported.canonicalSha256;
    } finally {
      await stop(first);
    }

    const reopened = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      live,
    });
    try {
      const snapshot = await reopened.productRepository.snapshot();
      expect(
        snapshot.textImports.find(
          (item) => item.artifactVersionId === artifactVersionId,
        ),
      ).toMatchObject({
        schemaVersion: 'evidence-text-import-record/2',
        caseId,
        canonicalSha256,
        sourceProvenance: {
          externalSourceRef: `postgres-test:${suffix}`,
          parentContainer: { sha256: 'b'.repeat(64) },
        },
      });
      expect(
        snapshot.sources.find(
          (item) => item.artifactVersionId === artifactVersionId,
        )?.contentHash,
      ).toBe(canonicalSha256);
      expect(
        (await reopened.identityRepository.snapshot()).cases.some(
          (item) => item.caseId === caseId,
        ),
      ).toBe(true);
    } finally {
      await stop(reopened);
    }
  });
});
