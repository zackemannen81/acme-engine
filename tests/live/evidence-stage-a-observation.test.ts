import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { listenEvidenceWorkbenchApi } from '../../apps/evidence-workbench-api/src/index.js';
import { createLocalEvidenceWorkbench } from '../../apps/evidence-workbench-api/src/local.js';

const ENABLED = process.env['ACME_EVIDENCE_STAGE_A_LIVE'] === '1';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Stage A live acceptance requires ${name}.`);
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer.`);
  return value;
}

async function login(
  address: string,
  credentials: {
    readonly email: string;
    readonly password: string | undefined;
  },
) {
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

/**
 * ACME-0107 Stage A product acceptance. This gate is separate from the older
 * provider probes because it sends an operator-authorized external source and
 * mutates the configured PostgreSQL/S3 product stores. It is skipped unless
 * its exact opt-in is present and then fails closed on every missing input.
 */
describe.skipIf(!ENABLED)('Evidence Stage A live observation', () => {
  it('imports one authorized source and produces reviewable observations', async () => {
    if (process.env['ACME_LIVE_TEST'] !== '1')
      throw new Error(
        'Stage A live acceptance also requires ACME_LIVE_TEST=1.',
      );
    if (process.env['ACME_HOSTED'] !== '1')
      throw new Error('Stage A live acceptance requires ACME_HOSTED=1.');
    required('OPENAI_API_KEY');
    required('ACME_POSTGRES_URL');
    required('ACME_EVIDENCE_PAYLOAD_KEY_FILE');
    required('ACME_ARTIFACT_KEK_FILE');
    if (required('ACME_ARTIFACT_STORE').toLowerCase() !== 's3')
      throw new Error(
        'Stage A live acceptance requires ACME_ARTIFACT_STORE=s3.',
      );

    const sourceFile = required('ACME_EVIDENCE_STAGE_A_SOURCE_FILE');
    const sourceText = await readFile(sourceFile, 'utf8');
    const parentSha256 = required('ACME_EVIDENCE_STAGE_A_PARENT_SHA256');
    if (!/^[a-f0-9]{64}$/u.test(parentSha256))
      throw new Error(
        'ACME_EVIDENCE_STAGE_A_PARENT_SHA256 must be lowercase SHA-256.',
      );
    const costCeilingMinor = positiveInteger(
      'ACME_EVIDENCE_LIVE_COST_CEILING_MINOR',
    );
    const currency = required('ACME_EVIDENCE_LIVE_CURRENCY');
    const model = required('ACME_EVIDENCE_LIVE_MODEL');
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;

    const local = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      live: {
        liveOptIn: true,
        hosted: true,
        profile: 'evidence-poc1-live/1',
        model,
        apiKey: required('OPENAI_API_KEY'),
        deploymentMaxModelCalls: 1,
        deploymentCostCeilingMinor: costCeilingMinor,
        deploymentCurrency: currency,
      },
    });
    try {
      const address = await listenEvidenceWorkbenchApi(local.server, {
        port: 0,
      });
      const request = await login(address.url, local.authCredentials);
      const identity = await local.identityRepository.snapshot();
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
            commandKey: `stage-a-live-case-${stamp}`,
            title: 'Stage A live acceptance',
            caseReference: `STAGE-A-LIVE-${stamp}`,
            metadata: { acceptance: 'ACME-0107' },
            dataPolicy: 'stage-a-authorized-judicial-text',
          }),
        },
      );
      expect(createdResponse.status, await createdResponse.clone().text()).toBe(
        201,
      );
      const caseId = ((await createdResponse.json()) as { caseId: string })
        .caseId;
      const importedResponse = await request(
        `api/cases/${encodeURIComponent(caseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              schemaVersion: 'evidence-text-import-metadata/2',
              commandKey: `stage-a-live-import-${stamp}`,
              intent: { kind: 'create' },
              title: required('ACME_EVIDENCE_STAGE_A_SOURCE_TITLE'),
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
                externalSourceRef: required('ACME_EVIDENCE_STAGE_A_SOURCE_REF'),
                acquiredAt:
                  process.env['ACME_EVIDENCE_STAGE_A_ACQUIRED_AT'] ??
                  new Date().toISOString(),
                parentContainer: {
                  kind: 'pdf',
                  sha256: parentSha256,
                  byteLength: positiveInteger(
                    'ACME_EVIDENCE_STAGE_A_PARENT_BYTE_LENGTH',
                  ),
                },
                extraction: {
                  method: 'pypdf-text-extraction',
                  version: required('ACME_EVIDENCE_STAGE_A_EXTRACTION_VERSION'),
                  extractedAt:
                    process.env['ACME_EVIDENCE_STAGE_A_EXTRACTED_AT'] ??
                    new Date().toISOString(),
                  pageCount: positiveInteger(
                    'ACME_EVIDENCE_STAGE_A_PAGE_COUNT',
                  ),
                },
              },
            },
            text: sourceText,
          }),
        },
      );
      expect(
        importedResponse.status,
        await importedResponse.clone().text(),
      ).toBe(201);
      const artifactVersionId = (
        (await importedResponse.json()) as { artifactVersionId: string }
      ).artifactVersionId;
      const launchedResponse = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-observations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-case-live-observation-command/1',
            commandKey: `stage-a-live-observe-${stamp}`,
            artifactVersionId,
            actorRoster: [],
            requestedBudget: { maxModelCalls: 1, costCeilingMinor },
            confirmation: {
              version: 'evidence-live-confirmation/1',
              optIn: true,
              provider: 'openai',
              model,
              caseId,
              maxModelCalls: 1,
              costCeilingMinor,
              currency,
              rationale: 'Explicit Stage A product acceptance.',
            },
          }),
        },
      );
      expect(
        launchedResponse.status,
        await launchedResponse.clone().text(),
      ).toBe(202);
      let job = (await launchedResponse.json()) as {
        jobId: string;
        phase: string;
        reasonCode: string | null;
      };
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const response = await request(
          `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
        );
        expect(response.status, await response.clone().text()).toBe(200);
        job = (await response.json()) as typeof job;
      }
      expect(job).toMatchObject({
        phase: 'completed',
        reasonCode: 'LIVE_OBSERVATION_COMPLETED',
      });
      const sourceResponse = await request(
        `api/cases/${encodeURIComponent(caseId)}/sources/${encodeURIComponent(artifactVersionId)}`,
      );
      expect(sourceResponse.status, await sourceResponse.clone().text()).toBe(
        200,
      );
      const source = (await sourceResponse.json()) as {
        source: { artifactVersionId: string };
        observations: Array<{
          exactQuote: string;
          citation: {
            artifactVersionId: string;
            startLine: number;
            endLine: number;
          };
        }>;
      };
      expect(source.observations.length).toBeGreaterThan(0);
      expect(source.source.artifactVersionId).toBe(artifactVersionId);
      expect(
        source.observations.every(
          (item) =>
            item.citation.artifactVersionId === artifactVersionId &&
            item.exactQuote.length > 0 &&
            item.citation.startLine <= item.citation.endLine,
        ),
      ).toBe(true);
    } finally {
      if (local.server.listening)
        await new Promise<void>((resolve, reject) =>
          local.server.close((error) =>
            error === undefined ? resolve() : reject(error),
          ),
        );
      await local.close();
    }
  });
});
