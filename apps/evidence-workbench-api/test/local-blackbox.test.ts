import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '@acme/core';

import { createFileEvidenceProductRepository } from '@acme/adapter-evidence-product-file';
import { buildEvidenceReviewedAssessmentExport } from '@acme/evidence-product-contracts';
import {
  developmentObserveArtifactInput,
  evaluationAssessmentCases,
} from '@acme/evidence-testing';
import { evaluationObserveCases } from '@acme/evidence-testing/evaluation-candidates';

import { listenEvidenceWorkbenchApi } from '../src/index.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

async function authenticatedFetch(
  baseUrl: string,
  credentials: { email: string; password: string | undefined },
  caseId: string,
): Promise<typeof fetch> {
  if (credentials.password === undefined)
    throw new Error('The deterministic test login requires a password.');
  const login = await globalThis.fetch(`${baseUrl}auth/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: baseUrl.slice(0, -1),
    },
    body: JSON.stringify(credentials),
  });
  expect(login.status, await login.clone().text()).toBe(201);
  const cookieValues = login.headers.getSetCookie();
  const cookie = cookieValues.map((value) => value.split(';')[0]).join('; ');
  const csrfCookie = cookieValues
    .map((value) => value.split(';')[0])
    .find((value) => value?.startsWith('acme_csrf='));
  if (csrfCookie === undefined) throw new Error('Missing CSRF cookie.');
  const csrf = decodeURIComponent(csrfCookie.slice('acme_csrf='.length));

  return async (input, init = {}) => {
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    headers.set('cookie', cookie);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      headers.set('origin', baseUrl.slice(0, -1));
      headers.set('x-acme-csrf', csrf);
    }
    const target = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
    );
    if (
      target.pathname.startsWith('/api/') &&
      !target.pathname.startsWith('/api/cases/') &&
      target.pathname !== '/api/session'
    ) {
      target.pathname = `/api/cases/${encodeURIComponent(caseId)}${target.pathname.slice(4)}`;
      target.searchParams.delete('workspaceId');
    }
    let body = init.body;
    if (typeof body === 'string') {
      const payload = JSON.parse(body) as Record<string, unknown>;
      delete payload.workspaceId;
      if (payload.schemaVersion === 'evidence-review-command/2')
        payload.schemaVersion = 'evidence-review-command/3';
      if (payload.schemaVersion === 'evidence-assessment-command/1')
        payload.schemaVersion = 'evidence-case-assessment-command/1';
      body = JSON.stringify(payload);
    }
    return globalThis.fetch(target, {
      ...init,
      headers,
      ...(body === undefined ? {} : { body }),
    });
  };
}

const directories: string[] = [];
function requiredValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing ${label}.`);
  return value;
}

