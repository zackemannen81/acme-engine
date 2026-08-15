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

  it('resumes a live observation after provider success without a second call', async () => {
    const suffix = randomUUID();
    const sourceText =
      'AUTHORIZED ANONYMIZED TEXT\nThe court records one source-bound fact.\n';
    let providerCalls = 0;
    const observationTransport: ProviderTransport = {
      async send(request) {
        providerCalls += 1;
        expect(request.body).toContain(
          'The court records one source-bound fact.',
        );
        return {
          kind: 'response',
          status: 200,
          headers: {},
          body: JSON.stringify({
            id: `stage-a-response-${suffix}`,
            model: 'gpt-stage-a-test',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      schemaVersion: 'evidence-observe-artifact-output/1',
                      observations: [
                        {
                          kind: 'exhibit-assertion',
                          startLine: 2,
                          endLine: 2,
                          exactQuote:
                            'The court records one source-bound fact.',
                          sourceActorReference: null,
                          temporalBound: {
                            kind: 'unknown',
                            role: 'document-time',
                            reason:
                              'The cited source line supplies no exact time.',
                          },
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          }),
        };
      },
    };
    let interruptOnce = true;
    const first = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      live: {
        ...live,
        transport: observationTransport,
        afterObservationEngineCommit() {
          if (interruptOnce) {
            interruptOnce = false;
            throw new Error('injected post-provider interruption');
          }
        },
      },
    });
    let caseId: string;
    let artifactVersionId: string;
    const commandKey = `postgres-live-observe-${suffix}`;
    const liveCommand = () => ({
      schemaVersion: 'evidence-case-live-observation-command/1',
      commandKey,
      artifactVersionId,
      actorRoster: [],
      requestedBudget: { maxModelCalls: 1, costCeilingMinor: 50 },
      confirmation: {
        version: 'evidence-live-confirmation/1',
        optIn: true,
        provider: 'openai',
        model: 'gpt-stage-a-test',
        caseId,
        maxModelCalls: 1,
        costCeilingMinor: 50,
        currency: 'SEK',
        rationale: 'Bounded PostgreSQL restart proof.',
      },
    });
    try {
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
      const created = await request(
        `api/organizations/${organizationId}/cases`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-create-case-command/2',
            commandKey: `postgres-live-case-${suffix}`,
            title: 'Stage A live observation restart',
            caseReference: suffix,
            metadata: {},
            dataPolicy: 'stage-a-authorized-judicial-text',
          }),
        },
      );
      expect(created.status, await created.clone().text()).toBe(201);
      caseId = ((await created.json()) as { caseId: string }).caseId;
      const imported = await request(
        `api/cases/${encodeURIComponent(caseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              schemaVersion: 'evidence-text-import-metadata/2',
              commandKey: `postgres-live-import-${suffix}`,
              intent: { kind: 'create' },
              title: 'Live observation source',
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
                externalSourceRef: `postgres-live:${suffix}`,
                acquiredAt: '2026-08-15T10:00:00.000Z',
                parentContainer: {
                  kind: 'pdf',
                  sha256: 'c'.repeat(64),
                  byteLength: 9_876,
                },
                extraction: {
                  method: 'pypdf-text-extraction',
                  version: 'test-version',
                  extractedAt: '2026-08-15T10:01:00.000Z',
                  pageCount: 2,
                },
              },
            },
            text: sourceText,
          }),
        },
      );
      expect(imported.status, await imported.clone().text()).toBe(201);
      artifactVersionId = (
        (await imported.json()) as { artifactVersionId: string }
      ).artifactVersionId;
      const overBudget = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-observations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...liveCommand(),
            commandKey: `postgres-live-over-budget-${suffix}`,
            requestedBudget: {
              maxModelCalls: 1,
              costCeilingMinor: 101,
            },
            confirmation: {
              ...liveCommand().confirmation,
              costCeilingMinor: 101,
            },
          }),
        },
      );
      expect(overBudget.status, await overBudget.clone().text()).toBe(403);
      expect(providerCalls).toBe(0);

      const credentialValue = 'must-not-echo-stage-a-secret';
      const credentialShaped = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-observations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...liveCommand(),
            commandKey: `postgres-live-credential-${suffix}`,
            provider: { apiKey: credentialValue },
          }),
        },
      );
      expect(
        credentialShaped.status,
        await credentialShaped.clone().text(),
      ).toBe(400);
      expect(await credentialShaped.text()).not.toContain(credentialValue);
      expect(providerCalls).toBe(0);

      const foreignCreated = await request(
        `api/organizations/${organizationId}/cases`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-create-case-command/2',
            commandKey: `postgres-live-foreign-case-${suffix}`,
            title: 'Stage A foreign case',
            caseReference: `foreign-${suffix}`,
            metadata: {},
            dataPolicy: 'stage-a-authorized-judicial-text',
          }),
        },
      );
      expect(foreignCreated.status, await foreignCreated.clone().text()).toBe(
        201,
      );
      const foreignCaseId = (
        (await foreignCreated.json()) as { caseId: string }
      ).caseId;
      const foreignSource = await request(
        `api/cases/${encodeURIComponent(foreignCaseId)}/live-observations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...liveCommand(),
            commandKey: `postgres-live-foreign-source-${suffix}`,
            confirmation: {
              ...liveCommand().confirmation,
              caseId: foreignCaseId,
            },
          }),
        },
      );
      expect(foreignSource.status, await foreignSource.clone().text()).toBe(
        404,
      );
      expect(providerCalls).toBe(0);

      const launch = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-observations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(liveCommand()),
        },
      );
      expect(launch.status, await launch.clone().text()).toBe(202);
      let job = (await launch.json()) as { jobId: string; phase: string };
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        const response = await request(
          `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
        );
        job = (await response.json()) as typeof job;
      }
      expect(job).toMatchObject({
        phase: 'failed',
        reasonCode: 'LIVE_PRODUCT_PROJECTION_INTERRUPTED',
        actualModelCalls: 1,
      });
      expect(providerCalls).toBe(1);
      const beforeRestart = await first.productRepository.snapshot();
      expect(
        beforeRestart.observations.filter(
          (item) => item.artifactVersionId === artifactVersionId,
        ),
      ).toEqual([]);
    } finally {
      await stop(first);
    }

    const reopened = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      live: { ...live, transport: observationTransport },
    });
    try {
      const address = await listenEvidenceWorkbenchApi(reopened.server, {
        port: 0,
      });
      const request = await authenticatedRequest(
        address.url,
        reopened.authCredentials,
      );
      const resumed = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-observations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(liveCommand()),
        },
      );
      expect(resumed.status, await resumed.clone().text()).toBe(202);
      let job = (await resumed.json()) as { jobId: string; phase: string };
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        const response = await request(
          `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
        );
        job = (await response.json()) as typeof job;
      }
      expect(job).toMatchObject({
        phase: 'completed',
        reasonCode: 'LIVE_OBSERVATION_RESUMED',
        actualModelCalls: 1,
      });
      expect(providerCalls).toBe(1);
      const snapshot = await reopened.productRepository.snapshot();
      const observations = snapshot.observations.filter(
        (item) => item.artifactVersionId === artifactVersionId,
      );
      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({
        exactQuote: 'The court records one source-bound fact.',
        locator: { startLine: 2, endLine: 2 },
      });
      const liveAudit = snapshot.securityAudit.filter(
        (item) => item.schemaVersion === 'evidence-security-audit-event/2',
      );
      expect(liveAudit.map((item) => item.action)).toEqual(
        expect.arrayContaining([
          'live.started',
          'live.failed',
          'live.completed',
        ]),
      );
      expect(
        liveAudit.filter((item) => item.action === 'live.refused'),
      ).toHaveLength(3);
      expect(JSON.stringify(liveAudit)).not.toContain(sourceText.trim());
      expect(JSON.stringify(liveAudit)).not.toContain(
        'postgres-stage-a-test-key',
      );
    } finally {
      await stop(reopened);
    }
  });
});
