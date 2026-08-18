import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  EVIDENCE_V2_ARTIFACT_RECORD_VERSION,
  EVIDENCE_V2_CASE_RECORD_VERSION,
  EVIDENCE_V2_SURFACE_GAPS,
  clampEvidenceV2Page,
  type EvidenceV2ArtifactRecord,
  type EvidenceV2CaseRecord,
  type EvidenceV2Repository,
} from '@acme/evidence-v2-contracts';
import {
  deriveEvidenceV2SourceStructure,
  proposeEvidenceV2Chains,
  type EvidenceV2ChainDecision,
} from '@acme/module-evidence-v2';
import type { EvidenceProductAction } from '@acme/evidence-auth';
import {
  renderCase,
  renderChain,
  renderChains,
  renderCases,
  renderPart,
  renderInstance,
  renderCaseStatus,
  renderChainSourceChoice,
  renderParts,
  renderSignIn,
  renderSurfaceGap,
} from '@acme/evidence-workbench-v2-web';

import {
  authorizationStatus,
  cookieValue,
  isAuthenticationError,
  EVIDENCE_V2_CSRF_COOKIE,
  EVIDENCE_V2_SESSION_COOKIE,
  type EvidenceV2Auth,
} from './auth.js';
import type { EvidenceV2Extractor } from './extract.js';
import type { EvidenceV2TextStore } from './artifact-store.js';

/** Bound on a request body. A canonical text of tens of megabytes is normal. */
const MAX_BODY_BYTES = 64 * 1024 * 1024;

export interface EvidenceV2AppOptions {
  readonly repository: EvidenceV2Repository;
  readonly textStore: EvidenceV2TextStore;
  readonly auth: EvidenceV2Auth;
  /** Absent when the deployment has no live model capability configured. */
  readonly extractor?: EvidenceV2Extractor;
  readonly now: () => string;
}

function digestId(prefix: string, ...parts: readonly string[]): string {
  const hash = createHash('sha256').update(parts.join(' ')).digest('hex');
  return `${prefix}-${hash.slice(0, 32)}`;
}

async function readBody(
  request: IncomingMessage,
): Promise<{ readonly text: string }> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) throw new RangeError('REQUEST_BODY_TOO_LARGE');
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString('utf8') };
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function sendHtml(
  response: ServerResponse,
  status: number,
  html: string,
): void {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(html),
  });
  response.end(html);
}

function sendText(
  response: ServerResponse,
  status: number,
  text: string,
): void {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  response.end(text);
}

/**
 * The V2 request handler.
 *
 * Every read comes from stored rows. No route derives a structure or proposes
 * a chain: that happens exactly once, inside the import transaction (R-10).
 * Every list route is bounded (R-08).
 */
