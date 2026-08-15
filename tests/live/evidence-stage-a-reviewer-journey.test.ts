import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { listenEvidenceWorkbenchApi } from '../../apps/evidence-workbench-api/src/index.js';
import { createLocalEvidenceWorkbench } from '../../apps/evidence-workbench-api/src/local.js';

const ENABLED = process.env['ACME_EVIDENCE_STAGE_A_REVIEWER_LIVE'] === '1';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Stage A reviewer acceptance requires ${name}.`);
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer.`);
  return value;
}

interface SourceInput {
  readonly text: string;
  readonly title: string;
  readonly externalSourceRef: string;
  readonly canonicalSha256: string;
  readonly canonicalByteLength: number;
  readonly parentSha256: string;
  readonly parentByteLength: number;
  readonly pageCount: number;
  readonly extractionVersion: string;
  readonly acquiredAt: string;
  readonly extractedAt: string;
}

async function sourceInput(prefix: 'D1' | 'D2'): Promise<SourceInput> {
  const name = `ACME_EVIDENCE_STAGE_A_${prefix}`;
  const bytes = await readFile(required(`${name}_SOURCE_FILE`));
  const text = bytes.toString('utf8');
  const canonicalSha256 = required(`${name}_CANONICAL_SHA256`);
  const parentSha256 = required(`${name}_PARENT_SHA256`);
  if (!/^[a-f0-9]{64}$/u.test(canonicalSha256))
    throw new Error(`${name}_CANONICAL_SHA256 must be lowercase SHA-256.`);
  if (!/^[a-f0-9]{64}$/u.test(parentSha256))
    throw new Error(`${name}_PARENT_SHA256 must be lowercase SHA-256.`);
  const canonicalByteLength = positiveInteger(`${name}_CANONICAL_BYTE_LENGTH`);
  if (bytes.byteLength !== canonicalByteLength)
    throw new Error(`${prefix} canonical byte length does not match.`);
  if (createHash('sha256').update(bytes).digest('hex') !== canonicalSha256)
    throw new Error(`${prefix} canonical digest does not match.`);
  return {
    text,
    title: required(`${name}_SOURCE_TITLE`),
    externalSourceRef: required(`${name}_SOURCE_REF`),
    canonicalSha256,
    canonicalByteLength,
    parentSha256,
    parentByteLength: positiveInteger(`${name}_PARENT_BYTE_LENGTH`),
    pageCount: positiveInteger(`${name}_PAGE_COUNT`),
    extractionVersion: required(`${name}_EXTRACTION_VERSION`),
    acquiredAt: required(`${name}_ACQUIRED_AT`),
    extractedAt: required(`${name}_EXTRACTED_AT`),
  };
}

