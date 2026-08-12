import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import {
  EvidenceImportCommandSchema,
  EvidenceAssessmentCommandSchema,
  EvidenceReviewCommandSchema,
  buildEvidenceReviewedAssessmentExport,
  recordReviewDecision,
  type EvidenceProductClock,
  type EvidenceProductIds,
  type EvidenceProductRepository,
  type EvidenceImportCommand,
} from '@acme/evidence-product-contracts';
import {
  buildEvidencePrimaryAssessmentView,
  buildEvidencePrimaryAccountComparisonView,
  buildEvidencePrimaryObservationLedgerView,
  buildEvidencePrimaryOpenQuestionsView,
  buildEvidencePrimaryRelationReviewView,
  buildEvidencePrimaryReviewHistoryView,
  buildEvidencePrimarySourceReviewView,
  buildEvidencePrimaryTimelineView,
  buildEvidencePrimaryWorkQueueView,
  buildEvidenceTechnicalProvenanceView,
  buildEvidenceTechnicalReplayView,
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

function sendBytes(
  response: ServerResponse,
  status: number,
  bytes: Uint8Array,
  headers: Readonly<Record<string, string>>,
): void {
  response.writeHead(status, {
    'content-length': bytes.byteLength,
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(Buffer.from(bytes));
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
  readonly lateEvidenceCommand?: EvidenceImportCommand;
  readonly technicalAudit?: { readonly enabled: boolean };
  readonly evidenceProjection?: () => EvidenceState | Promise<EvidenceState>;
  readonly technicalAuditSource?: () => {
    readonly domainObjectId: string;
    readonly executionId: string;
    readonly contractId: string;
    readonly contractVersion: string;
    readonly contractFingerprint: string;
    readonly operationDigest: string | null;
    readonly retainedCallAvailable: boolean;
    readonly replayVerdict: 'match' | 'different' | 'unavailable';
    readonly recordedDigest: string | null;
    readonly currentDigest: string | null;
    readonly replayReason: string;
  };
}): Server {
  const technicalAuditEnabled = options.technicalAudit?.enabled ?? false;
  return createServer(async (request, response) => {
    try {
      const origin = `http://${request.headers.host ?? '127.0.0.1'}`;
      const url = new URL(request.url ?? '/', origin);
      if (request.method === 'GET' && url.pathname === '/health') {
        send(response, 200, {
          status: 'ok',
          service: 'evidence-workbench-api',
          workspaceId: options.workspaceId,
        });
        return;
      }
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
        if (!technicalAuditEnabled) {
          send(response, 404, 'Not found.');
          return;
        }
        const source = options.technicalAuditSource?.();
        if (source === undefined) {
          send(response, 404, 'Technical audit source unavailable.');
          return;
        }
        if (
          request.method === 'GET' &&
          url.pathname === '/api/technical/provenance'
        ) {
          send(
            response,
            200,
            buildEvidenceTechnicalProvenanceView({
              domainObjectId: source.domainObjectId,
              executionId: source.executionId,
              contractId: source.contractId,
              contractVersion: source.contractVersion,
              contractFingerprint: source.contractFingerprint,
              operationDigest: source.operationDigest,
              retainedCallAvailable: source.retainedCallAvailable,
            }),
          );
          return;
        }
        if (
          request.method === 'GET' &&
          url.pathname === '/api/technical/replay'
        ) {
          send(
            response,
            200,
            buildEvidenceTechnicalReplayView({
              executionId: source.executionId,
              replayVerdict: source.replayVerdict,
              recordedDigest: source.recordedDigest,
              currentDigest: source.currentDigest,
              reason: source.replayReason,
            }),
          );
          return;
        }
        send(response, 404, 'Unknown technical audit route.');
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
            evidenceState: await options.evidenceProjection(),
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
            evidenceState: await options.evidenceProjection(),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/relations') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        if (options.evidenceProjection === undefined)
          throw new RangeError('Relation projection is unavailable.');
        send(
          response,
          200,
          buildEvidencePrimaryRelationReviewView({
            workspaceId,
            snapshot: await options.repository.snapshot(),
            evidenceState: await options.evidenceProjection(),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/timeline') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        send(
          response,
          200,
          buildEvidencePrimaryTimelineView({
            workspaceId,
            snapshot: await options.repository.snapshot(),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/open-questions') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        if (options.evidenceProjection === undefined)
          throw new RangeError('Open-question projection is unavailable.');
        send(
          response,
          200,
          buildEvidencePrimaryOpenQuestionsView({
            workspaceId,
            snapshot: await options.repository.snapshot(),
            evidenceState: await options.evidenceProjection(),
          }),
        );
        return;
      }
      const assessmentMatch = /^\/api\/assessments\/([^/]+)$/u.exec(
        url.pathname,
      );
      if (request.method === 'GET' && assessmentMatch?.[1] !== undefined) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        const requested = decodeURIComponent(assessmentMatch[1]);
        const snapshot = await options.repository.snapshot();
        const assessmentVersionId =
          requested === 'latest'
            ? snapshot.assessments
                .filter((assessment) => assessment.workspaceId === workspaceId)
                .sort(
                  (left, right) =>
                    right.sequence - left.sequence ||
                    right.assessmentVersionId.localeCompare(
                      left.assessmentVersionId,
                    ),
                )[0]?.assessmentVersionId
            : requested;
        if (assessmentVersionId === undefined)
          throw new RangeError('No assessment has been created.');
        send(
          response,
          200,
          buildEvidencePrimaryAssessmentView({
            workspaceId,
            assessmentVersionId,
            snapshot,
          }),
        );
        return;
      }
      const historyMatch =
        /^\/api\/reviews\/(observation|relation|assessment)\/([^/]+)$/u.exec(
          url.pathname,
        );
      if (
        request.method === 'GET' &&
        historyMatch?.[1] !== undefined &&
        historyMatch[2] !== undefined
      ) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        send(
          response,
          200,
          buildEvidencePrimaryReviewHistoryView({
            workspaceId,
            targetKind: historyMatch[1] as
              'observation' | 'relation' | 'assessment',
            targetVersionId: decodeURIComponent(historyMatch[2]),
            snapshot: await options.repository.snapshot(),
          }),
        );
        return;
      }
      const exportMatch = /^\/api\/assessments\/([^/]+)\/export$/u.exec(
        url.pathname,
      );
      if (request.method === 'GET' && exportMatch?.[1] !== undefined) {
        const snapshot = await options.repository.snapshot();
        const workspace = snapshot.workspaces.find(
          ({ workspaceId }) => workspaceId === options.workspaceId,
        );
        const assessment = snapshot.assessments.find(
          ({ assessmentVersionId }) =>
            assessmentVersionId ===
            decodeURIComponent(exportMatch[1] as string),
        );
        if (workspace === undefined || assessment === undefined)
          throw new RangeError('Unknown export assessment.');
        const view = buildEvidencePrimaryAssessmentView({
          workspaceId: workspace.workspaceId,
          assessmentVersionId: assessment.assessmentVersionId,
          snapshot,
        });
        const exported = buildEvidenceReviewedAssessmentExport({
          dataPolicy: workspace.dataPolicy,
          assessment,
          sources: snapshot.sources,
          observations: snapshot.observations,
          reviewDecisions: snapshot.reviewDecisions,
          effectiveBasisEvidenceRevision:
            view.assessment.effectiveBasisEvidenceRevision,
          newerEvidenceNotice: view.newEvidenceNotices.at(-1) ?? null,
        });
        sendBytes(response, 200, exported.bytes, {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="assessment-${assessment.sequence}.zip"`,
          'x-evidence-export-sha256': exported.exportSha256,
        });
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
      if (
        request.method === 'POST' &&
        url.pathname === '/api/imports/late-evidence'
      ) {
        if (options.lateEvidenceCommand === undefined)
          throw new RangeError(
            'No bounded late-evidence fixture is configured.',
          );
        send(
          response,
          202,
          await options.worker.start(options.lateEvidenceCommand),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/assessments') {
        send(
          response,
          201,
          await options.worker.proposeAssessment(
            EvidenceAssessmentCommandSchema.parse(await body(request)),
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