export function createEvidenceV2App(
  options: EvidenceV2AppOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const { repository, textStore, auth } = options;

  /**
   * An unauthorized case must be indistinguishable from a missing one, so a
   * refusal from the policy is never rendered as "forbidden" to a caller who
   * is not a member (ADR-0036).
   */
  const denied = (error: unknown): number | undefined => {
    if (isAuthenticationError(error)) return 401;
    return authorizationStatus(error);
  };

  async function importArtifact(
    caseId: string,
    payload: Record<string, unknown>,
  ): Promise<EvidenceV2ArtifactRecord> {
    const text = String(payload['text'] ?? '');
    if (text.length === 0) throw new RangeError('EMPTY_TEXT');
    const title = String(payload['title'] ?? 'Untitled source');
    const provenanceInput = (payload['provenance'] ?? {}) as Record<
      string,
      unknown
    >;
    const now = options.now();
    const artifactId = digestId('artifact', caseId, text);

    const stored = await textStore.put({
      caseId,
      artifactId,
      text,
      commandKey: digestId('import', caseId, artifactId),
      now,
    });

    // Derived once, here, and never again on a read path.
    const structure = deriveEvidenceV2SourceStructure(text);
    const proposal = proposeEvidenceV2Chains(structure, text);

    const artifact: EvidenceV2ArtifactRecord = {
      schemaVersion: EVIDENCE_V2_ARTIFACT_RECORD_VERSION,
      artifactId,
      caseId,
      title,
      canonicalSha256: stored.canonicalSha256,
      canonicalByteLength: stored.canonicalByteLength,
      lineCount: structure.lineCount,
      partCount: structure.parts.length,
      chainCount: proposal.chains.length,
      objectKey: stored.objectKey,
      representation: stored.representation,
      envelope: stored.envelope,
      importedAt: now,
      structureRuleVersion: structure.ruleVersion,
      chainRuleVersion: proposal.ruleVersion,
      provenance: {
        parentKind: String(provenanceInput['parentKind'] ?? 'unknown'),
        parentSha256: String(provenanceInput['parentSha256'] ?? ''),
        parentByteLength: Number(provenanceInput['parentByteLength'] ?? 0),
        pageCount:
          provenanceInput['pageCount'] === undefined
            ? null
            : Number(provenanceInput['pageCount']),
        extractionMethod: String(
          provenanceInput['extractionMethod'] ?? 'unknown',
        ),
        extractedAt: String(provenanceInput['extractedAt'] ?? now),
      },
    };

    await repository.writeImport({ artifact, structure, proposal });
    return artifact;
  }

  async function partView(artifactId: string, partId: string) {
    const artifact = await repository.readArtifact(artifactId);
    if (artifact === undefined) return undefined;
    const part = await repository.readPart(artifactId, partId);
    if (part === undefined) return undefined;
    const text = await textStore.get({
      representation: artifact.representation,
      envelope: artifact.envelope,
      objectKey: artifact.objectKey,
      canonicalSha256: artifact.canonicalSha256,
      canonicalByteLength: artifact.canonicalByteLength,
    });
    const lines = text.split('\n').slice(part.startLine - 1, part.endLine);
    const memberships = await repository.readEffectiveMemberships(artifactId);
    const chains = await Promise.all(
      memberships
        .filter((item) => item.sourcePartId === partId)
        .map(async (item) => {
          const detail = await repository.readChain(artifactId, item.chainId);
          return {
            chainId: item.chainId,
            subjectLabel: detail?.chain.subjectLabel ?? item.chainId,
          };
        }),
    );
    return { artifact, part, lines, chains };
  }

  return async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const path = url.pathname.replace(/\/+$/u, '') || '/';
    const method = request.method ?? 'GET';
    const json =
      url.searchParams.get('format') === 'json' || path.startsWith('/api/');
    const page = clampEvidenceV2Page(
      Number(url.searchParams.get('offset') ?? '0'),
      Number(url.searchParams.get('limit') ?? '25'),
    );

    try {
      if (method === 'GET' && path === '/health')
        return void sendJson(response, 200, {
          status: 'ok',
          service: 'evidence-workbench-v2-api',
        });

      // Same-origin is required for every unsafe method, exactly as the frozen
      // application requires it (ADR-0035).
      if (!['GET', 'HEAD'].includes(method)) {
        const origin = request.headers.origin;
        const host = request.headers.host;
        if (
          typeof origin === 'string' &&
          origin !== `http://${String(host)}` &&
          origin !== `https://${String(host)}`
        )
          return void sendText(response, 403, 'Cross-origin write refused.');
      }

      if (method === 'POST' && path === '/auth/session') {
        const body = await readBody(request);
        // The browser form posts urlencoded and wants a redirect; a client
        // posts JSON and wants the CSRF token back.
        const jsonBody = body.text.trimStart().startsWith('{');
        const wantsJson = json || jsonBody;
        const payload = jsonBody
          ? (JSON.parse(body.text) as Record<string, unknown>)
          : Object.fromEntries(new URLSearchParams(body.text));
        let session;
        try {
          session = await auth.login({
            email: String(payload['email'] ?? ''),
            password: String(payload['password'] ?? ''),
          });
        } catch {
          if (wantsJson)
            return void sendJson(response, 401, { error: 'Unauthorized.' });
          return void sendHtml(
            response,
            401,
            renderSignIn({ error: 'Invalid credentials.' }),
          );
        }
        const cookies = [
          `${EVIDENCE_V2_SESSION_COOKIE}=${encodeURIComponent(session.rawToken)}; Path=/; HttpOnly; SameSite=Strict`,
          `${EVIDENCE_V2_CSRF_COOKIE}=${encodeURIComponent(session.csrfToken)}; Path=/; SameSite=Strict`,
        ];
        if (wantsJson) {
          response.writeHead(201, {
            'content-type': 'application/json; charset=utf-8',
            'set-cookie': cookies,
          });
          response.end(
            JSON.stringify({
              principalRef: session.principal.principalRef,
              displayLabel: session.principal.displayLabel,
              csrfToken: session.csrfToken,
            }),
          );
          return;
        }
        response.writeHead(303, { location: '/', 'set-cookie': cookies });
        response.end();
        return;
      }

      if (method === 'DELETE' && path === '/auth/session') {
        const rawToken = cookieValue(request, EVIDENCE_V2_SESSION_COOKIE);
        if (rawToken !== null) {
          try {
            await auth.logout(rawToken);
          } catch {
            // A session that cannot be resolved is already unusable.
          }
        }
        response.writeHead(204, {
          'set-cookie': [
            `${EVIDENCE_V2_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
            `${EVIDENCE_V2_CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0`,
          ],
        });
        response.end();
        return;
      }

      if (method === 'POST' && path === '/sign-out') {
        const rawToken = cookieValue(request, EVIDENCE_V2_SESSION_COOKIE);
        if (rawToken !== null) {
          try {
            await auth.logout(rawToken);
          } catch {
            // Already unusable.
          }
        }
        response.writeHead(303, {
          location: '/',
          'set-cookie': [
            `${EVIDENCE_V2_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
            `${EVIDENCE_V2_CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0`,
          ],
        });
        response.end();
        return;
      }

      // Everything below requires an authenticated principal. Deny by default.
      let principal;
      try {
        principal = await auth.requirePrincipal(request);
      } catch (error) {
        if (json || method !== 'GET')
          return void sendText(response, denied(error) ?? 401, 'Unauthorized.');
        return void sendHtml(response, 401, renderSignIn({}));
      }
      const viewer = {
        principalRef: principal.principalRef,
        displayLabel: principal.displayLabel,
      };

      /** Authorize a case-scoped route, or answer 404/403 exactly as the policy says. */
      const authorizeCase = async (
        caseId: string,
        action: EvidenceProductAction,
      ): Promise<boolean> => {
        try {
          await auth.requireCase({
            principalRef: principal.principalRef,
            caseId,
            action,
          });
          return true;
        } catch (error) {
          const status = denied(error) ?? 404;
          sendText(
            response,
            status,
            status === 403 ? 'Forbidden.' : 'Not found.',
          );
          return false;
        }
      };

      /** Case-scoped authorization for a route addressed by artifact. */
      const authorizeArtifact = async (
        artifactId: string,
        action: EvidenceProductAction,
      ): Promise<{ readonly caseId: string } | undefined> => {
        const artifact = await repository.readArtifact(artifactId);
        if (artifact === undefined) {
          sendText(response, 404, 'Not found.');
          return undefined;
        }
        if (!(await authorizeCase(artifact.caseId, action))) return undefined;
        return { caseId: artifact.caseId };
      };

      if (method === 'GET' && (path === '/' || path === '/api/cases')) {
        const visible = await auth.visibleCaseIds(principal.principalRef);
        const all = await repository.listCases({ offset: 0, limit: 1000 });
        const mine = all.items.filter((item) => visible.has(item.caseId));
        const cases = {
          items: mine.slice(page.offset, page.offset + page.limit),
          total: mine.length,
          offset: page.offset,
          limit: page.limit,
        };
        if (json) return void sendJson(response, 200, cases);
        return void sendHtml(response, 200, renderCases(cases, viewer));
      }

      if (method === 'POST' && (path === '/cases' || path === '/api/cases')) {
        const body = await readBody(request);
        const payload = json
          ? (JSON.parse(body.text) as Record<string, unknown>)
          : Object.fromEntries(new URLSearchParams(body.text));
        const title = String(payload['title'] ?? '').trim();
        const caseReference = String(payload['caseReference'] ?? '').trim();
        if (title.length === 0 || caseReference.length === 0)
          return void sendText(
            response,
            400,
            'Title and case reference are required.',
          );
        const record: EvidenceV2CaseRecord = {
          schemaVersion: EVIDENCE_V2_CASE_RECORD_VERSION,
          caseId: digestId('case', caseReference, title),
          title,
          caseReference,
          createdAt: options.now(),
        };
        await repository.createCase(record);
        await auth.registerCase({
          caseId: record.caseId,
          title: record.title,
          caseReference: record.caseReference,
          principalRef: principal.principalRef,
        });
        if (json) return void sendJson(response, 201, record);
        response.writeHead(303, { location: `/cases/${record.caseId}` });
        response.end();
        return;
      }

      // The case landing and the documents surface answer from one renderer:
      // both are about the case's sources, and ADR-0049 lists them as separate
      // entries, so they get separate URLs rather than separate pages.
      const caseMatch = /^\/(?:api\/)?cases\/([^/]+)(?:\/(documents))?$/u.exec(
        path,
      );
      if (method === 'GET' && caseMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(caseMatch[1]);
        if (!(await authorizeCase(caseId, 'workspace.read'))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');
        const artifacts = await repository.listArtifacts(caseId, page);
        if (json)
          return void sendJson(response, 200, { case: record, artifacts });
        return void sendHtml(
          response,
          200,
          renderCase({
            caseId,
            caseTitle: record.title,
            caseReference: record.caseReference,
            active: caseMatch[2] === 'documents' ? 'documents' : 'case',
            viewer,
            artifacts: {
              ...artifacts,
              items: artifacts.items.map((item) => ({
                artifactId: item.artifactId,
                title: item.title,
                lineCount: item.lineCount,
                partCount: item.partCount,
                chainCount: item.chainCount,
                canonicalSha256: item.canonicalSha256,
                importedAt: item.importedAt,
              })),
            },
          }),
        );
      }

      // Chains belong to an artifact version. A case with exactly one source
      // goes straight there; anything else has to be asked, not guessed.
      const caseChainsMatch = /^\/(?:api\/)?cases\/([^/]+)\/chains$/u.exec(
        path,
      );
      if (method === 'GET' && caseChainsMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(caseChainsMatch[1]);
        if (!(await authorizeCase(caseId, 'workspace.read'))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');
        const artifacts = await repository.listArtifacts(caseId, page);
        const only = artifacts.total === 1 ? artifacts.items[0] : undefined;
        if (only !== undefined && !json) {
          response.writeHead(303, {
            location: `/artifacts/${encodeURIComponent(only.artifactId)}/chains`,
          });
          response.end();
          return;
        }
        if (json)
          return void sendJson(response, 200, {
            sources: artifacts.items.map((item) => ({
              artifactId: item.artifactId,
              title: item.title,
              chainCount: item.chainCount,
            })),
            total: artifacts.total,
          });
        return void sendHtml(
          response,
          200,
          renderChainSourceChoice({
            caseId,
            caseTitle: record.title,
            caseReference: record.caseReference,
            viewer,
            artifacts: {
              ...artifacts,
              items: artifacts.items.map((item) => ({
                artifactId: item.artifactId,
                title: item.title,
                lineCount: item.lineCount,
                partCount: item.partCount,
                chainCount: item.chainCount,
                canonicalSha256: item.canonicalSha256,
                importedAt: item.importedAt,
              })),
            },
          }),
        );
      }

      // Status: one projection over stored rows. It writes nothing, and its
      // counts come from the same rows the list routes page through, so the
      // two cannot disagree (R-07).
      const statusMatch = /^\/(?:api\/)?cases\/([^/]+)\/status$/u.exec(path);
      if (method === 'GET' && statusMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(statusMatch[1]);
        if (!(await authorizeCase(caseId, 'workspace.read'))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');
        const overview = await repository.readCaseOverview(caseId);
        if (json) return void sendJson(response, 200, overview);
        return void sendHtml(
          response,
          200,
          renderCaseStatus({
            caseId,
            caseTitle: record.title,
            caseReference: record.caseReference,
            overview,
            viewer,
          }),
        );
      }

      // Surfaces ADR-0049 names that ACME-0160 to ACME-0162 deliver. They are
      // reachable and they state their own condition. A surface that does not
      // exist must never answer with an empty list (R-07).
      const gapMatch =
        /^\/(?:api\/)?cases\/([^/]+)\/(timeline|relations)$/u.exec(path);
      if (method === 'GET' && gapMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(gapMatch[1]);
        if (!(await authorizeCase(caseId, 'workspace.read'))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');
        const surface = gapMatch[2] === 'timeline' ? 'timeline' : 'relations';
        const gap = EVIDENCE_V2_SURFACE_GAPS[surface];
        if (json) return void sendJson(response, 200, { surface, ...gap });
        return void sendHtml(
          response,
          200,
          renderSurfaceGap({
            context: {
              caseId,
              caseTitle: record.title,
              caseReference: record.caseReference,
              active: surface,
            },
            heading: surface === 'timeline' ? 'Timeline' : 'Relations',
            gap,
            viewer,
          }),
        );
      }

      const importMatch = /^\/api\/cases\/([^/]+)\/artifacts$/u.exec(path);
      if (method === 'POST' && importMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(importMatch[1]);
        if (!(await authorizeCase(caseId, 'source.import'))) return;
        if ((await repository.readCase(caseId)) === undefined)
          return void sendText(response, 404, 'No such case.');
        const body = await readBody(request);
        const artifact = await importArtifact(
          caseId,
          JSON.parse(body.text) as Record<string, unknown>,
        );
        return void sendJson(response, 201, {
          artifactId: artifact.artifactId,
          canonicalSha256: artifact.canonicalSha256,
          lineCount: artifact.lineCount,
          partCount: artifact.partCount,
          chainCount: artifact.chainCount,
        });
      }

      const partsMatch = /^\/(?:api\/)?artifacts\/([^/]+)\/parts$/u.exec(path);
      if (method === 'GET' && partsMatch?.[1] !== undefined) {
        const artifactId = decodeURIComponent(partsMatch[1]);
        if (
          (await authorizeArtifact(artifactId, 'workspace.read')) === undefined
        )
          return;
        const artifact = await repository.readArtifact(artifactId);
        if (artifact === undefined)
          return void sendText(response, 404, 'No such artifact.');
        const parts = await repository.listParts(artifactId, page);
        if (json) return void sendJson(response, 200, parts);
        const record = await repository.readCase(artifact.caseId);
        return void sendHtml(
          response,
          200,
          renderParts({
            caseId: artifact.caseId,
            caseTitle: record?.title ?? artifact.caseId,
            artifactId,
            artifactTitle: artifact.title,
            parts: {
              ...parts,
              items: parts.items.map((part) => ({
                partId: part.partId,
                startLine: part.startLine,
                endLine: part.endLine,
                contentCharacter: part.contentCharacter,
                title: part.title?.text ?? null,
              })),
            },
          }),
        );
      }

      const partMatch =
        /^\/(?:api\/)?artifacts\/([^/]+)\/parts\/([^/]+)$/u.exec(path);
      if (
        method === 'GET' &&
        partMatch?.[1] !== undefined &&
        partMatch[2] !== undefined
      ) {
        const artifactId = decodeURIComponent(partMatch[1]);
        if (
          (await authorizeArtifact(artifactId, 'workspace.read')) === undefined
        )
          return;
        const view = await partView(
          artifactId,
          decodeURIComponent(partMatch[2]),
        );
        if (view === undefined)
          return void sendText(response, 404, 'No such part.');
        if (json)
          return void sendJson(response, 200, {
            part: view.part,
            lines: view.lines,
            chains: view.chains,
          });
        const record = await repository.readCase(view.artifact.caseId);
        return void sendHtml(
          response,
          200,
          renderPart({
            caseId: view.artifact.caseId,
            caseTitle: record?.title ?? view.artifact.caseId,
            artifactId,
            partId: view.part.partId,
            startLine: view.part.startLine,
            endLine: view.part.endLine,
            contentCharacter: view.part.contentCharacter,
            title: view.part.title?.text ?? null,
            titleSourceLine: view.part.title?.sourceLine ?? null,
            lines: view.lines,
            unitCount: view.part.units.length,
            chains: view.chains,
          }),
        );
      }

      const chainsMatch = /^\/(?:api\/)?artifacts\/([^/]+)\/chains$/u.exec(
        path,
      );
      if (method === 'GET' && chainsMatch?.[1] !== undefined) {
        const artifactId = decodeURIComponent(chainsMatch[1]);
        if (
          (await authorizeArtifact(artifactId, 'workspace.read')) === undefined
        )
          return;
        const artifact = await repository.readArtifact(artifactId);
        if (artifact === undefined)
          return void sendText(response, 404, 'No such artifact.');
        const chains = await repository.listChains(artifactId, page);
        if (json) return void sendJson(response, 200, chains);
        const record = await repository.readCase(artifact.caseId);
        return void sendHtml(
          response,
          200,
          renderChains({
            caseId: artifact.caseId,
            caseTitle: record?.title ?? artifact.caseId,
            artifactId,
            chains,
          }),
        );
      }

      const chainMatch =
        /^\/(?:api\/)?artifacts\/([^/]+)\/chains\/([^/]+)$/u.exec(path);
      if (
        method === 'GET' &&
        chainMatch?.[1] !== undefined &&
        chainMatch[2] !== undefined
      ) {
        const artifactId = decodeURIComponent(chainMatch[1]);
        if (
          (await authorizeArtifact(artifactId, 'workspace.read')) === undefined
        )
          return;
        const detail = await repository.readChain(
          artifactId,
          decodeURIComponent(chainMatch[2]),
        );
        if (detail === undefined)
          return void sendText(response, 404, 'No such chain.');
        if (json) return void sendJson(response, 200, detail);
        const artifact = await repository.readArtifact(artifactId);
        const record =
          artifact === undefined
            ? undefined
            : await repository.readCase(artifact.caseId);
        return void sendHtml(
          response,
          200,
          renderChain({
            caseId: artifact?.caseId ?? '',
            caseTitle: record?.title ?? '',
            artifactId,
            chainId: detail.chain.chainId,
            subjectLabel: detail.chain.subjectLabel,
            caseFileRef: detail.chain.caseFileRef,
            instances: detail.chain.instances.map((instance) => ({
              instanceOrdinal: instance.instanceOrdinal,
              sourceTime: instance.instanceSourceTime.from ?? 'unknown',
              kind: instance.instanceSourceTime.kind,
              sourceLine: instance.instanceSourceTime.sourceLine,
              ordered: instance.ordered,
              sourcePartIds: instance.sourcePartIds,
            })),
          }),
        );
      }

      // Extraction: plan states the bounded call count; run executes the
      // outstanding windows and reports a partial outcome honestly.
      const extractMatch =
        /^\/api\/artifacts\/([^/]+)\/chains\/([^/]+)\/instances\/([^/]+)\/extraction$/u.exec(
          path,
        );
      if (
        extractMatch?.[1] !== undefined &&
        extractMatch[2] !== undefined &&
        extractMatch[3] !== undefined
      ) {
        const artifactId = decodeURIComponent(extractMatch[1]);
        const chainId = decodeURIComponent(extractMatch[2]);
        const instanceKey = decodeURIComponent(extractMatch[3]);
        const action: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'live-model.run';
        const scope = await authorizeArtifact(artifactId, action);
        if (scope === undefined) return;
        if (options.extractor === undefined)
          return void sendText(
            response,
            501,
            'This deployment has no live model capability.',
          );
        const detail = await repository.readChain(artifactId, chainId);
        const instance = detail?.chain.instances.find(
          (item) => item.instanceKey === instanceKey,
        );
        if (instance === undefined)
          return void sendText(response, 404, 'Not found.');

        if (method === 'GET') {
          const plan = await options.extractor.plan({
            artifactId,
            chainId,
            instanceKey,
            sourcePartIds: instance.sourcePartIds,
          });
          const windows = await repository.readExtractionWindows(
            artifactId,
            instanceKey,
          );
          const occurrences = await repository.listOccurrences(
            artifactId,
            instanceKey,
            page,
          );
          return void sendJson(response, 200, {
            plannedModelCalls: plan.plannedModelCalls,
            windowCount: plan.windows.length,
            outstandingWindowIds: plan.outstandingWindowIds,
            committedWindowIds: plan.committedWindowIds,
            windows,
            occurrences,
          });
        }
        if (method === 'POST') {
          const outcome = await options.extractor.run({
            caseId: scope.caseId,
            artifactId,
            chainId,
            instanceKey,
            sourcePartIds: instance.sourcePartIds,
          });
          return void sendJson(response, outcome.complete ? 201 : 207, outcome);
        }
      }

      const occurrenceMatch =
        /^\/(?:api\/)?artifacts\/([^/]+)\/chains\/([^/]+)\/instances\/([^/]+)$/u.exec(
          path,
        );
      if (
        method === 'GET' &&
        occurrenceMatch?.[1] !== undefined &&
        occurrenceMatch[2] !== undefined &&
        occurrenceMatch[3] !== undefined
      ) {
        const artifactId = decodeURIComponent(occurrenceMatch[1]);
        const chainId = decodeURIComponent(occurrenceMatch[2]);
        const instanceKey = decodeURIComponent(occurrenceMatch[3]);
        if (
          (await authorizeArtifact(artifactId, 'workspace.read')) === undefined
        )
          return;
        const detail = await repository.readChain(artifactId, chainId);
        const instance = detail?.chain.instances.find(
          (item) => item.instanceKey === instanceKey,
        );
        if (detail === undefined || instance === undefined)
          return void sendText(response, 404, 'Not found.');
        const occurrences = await repository.listOccurrences(
          artifactId,
          instanceKey,
          page,
        );
        const windows = await repository.readExtractionWindows(
          artifactId,
          instanceKey,
        );
        if (json)
          return void sendJson(response, 200, {
            instance,
            occurrences,
            windows,
          });
        const artifact = await repository.readArtifact(artifactId);
        const record =
          artifact === undefined
            ? undefined
            : await repository.readCase(artifact.caseId);
        return void sendHtml(
          response,
          200,
          renderInstance({
            caseId: artifact?.caseId ?? '',
            caseTitle: record?.title ?? '',
            artifactId,
            chainId,
            subjectLabel: detail.chain.subjectLabel,
            instanceOrdinal: instance.instanceOrdinal,
            sourceTime: instance.instanceSourceTime.from ?? 'unknown',
            sourcePartIds: instance.sourcePartIds,
            occurrences: {
              ...occurrences,
              items: occurrences.items.map((occurrence) => ({
                occurrenceId: occurrence.occurrenceId,
                partId: occurrence.partId,
                startLine: occurrence.startLine,
                endLine: occurrence.endLine,
                kind: occurrence.kind,
                exactQuote: occurrence.exactQuote,
                temporal: occurrence.temporalBound?.from ?? null,
              })),
            },
            windows: windows.map((window) => ({
              windowId: window.windowId,
              status: window.status,
              unitCount: window.unitCount,
              occurrenceCount: window.occurrenceCount,
              failureCode: window.failureCode,
            })),
          }),
        );
      }

      const decisionMatch =
        /^\/api\/artifacts\/([^/]+)\/chain-decisions$/u.exec(path);
      if (decisionMatch?.[1] !== undefined) {
        const artifactId = decodeURIComponent(decisionMatch[1]);
        const action: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'review.decide';
        if ((await authorizeArtifact(artifactId, action)) === undefined) return;
        if (method === 'GET')
          return void sendJson(
            response,
            200,
            await repository.listChainDecisions(artifactId),
          );
        if (method === 'POST') {
          const body = await readBody(request);
          const decision = JSON.parse(body.text) as EvidenceV2ChainDecision;
          await repository.appendChainDecision(artifactId, decision);
          return void sendJson(response, 201, {
            appended: decision.decisionId,
            memberships: await repository.readEffectiveMemberships(artifactId),
          });
        }
      }

      if (method === 'GET' && path === '/health')
        return void sendJson(response, 200, {
          status: 'ok',
          service: 'evidence-workbench-v2-api',
        });

      return void sendText(response, 404, 'Not found.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected error.';
      return void sendText(response, 500, message);
    }
  };
}