async function stop(
  local: Awaited<ReturnType<typeof createLocalEvidenceWorkbench>>,
) {
  if (local.server.listening)
    await new Promise<void>((resolve, reject) =>
      local.server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  await local.close();
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

type Request = Awaited<ReturnType<typeof login>>;

async function postJson(
  request: Request,
  pathname: string,
  body: unknown,
  expectedStatus: number,
) {
  const response = await request(pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.status, await response.clone().text()).toBe(expectedStatus);
  return response;
}

async function pollJob(
  request: Request,
  caseId: string,
  launch: Response,
  expectedReasonCode: string,
) {
  let job = (await launch.json()) as {
    jobId: string;
    phase: string;
    reasonCode: string | null;
    actualModelCalls: number;
  };
  const deadline = Date.now() + 10 * 60_000;
  while (!['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)) {
    if (Date.now() > deadline) throw new Error('Stage A live job timed out.');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const response = await request(
      `api/cases/${encodeURIComponent(caseId)}/jobs/${encodeURIComponent(job.jobId)}`,
    );
    expect(response.status, await response.clone().text()).toBe(200);
    job = (await response.json()) as typeof job;
  }
  expect(job).toMatchObject({
    phase: 'completed',
    reasonCode: expectedReasonCode,
    actualModelCalls: 1,
  });
  return job;
}

async function importSource(input: {
  readonly request: Request;
  readonly caseId: string;
  readonly source: SourceInput;
  readonly commandKey: string;
}) {
  const response = await postJson(
    input.request,
    `api/cases/${encodeURIComponent(input.caseId)}/text-imports`,
    {
      metadata: {
        schemaVersion: 'evidence-text-import-metadata/2',
        commandKey: input.commandKey,
        intent: { kind: 'create' },
        title: input.source.title,
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
          externalSourceRef: input.source.externalSourceRef,
          acquiredAt: input.source.acquiredAt,
          parentContainer: {
            kind: 'pdf',
            sha256: input.source.parentSha256,
            byteLength: input.source.parentByteLength,
          },
          extraction: {
            method: 'pypdf-text-extraction',
            version: input.source.extractionVersion,
            extractedAt: input.source.extractedAt,
            pageCount: input.source.pageCount,
          },
        },
      },
      text: input.source.text,
    },
    201,
  );
  const imported = (await response.json()) as {
    artifactVersionId: string;
    canonicalSha256: string;
  };
  expect(imported.canonicalSha256).toBe(input.source.canonicalSha256);
  return imported.artifactVersionId;
}

async function review(
  request: Request,
  caseId: string,
  input: {
    readonly commandKey: string;
    readonly targetKind: 'observation' | 'relation' | 'assessment';
    readonly targetVersionId: string;
    readonly action:
      'accept' | 'reject' | 'leave-unresolved' | 'request-revision';
  },
) {
  await postJson(
    request,
    `api/cases/${encodeURIComponent(caseId)}/reviews`,
    {
      schemaVersion: 'evidence-review-command/3',
      ...input,
      rationale: 'Reviewed against the exact authorized Stage A source.',
      basisEvidenceRevision: null,
    },
    201,
  );
}

async function sourceObservations(
  request: Request,
  caseId: string,
  artifactVersionId: string,
) {
  const response = await request(
    `api/cases/${encodeURIComponent(caseId)}/sources/${encodeURIComponent(artifactVersionId)}`,
  );
  expect(response.status, await response.clone().text()).toBe(200);
  const source = (await response.json()) as {
    source: { artifactVersionId: string };
    observations: Array<{
      observationId: string;
      exactQuote: string;
      citation: {
        artifactVersionId: string;
        locatorId: string;
        startLine: number;
        endLine: number;
      };
    }>;
  };
  expect(source.source.artifactVersionId).toBe(artifactVersionId);
  expect(source.observations.length).toBeGreaterThan(0);
  expect(
    source.observations.every(
      ({ exactQuote, citation }) =>
        exactQuote.length > 0 &&
        !/[\r\n]/u.test(exactQuote) &&
        citation.artifactVersionId === artifactVersionId &&
        citation.startLine === citation.endLine,
    ),
  ).toBe(true);
  return source.observations;
}

function executionCommand(input: {
  readonly kind: 'observation' | 'relation' | 'assessment';
  readonly commandKey: string;
  readonly caseId: string;
  readonly model: string;
  readonly costCeilingMinor: number;
  readonly artifactVersionId?: string;
}) {
  const noun =
    input.kind === 'observation'
      ? 'observation'
      : input.kind === 'relation'
        ? 'relation'
        : 'assessment';
  return {
    schemaVersion: `evidence-case-live-${noun}-command/1`,
    commandKey: input.commandKey,
    ...(input.artifactVersionId === undefined
      ? {}
      : { artifactVersionId: input.artifactVersionId, actorRoster: [] }),
    requestedBudget: {
      maxModelCalls: 1,
      costCeilingMinor: input.costCeilingMinor,
    },
    confirmation: {
      version: 'evidence-live-confirmation/1',
      optIn: true,
      provider: 'openai',
      model: input.model,
      caseId: input.caseId,
      maxModelCalls: 1,
      costCeilingMinor: input.costCeilingMinor,
      currency: 'SEK',
      rationale: `Explicit bounded Stage A ${noun} product acceptance.`,
    },
  };
}

async function launchExecution(input: {
  readonly request: Request;
  readonly caseId: string;
  readonly kind: 'observation' | 'relation' | 'assessment';
  readonly commandKey: string;
  readonly model: string;
  readonly costCeilingMinor: number;
  readonly artifactVersionId?: string;
}) {
  const plural =
    input.kind === 'observation'
      ? 'observations'
      : input.kind === 'relation'
        ? 'relations'
        : 'assessments';
  const launch = await postJson(
    input.request,
    `api/cases/${encodeURIComponent(input.caseId)}/live-${plural}`,
    executionCommand(input),
    202,
  );
  return pollJob(
    input.request,
    input.caseId,
    launch,
    `LIVE_${input.kind.toUpperCase()}_COMPLETED`,
  );
}

async function relationView(request: Request, caseId: string) {
  const response = await request(
    `api/cases/${encodeURIComponent(caseId)}/relations`,
  );
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as {
    metrics: { relationTotal: number; openQuestionTotal: number };
    relations: Array<{
      relationVersionId: string;
      relationKind: string;
      reviewStanding: string;
      endpoints: unknown[];
    }>;
    openQuestions: Array<{
      openQuestionId: string;
      triggeringEvidenceIds: string[];
    }>;
  };
}

async function assessmentView(
  request: Request,
  caseId: string,
  assessmentVersionId: string = 'latest',
) {
  const response = await request(
    `api/cases/${encodeURIComponent(caseId)}/assessments/${encodeURIComponent(assessmentVersionId)}`,
  );
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as {
    assessment: {
      assessmentVersionId: string;
      sequence: number;
      predecessorAssessmentVersionId: string | null;
    };
    claims: Array<{
      claimKey: string;
      uncertainty: 'low' | 'medium' | 'high';
      supportCitations: unknown[];
      conflictCitations: unknown[];
      qualificationCitations: unknown[];
    }>;
    openQuestions: unknown[];
    reviewStanding: string;
    shareable: boolean;
    dueForAttention: boolean;
    reviewHistoryPath: string;
  };
}

describe.skipIf(!ENABLED)('Evidence Stage A live reviewer journey', () => {
  it(
    'persists a reviewed assessment, marks it stale and reviews its successor',
    async () => {
      if (process.env['ACME_LIVE_TEST'] !== '1')
        throw new Error(
          'Stage A reviewer acceptance requires ACME_LIVE_TEST=1.',
        );
      if (process.env['ACME_HOSTED'] !== '1')
        throw new Error('Stage A reviewer acceptance requires ACME_HOSTED=1.');
      required('OPENAI_API_KEY');
      required('ACME_POSTGRES_URL');
      required('ACME_EVIDENCE_PAYLOAD_KEY_FILE');
      required('ACME_ARTIFACT_KEK_FILE');
      if (required('ACME_ARTIFACT_STORE').toLowerCase() !== 's3')
        throw new Error(
          'Stage A reviewer acceptance requires ACME_ARTIFACT_STORE=s3.',
        );

      const [d1, d2] = await Promise.all([
        sourceInput('D1'),
        sourceInput('D2'),
      ]);
      expect(d1.parentSha256).not.toBe(d2.parentSha256);
      expect(d1.canonicalSha256).not.toBe(d2.canonicalSha256);
      expect(d1.externalSourceRef).not.toBe(d2.externalSourceRef);
      const model = required('ACME_EVIDENCE_LIVE_MODEL');
      const costCeilingMinor = positiveInteger(
        'ACME_EVIDENCE_LIVE_COST_CEILING_MINOR',
      );
      expect(required('ACME_EVIDENCE_LIVE_CURRENCY')).toBe('SEK');
      const stamp = `${Date.now()}-${randomUUID()}`;
      const live = {
        liveOptIn: true,
        hosted: true,
        profile: 'evidence-poc1-live/1',
        model,
        apiKey: required('OPENAI_API_KEY'),
        deploymentMaxModelCalls: 1,
        deploymentCostCeilingMinor: costCeilingMinor,
        deploymentCurrency: 'SEK',
      } as const;

      let caseId: string;
      let d1ArtifactVersionId: string;
      let firstAssessmentVersionId: string;
      const first = await createLocalEvidenceWorkbench({
        persistence: 'postgres',
        seedMode: 'none',
        live,
      });
      try {
        const address = await listenEvidenceWorkbenchApi(first.server, {
          port: 0,
        });
        const request = await login(address.url, first.authCredentials);
        const identity = await first.identityRepository.snapshot();
        const organizationId = identity.organizations[0]?.organizationId;
        if (organizationId === undefined)
          throw new Error('Missing organization.');
        const created = await postJson(
          request,
          `api/organizations/${organizationId}/cases`,
          {
            schemaVersion: 'evidence-create-case-command/2',
            commandKey: `stage-a-reviewer-case-${stamp}`,
            title: 'Stage A live reviewer acceptance',
            caseReference: `STAGE-A-REVIEW-${stamp}`,
            metadata: { acceptance: 'ACME-0123' },
            dataPolicy: 'stage-a-authorized-judicial-text',
          },
          201,
        );
        caseId = ((await created.json()) as { caseId: string }).caseId;
        d1ArtifactVersionId = await importSource({
          request,
          caseId,
          source: d1,
          commandKey: `stage-a-reviewer-d1-import-${stamp}`,
        });
        await launchExecution({
          request,
          caseId,
          kind: 'observation',
          commandKey: `stage-a-reviewer-d1-observe-${stamp}`,
          artifactVersionId: d1ArtifactVersionId,
          model,
          costCeilingMinor,
        });
        const observations = await sourceObservations(
          request,
          caseId,
          d1ArtifactVersionId,
        );
        expect(observations.length).toBeGreaterThanOrEqual(4);
        for (const [index, observation] of observations.entries()) {
          await review(request, caseId, {
            commandKey: `stage-a-reviewer-d1-review-${String(index)}-${stamp}`,
            targetKind: 'observation',
            targetVersionId: observation.observationId,
            action:
              index === 0
                ? 'reject'
                : index === 1
                  ? 'leave-unresolved'
                  : 'accept',
          });
        }
        for (const [index, expectedAction] of [
          'reject',
          'leave-unresolved',
        ].entries()) {
          const history = await request(
            `api/cases/${encodeURIComponent(caseId)}/reviews/observation/${encodeURIComponent(observations[index]!.observationId)}`,
          );
          expect(history.status, await history.clone().text()).toBe(200);
          expect(await history.json()).toMatchObject({
            decisions: [expect.objectContaining({ action: expectedAction })],
          });
        }
        await launchExecution({
          request,
          caseId,
          kind: 'relation',
          commandKey: `stage-a-reviewer-d1-relate-${stamp}`,
          model,
          costCeilingMinor,
        });
        const relations = await relationView(request, caseId);
        expect(relations.metrics.relationTotal).toBeGreaterThan(0);
        expect(relations.metrics.openQuestionTotal).toBeGreaterThan(0);
        expect(relations.openQuestions.length).toBe(
          relations.metrics.openQuestionTotal,
        );
        for (const [index, relation] of relations.relations.entries()) {
          expect(relation.endpoints.length).toBeGreaterThan(1);
          await review(request, caseId, {
            commandKey: `stage-a-reviewer-d1-relation-review-${String(index)}-${stamp}`,
            targetKind: 'relation',
            targetVersionId: relation.relationVersionId,
            action: 'accept',
          });
        }
        const timeline = await request(
          `api/cases/${encodeURIComponent(caseId)}/timeline`,
        );
        expect(timeline.status, await timeline.clone().text()).toBe(200);
        await launchExecution({
          request,
          caseId,
          kind: 'assessment',
          commandKey: `stage-a-reviewer-d1-assess-${stamp}`,
          model,
          costCeilingMinor,
        });
        let firstAssessment = await assessmentView(request, caseId);
        firstAssessmentVersionId =
          firstAssessment.assessment.assessmentVersionId;
        expect(firstAssessment.assessment.sequence).toBe(1);
        expect(firstAssessment.claims.length).toBeGreaterThan(0);
        expect(
          firstAssessment.claims.every(
            (claim) => claim.supportCitations.length > 0,
          ),
        ).toBe(true);
        expect(firstAssessment.openQuestions.length).toBeGreaterThan(0);
        await review(request, caseId, {
          commandKey: `stage-a-reviewer-first-assessment-review-${stamp}`,
          targetKind: 'assessment',
          targetVersionId: firstAssessmentVersionId,
          action: 'accept',
        });
        firstAssessment = await assessmentView(
          request,
          caseId,
          firstAssessmentVersionId,
        );
        expect(firstAssessment).toMatchObject({
          reviewStanding: 'accepted',
          shareable: true,
          dueForAttention: false,
        });
      } finally {
        await stop(first);
      }

      let secondAssessmentVersionId: string;
      const reopened = await createLocalEvidenceWorkbench({
        persistence: 'postgres',
        seedMode: 'none',
        live,
      });
      try {
        const address = await listenEvidenceWorkbenchApi(reopened.server, {
          port: 0,
        });
        const request = await login(address.url, reopened.authCredentials);
        expect(
          await assessmentView(request, caseId, firstAssessmentVersionId),
        ).toMatchObject({ shareable: true, dueForAttention: false });
        const primaryPage = await request('');
        expect(primaryPage.status).toBe(200);
        const primaryHtml = await primaryPage.text();
        for (const label of [
          'Sources',
          'Observations',
          'Relations',
          'Timeline',
          'Questions',
          'Assessment',
        ]) {
          expect(primaryHtml).toContain(label);
        }
        expect(
          (
            await request(
              `api/cases/${encodeURIComponent(caseId)}/technical/provenance`,
            )
          ).status,
        ).toBe(404);

        const d2ArtifactVersionId = await importSource({
          request,
          caseId,
          source: d2,
          commandKey: `stage-a-reviewer-d2-import-${stamp}`,
        });
        await launchExecution({
          request,
          caseId,
          kind: 'observation',
          commandKey: `stage-a-reviewer-d2-observe-${stamp}`,
          artifactVersionId: d2ArtifactVersionId,
          model,
          costCeilingMinor,
        });
        const laterObservations = await sourceObservations(
          request,
          caseId,
          d2ArtifactVersionId,
        );
        for (const [index, observation] of laterObservations.entries()) {
          await review(request, caseId, {
            commandKey: `stage-a-reviewer-d2-review-${String(index)}-${stamp}`,
            targetKind: 'observation',
            targetVersionId: observation.observationId,
            action: 'accept',
          });
        }
        expect(
          await assessmentView(request, caseId, firstAssessmentVersionId),
        ).toMatchObject({ shareable: true, dueForAttention: true });
        await launchExecution({
          request,
          caseId,
          kind: 'relation',
          commandKey: `stage-a-reviewer-d2-relate-${stamp}`,
          model,
          costCeilingMinor,
        });
        const updatedRelations = await relationView(request, caseId);
        expect(updatedRelations.metrics.relationTotal).toBeGreaterThan(0);
        expect(updatedRelations.metrics.openQuestionTotal).toBeGreaterThan(0);
        for (const [index, relation] of updatedRelations.relations
          .filter(({ reviewStanding }) => reviewStanding === 'awaiting-review')
          .entries()) {
          await review(request, caseId, {
            commandKey: `stage-a-reviewer-d2-relation-review-${String(index)}-${stamp}`,
            targetKind: 'relation',
            targetVersionId: relation.relationVersionId,
            action: 'accept',
          });
        }
        await launchExecution({
          request,
          caseId,
          kind: 'assessment',
          commandKey: `stage-a-reviewer-d2-assess-${stamp}`,
          model,
          costCeilingMinor,
        });
        let secondAssessment = await assessmentView(request, caseId);
        secondAssessmentVersionId =
          secondAssessment.assessment.assessmentVersionId;
        expect(secondAssessment.assessment).toMatchObject({
          sequence: 2,
          predecessorAssessmentVersionId: firstAssessmentVersionId,
        });
        expect(secondAssessment.claims.length).toBeGreaterThan(0);
        expect(
          secondAssessment.claims.every(
            (claim) => claim.supportCitations.length > 0,
          ),
        ).toBe(true);
        await review(request, caseId, {
          commandKey: `stage-a-reviewer-second-assessment-review-${stamp}`,
          targetKind: 'assessment',
          targetVersionId: secondAssessmentVersionId,
          action: 'accept',
        });
        secondAssessment = await assessmentView(
          request,
          caseId,
          secondAssessmentVersionId,
        );
        expect(secondAssessment).toMatchObject({
          reviewStanding: 'accepted',
          shareable: true,
          dueForAttention: false,
        });
        const overviewResponse = await request(
          `api/cases/${encodeURIComponent(caseId)}/overview`,
        );
        expect(
          overviewResponse.status,
          await overviewResponse.clone().text(),
        ).toBe(200);
        const overview = (await overviewResponse.json()) as {
          counts: {
            sources: number;
            observations: number;
            relations: number;
            assessments: number;
            openQuestions: number;
          };
        };
        expect(overview.counts).toMatchObject({
          sources: 2,
          assessments: 2,
        });
        expect(overview.counts.observations).toBeGreaterThan(0);
        expect(overview.counts.relations).toBeGreaterThan(0);
        expect(overview.counts.openQuestions).toBeGreaterThan(0);
      } finally {
        await stop(reopened);
      }

      const finalRestart = await createLocalEvidenceWorkbench({
        persistence: 'postgres',
        seedMode: 'none',
        live,
      });
      try {
        const address = await listenEvidenceWorkbenchApi(finalRestart.server, {
          port: 0,
        });
        const request = await login(address.url, finalRestart.authCredentials);
        expect(
          await assessmentView(request, caseId, firstAssessmentVersionId),
        ).toMatchObject({ shareable: true, dueForAttention: true });
        expect(
          await assessmentView(request, caseId, secondAssessmentVersionId),
        ).toMatchObject({
          assessment: {
            sequence: 2,
            predecessorAssessmentVersionId: firstAssessmentVersionId,
          },
          reviewStanding: 'accepted',
          shareable: true,
          dueForAttention: false,
        });
        const history = await request(
          `api/cases/${encodeURIComponent(caseId)}/reviews/assessment/${encodeURIComponent(secondAssessmentVersionId)}`,
        );
        expect(history.status, await history.clone().text()).toBe(200);
        expect(await history.json()).toMatchObject({
          decisions: [expect.objectContaining({ action: 'accept' })],
        });
      } finally {
        await stop(finalRestart);
      }
    },
    20 * 60_000,
  );
});
