import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { createFileEvidenceProductRepository } from '@acme/adapter-evidence-product-file';

import {
  createEvidenceWorkbenchApi,
  listenEvidenceWorkbenchApi,
} from '../src/index.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function login(
  address: string,
  credentials: {
    readonly email: string;
    readonly password: string | undefined;
  },
): Promise<(pathname: string, init?: RequestInit) => Promise<Response>> {
  const origin = address.slice(0, -1);
  const response = await fetch(`${address}auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(credentials),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const cookies = response.headers.getSetCookie();
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const csrfCookie = cookies
    .map((value) => value.split(';')[0])
    .find((value) => value?.startsWith('acme_csrf='));
  if (csrfCookie === undefined) throw new Error('Missing CSRF cookie.');
  const csrf = decodeURIComponent(csrfCookie.slice('acme_csrf='.length));
  return (pathname, init = {}) => {
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

function stageAMetadata(commandKey: string) {
  return {
    schemaVersion: 'evidence-text-import-metadata/2',
    commandKey,
    intent: { kind: 'create' },
    title: 'Authorized anonymized judgment',
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
      externalSourceRef: 'operator-controlled-source:d1',
      acquiredAt: '2026-08-15T08:00:00.000Z',
      parentContainer: {
        kind: 'pdf',
        sha256: 'a'.repeat(64),
        byteLength: 106_907,
      },
      extraction: {
        method: 'pypdf-text-extraction',
        version: '6.0.0',
        extractedAt: '2026-08-15T08:05:00.000Z',
        pageCount: 52,
      },
    },
  } as const;
}

describe('Stage A HTTP boundary', () => {
  it('refuses Stage A case creation when the complete capability is absent', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-stage-a-off-'),
    );
    directories.push(directory);
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      seedMode: 'none',
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    try {
      const request = await login(address.url, local.authCredentials);
      expect(await (await request('api/capabilities')).json()).toEqual({
        schemaVersion: 'evidence-product-capabilities/1',
        stageAImport: false,
        liveObservation: false,
        liveObservationModel: null,
        liveObservationMaxModelCalls: null,
        liveObservationCostCeilingMinor: null,
        liveObservationCurrency: null,
      });
      const identity = await local.identityRepository.snapshot();
      const organizationId = identity.organizations[0]?.organizationId;
      if (organizationId === undefined)
        throw new Error('Missing organization.');
      const response = await request(
        `api/organizations/${organizationId}/cases`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-create-case-command/2',
            commandKey: 'stage-a-disabled',
            title: 'Must not be created',
            caseReference: null,
            metadata: {},
            dataPolicy: 'stage-a-authorized-judicial-text',
          }),
        },
      );
      expect(response.status).toBe(403);
      expect(await response.text()).toBe('STAGE_A_IMPORT_CAPABILITY_REQUIRED');
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
      await local.close();
    }
  });

  it('imports Stage A text with immutable provenance, case isolation, and file restart', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-stage-a-on-'),
    );
    directories.push(directory);
    const dataFile = path.join(directory, 'product.json');
    const clock = { now: () => '2026-08-15T09:00:00.000Z' };
    let nextId = 0;
    const local = await createLocalEvidenceWorkbench({
      dataFile,
      seedMode: 'none',
      clock,
    });
    const server = createEvidenceWorkbenchApi({
      repository: local.productRepository,
      worker: local.worker,
      clock,
      ids: { next: (kind) => `${kind}-stage-a-${String(++nextId)}` },
      workspaceId: local.workspaceId,
      caseId: local.caseId,
      auth: {
        sessions: local.sessions,
        repository: local.identityRepository,
        cookieName: 'acme_session_dev',
        secureCookies: false,
      },
      artifactSecurity: local.artifactService,
      ingestion: local.ingestionService,
      stageA: { enabled: true },
    });
    const address = await listenEvidenceWorkbenchApi(server, { port: 0 });
    let importedArtifactVersionId = '';
    let stageACaseId: string;
    try {
      const request = await login(address.url, local.authCredentials);
      const identity = await local.identityRepository.snapshot();
      const organizationId = identity.organizations[0]?.organizationId;
      if (organizationId === undefined)
        throw new Error('Missing organization.');
      const createResponse = await request(
        `api/organizations/${organizationId}/cases`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-create-case-command/2',
            commandKey: 'stage-a-blackbox-case',
            title: 'Stage A blackbox matter',
            caseReference: 'STAGE-A-001',
            metadata: {},
            dataPolicy: 'stage-a-authorized-judicial-text',
          }),
        },
      );
      expect(createResponse.status, await createResponse.clone().text()).toBe(
        201,
      );
      const created = (await createResponse.json()) as { caseId: string };
      stageACaseId = created.caseId;
      const syntheticInStageA = await request(
        `api/cases/${encodeURIComponent(stageACaseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              schemaVersion: 'evidence-text-import-metadata/1',
              commandKey: 'synthetic-wrong-stage-a-case',
              intent: { kind: 'create' },
              title: 'Wrong data class',
              artifactKind: 'structured-exhibit-text',
              declaredMediaType: 'text/plain; charset=utf-8',
              dataClass: 'synthetic-utf8-plain-text/1',
              attestationVersion: 'evidence-synthetic-attestation/1',
              syntheticAuthorityAttested: true,
            },
            text: 'Must not be retained.\n',
          }),
        },
      );
      expect(syntheticInStageA.status).toBe(409);
      expect(await syntheticInStageA.text()).toBe(
        'IMPORT_DATA_POLICY_MISMATCH',
      );
      const importedResponse = await request(
        `api/cases/${encodeURIComponent(stageACaseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: stageAMetadata('stage-a-blackbox-import'),
            text: 'ANONYMIZED JUDICIAL TEXT\nSource-bound paragraph.\n',
          }),
        },
      );
      expect(
        importedResponse.status,
        await importedResponse.clone().text(),
      ).toBe(201);
      const imported = (await importedResponse.json()) as {
        artifactVersionId: string;
        schemaVersion: string;
        sourceProvenance: { externalSourceRef: string };
      };
      importedArtifactVersionId = imported.artifactVersionId;
      expect(imported).toMatchObject({
        schemaVersion: 'evidence-text-import-record/2',
        dataClass: 'stage-a-anonymized-judicial-text/1',
        sourceProvenance: {
          externalSourceRef: 'operator-controlled-source:d1',
        },
      });
      const list = await request(
        `api/cases/${encodeURIComponent(stageACaseId)}/text-imports`,
      );
      expect(
        ((await list.json()) as { imports: unknown[] }).imports,
      ).toHaveLength(1);
      const source = await request(
        `api/cases/${encodeURIComponent(stageACaseId)}/sources/${encodeURIComponent(importedArtifactVersionId)}`,
      );
      expect(source.status, await source.clone().text()).toBe(200);
      expect(await source.text()).toContain('Source-bound paragraph.');
      const isolated = await request(
        `api/cases/${encodeURIComponent(local.caseId)}/text-imports`,
      );
      expect(
        ((await isolated.json()) as { imports: unknown[] }).imports,
      ).toEqual([]);

      const mismatchedPolicy = await request(
        `api/cases/${encodeURIComponent(local.caseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: stageAMetadata('stage-a-wrong-case'),
            text: 'Must not be retained.\n',
          }),
        },
      );
      expect(mismatchedPolicy.status).toBe(409);
      expect(await mismatchedPolicy.text()).toBe('IMPORT_DATA_POLICY_MISMATCH');

      const credentialValue = 'credential-value-must-not-echo';
      const credentialShaped = await request(
        `api/cases/${encodeURIComponent(stageACaseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              ...stageAMetadata('stage-a-credential-refusal'),
              apiKey: credentialValue,
            },
            text: 'Must not be retained.\n',
          }),
        },
      );
      expect(credentialShaped.status).toBe(400);
      expect(await credentialShaped.text()).not.toContain(credentialValue);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await local.close();
    }

    const reopened = createFileEvidenceProductRepository({
      filePath: dataFile,
    });
    {
      const snapshot = await reopened.snapshot();
      const record = snapshot.textImports.find(
        (item) => item.artifactVersionId === importedArtifactVersionId,
      );
      expect(record).toMatchObject({
        schemaVersion: 'evidence-text-import-record/2',
        caseId: stageACaseId,
        sourceProvenance: {
          parentContainer: { sha256: 'a'.repeat(64) },
          extraction: { method: 'pypdf-text-extraction', pageCount: 52 },
        },
      });
      expect(
        snapshot.sources.some(
          (item) => item.artifactVersionId === importedArtifactVersionId,
        ),
      ).toBe(true);
    }
  });
});
