import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import {
  EvidenceImportCommandSchema,
  EvidenceReviewCommandSchema,
  recordReviewDecision,
  type EvidenceProductClock,
  type EvidenceProductIds,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import {
  buildEvidencePrimaryAccountComparisonView,
  buildEvidencePrimaryObservationLedgerView,
  buildEvidencePrimarySourceReviewView,
  buildEvidencePrimaryWorkQueueView,
} from '@acme/evidence-views';
import { renderEvidenceWorkbenchShell } from '@acme/evidence-workbench-web';
import type { EvidenceWorkbenchWorker } from '@acme/evidence-workbench-worker';
import type { EvidenceState } from '@acme/module-evidence';

function send(response: ServerResponse, status: number, value: unknown): void {
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  response.writeHead(status, {
    'content-type':
      typeof value === 'string'
        ? 'text/plain; charset=utf-8'
        : 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');
  return text.length === 0 ? {} : (JSON.parse(text) as unknown);
}

export function createEvidenceWorkbenchApi(options: {
  readonly repository: EvidenceProductRepository;
  readonly worker: EvidenceWorkbenchWorker;
  readonly clock: EvidenceProductClock;
  readonly ids: EvidenceProductIds;
  readonly workspaceId: string;
  readonly technicalAudit?: { readonly enabled: boolean };
  readonly evidenceProjection?: () => EvidenceState;
}): Server {
  const technicalAuditEnabled = options.technicalAudit?.enabled ?? false;
  return createServer(async (request, response) => {
    try {
      const origin = `http://${request.headers.host ?? '127.0.0.1'}`;
      const url = new URL(request.url ?? '/', origin);
      if (request.method === 'GET' && url.pathname === '/') {
        const html = renderEvidenceWorkbenchShell({
          workspaceId: options.workspaceId,
        });
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': Buffer.byteLength(html),
          'cache-control': 'no-store',
        });
        response.end(html);
        return;
      }
      if (url.pathname.startsWith('/api/technical')) {
        send(
          response,
          404,
          technicalAuditEnabled
            ? 'No technical audit view is implemented in this slice.'
            : 'Not found.',
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/work-queue') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        send(
          response,
          200,
          buildEvidencePrimaryWorkQueueView({
            workspaceId,
            snapshot: await options.repository.snapshot(),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/observations') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        if (options.evidenceProjection === undefined)
          throw new RangeError('Observation projection is unavailable.');
        send(
          response,
          200,
          buildEvidencePrimaryObservationLedgerView({
            workspaceId,
            snapshot: await options.repository.snapshot(),
            evidenceState: options.evidenceProjection(),
          }),
        );
        return;
      }
      if (
        request.method === 'GET' &&
        url.pathname === '/api/accounts/compare'
      ) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        if (options.evidenceProjection === undefined)
          throw new RangeError('Account comparison projection is unavailable.');
        const changed = url.searchParams.getAll('changed');
        send(
          response,
          200,
          buildEvidencePrimaryAccountComparisonView({
            workspaceId,
            correctionLogicalArtifactId:
              url.searchParams.get('correction') ?? 'EVAL-T01',
            changedAccountLogicalArtifactIds:
              changed.length === 0 ? ['EVAL-T02'] : changed,
            snapshot: await options.repository.snapshot(),
            evidenceState: options.evidenceProjection(),
          }),
        );
        return;
      }
      const sourceMatch = /^\/api\/sources\/([^/]+)$/u.exec(url.pathname);
      if (request.method === 'GET' && sourceMatch?.[1] !== undefined) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        send(
          response,
          200,
          buildEvidencePrimarySourceReviewView({
            workspaceId,
            artifactVersionId: decodeURIComponent(sourceMatch[1]),
            snapshot: await options.repository.snapshot(),
          }),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/imports') {
        send(
          response,
          202,
          await options.worker.start(
            EvidenceImportCommandSchema.parse(await body(request)),
          ),
        );
        return;
      }
      const jobMatch = /^\/api\/jobs\/([^/]+)$/u.exec(url.pathname);
      if (request.method === 'GET' && jobMatch?.[1] !== undefined) {
        const jobId = decodeURIComponent(jobMatch[1]);
        const job = (await options.repository.snapshot()).jobs.find(
          (value) => value.jobId === jobId,
        );
        if (job === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        send(response, 200, job);
        return;
      }
      const eventMatch = /^\/api\/jobs\/([^/]+)\/events$/u.exec(url.pathname);
      if (request.method === 'GET' && eventMatch?.[1] !== undefined) {
        const jobId = decodeURIComponent(eventMatch[1]);
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
          connection: 'keep-alive',
        });
        let last = '';
        const emit = async (): Promise<void> => {
          const job = (await options.repository.snapshot()).jobs.find(
            (value) => value.jobId === jobId,
          );
          if (job === undefined) {
            response.write('event: error\ndata: "Not found."\n\n');
            response.end();
            return;
          }
          const encoded = JSON.stringify(job);
          if (encoded !== last) {
            response.write(`data: ${encoded}\n\n`);
            last = encoded;
          }
          if (['completed', 'failed', 'cancelled'].includes(job.phase))
            response.end();
          else
            setTimeout(() => {
              void emit();
            }, 50);
        };
        await emit();
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/reviews') {
        const command = EvidenceReviewCommandSchema.parse(await body(request));
        send(
          response,
          201,
          await recordReviewDecision(
            options.repository,
            command,
            options.clock,
            options.ids,
          ),
        );
        return;
      }
      send(response, 404, 'Not found.');
    } catch (error) {
      send(
        response,
        error instanceof SyntaxError ? 400 : 409,
        error instanceof Error ? error.message : 'Request failed.',
      );
    }
  });
}

export async function listenEvidenceWorkbenchApi(
  server: Server,
  options: { readonly host?: string; readonly port?: number } = {},
): Promise<{
  readonly host: string;
  readonly port: number;
  readonly url: string;
}> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8790;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Workbench did not bind a TCP port.');
  return {
    host,
    port: address.port,
    url: `http://${host}:${String(address.port)}/`,
  };
}
