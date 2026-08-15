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
      'AUTHORIZED ANONYMIZED TEXT\nThe court records one source-bound fact.\nThe record contains a second source-bound fact.\n';
    let providerCalls = 0;
    let relationCalls = 0;
    let assessmentCalls = 0;
    const observationTransport: ProviderTransport = {
      async send(request) {
        providerCalls += 1;
        if (request.body.includes('evidence-propose-assessment-input/2')) {
          assessmentCalls += 1;
          expect(request.body).toContain(
            'The court records one source-bound fact.',
          );
          const strings: string[] = [];
          const collect = (value: unknown): void => {
            if (typeof value === 'string') strings.push(value);
            else if (Array.isArray(value)) value.forEach(collect);
            else if (typeof value === 'object' && value !== null)
              Object.values(value).forEach(collect);
          };
          collect(JSON.parse(request.body));
          const encodedInput = strings.find((value) =>
            value.includes('evidence-propose-assessment-input/2'),
          );
          if (encodedInput === undefined)
            throw new Error('Assessment provider input was missing.');
          const assessmentInput = JSON.parse(encodedInput) as {
            acceptedObservations: Array<{
              observationId: string;
              artifactVersionId: string;
              locator: { locatorId: string };
            }>;
            acceptedRelations: Array<{ relationId: string }>;
            acceptedOpenQuestions: Array<{ openQuestionId: string }>;
          };
          const cited = assessmentInput.acceptedObservations[0];
          if (cited === undefined)
            throw new Error('Assessment request was not source-complete.');
          expect(assessmentInput.acceptedRelations.length).toBeGreaterThan(0);
          return {
            kind: 'response',
            status: 200,
            headers: {},
            body: JSON.stringify({
              id: `stage-a-assessment-response-${suffix}-${assessmentCalls}`,
              model: 'gpt-stage-a-test',
              status: 'completed',
              output: [
                {
                  type: 'message',
                  content: [
                    {
                      type: 'output_text',
                      text: JSON.stringify({
                        schemaVersion: 'evidence-propose-assessment-output/1',
                        claims: [
                          {
                            claimKey: `stage-a-assessment-${assessmentCalls}`,
                            text: 'The authorized record contains a source-bound fact.',
                            supportObservationIds: [cited.observationId],
                            conflictRelationIds: [],
                            qualificationRelationIds: [],
                            supportUnresolved: false,
                            uncertainty: 'medium',
                            uncertaintyRationale:
                              'The claim is limited to the cited record.',
                          },
                        ],
                        openQuestionIds: assessmentInput.acceptedOpenQuestions
                          .slice(0, 1)
                          .map((item) => item.openQuestionId),
                        citations: [
                          {
                            evidenceId: cited.observationId,
                            artifactVersionId: cited.artifactVersionId,
                            locatorId: cited.locator.locatorId,
                          },
                        ],
                      }),
                    },
                  ],
                },
              ],
              usage: {
                input_tokens: 180,
                output_tokens: 70,
                total_tokens: 250,
              },
            }),
          };
        }
        if (request.body.includes('evidence-relate-observations-input/1')) {
          relationCalls += 1;
          const observationIds = [
            ...new Set(
              request.body.match(/evidence_observation_[a-f0-9]+/gu) ?? [],
            ),
          ].sort();
          expect(observationIds).toHaveLength(2);
          return {
            kind: 'response',
            status: 200,
            headers: {},
            body: JSON.stringify({
              id: `stage-a-relation-response-${suffix}`,
              model: 'gpt-stage-a-test',
              status: 'completed',
              output: [
                {
                  type: 'message',
                  content: [
                    {
                      type: 'output_text',
                      text: JSON.stringify({
                        schemaVersion: 'evidence-relate-observations-output/1',
                        propositions: [],
                        events: [],
                        relations: [
                          {
                            relationKind: 'supports',
                            endpoints: observationIds.map((id) => ({
                              kind: 'observation',
                              id,
                            })),
                            comparableScope: {
                              subject: 'the judicial record',
                              aspect: 'recorded source-bound facts',
                              actorReferenceKeys: [],
                              temporalObservationIds: [],
                            },
                            rationaleCode: 'STAGE_A_FACTS_CO_RECORDED',
                            rationale:
                              'Both cited observations occur in the same authorized record.',
                          },
                        ],
                        openQuestions: [
                          {
                            questionCode: 'STAGE_A_CONTEXT_NEEDED',
                            questionText:
                              'What additional source context connects the two recorded facts?',
                            triggeringObservationIds: [],
                            triggeringRelationRationaleCodes: [
                              'STAGE_A_FACTS_CO_RECORDED',
                            ],
                          },
                        ],
                      }),
                    },
                  ],
                },
              ],
              usage: {
                input_tokens: 150,
                output_tokens: 80,
                total_tokens: 230,
              },
            }),
          };
        }
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
                      schemaVersion: 'evidence-observe-artifact-output/3',
                      observations: [
                        {
                          kind: 'exhibit-assertion',
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
                        {
                          kind: 'exhibit-assertion',
                          exactQuote:
                            'The record contains a second source-bound fact.',
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
    const relationCommand = () => ({
      schemaVersion: 'evidence-case-live-relation-command/1',
      commandKey: `postgres-live-relate-${suffix}`,
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
        rationale: 'Bounded Stage A relation restart proof.',
      },
    });
    const assessmentCommand = (
      commandKey = `postgres-live-assess-${suffix}`,
    ) => ({
      schemaVersion: 'evidence-case-live-assessment-command/1',
      commandKey,
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
        rationale: 'Bounded Stage A assessment restart proof.',
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
      live: {
        ...live,
        transport: observationTransport,
        afterRelationEngineCommit() {
          throw new Error('injected relation projection interruption');
        },
      },
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
      expect(observations).toHaveLength(2);
      expect(observations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            exactQuote: 'The court records one source-bound fact.',
            locator: expect.objectContaining({ startLine: 2, endLine: 2 }),
          }),
          expect.objectContaining({
            exactQuote: 'The record contains a second source-bound fact.',
            locator: expect.objectContaining({ startLine: 3, endLine: 3 }),
          }),
        ]),
      );
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
      const relationOverBudget = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-relations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...relationCommand(),
            commandKey: `postgres-live-relate-over-budget-${suffix}`,
            requestedBudget: { maxModelCalls: 1, costCeilingMinor: 101 },
            confirmation: {
              ...relationCommand().confirmation,
              costCeilingMinor: 101,
            },
          }),
        },
      );
      expect(
        relationOverBudget.status,
        await relationOverBudget.clone().text(),
      ).toBe(403);
      expect(relationCalls).toBe(0);
      const relationCredential = 'must-not-echo-relation-secret';
      const relationCredentialResponse = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-relations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...relationCommand(),
            commandKey: `postgres-live-relate-credential-${suffix}`,
            apiKey: relationCredential,
          }),
        },
      );
      expect(
        relationCredentialResponse.status,
        await relationCredentialResponse.clone().text(),
      ).toBe(400);
      expect(await relationCredentialResponse.text()).not.toContain(
        relationCredential,
      );
      expect(relationCalls).toBe(0);
      const foreignRelation = await request(
        `api/cases/${encodeURIComponent(reopened.caseId)}/live-relations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...relationCommand(),
            commandKey: `postgres-live-relate-foreign-${suffix}`,
            confirmation: {
              ...relationCommand().confirmation,
              caseId: reopened.caseId,
            },
          }),
        },
      );
      expect(foreignRelation.status).toBe(403);
      expect(relationCalls).toBe(0);
      const relationLaunch = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-relations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(relationCommand()),
        },
      );
      expect(relationLaunch.status, await relationLaunch.clone().text()).toBe(
        202,
      );
      let relationJob = (await relationLaunch.json()) as {
        jobId: string;
        phase: string;
      };
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(
          relationJob.phase,
        )
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        relationJob = (await (
          await request(
            `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(relationJob.jobId)}`,
          )
        ).json()) as typeof relationJob;
      }
      expect(relationJob).toMatchObject({
        phase: 'failed',
        reasonCode: 'LIVE_RELATION_PRODUCT_PROJECTION_INTERRUPTED',
        actualModelCalls: 1,
      });
      expect(relationCalls).toBe(1);
      expect((await reopened.productRepository.snapshot()).relations).toEqual(
        [],
      );
    } finally {
      await stop(reopened);
    }

    let assessmentInterruptOnce = true;
    const relationReopened = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      live: {
        ...live,
        transport: observationTransport,
        afterAssessmentEngineCommit() {
          if (assessmentInterruptOnce) {
            assessmentInterruptOnce = false;
            throw new Error('injected assessment projection interruption');
          }
        },
      },
    });
    try {
      const address = await listenEvidenceWorkbenchApi(
        relationReopened.server,
        {
          port: 0,
        },
      );
      const request = await authenticatedRequest(
        address.url,
        relationReopened.authCredentials,
      );
      const response = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-relations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(relationCommand()),
        },
      );
      expect(response.status, await response.clone().text()).toBe(202);
      let job = (await response.json()) as { jobId: string; phase: string };
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        job = (await (
          await request(
            `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
          )
        ).json()) as typeof job;
      }
      expect(job).toMatchObject({
        phase: 'completed',
        reasonCode: 'LIVE_RELATION_RESUMED',
        actualModelCalls: 1,
      });
      expect(relationCalls).toBe(1);
      const snapshot = await relationReopened.productRepository.snapshot();
      expect(snapshot.relations).toHaveLength(1);
      expect(snapshot.openQuestions).toHaveLength(1);
      expect(
        snapshot.securityAudit
          .filter(
            (item) => item.schemaVersion === 'evidence-security-audit-event/3',
          )
          .map((item) => item.action),
      ).toEqual(
        expect.arrayContaining([
          'live-relation.started',
          'live-relation.failed',
          'live-relation.completed',
        ]),
      );
      const relationAudit = snapshot.securityAudit.filter(
        (item) => item.schemaVersion === 'evidence-security-audit-event/3',
      );
      expect(
        relationAudit.filter((item) => item.action === 'live-relation.refused'),
      ).toHaveLength(3);
      expect(JSON.stringify(relationAudit)).not.toContain(sourceText.trim());
      const reviewTargets = [
        ...snapshot.observations.map((item) => ({
          kind: 'observation' as const,
          id: item.observationId,
        })),
        ...snapshot.relations.map((item) => ({
          kind: 'relation' as const,
          id: item.relationId,
        })),
      ];
      for (const target of reviewTargets) {
        const reviewed = await request(
          `api/cases/${encodeURIComponent(caseId)}/reviews`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              schemaVersion: 'evidence-review-command/3',
              commandKey: `review-${target.kind}-${target.id}`,
              targetKind: target.kind,
              targetVersionId: target.id,
              action: 'accept',
              rationale: 'Accepted against the exact Stage A source.',
              basisEvidenceRevision: null,
            }),
          },
        );
        expect(reviewed.status, await reviewed.clone().text()).toBe(201);
      }
      const assessmentOverBudget = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-assessments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...assessmentCommand(`assessment-over-budget-${suffix}`),
            requestedBudget: { maxModelCalls: 1, costCeilingMinor: 101 },
            confirmation: {
              ...assessmentCommand().confirmation,
              costCeilingMinor: 101,
            },
          }),
        },
      );
      expect(assessmentOverBudget.status).toBe(403);
      expect(assessmentCalls).toBe(0);
      const assessmentCredential = 'must-not-echo-assessment-secret';
      const assessmentCredentialResponse = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-assessments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...assessmentCommand(`assessment-credential-${suffix}`),
            credential: { apiKey: assessmentCredential },
          }),
        },
      );
      expect(assessmentCredentialResponse.status).toBe(400);
      expect(await assessmentCredentialResponse.text()).not.toContain(
        assessmentCredential,
      );
      expect(assessmentCalls).toBe(0);
      const foreignAssessment = await request(
        `api/cases/${encodeURIComponent(relationReopened.caseId)}/live-assessments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...assessmentCommand(`assessment-foreign-${suffix}`),
            confirmation: {
              ...assessmentCommand().confirmation,
              caseId: relationReopened.caseId,
            },
          }),
        },
      );
      expect(foreignAssessment.status).toBe(403);
      expect(assessmentCalls).toBe(0);
      const assessmentLaunch = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-assessments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(assessmentCommand()),
        },
      );
      expect(
        assessmentLaunch.status,
        await assessmentLaunch.clone().text(),
      ).toBe(202);
      let assessmentJob = (await assessmentLaunch.json()) as {
        jobId: string;
        phase: string;
      };
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(
          assessmentJob.phase,
        )
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        assessmentJob = (await (
          await request(
            `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(assessmentJob.jobId)}`,
          )
        ).json()) as typeof assessmentJob;
      }
      expect(assessmentJob).toMatchObject({
        phase: 'failed',
        reasonCode: 'LIVE_ASSESSMENT_PRODUCT_PROJECTION_INTERRUPTED',
        actualModelCalls: 1,
      });
      expect(assessmentCalls).toBe(1);
      expect(
        (await relationReopened.productRepository.snapshot()).assessments,
      ).toEqual([]);
    } finally {
      await stop(relationReopened);
    }

    const assessmentReopened = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      live: { ...live, transport: observationTransport },
    });
    try {
      const address = await listenEvidenceWorkbenchApi(
        assessmentReopened.server,
        { port: 0 },
      );
      const request = await authenticatedRequest(
        address.url,
        assessmentReopened.authCredentials,
      );
      const resumed = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-assessments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(assessmentCommand()),
        },
      );
      expect(resumed.status, await resumed.clone().text()).toBe(202);
      let job = (await resumed.json()) as { jobId: string; phase: string };
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        job = (await (
          await request(
            `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
          )
        ).json()) as typeof job;
      }
      expect(job).toMatchObject({
        phase: 'completed',
        reasonCode: 'LIVE_ASSESSMENT_RESUMED',
        actualModelCalls: 1,
      });
      expect(assessmentCalls).toBe(1);
      let snapshot = await assessmentReopened.productRepository.snapshot();
      const firstAssessment = snapshot.assessments[0];
      if (firstAssessment === undefined)
        throw new Error('Missing first live assessment.');
      const evidenceRevisionAfterAssessment = snapshot.workspaces.find(
        (item) => item.workspaceId === firstAssessment.workspaceId,
      )?.evidenceRevision;
      if (evidenceRevisionAfterAssessment === undefined)
        throw new Error('Missing assessment workspace revision.');
      expect(evidenceRevisionAfterAssessment).toBe(
        firstAssessment.basisEvidenceRevision,
      );
      const reviewed = await request(
        `api/cases/${encodeURIComponent(caseId)}/reviews`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-review-command/3',
            commandKey: `review-first-assessment-${suffix}`,
            targetKind: 'assessment',
            targetVersionId: firstAssessment.assessmentVersionId,
            action: 'accept',
            rationale: 'Reviewed every claim against its source citation.',
            basisEvidenceRevision: null,
          }),
        },
      );
      expect(reviewed.status, await reviewed.clone().text()).toBe(201);

      const laterImport = await request(
        `api/cases/${encodeURIComponent(caseId)}/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              schemaVersion: 'evidence-text-import-metadata/2',
              commandKey: `postgres-live-later-import-${suffix}`,
              intent: { kind: 'create' },
              title: 'Later Stage A evidence',
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
                externalSourceRef: `postgres-live:later:${suffix}`,
                acquiredAt: '2026-08-15T11:00:00.000Z',
                parentContainer: {
                  kind: 'pdf',
                  sha256: 'd'.repeat(64),
                  byteLength: 8_765,
                },
                extraction: {
                  method: 'pypdf-text-extraction',
                  version: 'test-version',
                  extractedAt: '2026-08-15T11:01:00.000Z',
                  pageCount: 2,
                },
              },
            },
            text: sourceText,
          }),
        },
      );
      expect(laterImport.status, await laterImport.clone().text()).toBe(201);
      const laterArtifactVersionId = (
        (await laterImport.json()) as { artifactVersionId: string }
      ).artifactVersionId;
      const laterObservationCommand = {
        ...liveCommand(),
        commandKey: `postgres-live-later-observe-${suffix}`,
        artifactVersionId: laterArtifactVersionId,
      };
      const laterLaunch = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-observations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(laterObservationCommand),
        },
      );
      expect(laterLaunch.status, await laterLaunch.clone().text()).toBe(202);
      job = (await laterLaunch.json()) as typeof job;
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        job = (await (
          await request(
            `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
          )
        ).json()) as typeof job;
      }
      expect(job.phase).toBe('completed');
      snapshot = await assessmentReopened.productRepository.snapshot();
      for (const observation of snapshot.observations.filter(
        (item) => item.artifactVersionId === laterArtifactVersionId,
      )) {
        const response = await request(
          `api/cases/${encodeURIComponent(caseId)}/reviews`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              schemaVersion: 'evidence-review-command/3',
              commandKey: `review-later-${observation.observationId}`,
              targetKind: 'observation',
              targetVersionId: observation.observationId,
              action: 'accept',
              rationale: 'Accepted later evidence against source.',
              basisEvidenceRevision: null,
            }),
          },
        );
        expect(response.status, await response.clone().text()).toBe(201);
      }
      const staleView = await request(
        `api/cases/${encodeURIComponent(caseId)}/assessments/${encodeURIComponent(firstAssessment.assessmentVersionId)}`,
      );
      expect(staleView.status, await staleView.clone().text()).toBe(200);
      expect(await staleView.json()).toMatchObject({ dueForAttention: true });
      const successorLaunch = await request(
        `api/cases/${encodeURIComponent(caseId)}/live-assessments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            assessmentCommand(`postgres-live-reassess-${suffix}`),
          ),
        },
      );
      expect(successorLaunch.status, await successorLaunch.clone().text()).toBe(
        202,
      );
      job = (await successorLaunch.json()) as typeof job;
      while (
        !['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        job = (await (
          await request(
            `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
          )
        ).json()) as typeof job;
      }
      expect(job.phase).toBe('completed');
      expect(assessmentCalls).toBe(2);
      snapshot = await assessmentReopened.productRepository.snapshot();
      expect(snapshot.assessments).toHaveLength(2);
      const successor = snapshot.assessments.find(
        (item) => item.sequence === 2,
      );
      expect(successor).toMatchObject({
        predecessorAssessmentVersionId: firstAssessment.assessmentVersionId,
        basisEvidenceRevision: evidenceRevisionAfterAssessment + 1,
      });
      if (successor === undefined)
        throw new Error('Missing successor assessment.');
      const successorReview = await request(
        `api/cases/${encodeURIComponent(caseId)}/reviews`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-review-command/3',
            commandKey: `review-successor-assessment-${suffix}`,
            targetKind: 'assessment',
            targetVersionId: successor.assessmentVersionId,
            action: 'accept',
            rationale: 'Reviewed the successor against its expanded citations.',
            basisEvidenceRevision: null,
          }),
        },
      );
      expect(successorReview.status, await successorReview.clone().text()).toBe(
        201,
      );
      snapshot = await assessmentReopened.productRepository.snapshot();
      expect(
        snapshot.reviewDecisions.some(
          (item) =>
            item.targetVersionId === firstAssessment.assessmentVersionId &&
            item.action === 'accept',
        ),
      ).toBe(true);
      expect(
        snapshot.reviewDecisions.some(
          (item) =>
            item.targetVersionId === successor.assessmentVersionId &&
            item.action === 'accept',
        ),
      ).toBe(true);
      expect(
        snapshot.securityAudit
          .filter(
            (item) => item.schemaVersion === 'evidence-security-audit-event/4',
          )
          .map((item) => item.action),
      ).toEqual(
        expect.arrayContaining([
          'live-assessment.started',
          'live-assessment.failed',
          'live-assessment.completed',
          'live-assessment.refused',
        ]),
      );
    } finally {
      await stop(assessmentReopened);
    }
  }, 30_000);
});
