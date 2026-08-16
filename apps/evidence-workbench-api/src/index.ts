import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import {
  EvidenceImportCommandSchema,
  EvidenceAssessmentCommandSchema,
  EvidenceAuthenticatedReviewCommandSchema,
  EvidenceCaseImportCommandSchema,
  EvidenceCaseAssessmentCommandSchema,
  EvidenceCaseReviewCommandSchema,
  EvidenceCreateCaseCommandSchema,
  EvidenceUpdateCaseCommandSchema,
  EvidenceCaseLifecycleCommandSchema,
  EvidenceCaseMembershipCommandSchema,
  buildEvidenceReviewedAssessmentExport,
  changeEvidenceCaseLifecycle,
  createEvidenceCase,
  evidenceReviewTargetExistsInCase,
  evidenceReviewTargetExistsInWorkspace,
  listVisibleEvidenceCases,
  putEvidenceCaseMembership,
  recordCaseReviewDecision,
  recordAuthenticatedReviewDecision,
  updateEvidenceCase,
  scopeEvidenceProductSnapshot,
  type EvidenceProductClock,
  type EvidenceProductIds,
  type EvidenceProductRepository,
  type EvidenceImportCommand,
  type EvidenceArtifactReadAuditContext,
  type EvidenceArtifactService,
  EvidenceTextImportMetadataSchema,
  EvidenceCaseLiveObservationCommandSchema,
  type EvidenceCaseLiveObservationCommand,
  EvidenceCaseLiveRelationCommandSchema,
  type EvidenceCaseLiveRelationCommand,
  EvidenceCaseLiveAssessmentCommandSchema,
  type EvidenceCaseLiveAssessmentCommand,
  EvidenceRedactionOperationSchema,
  type EvidenceIngestionService,
  EvidenceBulkReviewCommandSchema,
  EvidenceCaseReviewDecisionSchema,
  EvidenceCaseSearchQuerySchema,
  EvidenceReviewActivitySchema,
  EvidenceReviewAssignmentCommandSchema,
  EvidenceReviewAssignmentSchema,
  EvidenceReviewCommentCommandSchema,
  EvidenceReviewCommentSchema,
  deriveEvidenceReviewOperationId,
  searchEvidenceCase,
  buildEvidenceCaseOverview,
  buildEvidenceCaseIntegrityReport,
  EVIDENCE_ASSESSMENT_OUTPUT_FORMATS,
  EvidenceAssessmentOutputFormatSchema,
  EvidenceExportPolicyCommandSchema,
  EvidenceExportRefusedError,
  authorizeEvidenceAssessmentExport,
  buildEvidenceAssessmentOutputDocument,
  renderEvidenceAssessmentOutput,
  resolveEvidenceExportPolicy,
} from '@acme/evidence-product-contracts';
import {
  EvidenceAuthenticationError,
  EvidenceAuthorizationError,
  authorizeEvidenceAction,
  authorizeEvidenceCaseAction,
  authorizeEvidenceOrganizationAction,
  type EvidenceIdentityRepository,
  type EvidenceProductAction,
  type EvidenceSessionService,
} from '@acme/evidence-auth';
import {
  buildEvidencePrimaryAssessmentView,
  buildEvidenceClaimSurfaceView,
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
import { assertNoLiveCredentialFields } from '@acme/live-safety';

import {
  EvidenceLiveObservationRefused,
  type EvidenceLiveObservationService,
} from './live-observation.js';
import {
  EvidenceLiveRelationRefused,
  type EvidenceLiveRelationService,
} from './live-relation.js';
import {
  EvidenceLiveAssessmentRefused,
  type EvidenceLiveAssessmentService,
} from './live-assessment.js';
import { sortTextImportsBySourceTime } from './text-import-list.js';

export * from './live.js';
export {
  compareTextImportsBySourceTime,
  sortTextImportsBySourceTime,
  textImportSourceTime,
} from './text-import-list.js';

function zCaseStatus(value: string): 'active' | 'archived' {
  if (value === 'active' || value === 'archived') return value;
  throw new SyntaxError('status must be active or archived.');
}

function send(
  response: ServerResponse,
  status: number,
  value: unknown,
  headers: Readonly<Record<string, string | readonly string[]>> = {},
): void {
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  response.writeHead(status, {
    'content-type':
      typeof value === 'string'
        ? 'text/plain; charset=utf-8'
        : 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(body);
}

function cookie(request: IncomingMessage, name: string): string | null {
  const source = request.headers.cookie ?? '';
  for (const part of source.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sessionCookie(name: string, value: string, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

function csrfCookie(value: string, secure: boolean): string {
  return `acme_csrf=${encodeURIComponent(value)}; Path=/; SameSite=Strict${secure ? '; Secure' : ''}`;
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

async function boundedJsonBody(
  request: IncomingMessage,
  maximumBytes: number,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.byteLength;
    if (total > maximumBytes) throw new RangeError('REQUEST_BODY_TOO_LARGE');
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  return bytes.byteLength === 0
    ? {}
    : (JSON.parse(bytes.toString('utf8')) as unknown);
}

export function createEvidenceWorkbenchApi(options: {
  readonly repository: EvidenceProductRepository;
  readonly worker: EvidenceWorkbenchWorker;
  readonly clock: EvidenceProductClock;
  readonly ids: EvidenceProductIds;
  readonly workspaceId: string;
  readonly caseId: string;
  readonly auth: {
    readonly sessions: EvidenceSessionService;
    readonly repository: EvidenceIdentityRepository;
    readonly cookieName: string;
    readonly secureCookies: boolean;
    readonly publicOrigin?: string;
  };
  readonly artifactSecurity?: Pick<
    EvidenceArtifactService,
    'recordDeniedRead' | 'recordExport' | 'rewrap' | 'delete'
  >;
  readonly ingestion?: EvidenceIngestionService;
  readonly stageA?: { readonly enabled: boolean };
  readonly liveObservation?: EvidenceLiveObservationService;
  readonly liveRelation?: EvidenceLiveRelationService;
  readonly liveAssessment?: EvidenceLiveAssessmentService;
  readonly lateEvidenceCommand?: EvidenceImportCommand;
  readonly technicalAudit?: { readonly enabled: boolean };
  readonly evidenceProjection?: (
    workspaceId: string,
  ) => EvidenceState | Promise<EvidenceState>;
  readonly technicalAuditSource?: (caseId: string) => {
    readonly caseId: string;
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
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  return createServer(async (request, response) => {
    try {
      const origin =
        options.auth.publicOrigin?.replace(/\/$/u, '') ??
        `http://${request.headers.host ?? '127.0.0.1'}`;
      const url = new URL(request.url ?? '/', origin);
      const originalPathname = url.pathname;
      const casePath = /^\/api\/cases\/([^/]+)(\/.*)?$/u.exec(originalPathname);
      const requestCaseId =
        casePath?.[1] === undefined ? null : decodeURIComponent(casePath[1]);
      let artifactReadAudit: EvidenceArtifactReadAuditContext | undefined;
      const rememberArtifactAudit = (authorization: {
        readonly organizationId: string;
        readonly principalRef: string;
        readonly policyVersion: string;
        readonly decidedAt: string;
      }) => {
        artifactReadAudit = {
          organizationId: authorization.organizationId,
          principalRef: authorization.principalRef,
          requestId:
            typeof request.headers['x-request-id'] === 'string'
              ? request.headers['x-request-id']
              : `api:${request.method ?? 'UNKNOWN'}:${url.pathname}:${authorization.decidedAt}`,
          policyVersion: authorization.policyVersion,
        };
      };
      const recordDeniedCaseRead = async (input: {
        readonly principalRef: string;
        readonly caseId: string;
        readonly identity: Awaited<
          ReturnType<EvidenceIdentityRepository['snapshot']>
        >;
      }) => {
        const evidenceCase = input.identity.cases.find(
          (item) => item.caseId === input.caseId,
        );
        if (
          evidenceCase === undefined ||
          options.artifactSecurity === undefined
        )
          return;
        await options.artifactSecurity
          .recordDeniedRead({
            scope: {
              caseId: evidenceCase.caseId,
              workspaceId: evidenceCase.workspaceId,
              boundAt: options.clock.now(),
            },
            audit: {
              organizationId: evidenceCase.organizationId,
              principalRef: input.principalRef,
              requestId:
                typeof request.headers['x-request-id'] === 'string'
                  ? request.headers['x-request-id']
                  : `api-denied:${request.method ?? 'UNKNOWN'}:${url.pathname}:${options.clock.now()}`,
              policyVersion: 'evidence-case-auth-policy/1',
            },
            reasonCode: 'CASE_READ_AUTHORIZATION_DENIED',
          })
          .catch(() => undefined);
      };
      const requireSameOrigin = (): void => {
        if (request.headers.origin !== origin) {
          throw new EvidenceAuthenticationError('Invalid request origin.');
        }
      };
      const requireAuthorized = async (
        action: EvidenceProductAction,
        workspaceId: string | null,
        unsafe = false,
      ) => {
        if (unsafe) requireSameOrigin();
        const rawToken = cookie(request, options.auth.cookieName);
        if (rawToken === null) throw new EvidenceAuthenticationError();
        const csrf = unsafe
          ? typeof request.headers['x-acme-csrf'] === 'string'
            ? request.headers['x-acme-csrf']
            : ''
          : undefined;
        const resolved = await options.auth.sessions.resolve(rawToken, csrf);
        if (requestCaseId !== null) {
          const identity = await options.auth.repository.snapshot();
          let authorization;
          try {
            authorization = authorizeEvidenceCaseAction({
              snapshot: identity,
              principalRef: resolved.principal.principalRef,
              caseId: requestCaseId,
              action,
              decidedAt: options.clock.now(),
            });
          } catch (error) {
            await recordDeniedCaseRead({
              principalRef: resolved.principal.principalRef,
              caseId: requestCaseId,
              identity,
            });
            throw error;
          }
          if (workspaceId !== null && authorization.workspaceId !== workspaceId)
            throw new EvidenceAuthorizationError(404, 'Not found.');
          rememberArtifactAudit(authorization);
          return authorization;
        }
        return authorizeEvidenceAction({
          snapshot: await options.auth.repository.snapshot(),
          principalRef: resolved.principal.principalRef,
          action,
          workspaceId,
          decidedAt: options.clock.now(),
        });
      };
      const requireCaseAuthorized = async (
        caseId: string,
        action: EvidenceProductAction,
        unsafe = false,
      ) => {
        if (unsafe) requireSameOrigin();
        const rawToken = cookie(request, options.auth.cookieName);
        if (rawToken === null) throw new EvidenceAuthenticationError();
        const csrf = unsafe
          ? typeof request.headers['x-acme-csrf'] === 'string'
            ? request.headers['x-acme-csrf']
            : ''
          : undefined;
        const resolved = await options.auth.sessions.resolve(rawToken, csrf);
        const identity = await options.auth.repository.snapshot();
        let authorization;
        try {
          authorization = authorizeEvidenceCaseAction({
            snapshot: identity,
            principalRef: resolved.principal.principalRef,
            caseId,
            action,
            decidedAt: options.clock.now(),
          });
        } catch (error) {
          await recordDeniedCaseRead({
            principalRef: resolved.principal.principalRef,
            caseId,
            identity,
          });
          throw error;
        }
        rememberArtifactAudit(authorization);
        return authorization;
      };
      const requireOrganizationAuthorized = async (
        organizationId: string,
        action: 'case.catalog.read' | 'case.create',
        unsafe = false,
      ) => {
        if (unsafe) requireSameOrigin();
        const rawToken = cookie(request, options.auth.cookieName);
        if (rawToken === null) throw new EvidenceAuthenticationError();
        const csrf = unsafe
          ? typeof request.headers['x-acme-csrf'] === 'string'
            ? request.headers['x-acme-csrf']
            : ''
          : undefined;
        const resolved = await options.auth.sessions.resolve(rawToken, csrf);
        return authorizeEvidenceOrganizationAction({
          snapshot: await options.auth.repository.snapshot(),
          principalRef: resolved.principal.principalRef,
          organizationId,
          action,
          decidedAt: options.clock.now(),
        });
      };
      const scopedSnapshot = async (workspaceId: string) =>
        requestCaseId === null
          ? scopeEvidenceProductSnapshot(
              await options.repository.snapshot(),
              workspaceId,
            )
          : options.repository.caseSnapshot(
              requestCaseId,
              workspaceId,
              artifactReadAudit,
            );
      const defaultWorkspaceId = async (): Promise<string> => {
        if (requestCaseId === null) return options.workspaceId;
        const evidenceCase = (
          await options.auth.repository.snapshot()
        ).cases.find((item) => item.caseId === requestCaseId);
        if (evidenceCase === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        return evidenceCase.workspaceId;
      };
      if (request.method === 'GET' && url.pathname === '/health') {
        send(response, 200, {
          status: 'ok',
          service: 'evidence-workbench-api',
          caseId: options.caseId,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/') {
        const html = renderEvidenceWorkbenchShell({
          caseId: options.caseId,
        });
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': Buffer.byteLength(html),
          'cache-control': 'no-store',
        });
        response.end(html);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/auth/session') {
        requireSameOrigin();
        const remote = request.socket.remoteAddress ?? 'unknown';
        const now = Date.now();
        const attempt = loginAttempts.get(remote);
        if (
          attempt !== undefined &&
          attempt.resetAt > now &&
          attempt.count >= 5
        ) {
          send(response, 429, 'Too many login attempts.');
          return;
        }
        const value = (await body(request)) as Record<string, unknown>;
        if (
          typeof value.email !== 'string' ||
          typeof value.password !== 'string'
        ) {
          send(response, 400, 'Email and password are required.');
          return;
        }
        try {
          const login = await options.auth.sessions.login({
            email: value.email,
            password: value.password,
          });
          loginAttempts.delete(remote);
          send(
            response,
            201,
            {
              schemaVersion: 'evidence-session-view/1',
              principalRef: login.principal.principalRef,
              displayLabel: login.principal.displayLabel,
            },
            {
              'set-cookie': [
                sessionCookie(
                  options.auth.cookieName,
                  login.rawToken,
                  options.auth.secureCookies,
                ),
                csrfCookie(login.csrfToken, options.auth.secureCookies),
              ],
            },
          );
          return;
        } catch (error) {
          loginAttempts.set(remote, {
            count:
              attempt !== undefined && attempt.resetAt > now
                ? attempt.count + 1
                : 1,
            resetAt: now + 5 * 60 * 1_000,
          });
          throw error;
        }
      }
      if (request.method === 'GET' && url.pathname === '/api/session') {
        const rawToken = cookie(request, options.auth.cookieName);
        if (rawToken === null) throw new EvidenceAuthenticationError();
        const resolved = await options.auth.sessions.resolve(rawToken);
        const snapshot = await options.auth.repository.snapshot();
        send(response, 200, {
          schemaVersion: 'evidence-session-view/1',
          principalRef: resolved.principal.principalRef,
          displayLabel: resolved.principal.displayLabel,
          memberships: snapshot.memberships.filter(
            (item) =>
              item.principalRef === resolved.principal.principalRef &&
              item.status === 'active',
          ),
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/capabilities') {
        const rawToken = cookie(request, options.auth.cookieName);
        if (rawToken === null) throw new EvidenceAuthenticationError();
        await options.auth.sessions.resolve(rawToken);
        send(response, 200, {
          schemaVersion: 'evidence-product-capabilities/1',
          stageAImport: options.stageA?.enabled === true,
          liveObservation: options.liveObservation !== undefined,
          liveRelation: options.liveRelation !== undefined,
          liveAssessment: options.liveAssessment !== undefined,
          liveObservationModel:
            options.liveObservation?.deployment.model ?? null,
          liveObservationMaxModelCalls:
            options.liveObservation?.deployment.maxModelCalls ?? null,
          liveObservationCostCeilingMinor:
            options.liveObservation?.deployment.costCeilingMinor ?? null,
          liveObservationCurrency:
            options.liveObservation?.deployment.currency ?? null,
        });
        return;
      }
      if (request.method === 'DELETE' && url.pathname === '/auth/session') {
        requireSameOrigin();
        const rawToken = cookie(request, options.auth.cookieName);
        if (rawToken === null) throw new EvidenceAuthenticationError();
        const csrf = request.headers['x-acme-csrf'];
        await options.auth.sessions.resolve(
          rawToken,
          typeof csrf === 'string' ? csrf : '',
        );
        await options.auth.sessions.logout(rawToken);
        send(response, 204, '', {
          'set-cookie': [
            `${options.auth.cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${options.auth.secureCookies ? '; Secure' : ''}`,
            `acme_csrf=; Path=/; SameSite=Strict; Max-Age=0${options.auth.secureCookies ? '; Secure' : ''}`,
          ],
        });
        return;
      }
      if (request.method === 'GET' && originalPathname === '/api/cases') {
        const organizationId = url.searchParams.get('organizationId');
        if (organizationId === null)
          throw new SyntaxError('organizationId is required.');
        const authorization = await requireOrganizationAuthorized(
          organizationId,
          'case.catalog.read',
        );
        const snapshot = await options.auth.repository.snapshot();
        send(response, 200, {
          schemaVersion: 'evidence-case-catalog-view/1',
          organizationId,
          cases: listVisibleEvidenceCases({
            snapshot,
            principalRef: authorization.principalRef,
            organizationId,
            ...(url.searchParams.get('q') === null
              ? {}
              : { query: url.searchParams.get('q') as string }),
            ...(url.searchParams.get('status') === null
              ? {}
              : {
                  status: zCaseStatus(url.searchParams.get('status') as string),
                }),
            ...(url.searchParams.get('limit') === null
              ? {}
              : { limit: Number(url.searchParams.get('limit')) }),
          }),
        });
        return;
      }
      const organizationCasesMatch =
        /^\/api\/organizations\/([^/]+)\/cases$/u.exec(originalPathname);
      if (
        request.method === 'POST' &&
        organizationCasesMatch?.[1] !== undefined
      ) {
        const organizationId = decodeURIComponent(organizationCasesMatch[1]);
        const command = EvidenceCreateCaseCommandSchema.parse(
          await body(request),
        );
        if (
          command.schemaVersion === 'evidence-create-case-command/2' &&
          command.dataPolicy === 'stage-a-authorized-judicial-text' &&
          options.stageA?.enabled !== true
        )
          throw new EvidenceAuthorizationError(
            403,
            'STAGE_A_IMPORT_CAPABILITY_REQUIRED',
          );
        const authorization = await requireOrganizationAuthorized(
          organizationId,
          'case.create',
          true,
        );
        send(
          response,
          201,
          await createEvidenceCase({
            identityRepository: options.auth.repository,
            productRepository: options.repository,
            authorization,
            organizationId,
            command,
            clock: options.clock,
          }),
        );
        return;
      }
      const caseSuffix = casePath?.[2] ?? '';
      if (requestCaseId !== null && (caseSuffix === '' || caseSuffix === '/')) {
        if (request.method === 'GET') {
          const authorization = await requireCaseAuthorized(
            requestCaseId,
            'case.read',
          );
          const snapshot = await options.auth.repository.snapshot();
          const evidenceCase = snapshot.cases.find(
            (item) => item.caseId === requestCaseId,
          );
          if (evidenceCase === undefined)
            throw new EvidenceAuthorizationError(404, 'Not found.');
          send(response, 200, {
            schemaVersion: 'evidence-case-detail-view/1',
            case: evidenceCase,
            membership: snapshot.caseMemberships.find(
              (item) =>
                item.caseId === requestCaseId &&
                item.principalRef === authorization.principalRef &&
                item.status === 'active',
            ),
          });
          return;
        }
        if (request.method === 'PATCH') {
          const authorization = await requireCaseAuthorized(
            requestCaseId,
            'case.metadata.manage',
            true,
          );
          send(
            response,
            200,
            await updateEvidenceCase({
              identityRepository: options.auth.repository,
              authorization,
              command: EvidenceUpdateCaseCommandSchema.parse(
                await body(request),
              ),
              clock: options.clock,
            }),
          );
          return;
        }
      }
      if (
        requestCaseId !== null &&
        request.method === 'POST' &&
        (caseSuffix === '/archive' || caseSuffix === '/restore')
      ) {
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          'case.lifecycle.manage',
          true,
        );
        const value = (await body(request)) as Record<string, unknown>;
        send(
          response,
          200,
          await changeEvidenceCaseLifecycle({
            identityRepository: options.auth.repository,
            productRepository: options.repository,
            authorization,
            command: EvidenceCaseLifecycleCommandSchema.parse({
              ...value,
              schemaVersion: 'evidence-case-lifecycle-command/1',
              action: caseSuffix === '/archive' ? 'archive' : 'restore',
            }),
            clock: options.clock,
          }),
        );
        return;
      }
      const participantMatch = /^\/participants(?:\/([^/]+))?$/u.exec(
        caseSuffix,
      );
      if (requestCaseId !== null && participantMatch !== null) {
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          'case-membership.manage',
          request.method !== 'GET',
        );
        if (request.method === 'GET' && participantMatch[1] === undefined) {
          const snapshot = await options.auth.repository.snapshot();
          send(response, 200, {
            schemaVersion: 'evidence-case-participants-view/1',
            caseId: requestCaseId,
            participants: snapshot.caseMemberships.filter(
              (item) => item.caseId === requestCaseId,
            ),
          });
          return;
        }
        if (request.method === 'PUT' && participantMatch[1] !== undefined) {
          const principalRef = decodeURIComponent(participantMatch[1]);
          const value = (await body(request)) as Record<string, unknown>;
          send(
            response,
            200,
            await putEvidenceCaseMembership({
              identityRepository: options.auth.repository,
              authorization,
              command: EvidenceCaseMembershipCommandSchema.parse({
                ...value,
                schemaVersion: 'evidence-case-membership-command/1',
                principalRef,
              }),
              clock: options.clock,
            }),
          );
          return;
        }
      }
      if (requestCaseId !== null) {
        if (url.searchParams.has('workspaceId'))
          throw new SyntaxError('workspaceId is not accepted by case routes.');
        const identity = await options.auth.repository.snapshot();
        const evidenceCase = identity.cases.find(
          (item) => item.caseId === requestCaseId,
        );
        url.pathname = `/api${caseSuffix}`;
        url.searchParams.set(
          'workspaceId',
          evidenceCase?.workspaceId ?? '__unknown_case__',
        );
      }
      if (
        requestCaseId === null &&
        [
          '/api/work-queue',
          '/api/observations',
          '/api/accounts',
          '/api/claims',
          '/api/relations',
          '/api/timeline',
          '/api/open-questions',
          '/api/sources',
          '/api/assessments',
          '/api/reviews',
          '/api/imports',
          '/api/live-observations',
          '/api/live-relations',
          '/api/live-assessments',
          '/api/jobs',
          '/api/technical',
          '/api/export-policy',
          '/api/export-audit',
        ].some(
          (prefix) =>
            url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
        )
      ) {
        send(response, 404, 'Not found.');
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        const rawToken = cookie(request, options.auth.cookieName);
        if (rawToken === null) throw new EvidenceAuthenticationError();
        await options.auth.sessions.resolve(rawToken);
      }
      if (url.pathname.startsWith('/api/technical')) {
        await requireAuthorized('technical-audit.read', options.workspaceId);
        if (!technicalAuditEnabled) {
          send(response, 404, 'Not found.');
          return;
        }
        const source =
          requestCaseId === null
            ? undefined
            : options.technicalAuditSource?.(requestCaseId);
        if (source === undefined || source.caseId !== requestCaseId) {
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
      if (request.method === 'GET' && url.pathname === '/api/security-audit') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('technical-audit.read', workspaceId);
        const snapshot = await scopedSnapshot(workspaceId);
        send(response, 200, {
          schemaVersion: 'evidence-security-audit-view/1',
          caseId: requestCaseId,
          events: [...snapshot.securityAudit].sort(
            (a, b) =>
              a.occurredAt.localeCompare(b.occurredAt) ||
              a.auditEventId.localeCompare(b.auditEventId),
          ),
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/artifacts') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('technical-audit.read', workspaceId);
        const snapshot = await scopedSnapshot(workspaceId);
        send(response, 200, {
          schemaVersion: 'evidence-artifact-administration-view/1',
          caseId: requestCaseId,
          artifacts: snapshot.artifactRepresentations.map((representation) => {
            const envelope = snapshot.artifactEnvelopes.find(
              (item) =>
                item.representationId === representation.representationId,
            );
            return {
              representationId: representation.representationId,
              artifactVersionId: representation.artifactVersionId,
              kind: representation.kind,
              mediaType: representation.mediaType,
              plaintextByteLength: representation.plaintextByteLength,
              plaintextSha256: representation.plaintextSha256,
              keyId: envelope?.keyId ?? null,
              keyVersion: envelope?.keyVersion ?? null,
              lifecycleRevision: snapshot.artifactLifecycle.filter(
                (item) =>
                  item.representationId === representation.representationId,
              ).length,
              lifecycle: snapshot.artifactLifecycle
                .filter(
                  (item) =>
                    item.representationId === representation.representationId,
                )
                .map((item) => ({
                  action: item.action,
                  reason: item.reason,
                  principalRef: item.principalRef,
                  occurredAt: item.occurredAt,
                  expectedRevision: item.expectedRevision,
                })),
            };
          }),
        });
        return;
      }
      const artifactAdminMatch = /^\/api\/artifacts\/([^/]+)$/u.exec(
        url.pathname,
      );
      if (
        artifactAdminMatch?.[1] !== undefined &&
        (request.method === 'POST' || request.method === 'DELETE')
      ) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('case.metadata.manage', workspaceId, true);
        if (
          requestCaseId === null ||
          artifactReadAudit === undefined ||
          options.artifactSecurity === undefined
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const representationId = decodeURIComponent(artifactAdminMatch[1]);
        const scope = {
          caseId: requestCaseId,
          workspaceId,
          boundAt: options.clock.now(),
        };
        if (request.method === 'POST') {
          await options.artifactSecurity.rewrap({
            representationId,
            scope,
            audit: artifactReadAudit,
          });
          send(response, 204, '');
          return;
        }
        const command = (await body(request)) as Record<string, unknown>;
        if (
          typeof command.reason !== 'string' ||
          typeof command.expectedRevision !== 'number'
        )
          throw new SyntaxError(
            'Deletion reason and expectedRevision are required.',
          );
        await options.artifactSecurity.delete({
          representationId,
          scope,
          reason: command.reason,
          expectedRevision: command.expectedRevision,
          audit: artifactReadAudit,
        });
        send(response, 204, '');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/work-queue') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? (await defaultWorkspaceId());
        await requireAuthorized('workspace.read', workspaceId);
        send(
          response,
          200,
          buildEvidencePrimaryWorkQueueView({
            workspaceId,
            snapshot: await scopedSnapshot(workspaceId),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/search') {
        const workspaceId = options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        const query = EvidenceCaseSearchQuerySchema.parse({
          schemaVersion: 'evidence-case-search-query/1',
          text: url.searchParams.get('q') ?? '',
          kinds: url.searchParams.getAll('kind'),
          reviewStanding: url.searchParams.get('reviewStanding'),
          relationKind: url.searchParams.get('relationKind'),
          assigneePrincipalRef: url.searchParams.get('assignee'),
          pageSize: Number(url.searchParams.get('pageSize') ?? '50'),
          cursor: url.searchParams.get('cursor'),
        });
        send(
          response,
          200,
          searchEvidenceCase(await scopedSnapshot(workspaceId), query),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/overview') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        send(
          response,
          200,
          buildEvidenceCaseOverview(await scopedSnapshot(workspaceId)),
        );
        return;
      }
      if (
        request.method === 'GET' &&
        url.pathname === '/api/integrity-report'
      ) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        send(
          response,
          200,
          buildEvidenceCaseIntegrityReport(await scopedSnapshot(workspaceId)),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/reviewer-work') {
        const authorization = await requireAuthorized(
          'workspace.read',
          options.workspaceId,
        );
        if (!('caseId' in authorization))
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const snapshot = await scopedSnapshot(options.workspaceId);
        const assignee =
          url.searchParams.get('assignee') === 'me'
            ? authorization.principalRef
            : url.searchParams.get('assignee');
        const decidedTargets = new Set(
          snapshot.reviewDecisions.map(
            (item) => `${item.targetKind}:${item.targetVersionId}`,
          ),
        );
        send(response, 200, {
          schemaVersion: 'evidence-reviewer-work/1',
          assignments: snapshot.reviewAssignments
            .filter(
              (item) =>
                assignee === null || item.assigneePrincipalRef === assignee,
            )
            .map((item) =>
              decidedTargets.has(`${item.targetKind}:${item.targetVersionId}`)
                ? { ...item, status: 'completed' }
                : item,
            ),
          comments: snapshot.reviewComments,
          activity: snapshot.reviewActivity,
        });
        return;
      }
      if (
        request.method === 'PUT' &&
        url.pathname === '/api/reviewer-work/assignment'
      ) {
        const command = EvidenceReviewAssignmentCommandSchema.parse(
          await body(request),
        );
        const authorization = await requireAuthorized(
          'case-membership.manage',
          options.workspaceId,
          true,
        );
        if (!('caseId' in authorization) || requestCaseId === null)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const identity = await options.auth.repository.snapshot();
        if (
          !identity.caseMemberships.some(
            (item) =>
              item.caseId === requestCaseId &&
              item.principalRef === command.assigneePrincipalRef &&
              item.status === 'active',
          )
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const snapshot = await scopedSnapshot(options.workspaceId);
        if (
          !evidenceReviewTargetExistsInCase({
            snapshot: await options.repository.snapshot(),
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            targetKind: command.targetKind,
            targetVersionId: command.targetVersionId,
          })
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const assignmentId = deriveEvidenceReviewOperationId('assignment', {
          caseId: requestCaseId,
          targetKind: command.targetKind,
          targetVersionId: command.targetVersionId,
        });
        const current = snapshot.reviewAssignments.find(
          (item) => item.assignmentId === assignmentId,
        );
        if ((current?.revision ?? -1) !== command.expectedRevision)
          throw new Error('ASSIGNMENT_REVISION_CONFLICT');
        const now = options.clock.now();
        const assignment = EvidenceReviewAssignmentSchema.parse({
          schemaVersion: 'evidence-review-assignment/1',
          assignmentId,
          organizationId: authorization.organizationId,
          caseId: requestCaseId,
          workspaceId: options.workspaceId,
          targetKind: command.targetKind,
          targetVersionId: command.targetVersionId,
          assigneePrincipalRef: command.assigneePrincipalRef,
          status: command.status,
          assignedByPrincipalRef: authorization.principalRef,
          commandKey: command.commandKey,
          revision: command.expectedRevision + 1,
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
        });
        const activity = EvidenceReviewActivitySchema.parse({
          schemaVersion: 'evidence-review-activity/1',
          activityId: deriveEvidenceReviewOperationId('activity', {
            caseId: requestCaseId,
            commandKey: command.commandKey,
          }),
          organizationId: authorization.organizationId,
          caseId: requestCaseId,
          workspaceId: options.workspaceId,
          targetKind: command.targetKind,
          targetVersionId: command.targetVersionId,
          action:
            current === undefined
              ? 'assigned'
              : current.assigneePrincipalRef === command.assigneePrincipalRef
                ? 'status-changed'
                : 'reassigned',
          principalRef: authorization.principalRef,
          subjectPrincipalRef: command.assigneePrincipalRef,
          commandKey: command.commandKey,
          occurredAt: now,
        });
        send(
          response,
          200,
          await options.repository.putReviewAssignment(assignment, activity, {
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            boundAt: now,
          }),
        );
        return;
      }
      if (
        request.method === 'POST' &&
        url.pathname === '/api/reviewer-work/comments'
      ) {
        const command = EvidenceReviewCommentCommandSchema.parse(
          await body(request),
        );
        const authorization = await requireAuthorized(
          'review.decide',
          options.workspaceId,
          true,
        );
        if (!('caseId' in authorization) || requestCaseId === null)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        if (
          !evidenceReviewTargetExistsInCase({
            snapshot: await options.repository.snapshot(),
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            targetKind: command.targetKind,
            targetVersionId: command.targetVersionId,
          })
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const now = options.clock.now();
        const commentId = deriveEvidenceReviewOperationId('comment', {
          caseId: requestCaseId,
          commandKey: command.commandKey,
        });
        const comment = EvidenceReviewCommentSchema.parse({
          schemaVersion: 'evidence-review-comment/1',
          commentId,
          organizationId: authorization.organizationId,
          caseId: requestCaseId,
          workspaceId: options.workspaceId,
          targetKind: command.targetKind,
          targetVersionId: command.targetVersionId,
          principalRef: authorization.principalRef,
          body: command.body,
          commandKey: command.commandKey,
          createdAt: now,
        });
        const activity = EvidenceReviewActivitySchema.parse({
          schemaVersion: 'evidence-review-activity/1',
          activityId: deriveEvidenceReviewOperationId('activity', {
            caseId: requestCaseId,
            commandKey: command.commandKey,
          }),
          organizationId: authorization.organizationId,
          caseId: requestCaseId,
          workspaceId: options.workspaceId,
          targetKind: command.targetKind,
          targetVersionId: command.targetVersionId,
          action: 'commented',
          principalRef: authorization.principalRef,
          subjectPrincipalRef: null,
          commandKey: command.commandKey,
          occurredAt: now,
        });
        send(
          response,
          201,
          await options.repository.appendReviewComment(comment, activity, {
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            boundAt: now,
          }),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/reviews/bulk') {
        const command = EvidenceBulkReviewCommandSchema.parse(
          await body(request),
        );
        const authorization = await requireAuthorized(
          'review.decide',
          options.workspaceId,
          true,
        );
        if (!('caseId' in authorization) || requestCaseId === null)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const snapshot = await options.repository.snapshot();
        if (
          !command.targets.every((target) =>
            evidenceReviewTargetExistsInCase({
              snapshot,
              caseId: requestCaseId,
              workspaceId: options.workspaceId,
              targetKind: target.targetKind,
              targetVersionId: target.targetVersionId,
            }),
          )
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const now = options.clock.now();
        const decisions = command.targets.map((target, index) =>
          EvidenceCaseReviewDecisionSchema.parse({
            schemaVersion: 'evidence-review-decision/3',
            reviewDecisionId: options.ids.next('review-decision'),
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            targetKind: target.targetKind,
            targetVersionId: target.targetVersionId,
            action: command.action,
            principalRef: authorization.principalRef,
            principalAssurance: 'authenticated-case-session',
            authorization,
            rationale: command.rationale,
            decidedAt: now,
            commandKey: `${command.commandKey}:${String(index + 1)}`,
            basisEvidenceRevision: command.basisEvidenceRevision,
          }),
        );
        const activities = command.targets.map((target, index) =>
          EvidenceReviewActivitySchema.parse({
            schemaVersion: 'evidence-review-activity/1',
            activityId: deriveEvidenceReviewOperationId('activity', {
              caseId: requestCaseId,
              commandKey: `${command.commandKey}:${String(index + 1)}`,
            }),
            organizationId: authorization.organizationId,
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            targetKind: target.targetKind,
            targetVersionId: target.targetVersionId,
            action: 'bulk-decided',
            principalRef: authorization.principalRef,
            subjectPrincipalRef: null,
            commandKey: command.commandKey,
            occurredAt: now,
          }),
        );
        send(
          response,
          201,
          await options.repository.appendReviewDecisions(
            decisions,
            activities,
            {
              caseId: requestCaseId,
              workspaceId: options.workspaceId,
              boundAt: now,
            },
          ),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/observations') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        if (options.evidenceProjection === undefined)
          throw new RangeError('Observation projection is unavailable.');
        send(
          response,
          200,
          buildEvidencePrimaryObservationLedgerView({
            workspaceId,
            snapshot: await scopedSnapshot(workspaceId),
            evidenceState: await options.evidenceProjection(workspaceId),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/text-imports') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? (await defaultWorkspaceId());
        await requireAuthorized('workspace.read', workspaceId);
        const snapshot = await scopedSnapshot(workspaceId);
        send(response, 200, {
          schemaVersion: 'evidence-text-import-list/1',
          imports: sortTextImportsBySourceTime(snapshot.textImports),
          redactionDrafts: snapshot.redactionDrafts,
          redactionLogs: snapshot.redactionLogs,
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/text-imports') {
        if (requestCaseId === null || options.ingestion === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const payload = (await boundedJsonBody(request, 25_000_000)) as Record<
          string,
          unknown
        >;
        const metadata = EvidenceTextImportMetadataSchema.parse(
          payload.metadata,
        );
        if (
          metadata.schemaVersion === 'evidence-text-import-metadata/2' &&
          options.stageA?.enabled !== true
        )
          throw new EvidenceAuthorizationError(
            403,
            'STAGE_A_IMPORT_CAPABILITY_REQUIRED',
          );
        if (typeof payload.text !== 'string')
          throw new SyntaxError('text is required.');
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          metadata.schemaVersion === 'evidence-text-import-metadata/2'
            ? 'source.import'
            : 'synthetic-fixture.run',
          true,
        );
        if (
          authorization.workspaceId === null ||
          artifactReadAudit === undefined
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const record = await options.ingestion.importText({
          organizationId: authorization.organizationId,
          scope: {
            caseId: requestCaseId,
            workspaceId: authorization.workspaceId,
            boundAt: options.clock.now(),
          },
          metadata,
          bytes: new TextEncoder().encode(payload.text),
          audit: artifactReadAudit,
        });
        send(response, 201, record);
        return;
      }
      const importCancelMatch = /^\/api\/text-imports\/([^/]+)\/cancel$/u.exec(
        url.pathname,
      );
      if (request.method === 'POST' && importCancelMatch?.[1] !== undefined) {
        if (requestCaseId === null || options.ingestion === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const authorization = await requireAuthorized(
          'job.cancel',
          options.workspaceId,
          true,
        );
        if (!('caseId' in authorization) || artifactReadAudit === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const cancelled = await options.ingestion.cancelTextImport({
          scope: {
            caseId: requestCaseId,
            workspaceId: authorization.workspaceId as string,
            boundAt: options.clock.now(),
          },
          importId: decodeURIComponent(importCancelMatch[1]),
          audit: artifactReadAudit,
        });
        send(response, 200, cancelled);
        return;
      }
      if (
        request.method === 'POST' &&
        url.pathname === '/api/redactions/drafts'
      ) {
        if (requestCaseId === null || options.ingestion === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const payload = (await boundedJsonBody(request, 512_000)) as Record<
          string,
          unknown
        >;
        const authorization = await requireAuthorized(
          'review.decide',
          options.workspaceId,
          true,
        );
        if (!('caseId' in authorization) || artifactReadAudit === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const operations = Array.isArray(payload.operations)
          ? payload.operations.map((item) =>
              EvidenceRedactionOperationSchema.parse(item),
            )
          : [];
        const draft = await options.ingestion.putRedactionDraft({
          organizationId: authorization.organizationId,
          scope: {
            caseId: requestCaseId,
            workspaceId: authorization.workspaceId as string,
            boundAt: options.clock.now(),
          },
          ...(typeof payload.draftId === 'string'
            ? { draftId: payload.draftId }
            : {}),
          predecessorRepresentationId: String(
            payload.predecessorRepresentationId ?? '',
          ),
          expectedRepresentationRevision: Number(
            payload.expectedRepresentationRevision,
          ),
          policyReference: String(payload.policyReference ?? ''),
          operations,
          audit: artifactReadAudit,
        });
        send(response, 201, draft);
        return;
      }
      const redactionApplyMatch = /^\/api\/redactions\/([^/]+)\/apply$/u.exec(
        url.pathname,
      );
      if (request.method === 'POST' && redactionApplyMatch?.[1] !== undefined) {
        if (requestCaseId === null || options.ingestion === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const payload = (await boundedJsonBody(request, 32_768)) as Record<
          string,
          unknown
        >;
        const authorization = await requireAuthorized(
          'case.metadata.manage',
          options.workspaceId,
          true,
        );
        if (!('caseId' in authorization) || artifactReadAudit === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const log = await options.ingestion.applyRedaction({
          scope: {
            caseId: requestCaseId,
            workspaceId: authorization.workspaceId as string,
            boundAt: options.clock.now(),
          },
          draftId: decodeURIComponent(redactionApplyMatch[1]),
          commandKey: String(payload.commandKey ?? ''),
          audit: artifactReadAudit,
        });
        send(response, 201, log);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/claims') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        if (options.evidenceProjection === undefined)
          throw new RangeError('Claim projection is unavailable.');
        const sort =
          url.searchParams.get('sort') === 'event-time'
            ? 'event-time'
            : 'source-time';
        send(
          response,
          200,
          buildEvidenceClaimSurfaceView({
            workspaceId,
            snapshot: await scopedSnapshot(workspaceId),
            evidenceState: await options.evidenceProjection(workspaceId),
            sort,
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
        await requireAuthorized('workspace.read', workspaceId);
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
            snapshot: await scopedSnapshot(workspaceId),
            evidenceState: await options.evidenceProjection(workspaceId),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/relations') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        if (options.evidenceProjection === undefined)
          throw new RangeError('Relation projection is unavailable.');
        send(
          response,
          200,
          buildEvidencePrimaryRelationReviewView({
            workspaceId,
            snapshot: await scopedSnapshot(workspaceId),
            evidenceState: await options.evidenceProjection(workspaceId),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/timeline') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        send(
          response,
          200,
          buildEvidencePrimaryTimelineView({
            workspaceId,
            snapshot: await scopedSnapshot(workspaceId),
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/open-questions') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        if (options.evidenceProjection === undefined)
          throw new RangeError('Open-question projection is unavailable.');
        send(
          response,
          200,
          buildEvidencePrimaryOpenQuestionsView({
            workspaceId,
            snapshot: await scopedSnapshot(workspaceId),
            evidenceState: await options.evidenceProjection(workspaceId),
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
        await requireAuthorized('workspace.read', workspaceId);
        const requested = decodeURIComponent(assessmentMatch[1]);
        const snapshot = await scopedSnapshot(workspaceId);
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
        if (assessmentVersionId === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        const view = buildEvidencePrimaryAssessmentView({
          workspaceId,
          assessmentVersionId,
          snapshot,
        });
        send(response, 200, {
          ...view,
          exportPath:
            requestCaseId === null || view.exportPath === null
              ? view.exportPath
              : `/api/cases/${encodeURIComponent(requestCaseId)}/assessments/${encodeURIComponent(assessmentVersionId)}/export`,
        });
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
        await requireAuthorized('review-history.read', workspaceId);
        const snapshot = await scopedSnapshot(workspaceId);
        if (
          !evidenceReviewTargetExistsInWorkspace({
            snapshot,
            workspaceId,
            targetKind: historyMatch[1] as
              'observation' | 'relation' | 'assessment',
            targetVersionId: decodeURIComponent(historyMatch[2]),
          })
        ) {
          send(response, 404, 'Not found.');
          return;
        }
        send(
          response,
          200,
          buildEvidencePrimaryReviewHistoryView({
            workspaceId,
            targetKind: historyMatch[1] as
              'observation' | 'relation' | 'assessment',
            targetVersionId: decodeURIComponent(historyMatch[2]),
            snapshot,
          }),
        );
        return;
      }
      const exportMatch = /^\/api\/assessments\/([^/]+)\/export$/u.exec(
        url.pathname,
      );
      if (request.method === 'GET' && exportMatch?.[1] !== undefined) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('export.download', workspaceId);
        const snapshot = await scopedSnapshot(workspaceId);
        const assessment = snapshot.assessments.find(
          ({ assessmentVersionId }) =>
            assessmentVersionId ===
            decodeURIComponent(exportMatch[1] as string),
        );
        if (assessment === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        const workspace = snapshot.workspaces.find(
          ({ workspaceId }) => workspaceId === assessment.workspaceId,
        );
        if (workspace === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
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
        if (
          requestCaseId !== null &&
          artifactReadAudit !== undefined &&
          options.artifactSecurity !== undefined
        )
          await options.artifactSecurity.recordExport({
            scope: {
              caseId: requestCaseId,
              workspaceId,
              boundAt: options.clock.now(),
            },
            audit: artifactReadAudit,
            exportSha256: exported.exportSha256,
          });
        sendBytes(response, 200, exported.bytes, {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="assessment-${assessment.sequence}.zip"`,
          'x-evidence-export-sha256': exported.exportSha256,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/export-policy') {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        if (requestCaseId === null)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const policy = resolveEvidenceExportPolicy(
          await scopedSnapshot(workspaceId),
          requestCaseId,
        );
        send(response, 200, {
          schemaVersion: 'evidence-export-policy-view/1',
          caseId: requestCaseId,
          enabled: policy.enabled,
          allowedFormats: policy.allowedFormats,
          revision: policy.revision,
          availableFormats: EVIDENCE_ASSESSMENT_OUTPUT_FORMATS,
        });
        return;
      }
      if (request.method === 'PUT' && url.pathname === '/api/export-policy') {
        const authorization = await requireAuthorized(
          'case.metadata.manage',
          options.workspaceId,
          true,
        );
        if (requestCaseId === null || !('caseId' in authorization))
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const command = EvidenceExportPolicyCommandSchema.parse(
          await body(request),
        );
        const current = resolveEvidenceExportPolicy(
          await scopedSnapshot(options.workspaceId),
          requestCaseId,
        );
        if (command.expectedRevision !== current.revision)
          throw new SyntaxError('Export policy revision conflict.');
        const stored = await options.repository.putExportPolicy(
          {
            schemaVersion: 'evidence-export-policy/1',
            organizationId: authorization.organizationId,
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            enabled: command.enabled,
            allowedFormats: command.allowedFormats,
            revision: current.revision + 1,
            updatedByPrincipalRef: authorization.principalRef,
            updatedAt: options.clock.now(),
          },
          {
            caseId: requestCaseId,
            workspaceId: options.workspaceId,
            boundAt: options.clock.now(),
          },
        );
        send(response, 200, stored);
        return;
      }
      const outputMatch =
        /^\/api\/assessments\/([^/]+)\/output\/([^/]+)$/u.exec(url.pathname);
      if (
        request.method === 'GET' &&
        outputMatch?.[1] !== undefined &&
        outputMatch[2] !== undefined
      ) {
        const workspaceId = options.workspaceId;
        const authorization = await requireAuthorized(
          'export.download',
          workspaceId,
        );
        if (requestCaseId === null || !('caseId' in authorization))
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const format = EvidenceAssessmentOutputFormatSchema.parse(
          decodeURIComponent(outputMatch[2]),
        );
        const snapshot = await scopedSnapshot(workspaceId);
        const assessmentVersionId = decodeURIComponent(outputMatch[1]);
        const assessment = snapshot.assessments.find(
          (item) => item.assessmentVersionId === assessmentVersionId,
        );
        if (assessment === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        const scope = {
          caseId: requestCaseId,
          workspaceId,
          boundAt: options.clock.now(),
        };
        const audit = async (
          outcome: 'released' | 'refused',
          reasonCode: string,
          output: { sha256: string; byteLength: number } | null,
        ) => {
          const occurredAt = options.clock.now();
          await options.repository.appendExportAuditRecord(
            {
              schemaVersion: 'evidence-export-audit-record/1',
              // Each release or refusal is its own event, so the identity is
              // generated rather than derived: two downloads of the same bytes
              // must both appear in the audit trail.
              exportAuditId: options.ids.next('export-audit'),
              organizationId: authorization.organizationId,
              caseId: requestCaseId,
              workspaceId,
              assessmentVersionId,
              format,
              outcome,
              reasonCode,
              outputSha256: output?.sha256 ?? null,
              outputByteLength: output?.byteLength ?? null,
              principalRef: authorization.principalRef,
              occurredAt,
            },
            scope,
          );
        };
        try {
          authorizeEvidenceAssessmentExport({
            snapshot,
            caseId: requestCaseId,
            format,
          });
        } catch (error) {
          if (!(error instanceof EvidenceExportRefusedError)) throw error;
          await audit('refused', error.reasonCode, null);
          send(response, 403, error.message);
          return;
        }
        const workspace = snapshot.workspaces.find(
          (item) => item.workspaceId === workspaceId,
        );
        if (workspace === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        const view = buildEvidencePrimaryAssessmentView({
          workspaceId,
          assessmentVersionId,
          snapshot,
        });
        let output;
        try {
          output = renderEvidenceAssessmentOutput(
            buildEvidenceAssessmentOutputDocument({
              dataPolicy: workspace.dataPolicy,
              assessment,
              sources: snapshot.sources,
              observations: snapshot.observations,
              reviewDecisions: snapshot.reviewDecisions,
              effectiveBasisEvidenceRevision:
                view.assessment.effectiveBasisEvidenceRevision,
              newerEvidenceNotice:
                view.newEvidenceNotices.at(-1)?.message ?? null,
            }),
            format,
          );
        } catch (error) {
          await audit('refused', 'export.not-shareable', null);
          send(response, 409, (error as Error).message);
          return;
        }
        await audit('released', 'export.released', {
          sha256: output.outputSha256,
          byteLength: output.bytes.length,
        });
        sendBytes(response, 200, output.bytes, {
          'content-type': output.mediaType,
          'content-disposition': `attachment; filename="${output.fileName}"`,
          'x-evidence-export-sha256': output.outputSha256,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/export-audit') {
        await requireAuthorized('technical-audit.read', options.workspaceId);
        if (requestCaseId === null)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const snapshot = await scopedSnapshot(options.workspaceId);
        send(response, 200, {
          schemaVersion: 'evidence-export-audit-view/1',
          records: snapshot.exportAuditRecords,
        });
        return;
      }
      const sourceMatch = /^\/api\/sources\/([^/]+)$/u.exec(url.pathname);
      if (request.method === 'GET' && sourceMatch?.[1] !== undefined) {
        const workspaceId =
          url.searchParams.get('workspaceId') ?? (await defaultWorkspaceId());
        await requireAuthorized('workspace.read', workspaceId);
        const snapshot = await scopedSnapshot(workspaceId);
        const artifactVersionId = decodeURIComponent(sourceMatch[1]);
        if (
          !snapshot.sources.some(
            (item) => item.artifactVersionId === artifactVersionId,
          )
        ) {
          send(response, 404, 'Not found.');
          return;
        }
        send(
          response,
          200,
          buildEvidencePrimarySourceReviewView({
            workspaceId,
            artifactVersionId,
            snapshot,
          }),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/imports') {
        if (requestCaseId !== null) {
          // Stage 3 deliberately has no arbitrary browser ingestion path.
          EvidenceCaseImportCommandSchema.parse(await body(request));
          send(response, 404, 'Arbitrary ingestion is not available.');
          return;
        }
        const command = EvidenceImportCommandSchema.parse(await body(request));
        await requireAuthorized(
          'synthetic-fixture.run',
          command.workspaceId,
          true,
        );
        send(response, 202, await options.worker.start(command));
        return;
      }
      if (
        request.method === 'POST' &&
        url.pathname === '/api/live-observations'
      ) {
        if (requestCaseId === null || options.liveObservation === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const raw = await boundedJsonBody(request, 100_000);
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          'live-model.run',
          true,
        );
        if (
          authorization.workspaceId === null ||
          artifactReadAudit === undefined
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const scope = {
          caseId: requestCaseId,
          workspaceId: authorization.workspaceId,
          boundAt: options.clock.now(),
        };
        let command: EvidenceCaseLiveObservationCommand;
        try {
          assertNoLiveCredentialFields(raw);
          command = EvidenceCaseLiveObservationCommandSchema.parse(raw);
        } catch (error) {
          await options.liveObservation.refuse({
            reasonCode: 'LIVE_OBSERVATION_COMMAND_INVALID',
            authorization,
            audit: artifactReadAudit,
            scope,
          });
          throw new SyntaxError(
            error instanceof Error
              ? error.message
              : 'Live observation command is invalid.',
            { cause: error },
          );
        }
        try {
          send(
            response,
            202,
            await options.liveObservation.start({
              command,
              authorization,
              audit: artifactReadAudit,
              scope,
            }),
          );
        } catch (error) {
          if (error instanceof EvidenceLiveObservationRefused)
            throw new EvidenceAuthorizationError(error.status, error.reason);
          throw error;
        }
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/live-relations') {
        if (requestCaseId === null || options.liveRelation === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const raw = await boundedJsonBody(request, 100_000);
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          'live-model.run',
          true,
        );
        if (
          authorization.workspaceId === null ||
          artifactReadAudit === undefined
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const scope = {
          caseId: requestCaseId,
          workspaceId: authorization.workspaceId,
          boundAt: options.clock.now(),
        };
        let command: EvidenceCaseLiveRelationCommand;
        try {
          assertNoLiveCredentialFields(raw);
          command = EvidenceCaseLiveRelationCommandSchema.parse(raw);
        } catch (error) {
          await options.liveRelation.refuse({
            reasonCode: 'LIVE_RELATION_COMMAND_INVALID',
            authorization,
            audit: artifactReadAudit,
            scope,
          });
          throw new SyntaxError(
            error instanceof Error
              ? error.message
              : 'Live relation command is invalid.',
            { cause: error },
          );
        }
        try {
          send(
            response,
            202,
            await options.liveRelation.start({
              command,
              authorization,
              audit: artifactReadAudit,
              scope,
            }),
          );
        } catch (error) {
          if (error instanceof EvidenceLiveRelationRefused)
            throw new EvidenceAuthorizationError(error.status, error.reason);
          throw error;
        }
        return;
      }
      if (
        request.method === 'POST' &&
        url.pathname === '/api/live-assessments'
      ) {
        if (requestCaseId === null || options.liveAssessment === undefined)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const raw = await boundedJsonBody(request, 100_000);
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          'live-model.run',
          true,
        );
        if (
          authorization.workspaceId === null ||
          artifactReadAudit === undefined
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        const scope = {
          caseId: requestCaseId,
          workspaceId: authorization.workspaceId,
          boundAt: options.clock.now(),
        };
        let command: EvidenceCaseLiveAssessmentCommand;
        try {
          assertNoLiveCredentialFields(raw);
          command = EvidenceCaseLiveAssessmentCommandSchema.parse(raw);
        } catch (error) {
          await options.liveAssessment.refuse({
            reasonCode: 'LIVE_ASSESSMENT_COMMAND_INVALID',
            authorization,
            audit: artifactReadAudit,
            scope,
          });
          throw new SyntaxError(
            error instanceof Error
              ? error.message
              : 'Live assessment command is invalid.',
            { cause: error },
          );
        }
        try {
          send(
            response,
            202,
            await options.liveAssessment.start({
              command,
              authorization,
              audit: artifactReadAudit,
              scope,
            }),
          );
        } catch (error) {
          if (error instanceof EvidenceLiveAssessmentRefused)
            throw new EvidenceAuthorizationError(error.status, error.reason);
          throw error;
        }
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
        const authorization = await requireAuthorized(
          'synthetic-fixture.run',
          options.lateEvidenceCommand.workspaceId,
          true,
        );
        if (
          requestCaseId !== null &&
          ('caseId' in authorization
            ? authorization.workspaceId
            : options.lateEvidenceCommand.workspaceId) !==
            options.lateEvidenceCommand.workspaceId
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        send(
          response,
          202,
          await options.worker.start(
            options.lateEvidenceCommand,
            requestCaseId === null
              ? undefined
              : {
                  caseId: requestCaseId,
                  workspaceId: options.lateEvidenceCommand.workspaceId,
                  boundAt: options.clock.now(),
                },
          ),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/assessments') {
        if (requestCaseId === null) {
          const command = EvidenceAssessmentCommandSchema.parse(
            await body(request),
          );
          await requireAuthorized(
            'assessment.propose',
            command.workspaceId,
            true,
          );
          send(response, 201, await options.worker.proposeAssessment(command));
          return;
        }
        const command = EvidenceCaseAssessmentCommandSchema.parse(
          await body(request),
        );
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          'assessment.propose',
          true,
        );
        const workspaceId = authorization.workspaceId;
        if (workspaceId === null)
          throw new EvidenceAuthorizationError(404, 'Not found.');
        send(
          response,
          201,
          await options.worker.proposeAssessment(
            EvidenceAssessmentCommandSchema.parse({
              schemaVersion: 'evidence-assessment-command/1',
              workspaceId,
              commandKey: command.commandKey,
              sequence: command.sequence,
              predecessorAssessmentVersionId:
                command.predecessorAssessmentVersionId,
            }),
            {
              caseId: requestCaseId,
              workspaceId,
              boundAt: options.clock.now(),
            },
          ),
        );
        return;
      }
      const jobMatch = /^\/api\/jobs\/([^/]+)$/u.exec(url.pathname);
      if (request.method === 'GET' && jobMatch?.[1] !== undefined) {
        const jobId = decodeURIComponent(jobMatch[1]);
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        const job = (await scopedSnapshot(workspaceId)).jobs.find(
          (value) => value.jobId === jobId,
        );
        if (job === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        send(response, 200, job);
        return;
      }
      const cancelMatch = /^\/api\/jobs\/([^/]+)\/cancel$/u.exec(url.pathname);
      if (request.method === 'POST' && cancelMatch?.[1] !== undefined) {
        const jobId = decodeURIComponent(cancelMatch[1]);
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('job.cancel', workspaceId, true);
        const job = (await scopedSnapshot(workspaceId)).jobs.find(
          (value) => value.jobId === jobId,
        );
        if (job === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        send(
          response,
          200,
          await options.worker.cancel(
            jobId,
            requestCaseId === null
              ? undefined
              : {
                  caseId: requestCaseId,
                  workspaceId,
                  boundAt: options.clock.now(),
                },
          ),
        );
        return;
      }
      const eventMatch = /^\/api\/jobs\/([^/]+)\/events$/u.exec(url.pathname);
      if (request.method === 'GET' && eventMatch?.[1] !== undefined) {
        const jobId = decodeURIComponent(eventMatch[1]);
        const workspaceId =
          url.searchParams.get('workspaceId') ?? options.workspaceId;
        await requireAuthorized('workspace.read', workspaceId);
        const initialJob = (await scopedSnapshot(workspaceId)).jobs.find(
          (value) => value.jobId === jobId,
        );
        if (initialJob === undefined) {
          send(response, 404, 'Not found.');
          return;
        }
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
          connection: 'keep-alive',
        });
        let last = '';
        const emit = async (): Promise<void> => {
          const job = (await scopedSnapshot(workspaceId)).jobs.find(
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
          if (
            ['completed', 'failed', 'cancelled', 'refused'].includes(job.phase)
          )
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
        if (requestCaseId === null) {
          const command = EvidenceAuthenticatedReviewCommandSchema.parse(
            await body(request),
          );
          const authorization = await requireAuthorized(
            'review.decide',
            command.workspaceId,
            true,
          );
          if (
            authorization.schemaVersion !== 'evidence-authorization-context/1'
          )
            throw new Error('Legacy review requires workspace authorization.');
          if (
            !evidenceReviewTargetExistsInWorkspace({
              snapshot: await options.repository.snapshot(),
              workspaceId: command.workspaceId,
              targetKind: command.targetKind,
              targetVersionId: command.targetVersionId,
            })
          )
            throw new EvidenceAuthorizationError(404, 'Not found.');
          send(
            response,
            201,
            await recordAuthenticatedReviewDecision(
              options.repository,
              command,
              authorization,
              options.clock,
              options.ids,
            ),
          );
          return;
        }
        const command = EvidenceCaseReviewCommandSchema.parse(
          await body(request),
        );
        const authorization = await requireCaseAuthorized(
          requestCaseId,
          'review.decide',
          true,
        );
        const workspaceId = authorization.workspaceId;
        if (
          workspaceId === null ||
          !evidenceReviewTargetExistsInCase({
            snapshot: await options.repository.snapshot(),
            caseId: requestCaseId,
            workspaceId,
            targetKind: command.targetKind,
            targetVersionId: command.targetVersionId,
          })
        )
          throw new EvidenceAuthorizationError(404, 'Not found.');
        send(
          response,
          201,
          await recordCaseReviewDecision(
            options.repository,
            command,
            authorization,
            options.clock,
            options.ids,
          ),
        );
        return;
      }
      send(response, 404, 'Not found.');
    } catch (error) {
      const status =
        error instanceof EvidenceAuthenticationError ||
        error instanceof EvidenceAuthorizationError
          ? error.status
          : error instanceof SyntaxError ||
              (error instanceof Error && error.name === 'ZodError')
            ? 400
            : 409;
      send(
        response,
        status,
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