function storedZipFiles(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (
    offset + 30 <= bytes.length &&
    view.getUint32(offset, true) === 0x04034b50
  ) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    files.set(name, bytes.slice(contentStart, contentStart + size));
    offset = contentStart + size;
  }
  return files;
}
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('local Evidence workbench', () => {
  it('assigns, comments, bulk reviews and searches only inside the selected case', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-review-operations-blackbox-'),
    );
    directories.push(directory);
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    const authFetch = await authenticatedFetch(
      address.url,
      local.authCredentials,
      local.caseId,
    );
    try {
      const session = (await (
        await authFetch(`${address.url}api/session`)
      ).json()) as { principalRef: string };
      const queue = (await (
        await authFetch(`${address.url}api/work-queue`)
      ).json()) as {
        nextItems: { kind: string; observationVersionId?: string }[];
      };
      const targets = queue.nextItems
        .filter((item) => item.kind === 'source-observation')
        .map((item) =>
          requiredValue(item.observationVersionId, 'observation id'),
        );
      expect(targets).toHaveLength(2);
      const first = requiredValue(targets[0], 'first target');
      const assigned = await authFetch(
        `${address.url}api/reviewer-work/assignment`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-review-assignment-command/1',
            commandKey: 'assign-blackbox-1',
            targetKind: 'observation',
            targetVersionId: first,
            assigneePrincipalRef: session.principalRef,
            status: 'waiting',
            expectedRevision: -1,
          }),
        },
      );
      expect(assigned.status, await assigned.clone().text()).toBe(200);
      const commented = await authFetch(
        `${address.url}api/reviewer-work/comments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-review-comment-command/1',
            commandKey: 'comment-blackbox-1',
            targetKind: 'observation',
            targetVersionId: first,
            body: 'Checked the immutable locator and exact quotation.',
          }),
        },
      );
      expect(commented.status, await commented.clone().text()).toBe(201);
      const bulk = await authFetch(`${address.url}api/reviews/bulk`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-bulk-review-command/1',
          commandKey: 'bulk-blackbox-1',
          targets: targets.map((targetVersionId) => ({
            targetKind: 'observation',
            targetVersionId,
          })),
          action: 'accept',
          rationale: 'Each bounded source observation was checked.',
          basisEvidenceRevision: null,
        }),
      });
      expect(bulk.status, await bulk.clone().text()).toBe(201);
      const work = (await (
        await authFetch(`${address.url}api/reviewer-work?assignee=me`)
      ).json()) as {
        assignments: { status: string }[];
        comments: unknown[];
        activity: { action: string }[];
      };
      expect(work.assignments).toEqual([
        expect.objectContaining({ status: 'completed' }),
      ]);
      expect(work.comments).toHaveLength(1);
      expect(work.activity.map((item) => item.action)).toEqual([
        'assigned',
        'commented',
        'bulk-decided',
        'bulk-decided',
      ]);
      const search = (await (
        await authFetch(
          `${address.url}api/search?kind=observation&reviewStanding=accepted&pageSize=1`,
        )
      ).json()) as {
        total: number;
        items: unknown[];
        nextCursor: string | null;
      };
      expect(search).toMatchObject({ total: 2 });
      expect(search.items).toHaveLength(1);
      expect(search.nextCursor).toBe('offset:1');
      const overview = (await (
        await authFetch(`${address.url}api/overview`)
      ).json()) as { counts: { sources: number; pendingObservations: number } };
      expect(overview.counts).toMatchObject({
        sources: 1,
        pendingObservations: 0,
      });
      const report = (await (
        await authFetch(`${address.url}api/integrity-report`)
      ).json()) as { reportId: string; rows: { citations: unknown[] }[] };
      expect(report.rows.every((row) => row.citations.length > 0)).toBe(true);
      expect(
        await (await authFetch(`${address.url}api/integrity-report`)).json(),
      ).toEqual(report);
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('imports bounded synthetic text and applies immutable redaction through case-first routes', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-ingestion-blackbox-'),
    );
    directories.push(directory);
    const dataFile = path.join(directory, 'product.json');
    const local = await createLocalEvidenceWorkbench({ dataFile });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    const authFetch = await authenticatedFetch(
      address.url,
      local.authCredentials,
      local.caseId,
    );
    let derivedArtifactVersionId = '';
    try {
      const text = 'Name: Åsa\nPlace: Rillford\n';
      const importedResponse = await authFetch(
        `${address.url}api/text-imports`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              schemaVersion: 'evidence-text-import-metadata/1',
              commandKey: 'browser-import-blackbox-1',
              intent: { kind: 'create' },
              title: 'Synthetic browser transcript',
              artifactKind: 'interview-transcript',
              declaredMediaType: 'text/plain; charset=utf-8',
              dataClass: 'synthetic-utf8-plain-text/1',
              attestationVersion: 'evidence-synthetic-attestation/1',
              syntheticAuthorityAttested: true,
            },
            text,
          }),
        },
      );
      expect(
        importedResponse.status,
        await importedResponse.clone().text(),
      ).toBe(201);
      const imported = (await importedResponse.json()) as {
        artifactVersionId: string;
        canonicalRepresentationId: string;
      };
      const sourceResponse = await authFetch(
        `${address.url}api/sources/${encodeURIComponent(imported.artifactVersionId)}`,
      );
      expect(sourceResponse.status).toBe(200);
      expect(await sourceResponse.text()).toContain(
        'Synthetic browser transcript',
      );

      const encoded = new TextEncoder().encode(text);
      const startByte = new TextEncoder().encode('Name: ').byteLength;
      const endByte = new TextEncoder().encode('Name: Åsa').byteLength;
      const draftResponse = await authFetch(
        `${address.url}api/redactions/drafts`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            predecessorRepresentationId: imported.canonicalRepresentationId,
            expectedRepresentationRevision: 1,
            policyReference: 'blackbox-policy/1',
            operations: [
              {
                schemaVersion: 'evidence-redaction-operation/1',
                operationId: 'redaction-operation-blackbox-1',
                ordinal: 1,
                startByte,
                endByte,
                removedBytesSha256: sha256(encoded.slice(startByte, endByte)),
                reasonCode: 'personal-data',
                rationale: null,
                replacementVersion: 'evidence-redaction-token/1',
              },
            ],
          }),
        },
      );
      expect(draftResponse.status, await draftResponse.clone().text()).toBe(
        201,
      );
      const draft = (await draftResponse.json()) as { draftId: string };
      const applyResponse = await authFetch(
        `${address.url}api/redactions/${encodeURIComponent(draft.draftId)}/apply`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ commandKey: 'apply-redaction-blackbox-1' }),
        },
      );
      expect(applyResponse.status, await applyResponse.clone().text()).toBe(
        201,
      );
      const log = (await applyResponse.json()) as {
        derivedArtifactVersionId: string;
      };
      derivedArtifactVersionId = log.derivedArtifactVersionId;
      const redactedResponse = await authFetch(
        `${address.url}api/sources/${encodeURIComponent(log.derivedArtifactVersionId)}`,
      );
      expect(await redactedResponse.text()).toContain(
        '[REDACTED:personal-data]',
      );
      const records = await local.productRepository.caseSnapshot(
        local.caseId,
        local.workspaceId,
      );
      expect(
        records.artifactRepresentations
          .filter(
            (item) => item.artifactVersionId === imported.artifactVersionId,
          )
          .map((item) => item.kind)
          .sort(),
      ).toEqual(['canonical-text', 'original']);
      expect(records.redactionLogs).toHaveLength(1);
      expect(records.redactionLogs[0]?.operations[0]).not.toHaveProperty(
        'removedText',
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    const restarted = await createLocalEvidenceWorkbench({ dataFile });
    const restartedSnapshot = await restarted.productRepository.caseSnapshot(
      restarted.caseId,
      restarted.workspaceId,
    );
    expect(restartedSnapshot.redactionLogs).toHaveLength(1);
    expect(
      restartedSnapshot.sources.find(
        (item) => item.artifactVersionId === derivedArtifactVersionId,
      )?.text,
    ).toContain('[REDACTED:personal-data]');
  });

  it('runs source import, polling, primary views and review with technical audit disabled', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-blackbox-'),
    );
    directories.push(directory);
    const dataFile = path.join(directory, 'product.json');
    let coreId = 0;
    let reviewId = 0;
    const local = await createLocalEvidenceWorkbench({
      dataFile,
      clock: { now: () => '2026-08-11T10:00:00.000Z' },
      ids: { next: (kind) => `${kind}-${String(++coreId).padStart(4, '0')}` },
      reviewIds: {
        next: () => `review-${String(++reviewId).padStart(4, '0')}`,
      },
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    const authFetch = await authenticatedFetch(
      address.url,
      local.authCredentials,
      local.caseId,
    );
    try {
      const page = await authFetch(address.url);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain(
        'Review source-bound observations beside their exact lines.',
      );

      const queueResponse = await authFetch(
        `${address.url}api/work-queue?workspaceId=${local.workspaceId}`,
      );
      const queue = (await queueResponse.json()) as {
        nextItems: {
          observationVersionId: string;
          citation: { artifactVersionId: string; display: string };
        }[];
      };
      expect(queue.nextItems).toHaveLength(2);
      const observationItems = queue.nextItems.filter(
        (
          item,
        ): item is (typeof queue.nextItems)[number] & {
          kind?: string;
          citation: { artifactVersionId: string; display: string };
          observationVersionId: string;
        } => 'citation' in item && item.citation !== undefined,
      );
      expect(
        observationItems.map(({ citation }) => citation.display).sort(),
      ).toEqual(['[DEV-T01@v1:L4-L4]', '[DEV-T01@v1:L6-L6]']);

      const first = requiredValue(observationItems[0], 'first review item');
      const sourceResponse = await authFetch(
        `${address.url}api/sources/${encodeURIComponent(first.citation.artifactVersionId)}?workspaceId=${local.workspaceId}`,
      );
      const source = (await sourceResponse.json()) as {
        observations: unknown[];
        source: { lines: unknown[] };
      };
      expect(source.observations).toHaveLength(2);
      expect(source.source.lines).toHaveLength(6);

      const reviewResponse = await authFetch(`${address.url}api/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-review-command/2',
          workspaceId: local.workspaceId,
          commandKey: 'blackbox-review-1',
          targetKind: 'observation',
          targetVersionId: first.observationVersionId,
          action: 'accept',
          rationale: 'Exact quote and source label confirmed.',
          basisEvidenceRevision: null,
        }),
      });
      expect(reviewResponse.status).toBe(201);
      const updatedQueue = (await (
        await authFetch(
          `${address.url}api/work-queue?workspaceId=${local.workspaceId}`,
        )
      ).json()) as { nextItems: unknown[] };
      expect(updatedQueue.nextItems).toHaveLength(1);
      expect(
        (await authFetch(`${address.url}api/technical/provenance`)).status,
      ).toBe(404);

      const fixture = developmentObserveArtifactInput();
      const duplicate = await local.worker.start({
        schemaVersion: 'evidence-import-command/1',
        workspaceId: local.workspaceId,
        commandKey: 'development-observe-dev-t01-v1',
        artifactVersion: fixture.artifactVersion,
        actorRoster: fixture.actorRoster,
      });
      expect(duplicate.phase).toBe('completed');
      expect(local.gateway.invocations()).toHaveLength(1);
      const executionId = requiredValue(
        (await local.ledger.snapshot()).executions[0],
        'observed execution',
      ).executionId;
      expect(await local.engine.replayVerify(executionId)).toMatchObject({
        status: 'match',
      });
      expect(local.gateway.invocations()).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('compares corrected and later accounts with every prior source version navigable', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-comparison-blackbox-'),
    );
    directories.push(directory);
    let coreId = 0;
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      seedMode: 'evaluation',
      clock: { now: () => '2026-08-11T12:00:00.000Z' },
      ids: { next: (kind) => `${kind}-${String(++coreId).padStart(4, '0')}` },
      reviewIds: { next: () => 'review-evaluation-0001' },
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    const authFetch = await authenticatedFetch(
      address.url,
      local.authCredentials,
      local.caseId,
    );
    try {
      expect(local.gateway.invocations()).toHaveLength(5);
      const pageText = await (await authFetch(address.url)).text();
      expect(pageText).toContain('Compare accounts');
      expect(pageText).toContain('Relations');

      const ledgerResponse = await authFetch(
        `${address.url}api/observations?workspaceId=${local.workspaceId}`,
      );
      expect(ledgerResponse.status).toBe(200);
      const ledger = (await ledgerResponse.json()) as {
        summary: {
          total: number;
          current: number;
          contested: number;
          superseded: number;
        };
      };
      expect(ledger.summary).toEqual(
        expect.objectContaining({
          total: 8,
          current: 5,
          contested: 1,
          superseded: 2,
        }),
      );

      const relationsResponse = await authFetch(
        `${address.url}api/relations?workspaceId=${local.workspaceId}`,
      );
      expect(relationsResponse.status).toBe(200);
      const relations = (await relationsResponse.json()) as {
        metrics: {
          relationTotal: number;
          openQuestionTotal: number;
          unresolvedActorRelations: number;
        };
      };
      expect(relations.metrics).toEqual(
        expect.objectContaining({
          relationTotal: 5,
          openQuestionTotal: 0,
          unresolvedActorRelations: 0,
        }),
      );

      const comparisonResponse = await authFetch(
        `${address.url}api/accounts/compare?workspaceId=${local.workspaceId}`,
      );
      expect(comparisonResponse.status).toBe(200);
      const comparisonText = await comparisonResponse.text();
      expect(comparisonText).not.toContain('truthId');
      expect(comparisonText).not.toContain('E-O01');
      const comparison = JSON.parse(comparisonText) as {
        correction: { pairs: unknown[] };
        laterAccounts: unknown[];
        priorVersionNavigation: { sourcePath: string }[];
      };
      expect(comparison.correction.pairs).toHaveLength(2);
      expect(comparison.laterAccounts).toHaveLength(1);
      expect(comparison.priorVersionNavigation).toHaveLength(3);
      for (const { sourcePath } of comparison.priorVersionNavigation) {
        expect(
          (
            await authFetch(
              `${address.url}api${sourcePath}?workspaceId=${local.workspaceId}`,
            )
          ).status,
        ).toBe(200);
      }

      const fixture = requiredValue(
        evaluationObserveCases()[0],
        'first evaluation fixture',
      );
      const duplicate = await local.worker.start({
        schemaVersion: 'evidence-import-command/1',
        workspaceId: local.workspaceId,
        commandKey: fixture.caseId,
        artifactVersion: fixture.input.artifactVersion,
        actorRoster: fixture.input.actorRoster,
      });
      expect(duplicate.phase).toBe('completed');
      expect(local.gateway.invocations()).toHaveLength(5);
      expect(
        (await authFetch(`${address.url}api/technical/provenance`)).status,
      ).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('completes assessment review, late-evidence attention, re-review and deterministic export', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-assessment-blackbox-'),
    );
    directories.push(directory);
    const dataFile = path.join(directory, 'product.json');
    let coreId = 0;
    let reviewId = 0;
    const local = await createLocalEvidenceWorkbench({
      dataFile,
      seedMode: 'evaluation',
      clock: { now: () => '2026-08-11T13:00:00.000Z' },
      ids: { next: (kind) => `${kind}-${String(++coreId).padStart(4, '0')}` },
      reviewIds: {
        next: () => `assessment-review-${String(++reviewId).padStart(4, '0')}`,
      },
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    const authFetch = await authenticatedFetch(
      address.url,
      local.authCredentials,
      local.caseId,
    );
    let command = 0;
    const review = async (
      targetKind: 'observation' | 'relation' | 'assessment',
      targetVersionId: string,
      action: 'accept' | 'reaffirm',
      basisEvidenceRevision: number | null = null,
    ) => {
      const response = await authFetch(`${address.url}api/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-review-command/2',
          workspaceId: local.workspaceId,
          commandKey: `assessment-blackbox-review-${String(++command)}`,
          targetKind,
          targetVersionId,
          action,
          rationale: 'Reviewed against the exact immutable source context.',
          basisEvidenceRevision,
        }),
      });
      expect(response.status).toBe(201);
    };
    const propose = async (sequence: number, predecessor: string | null) => {
      const response = await authFetch(`${address.url}api/assessments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-assessment-command/1',
          workspaceId: local.workspaceId,
          commandKey: `assessment-sequence-${String(sequence)}`,
          sequence,
          predecessorAssessmentVersionId: predecessor,
        }),
      });
      const responseText = await response.text();
      expect(response.status, responseText).toBe(201);
      return JSON.parse(responseText) as {
        assessmentVersionId: string;
        sequence: number;
      };
    };
    try {
      expect(local.gateway.invocations()).toHaveLength(5);
      const [firstCase, secondCase] = evaluationAssessmentCases();
      if (firstCase === undefined || secondCase === undefined)
        throw new Error('Missing assessment fixtures.');
      const initial = await local.productRepository.snapshot();
      const relationIds = new Set(
        initial.relations.map(({ relationId }) => relationId),
      );
      for (const id of [
        ...firstCase.input.acceptedObservationIds,
        ...firstCase.input.acceptedRelationIds,
      ]) {
        await review(
          relationIds.has(id) ? 'relation' : 'observation',
          id,
          'accept',
        );
      }
      const first = await propose(1, null);
      expect(first.assessmentVersionId).toBe(
        firstCase.expectedAssessmentVersionId,
      );
      expect(local.gateway.invocations()).toHaveLength(6);
      const unreviewedSnapshot = await local.productRepository.snapshot();
      const unreviewedAssessment = requiredValue(
        unreviewedSnapshot.assessments.find(
          ({ assessmentVersionId }) =>
            assessmentVersionId === first.assessmentVersionId,
        ),
        'unreviewed assessment',
      );
      expect(() =>
        buildEvidenceReviewedAssessmentExport({
          dataPolicy: 'synthetic-only',
          assessment: unreviewedAssessment,
          sources: unreviewedSnapshot.sources,
          observations: unreviewedSnapshot.observations,
          reviewDecisions: unreviewedSnapshot.reviewDecisions,
          effectiveBasisEvidenceRevision:
            unreviewedAssessment.basisEvidenceRevision,
          newerEvidenceNotice: null,
        }),
      ).toThrow(/reviewed shareable/u);
      await review('assessment', first.assessmentVersionId, 'accept');

      const reviewedSnapshot = await local.productRepository.snapshot();
      expect(() =>
        buildEvidenceReviewedAssessmentExport({
          dataPolicy: 'non-synthetic',
          assessment: unreviewedAssessment,
          sources: reviewedSnapshot.sources,
          observations: reviewedSnapshot.observations,
          reviewDecisions: reviewedSnapshot.reviewDecisions,
          effectiveBasisEvidenceRevision:
            unreviewedAssessment.basisEvidenceRevision,
          newerEvidenceNotice: null,
        }),
      ).toThrow(/refuses non-synthetic/u);

      const firstViewBefore = (await (
        await authFetch(
          `${address.url}api/assessments/${first.assessmentVersionId}`,
        )
      ).json()) as {
        shareable: boolean;
        dueForAttention: boolean;
        exportPath: string;
      };
      expect(firstViewBefore).toMatchObject({
        shareable: true,
        dueForAttention: false,
      });
      const exportOne = await authFetch(
        `${address.url.slice(0, -1)}${firstViewBefore.exportPath}`,
      );
      const exportTwo = await authFetch(
        `${address.url.slice(0, -1)}${firstViewBefore.exportPath}`,
      );
      const bytesOne = new Uint8Array(await exportOne.arrayBuffer());
      const bytesTwo = new Uint8Array(await exportTwo.arrayBuffer());
      expect(exportOne.status).toBe(200);
      expect(bytesTwo).toEqual(bytesOne);
      expect(exportOne.headers.get('x-evidence-export-sha256')).toMatch(
        /^[a-f0-9]{64}$/u,
      );
      const files = storedZipFiles(bytesOne);
      expect([...files.keys()]).toEqual([...files.keys()].sort());
      expect([...files.keys()]).toEqual(
        expect.arrayContaining([
          'assessment.json',
          'assessment.md',
          'manifest.json',
          'review-history.json',
        ]),
      );
      const markdown = new TextDecoder().decode(files.get('assessment.md'));
      const manifest = JSON.parse(
        new TextDecoder().decode(
          requiredValue(files.get('manifest.json'), 'manifest'),
        ),
      ) as {
        citations: { artifactVersionId: string; locatorId: string }[];
      };
      for (const citation of manifest.citations) {
        const sourcePath = `sources/${citation.artifactVersionId}.txt`;
        expect(files.has(sourcePath)).toBe(true);
        expect(markdown).toContain(`${sourcePath}#L`);
        const sourceView = (await (
          await authFetch(
            `${address.url}api/sources/${citation.artifactVersionId}?workspaceId=${local.workspaceId}`,
          )
        ).json()) as {
          observations: { citation: { locatorId: string } }[];
        };
        expect(
          sourceView.observations.some(
            ({ citation: value }) => value.locatorId === citation.locatorId,
          ),
        ).toBe(true);
      }

      const beforeLate = JSON.stringify(
        (await local.productRepository.snapshot()).assessments.find(
          ({ assessmentVersionId }) =>
            assessmentVersionId === first.assessmentVersionId,
        ),
      );
      const lateResponse = await authFetch(
        `${address.url}api/imports/late-evidence`,
        {
          method: 'POST',
        },
      );
      expect(lateResponse.status).toBe(202);
      const lateJob = (await lateResponse.json()) as { jobId: string };
      const completedLateJob = await local.worker.wait(lateJob.jobId);
      expect(completedLateJob.phase, completedLateJob.message).toBe(
        'completed',
      );
      expect(local.gateway.invocations()).toHaveLength(8);

      const dueView = (await (
        await authFetch(
          `${address.url}api/assessments/${first.assessmentVersionId}`,
        )
      ).json()) as {
        dueForAttention: boolean;
        newEvidenceNotices: unknown[];
        workspace: { evidenceRevision: number };
      };
      expect(dueView.dueForAttention).toBe(true);
      expect(dueView.newEvidenceNotices).toHaveLength(1);
      const queue = (await (
        await authFetch(
          `${address.url}api/work-queue?workspaceId=${local.workspaceId}`,
        )
      ).json()) as {
        newEvidenceNotices: unknown[];
        nextItems: { kind: string }[];
      };
      expect(queue.newEvidenceNotices).toHaveLength(1);
      expect(
        queue.nextItems.filter(({ kind }) => kind === 'assessment-attention'),
      ).toHaveLength(1);
      const exportAfterLate = new Uint8Array(
        await (
          await authFetch(
            `${address.url.slice(0, -1)}${firstViewBefore.exportPath}`,
          )
        ).arrayBuffer(),
      );
      expect(exportAfterLate).not.toEqual(bytesOne);
      const filesAfterLate = storedZipFiles(exportAfterLate);
      expect(filesAfterLate.get('assessment.json')).toEqual(
        files.get('assessment.json'),
      );
      const manifestAfterLate = JSON.parse(
        new TextDecoder().decode(
          requiredValue(filesAfterLate.get('manifest.json'), 'late manifest'),
        ),
      ) as { newerEvidenceNotice: unknown | null };
      expect(manifestAfterLate.newerEvidenceNotice).not.toBeNull();
      expect(
        JSON.stringify(
          (await local.productRepository.snapshot()).assessments.find(
            ({ assessmentVersionId }) =>
              assessmentVersionId === first.assessmentVersionId,
          ),
        ),
      ).toBe(beforeLate);

      await review(
        'assessment',
        first.assessmentVersionId,
        'reaffirm',
        dueView.workspace.evidenceRevision,
      );
      const reaffirmed = (await (
        await authFetch(
          `${address.url}api/assessments/${first.assessmentVersionId}`,
        )
      ).json()) as { dueForAttention: boolean };
      expect(reaffirmed.dueForAttention).toBe(false);
      const history = (await (
        await authFetch(
          `${address.url}api/reviews/assessment/${first.assessmentVersionId}`,
        )
      ).json()) as { decisions: { action: string }[] };
      expect(history.decisions.map(({ action }) => action)).toEqual([
        'accept',
        'reaffirm',
      ]);

      const afterLate = await local.productRepository.snapshot();
      const afterRelationIds = new Set(
        afterLate.relations.map(({ relationId }) => relationId),
      );
      for (const id of [
        ...secondCase.input.acceptedObservationIds,
        ...secondCase.input.acceptedRelationIds,
      ]) {
        await review(
          afterRelationIds.has(id) ? 'relation' : 'observation',
          id,
          'accept',
        );
      }
      const second = await propose(2, first.assessmentVersionId);
      expect(second.assessmentVersionId).toBe(
        secondCase.expectedAssessmentVersionId,
      );
      expect(local.gateway.invocations()).toHaveLength(9);
      await review('assessment', second.assessmentVersionId, 'accept');

      const overview = (await (
        await authFetch(`${address.url}api/overview`)
      ).json()) as {
        snapshotDigest: string;
        counts: { sources: number; openQuestions: number };
      };
      const report = (await (
        await authFetch(`${address.url}api/integrity-report`)
      ).json()) as {
        reportId: string;
        snapshotDigest: string;
        counts: Record<string, number>;
        rows: {
          kind: string;
          citations: { artifactVersionId: string; locatorId: string }[];
        }[];
      };
      expect(overview.counts.sources).toBe(5);
      expect(report.snapshotDigest).toBe(overview.snapshotDigest);
      expect(report.counts).toMatchObject({
        changedAccountPairs: 1,
        corrections: 2,
        temporalConflicts: 2,
        qualifications: 1,
      });
      expect(report.counts.unresolvedQuestions).toBe(
        overview.counts.openQuestions,
      );
      for (const row of report.rows) {
        expect(row.citations.length).toBeGreaterThan(0);
        for (const citation of row.citations) {
          const sourceView = (await (
            await authFetch(
              `${address.url}api/sources/${citation.artifactVersionId}?workspaceId=${local.workspaceId}`,
            )
          ).json()) as {
            observations: { citation: { locatorId: string } }[];
          };
          expect(
            sourceView.observations.some(
              ({ citation: value }) => value.locatorId === citation.locatorId,
            ),
          ).toBe(true);
        }
      }
      expect(
        await (await authFetch(`${address.url}api/integrity-report`)).json(),
      ).toEqual(report);

      const outputPath = (format: string) =>
        `${address.url}api/assessments/${encodeURIComponent(first.assessmentVersionId)}/output/${format}`;
      const digests = new Map<string, string>();
      for (const format of ['pdf', 'docx', 'markdown', 'json'] as const) {
        const released = await authFetch(outputPath(format));
        expect(released.status, format).toBe(200);
        const bytes = new Uint8Array(await released.arrayBuffer());
        const digest = released.headers.get('x-evidence-export-sha256');
        expect(digest).toMatch(/^[a-f0-9]{64}$/u);
        expect(released.headers.get('content-disposition')).toContain(
          `assessment-1.${format === 'markdown' ? 'md' : format}`,
        );
        const repeated = await authFetch(outputPath(format));
        expect(new Uint8Array(await repeated.arrayBuffer())).toEqual(bytes);
        digests.set(format, digest as string);
      }
      expect(new Set(digests.values()).size).toBe(4);

      // Every released output must leave exactly one audit record behind.
      const auditView = (await (
        await authFetch(`${address.url}api/export-audit`)
      ).json()) as {
        records: {
          format: string;
          outcome: string;
          outputSha256: string | null;
          reasonCode: string;
          principalRef: string;
        }[];
      };
      const released = auditView.records.filter(
        (item) => item.outcome === 'released',
      );
      expect(released).toHaveLength(8);
      expect(new Set(released.map((item) => item.format))).toEqual(
        new Set(['pdf', 'docx', 'markdown', 'json']),
      );
      for (const record of released) {
        expect(record.outputSha256).toBe(digests.get(record.format));
        expect(record.reasonCode).toBe('export.released');
        expect(record.principalRef).not.toBe('');
      }

      // Narrowing the policy must refuse the other formats and record why.
      const policyBefore = (await (
        await authFetch(`${address.url}api/export-policy`)
      ).json()) as { revision: number; allowedFormats: string[] };
      expect(policyBefore.allowedFormats).toHaveLength(4);
      const narrowed = await authFetch(`${address.url}api/export-policy`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-export-policy-command/1',
          commandKey: 'export-policy-blackbox-1',
          expectedRevision: policyBefore.revision,
          enabled: true,
          allowedFormats: ['json'],
        }),
      });
      expect(narrowed.status, await narrowed.clone().text()).toBe(200);
      const refused = await authFetch(outputPath('pdf'));
      expect(refused.status).toBe(403);
      expect((await authFetch(outputPath('json'))).status).toBe(200);

      const disabled = await authFetch(`${address.url}api/export-policy`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-export-policy-command/1',
          commandKey: 'export-policy-blackbox-2',
          expectedRevision: 1,
          enabled: false,
          allowedFormats: ['json'],
        }),
      });
      expect(disabled.status, await disabled.clone().text()).toBe(200);
      expect((await authFetch(outputPath('json'))).status).toBe(403);
      // A stale expected revision must not overwrite the stored policy.
      expect(
        (
          await authFetch(`${address.url}api/export-policy`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              schemaVersion: 'evidence-export-policy-command/1',
              commandKey: 'export-policy-blackbox-3',
              expectedRevision: 1,
              enabled: true,
              allowedFormats: ['pdf'],
            }),
          })
        ).status,
      ).toBe(400);

      const afterRefusals = (await (
        await authFetch(`${address.url}api/export-audit`)
      ).json()) as {
        records: { outcome: string; reasonCode: string }[];
      };
      const refusals = afterRefusals.records.filter(
        (item) => item.outcome === 'refused',
      );
      expect(refusals.map((item) => item.reasonCode).sort()).toEqual([
        'export.disabled',
        'export.format-not-allowed',
      ]);

      expect(
        (await authFetch(`${address.url}api/technical/provenance`)).status,
      ).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
      await local.close();
    }
    const reopened = createFileEvidenceProductRepository({
      filePath: dataFile,
    });
    const persisted = await reopened.snapshot();
    expect(
      persisted.assessments
        .map(({ sequence }) => sequence)
        .sort((left, right) => left - right),
    ).toEqual([1, 2]);
    expect(
      persisted.reviewDecisions.filter(
        ({ targetKind }) => targetKind === 'assessment',
      ),
    ).toHaveLength(3);
    expect(persisted.changeSets).not.toHaveLength(0);
    // The longest journey: nine mock executions, a late import, a reviewed ZIP
    // and eight rendered outputs against the file-backed product store.
  }, 30_000);
});
