import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { developmentObserveArtifactInput } from '@acme/evidence-testing';
import { evaluationObserveCases } from '@acme/evidence-testing/evaluation-candidates';

import { listenEvidenceWorkbenchApi } from '../src/index.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

const directories: string[] = [];
function requiredValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing ${label}.`);
  return value;
}
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('local Evidence workbench', () => {
  it('runs source import, polling, primary views and review with technical audit disabled', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'evidence-blackbox-'),
    );
    directories.push(directory);
    let coreId = 0;
    let reviewId = 0;
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      clock: { now: () => '2026-08-11T10:00:00.000Z' },
      ids: { next: (kind) => `${kind}-${String(++coreId).padStart(4, '0')}` },
      reviewIds: {
        next: () => `review-${String(++reviewId).padStart(4, '0')}`,
      },
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    try {
      const page = await fetch(address.url);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain(
        'Review source-bound observations beside their exact lines.',
      );

      const queueResponse = await fetch(
        `${address.url}api/work-queue?workspaceId=${local.workspaceId}`,
      );
      const queue = (await queueResponse.json()) as {
        nextItems: {
          observationVersionId: string;
          citation: { artifactVersionId: string; display: string };
        }[];
      };
      expect(queue.nextItems).toHaveLength(2);
      expect(queue.nextItems.map(({ citation }) => citation.display)).toEqual([
        '[DEV-T01@v1:L4-L4]',
        '[DEV-T01@v1:L6-L6]',
      ]);

      const first = requiredValue(queue.nextItems[0], 'first review item');
      const sourceResponse = await fetch(
        `${address.url}api/sources/${encodeURIComponent(first.citation.artifactVersionId)}?workspaceId=${local.workspaceId}`,
      );
      const source = (await sourceResponse.json()) as {
        observations: unknown[];
        source: { lines: unknown[] };
      };
      expect(source.observations).toHaveLength(2);
      expect(source.source.lines).toHaveLength(6);

      const reviewResponse = await fetch(`${address.url}api/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-review-command/1',
          workspaceId: local.workspaceId,
          commandKey: 'blackbox-review-1',
          targetKind: 'observation',
          targetVersionId: first.observationVersionId,
          action: 'accept',
          reviewerRef: 'local-reviewer',
          rationale: 'Exact quote and source label confirmed.',
          basisEvidenceRevision: null,
        }),
      });
      expect(reviewResponse.status).toBe(201);
      const updatedQueue = (await (
        await fetch(
          `${address.url}api/work-queue?workspaceId=${local.workspaceId}`,
        )
      ).json()) as { nextItems: unknown[] };
      expect(updatedQueue.nextItems).toHaveLength(1);
      expect(
        (await fetch(`${address.url}api/technical/provenance`)).status,
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
        local.ledger.snapshot().executions[0],
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
    try {
      expect(local.gateway.invocations()).toHaveLength(5);
      const pageText = await (await fetch(address.url)).text();
      expect(pageText).toContain('Compare accounts');

      const ledgerResponse = await fetch(
        `${address.url}api/observations?workspaceId=${local.workspaceId}`,
      );
      expect(ledgerResponse.status).toBe(200);
      const ledger = (await ledgerResponse.json()) as {
        summary: { total: number; current: number; superseded: number };
      };
      expect(ledger.summary).toEqual(
        expect.objectContaining({ total: 10, current: 8, superseded: 2 }),
      );

      const comparisonResponse = await fetch(
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
            await fetch(
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
        (await fetch(`${address.url}api/technical/provenance`)).status,
      ).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
