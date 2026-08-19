import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  EVIDENCE_V2_ARTIFACT_RECORD_VERSION,
  EVIDENCE_V2_CASE_RECORD_VERSION,
  clampEvidenceV2Page,
  EVIDENCE_V2_PDF_EXTRACTOR_METHOD,
  EVIDENCE_V2_PDF_EXTRACTOR_RULE_VERSION,
  EVIDENCE_V2_PDF_SOURCE_CLASS,
  EVIDENCE_V2_TEXT_SOURCE_CLASS,
  type EvidenceV2ArtifactRecord,
  type EvidenceV2CaseRecord,
  type EvidenceV2PdfExtractor,
  type EvidenceV2Repository,
} from '@acme/evidence-v2-contracts';
import {
  EVIDENCE_V2_CLAIM_SCHEMA_VERSION,
  EVIDENCE_V2_RELATION_SCHEMA_VERSION,
  EVIDENCE_V2_RELATION_REVIEW_SCHEMA_VERSION,
  EVIDENCE_V2_REVIEW_SCHEMA_VERSION,
  EvidenceV2ClaimGroupingActionSchema,
  EvidenceV2ComparableScopeSchema,
  EvidenceV2RelationEndpointKindSchema,
  EvidenceV2RelationReviewActionSchema,
  EvidenceV2RelationTypeSchema,
  EvidenceV2ReviewActionSchema,
  deriveEvidenceV2ClaimGroupingDecisionId,
  deriveEvidenceV2ClaimId,
  deriveEvidenceV2ClaimMemberships,
  projectEvidenceV2Claim,
  deriveEvidenceV2CaseRevision,
  deriveEvidenceV2ChainCompletion,
  deriveEvidenceV2InstanceCompletion,
  deriveEvidenceV2RelationStandings,
  projectEvidenceV2Consensus,
  projectEvidenceV2Timeline,
  deriveEvidenceV2OccurrenceId,
  deriveEvidenceV2RelationId,
  deriveEvidenceV2RelationReviewDecisionId,
  deriveEvidenceV2ReviewDecisionId,
  deriveEvidenceV2SourceStructure,
  deriveEvidenceV2Standings,
  evidenceV2ContradictionScopeIssues,
  projectEvidenceV2Relation,
  proposeEvidenceV2Chains,
  type EvidenceV2ChainDecision,
  type EvidenceV2Claim,
  type EvidenceV2ClaimGroupingDecision,
  type EvidenceV2EffectiveStanding,
  type EvidenceV2InstanceCompletion,
  type EvidenceV2Occurrence,
  type EvidenceV2Relation,
  type EvidenceV2RelationEndpointInput,
  type EvidenceV2ReviewDecision,
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
  renderClaim,
  renderClaims,
  renderParts,
  renderConsensus,
  renderRelation,
  renderRelations,
  renderSignIn,
  renderTimeline,
} from '@acme/evidence-workbench-v2-web';

import {
  authorizationStatus,
  cookieValue,
  isAuthenticationError,
  EVIDENCE_V2_CSRF_COOKIE,
  EVIDENCE_V2_SESSION_COOKIE,
  type EvidenceV2Auth,
} from './auth.js';
import type { EvidenceV2Comparer } from './compare.js';
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
  readonly comparer?: EvidenceV2Comparer;
  readonly pdfExtractor?: EvidenceV2PdfExtractor;
  readonly now: () => string;
}

export class EvidenceV2ImportRefusal extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'EvidenceV2ImportRefusal';
  }
}

function digestId(prefix: string, ...parts: readonly string[]): string {
  const hash = createHash('sha256').update(parts.join(' ')).digest('hex');
  return `${prefix}-${hash.slice(0, 32)}`;
}

async function readBody(request: IncomingMessage): Promise<{
  readonly text: string;
  readonly bytes: Buffer;
}> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) throw new RangeError('REQUEST_BODY_TOO_LARGE');
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  return { text: bytes.toString('utf8'), bytes };
}

function multipartBoundary(contentType: string): string | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/iu.exec(contentType);
  const value = match?.[1] ?? match?.[2];
  return value === undefined ? undefined : value.trim();
}

function parseMultipart(
  bytes: Buffer,
  contentType: string,
): {
  readonly fields: Record<string, string>;
  readonly files: Record<string, Buffer>;
} {
  const boundary = multipartBoundary(contentType);
  if (boundary === undefined)
    throw new EvidenceV2ImportRefusal('EVIDENCE_V2_PDF_NOT_PDF');
  const token = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  const files: Record<string, Buffer> = {};
  let cursor = 0;
  while (cursor < bytes.byteLength) {
    const start = bytes.indexOf(token, cursor);
    if (start === -1) break;
    let partStart = start + token.byteLength;
    if (bytes[partStart] === 13 && bytes[partStart + 1] === 10) partStart += 2;
    if (bytes[partStart] === 45 && bytes[partStart + 1] === 45) break;
    const next = bytes.indexOf(token, partStart);
    if (next === -1) break;
    let part = bytes.subarray(partStart, next);
    if (part.byteLength >= 2 && part[part.byteLength - 2] === 13)
      part = part.subarray(0, part.byteLength - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      cursor = next;
      continue;
    }
    const header = part.subarray(0, headerEnd).toString('utf8');
    const body = part.subarray(headerEnd + 4);
    const name = /name="([^"]+)"/u.exec(header)?.[1];
    if (name !== undefined) {
      if (/filename=/u.test(header)) files[name] = Buffer.from(body);
      else fields[name] = body.toString('utf8');
    }
    cursor = next;
  }
  return { fields, files };
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

  async function persistStructuredSource(input: {
    readonly caseId: string;
    readonly title: string;
    readonly text: string;
    readonly now: string;
    readonly artifactId: string;
    readonly provenance: EvidenceV2ArtifactRecord['provenance'];
    readonly sourceClass?: string;
    readonly extractionRuleVersion?: string;
    readonly received?: EvidenceV2ArtifactRecord['received'];
  }): Promise<EvidenceV2ArtifactRecord> {
    const stored = await textStore.put({
      caseId: input.caseId,
      artifactId: input.artifactId,
      text: input.text,
      commandKey: digestId('import', input.caseId, input.artifactId),
      now: input.now,
    });
    const structure = deriveEvidenceV2SourceStructure(input.text);
    const proposal = proposeEvidenceV2Chains(structure, input.text);
    const artifact: EvidenceV2ArtifactRecord = {
      schemaVersion: EVIDENCE_V2_ARTIFACT_RECORD_VERSION,
      artifactId: input.artifactId,
      caseId: input.caseId,
      title: input.title,
      canonicalSha256: stored.canonicalSha256,
      canonicalByteLength: stored.canonicalByteLength,
      lineCount: structure.lineCount,
      partCount: structure.parts.length,
      chainCount: proposal.chains.length,
      objectKey: stored.objectKey,
      representation: stored.representation,
      envelope: stored.envelope,
      importedAt: input.now,
      structureRuleVersion: structure.ruleVersion,
      chainRuleVersion: proposal.ruleVersion,
      provenance: input.provenance,
      ...(input.sourceClass === undefined
        ? {}
        : { sourceClass: input.sourceClass }),
      ...(input.extractionRuleVersion === undefined
        ? {}
        : { extractionRuleVersion: input.extractionRuleVersion }),
      ...(input.received === undefined ? {} : { received: input.received }),
    };
    await repository.writeImport({ artifact, structure, proposal });
    return artifact;
  }

  async function importTextArtifact(
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
    return persistStructuredSource({
      caseId,
      title,
      text,
      now,
      artifactId,
      sourceClass: EVIDENCE_V2_TEXT_SOURCE_CLASS,
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
    });
  }

  async function importPdfArtifact(
    caseId: string,
    input: {
      readonly title: string;
      readonly bytes: Uint8Array;
      readonly principalRef: string;
    },
  ): Promise<EvidenceV2ArtifactRecord> {
    if (options.pdfExtractor === undefined)
      throw new EvidenceV2ImportRefusal('EVIDENCE_V2_PDF_EXTRACT_FAILED');
    const extracted = await options.pdfExtractor.extract(input.bytes);
    if (!extracted.ok) throw new EvidenceV2ImportRefusal(extracted.code);

    const now = options.now();
    const receivedSha256 = createHash('sha256')
      .update(input.bytes)
      .digest('hex');
    const artifactId = digestId('artifact', caseId, receivedSha256);
    const commandKey = digestId('import', caseId, artifactId);
    const received = await textStore.putBytes({
      caseId,
      artifactId,
      bytes: input.bytes,
      kind: 'original',
      mediaType: 'application/pdf',
      commandKey,
      now,
      principalRef: input.principalRef,
    });

    return persistStructuredSource({
      caseId,
      title: input.title,
      text: extracted.value.text,
      now,
      artifactId,
      sourceClass: EVIDENCE_V2_PDF_SOURCE_CLASS,
      extractionRuleVersion: EVIDENCE_V2_PDF_EXTRACTOR_RULE_VERSION,
      received: {
        sha256: received.sha256,
        byteLength: received.byteLength,
        objectKey: received.objectKey,
        mediaType: 'application/pdf',
        representation: received.representation,
        envelope: received.envelope,
      },
      provenance: {
        parentKind: 'pdf',
        parentSha256: received.sha256,
        parentByteLength: received.byteLength,
        pageCount: extracted.value.pageCount,
        extractionMethod: EVIDENCE_V2_PDF_EXTRACTOR_METHOD,
        extractedAt: now,
      },
    });
  }

  /**
   * Standing and completion for one instance, folded on read.
   *
   * Nothing here is stored. A stored completion flag would be a second source
   * of truth the decision log could contradict, and the log is the authority.
   */
  /**
   * Every occurrence of one instance, not just the page being rendered.
   *
   * Completion is a property of the instance; the page bound is a property of
   * the display. Folding standing over one page reported an instance
   * `reviewed` while the chain and the case still reported it pending — R-07
   * in miniature, found by the ACME-0159 close-out run on a 27-occurrence
   * instance with a page of 25.
   */
  async function allOccurrenceIds(
    artifactId: string,
    instanceKey: string,
  ): Promise<readonly string[]> {
    const ids: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await repository.listOccurrences(artifactId, instanceKey, {
        offset,
        limit: 100,
      });
      ids.push(...page.items.map((item) => item.occurrenceId));
      if (ids.length >= page.total || page.items.length === 0) break;
    }
    return ids;
  }

  async function instanceReview(
    artifactId: string,
    instanceKey: string,
    occurrenceIds: readonly string[],
  ): Promise<{
    readonly standings: ReadonlyMap<string, EvidenceV2EffectiveStanding>;
    readonly completion: EvidenceV2InstanceCompletion;
    readonly decisions: readonly EvidenceV2ReviewDecision[];
  }> {
    const decisions = await repository.listReviewDecisions(
      artifactId,
      instanceKey,
    );
    const windows = await repository.readExtractionWindows(
      artifactId,
      instanceKey,
    );
    const standings = deriveEvidenceV2Standings(occurrenceIds, decisions);
    // The rendered rows follow the page; completion follows the instance.
    const complete = deriveEvidenceV2Standings(
      await allOccurrenceIds(artifactId, instanceKey),
      decisions,
    );
    return {
      standings: new Map(standings.map((item) => [item.occurrenceId, item])),
      completion: deriveEvidenceV2InstanceCompletion({
        instanceKey,
        hasCommittedWindow: windows.some(
          (window) => window.status === 'committed',
        ),
        standings: complete,
      }),
      decisions,
    };
  }

  /** Every instance's completion in one chain, so the chain can report its own. */
  async function chainCompletion(
    artifactId: string,
    instanceKeys: readonly string[],
  ): Promise<{
    readonly perInstance: readonly EvidenceV2InstanceCompletion[];
    readonly chain: ReturnType<typeof deriveEvidenceV2ChainCompletion>;
  }> {
    const extracted = new Set(
      await repository.readExtractedInstanceKeys(artifactId),
    );
    const perInstance: EvidenceV2InstanceCompletion[] = [];
    for (const instanceKey of instanceKeys) {
      const decisions = await repository.listReviewDecisions(
        artifactId,
        instanceKey,
      );
      perInstance.push(
        deriveEvidenceV2InstanceCompletion({
          instanceKey,
          hasCommittedWindow: extracted.has(instanceKey),
          standings: deriveEvidenceV2Standings(
            await allOccurrenceIds(artifactId, instanceKey),
            decisions,
          ),
        }),
      );
    }
    return {
      perInstance,
      chain: deriveEvidenceV2ChainCompletion(perInstance),
    };
  }

  /**
   * J5, assembled from stored rows.
   *
   * Deterministic and free: it reads the grouping log, folds it, fetches the
   * named occurrences and their standings, and projects. It speaks for the
   * claim rather than for any page (the ACME-0159 lesson), and it never
   * reconstructs an occurrence a claim points at but the store does not hold —
   * a claim does not own its contributors.
   */
  async function claimProjection(claim: EvidenceV2Claim) {
    const groupings = await repository.listClaimGroupings(claim.claimId);
    const memberships = deriveEvidenceV2ClaimMemberships(
      claim.claimId,
      groupings,
    );
    const occurrences = await repository.readOccurrencesById(
      memberships.map((item) => item.occurrenceId),
    );
    const byInstance = new Map<string, string[]>();
    for (const membership of memberships) {
      const key = `${membership.artifactId}\u0000${membership.instanceKey}`;
      byInstance.set(key, [
        ...(byInstance.get(key) ?? []),
        membership.occurrenceId,
      ]);
    }
    const standings: EvidenceV2EffectiveStanding[] = [];
    for (const [key, ids] of byInstance) {
      const [artifactId, instanceKey] = key.split('\u0000');
      const decisions = await repository.listReviewDecisions(
        artifactId ?? '',
        instanceKey ?? '',
      );
      standings.push(...deriveEvidenceV2Standings(ids, decisions));
    }
    return {
      projection: projectEvidenceV2Claim({
        claim,
        memberships,
        occurrences: occurrences.map((item) => ({
          occurrenceId: item.occurrenceId,
          artifactId: item.artifactId,
          instanceKey:
            memberships.find(
              (member) => member.occurrenceId === item.occurrenceId,
            )?.instanceKey ?? '',
          partId: item.partId,
          startLine: item.startLine,
          endLine: item.endLine,
          exactQuote: item.exactQuote,
        })),
        standings,
      }),
      groupings,
    };
  }

  async function resolveRelationEndpoint(
    caseId: string,
    kind: 'occurrence' | 'claim',
    id: string,
  ): Promise<EvidenceV2RelationEndpointInput | undefined> {
    if (kind === 'occurrence') {
      const [binding] = await repository.readOccurrenceBindings([id]);
      if (binding === undefined) return undefined;
      const owner = await repository.readArtifact(
        binding.occurrence.artifactId,
      );
      if (owner === undefined || owner.caseId !== caseId) return undefined;
      const reviews = await repository.listReviewDecisions(
        binding.occurrence.artifactId,
        binding.instanceKey,
      );
      const [standing] = deriveEvidenceV2Standings(
        [binding.occurrence.occurrenceId],
        reviews,
      );
      return {
        kind: 'occurrence',
        id: binding.occurrence.occurrenceId,
        artifactId: binding.occurrence.artifactId,
        instanceKey: binding.instanceKey,
        partId: binding.occurrence.partId,
        startLine: binding.occurrence.startLine,
        endLine: binding.occurrence.endLine,
        exactQuote: binding.occurrence.exactQuote,
        standing: standing?.standing ?? 'pending',
      };
    }
    const claim = await repository.readClaim(id);
    if (claim === undefined || claim.caseId !== caseId) return undefined;
    const { projection } = await claimProjection(claim);
    return {
      kind: 'claim',
      id: claim.claimId,
      claimLabel: claim.label,
      standing: projection.empty ? 'pending' : 'accepted',
    };
  }

  function endpointLabel(endpoint: EvidenceV2RelationEndpointInput): string {
    if (endpoint.kind === 'claim') return endpoint.claimLabel ?? endpoint.id;
    if (endpoint.exactQuote !== undefined && endpoint.startLine !== undefined)
      return `L${String(endpoint.startLine)} · ${endpoint.exactQuote}`;
    return endpoint.id;
  }

  function endpointLink(
    caseId: string,
    endpoint: EvidenceV2RelationEndpointInput,
  ): string | null {
    if (
      endpoint.kind === 'occurrence' &&
      endpoint.artifactId !== undefined &&
      endpoint.partId !== undefined
    )
      return `/artifacts/${encodeURIComponent(endpoint.artifactId)}/parts/${encodeURIComponent(endpoint.partId)}`;
    if (endpoint.kind === 'claim')
      return `/cases/${encodeURIComponent(caseId)}/claims/${encodeURIComponent(endpoint.id)}`;
    return null;
  }

  async function relationProjection(relation: EvidenceV2Relation) {
    const reviews = await repository.listRelationReviews(relation.relationId);
    const [standing] = deriveEvidenceV2RelationStandings([relation], reviews);
    const from = await resolveRelationEndpoint(
      relation.caseId,
      relation.from.kind,
      relation.from.id,
    );
    const to = await resolveRelationEndpoint(
      relation.caseId,
      relation.to.kind,
      relation.to.id,
    );
    const endpoints = [from, to].filter(
      (item): item is EvidenceV2RelationEndpointInput => item !== undefined,
    );
    return {
      projection:
        standing === undefined
          ? undefined
          : projectEvidenceV2Relation({
              relation,
              standing,
              endpoints,
            }),
      standing,
      reviews,
      from,
      to,
    };
  }

  async function projectCase(caseId: string) {
    const inputs = await repository.readCaseProjectionInputs(caseId);
    const revision = deriveEvidenceV2CaseRevision({
      caseId,
      occurrenceIds: inputs.occurrences.map(
        (item) => item.occurrence.occurrenceId,
      ),
      reviewDecisionIds: inputs.reviews.map((item) => item.decisionId),
      claimIds: inputs.claims.map((item) => item.claimId),
      groupingDecisionIds: inputs.groupings.map((item) => item.decisionId),
      relationIds: inputs.relations.map((item) => item.relationId),
      relationReviewIds: inputs.relationReviews.map((item) => item.decisionId),
    });
    const standingByOccurrence = new Map(
      deriveEvidenceV2Standings(
        inputs.occurrences.map((item) => item.occurrence.occurrenceId),
        inputs.reviews,
      ).map((item) => [item.occurrenceId, item.standing]),
    );
    const relationStanding = deriveEvidenceV2RelationStandings(
      inputs.relations,
      inputs.relationReviews,
    );
    const acceptedRelations = inputs.relations.filter((relation) => {
      const standing = relationStanding.find(
        (item) => item.relationId === relation.relationId,
      );
      return standing?.standing === 'accepted';
    });
    const timeline = projectEvidenceV2Timeline({
      caseId,
      revision,
      occurrences: inputs.occurrences.map((item) => ({
        occurrenceId: item.occurrence.occurrenceId,
        artifactId: item.occurrence.artifactId,
        instanceKey: item.instanceKey,
        partId: item.occurrence.partId,
        startLine: item.occurrence.startLine,
        endLine: item.occurrence.endLine,
        exactQuote: item.occurrence.exactQuote,
        temporalBound: item.occurrence.temporalBound,
        standing:
          standingByOccurrence.get(item.occurrence.occurrenceId) ?? 'pending',
      })),
      claims: inputs.claims.map((claim) => {
        const members = deriveEvidenceV2ClaimMemberships(
          claim.claimId,
          inputs.groupings,
        );
        const acceptedBounds = members
          .filter(
            (member) =>
              standingByOccurrence.get(member.occurrenceId) === 'accepted',
          )
          .map((member) => {
            const occurrence = inputs.occurrences.find(
              (item) => item.occurrence.occurrenceId === member.occurrenceId,
            );
            return occurrence?.occurrence.temporalBound ?? null;
          });
        return { claim, acceptedBounds };
      }),
    });
    const consensus = projectEvidenceV2Consensus({
      caseId,
      revision,
      acceptedRelations,
      claims: inputs.claims.map((claim) => {
        const members = deriveEvidenceV2ClaimMemberships(
          claim.claimId,
          inputs.groupings,
        );
        const acceptedMembers = members
          .filter(
            (member) =>
              standingByOccurrence.get(member.occurrenceId) === 'accepted',
          )
          .flatMap((member) => {
            const binding = inputs.occurrences.find(
              (item) => item.occurrence.occurrenceId === member.occurrenceId,
            );
            if (binding === undefined) return [];
            return [
              {
                occurrenceId: binding.occurrence.occurrenceId,
                artifactId: binding.occurrence.artifactId,
                instanceKey: binding.instanceKey,
                partId: binding.occurrence.partId,
                startLine: binding.occurrence.startLine,
                endLine: binding.occurrence.endLine,
                exactQuote: binding.occurrence.exactQuote,
              },
            ];
          });
        return { claim, acceptedMembers };
      }),
    });
    return { revision, timeline, consensus };
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
        const { consensus } = await projectCase(caseId);
        const counts = {
          ...overview.counts,
          consensusSupported: consensus.aggregates.verdictCounts.supported,
          consensusContested: consensus.aggregates.verdictCounts.contested,
          consensusQualified: consensus.aggregates.verdictCounts.qualified,
          consensusUnresolved: consensus.aggregates.verdictCounts.unresolved,
          consensusInsufficient:
            consensus.aggregates.verdictCounts['insufficient-material'],
        };
        const withConsensus = { ...overview, counts };
        if (json) return void sendJson(response, 200, withConsensus);
        return void sendHtml(
          response,
          200,
          renderCaseStatus({
            caseId,
            caseTitle: record.title,
            caseReference: record.caseReference,
            overview: withConsensus,
            viewer,
          }),
        );
      }

      const timelineMatch = /^\/(?:api\/)?cases\/([^/]+)\/timeline$/u.exec(
        path,
      );
      if (method === 'GET' && timelineMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(timelineMatch[1]);
        if (!(await authorizeCase(caseId, 'workspace.read'))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');
        const { timeline } = await projectCase(caseId);
        const paged = {
          items: timeline.items.slice(page.offset, page.offset + page.limit),
          total: timeline.items.length,
          offset: page.offset,
          limit: page.limit,
        };
        if (json)
          return void sendJson(response, 200, {
            revision: timeline.revision,
            datedCount: timeline.datedCount,
            unorderedCount: timeline.unorderedCount,
            ...paged,
          });
        return void sendHtml(
          response,
          200,
          renderTimeline({
            caseId,
            caseTitle: record.title,
            caseReference: record.caseReference,
            viewer,
            revision: timeline.revision.digest,
            datedCount: timeline.datedCount,
            unorderedCount: timeline.unorderedCount,
            items: paged,
          }),
        );
      }

      const consensusMatch = /^\/(?:api\/)?cases\/([^/]+)\/consensus$/u.exec(
        path,
      );
      if (method === 'GET' && consensusMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(consensusMatch[1]);
        if (!(await authorizeCase(caseId, 'workspace.read'))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');
        const { consensus } = await projectCase(caseId);
        if (json) return void sendJson(response, 200, consensus);
        return void sendHtml(
          response,
          200,
          renderConsensus({
            caseId,
            caseTitle: record.title,
            caseReference: record.caseReference,
            viewer,
            revision: consensus.revision.digest,
            aggregates: consensus.aggregates,
            claims: consensus.claims,
          }),
        );
      }

      const importMatch = /^\/(?:api\/)?cases\/([^/]+)\/artifacts$/u.exec(path);
      if (method === 'POST' && importMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(importMatch[1]);
        if (!(await authorizeCase(caseId, 'source.import'))) return;
        if ((await repository.readCase(caseId)) === undefined)
          return void sendText(response, 404, 'No such case.');
        const body = await readBody(request);
        const contentType = String(request.headers['content-type'] ?? '');
        let artifact: EvidenceV2ArtifactRecord;
        if (contentType.includes('multipart/form-data')) {
          const parsed = parseMultipart(body.bytes, contentType);
          const file = parsed.files['file'];
          if (file === undefined)
            throw new EvidenceV2ImportRefusal('EVIDENCE_V2_PDF_NOT_PDF');
          artifact = await importPdfArtifact(caseId, {
            title: parsed.fields['title']?.trim() || 'Untitled source',
            bytes: file,
            principalRef: principal.principalRef,
          });
        } else {
          const payload = body.text.trimStart().startsWith('{')
            ? (JSON.parse(body.text) as Record<string, unknown>)
            : Object.fromEntries(new URLSearchParams(body.text));
          const pdfBase64 = String(payload['pdfBase64'] ?? '').trim();
          if (pdfBase64.length > 0) {
            artifact = await importPdfArtifact(caseId, {
              title: String(payload['title'] ?? 'Untitled source'),
              bytes: Buffer.from(pdfBase64, 'base64'),
              principalRef: principal.principalRef,
            });
          } else {
            artifact = await importTextArtifact(caseId, payload);
          }
        }
        if (json)
          return void sendJson(response, 201, {
            artifactId: artifact.artifactId,
            canonicalSha256: artifact.canonicalSha256,
            lineCount: artifact.lineCount,
            partCount: artifact.partCount,
            chainCount: artifact.chainCount,
            sourceClass: artifact.sourceClass,
            receivedSha256: artifact.received?.sha256,
          });
        response.writeHead(303, {
          location: `/cases/${encodeURIComponent(caseId)}`,
        });
        response.end();
        return;
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
        const completion = await chainCompletion(
          artifactId,
          detail.chain.instances.map((instance) => instance.instanceKey),
        );
        const stateOf = new Map(
          completion.perInstance.map((item) => [item.instanceKey, item.state]),
        );
        if (json)
          return void sendJson(response, 200, {
            ...detail,
            completion: completion.chain,
            instanceReviewStates: completion.perInstance,
          });
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
            completion: completion.chain,
            instances: detail.chain.instances.map((instance) => ({
              instanceOrdinal: instance.instanceOrdinal,
              instanceKey: instance.instanceKey,
              reviewState: stateOf.get(instance.instanceKey) ?? 'not-extracted',
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
        /^\/(?:api\/)?artifacts\/([^/]+)\/chains\/([^/]+)\/instances\/([^/]+)\/extraction$/u.exec(
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
          if (json)
            return void sendJson(
              response,
              outcome.complete ? 201 : 207,
              outcome,
            );
          response.writeHead(303, {
            location: `/artifacts/${encodeURIComponent(artifactId)}/chains/${encodeURIComponent(chainId)}/instances/${encodeURIComponent(instanceKey)}`,
          });
          response.end();
          return;
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
        const review = await instanceReview(
          artifactId,
          instanceKey,
          occurrences.items.map((item) => item.occurrenceId),
        );
        if (json)
          return void sendJson(response, 200, {
            instance,
            occurrences,
            windows,
            completion: review.completion,
            standings: [...review.standings.values()],
          });
        const artifact = await repository.readArtifact(artifactId);
        const record =
          artifact === undefined
            ? undefined
            : await repository.readCase(artifact.caseId);
        const compare =
          options.comparer === undefined
            ? undefined
            : await options.comparer.plan({
                artifactId,
                chainId,
                instanceKey,
              });
        const extract =
          options.extractor === undefined
            ? undefined
            : await options.extractor.plan({
                artifactId,
                chainId,
                instanceKey,
                sourcePartIds: instance.sourcePartIds,
              });
        return void sendHtml(
          response,
          200,
          renderInstance({
            caseId: artifact?.caseId ?? '',
            caseTitle: record?.title ?? '',
            artifactId,
            chainId,
            instanceKey,
            subjectLabel: detail.chain.subjectLabel,
            instanceOrdinal: instance.instanceOrdinal,
            sourceTime: instance.instanceSourceTime.from ?? 'unknown',
            sourcePartIds: instance.sourcePartIds,
            completion: review.completion,
            standings: [...review.standings.values()].map((standing) => ({
              occurrenceId: standing.occurrenceId,
              standing: standing.standing,
              principal: standing.principal,
              decidedAt: standing.decidedAt,
              rationale: standing.rationale,
              decisionCount: standing.decisionCount,
            })),
            viewer,
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
            ...(compare === undefined
              ? {}
              : {
                  compare: {
                    reason: compare.reason,
                    plannedModelCalls: compare.plannedModelCalls,
                    windowCount: compare.windows.length,
                    outstandingCount: compare.outstandingWindowIds.length,
                    committedCount: compare.committedWindowIds.length,
                  },
                }),
            ...(extract === undefined
              ? {}
              : {
                  extract: {
                    plannedModelCalls: extract.plannedModelCalls,
                    windowCount: extract.windows.length,
                    outstandingCount: extract.outstandingWindowIds.length,
                    committedCount: extract.committedWindowIds.length,
                  },
                }),
          }),
        );
      }

      // J4: plan states the bounded call count; run executes outstanding
      // windows. HTML posts redirect back to the instance.
      const compareMatch =
        /^\/(?:api\/)?artifacts\/([^/]+)\/chains\/([^/]+)\/instances\/([^/]+)\/comparison$/u.exec(
          path,
        );
      if (
        compareMatch?.[1] !== undefined &&
        compareMatch[2] !== undefined &&
        compareMatch[3] !== undefined
      ) {
        const artifactId = decodeURIComponent(compareMatch[1]);
        const chainId = decodeURIComponent(compareMatch[2]);
        const instanceKey = decodeURIComponent(compareMatch[3]);
        const action: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'live-model.run';
        const scope = await authorizeArtifact(artifactId, action);
        if (scope === undefined) return;
        if (options.comparer === undefined)
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
          const plan = await options.comparer.plan({
            artifactId,
            chainId,
            instanceKey,
          });
          return void sendJson(response, 200, {
            plannedModelCalls: plan.plannedModelCalls,
            windowCount: plan.windows.length,
            outstandingWindowIds: plan.outstandingWindowIds,
            committedWindowIds: plan.committedWindowIds,
            reason: plan.reason,
          });
        }
        if (method === 'POST') {
          const outcome = await options.comparer.run({
            caseId: scope.caseId,
            artifactId,
            chainId,
            instanceKey,
          });
          if (json)
            return void sendJson(
              response,
              outcome.complete ? 201 : 207,
              outcome,
            );
          response.writeHead(303, {
            location: `/cases/${encodeURIComponent(scope.caseId)}/relations`,
          });
          response.end();
          return;
        }
      }

      // Claims: create and list, case-scoped.
      const claimsMatch = /^\/(?:api\/)?cases\/([^/]+)\/claims$/u.exec(path);
      if (claimsMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(claimsMatch[1]);
        const claimAction: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'review.decide';
        if (!(await authorizeCase(caseId, claimAction))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');

        if (method === 'GET') {
          const claims = await repository.listClaims(caseId, page);
          const rows = [];
          for (const claim of claims.items) {
            const { projection } = await claimProjection(claim);
            rows.push({
              claimId: claim.claimId,
              label: claim.label,
              statement: claim.statement,
              contributorCount: projection.contributorCount,
              distinctInstances: projection.distinctInstances,
              crossInstance: projection.crossInstance,
              accepted: projection.standingCounts.accepted,
              pending: projection.standingCounts.pending,
              empty: projection.empty,
            });
          }
          if (json)
            return void sendJson(response, 200, { ...claims, items: rows });
          return void sendHtml(
            response,
            200,
            renderClaims({
              caseId,
              caseTitle: record.title,
              caseReference: record.caseReference,
              viewer,
              claims: { ...claims, items: rows },
            }),
          );
        }

        if (method === 'POST') {
          const body = await readBody(request);
          const payload = body.text.trimStart().startsWith('{')
            ? (JSON.parse(body.text) as Record<string, unknown>)
            : Object.fromEntries(new URLSearchParams(body.text));
          const label = String(payload['label'] ?? '').trim();
          const statement = String(payload['statement'] ?? '').trim();
          if (label.length === 0 || statement.length === 0)
            return void sendText(
              response,
              400,
              'A label and a statement are required.',
            );
          const createdAt = options.now();
          const claim: EvidenceV2Claim = {
            schemaVersion: EVIDENCE_V2_CLAIM_SCHEMA_VERSION,
            claimId: deriveEvidenceV2ClaimId({ caseId, label, createdAt }),
            caseId,
            label,
            statement,
            createdBy: principal.principalRef,
            createdAt,
          };
          await repository.createClaim(claim);
          if (json) return void sendJson(response, 201, claim);
          response.writeHead(303, {
            location: `/cases/${encodeURIComponent(caseId)}/claims/${encodeURIComponent(claim.claimId)}`,
          });
          response.end();
          return;
        }
      }

      // One claim: its projection, and appending a grouping decision.
      const claimMatch = /^\/(?:api\/)?cases\/([^/]+)\/claims\/([^/]+)$/u.exec(
        path,
      );
      if (claimMatch?.[1] !== undefined && claimMatch[2] !== undefined) {
        const caseId = decodeURIComponent(claimMatch[1]);
        const claimId = decodeURIComponent(claimMatch[2]);
        const claimAction: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'review.decide';
        if (!(await authorizeCase(caseId, claimAction))) return;
        const claim = await repository.readClaim(claimId);
        // A claim of another case is as invisible as one that does not exist.
        if (claim === undefined || claim.caseId !== caseId)
          return void sendText(response, 404, 'No such claim.');

        if (method === 'GET') {
          const { projection, groupings } = await claimProjection(claim);
          if (json)
            return void sendJson(response, 200, { ...projection, groupings });
          const record = await repository.readCase(caseId);
          return void sendHtml(
            response,
            200,
            renderClaim({
              caseId,
              caseTitle: record?.title ?? caseId,
              caseReference: record?.caseReference ?? '',
              viewer,
              claim,
              projection: {
                contributorCount: projection.contributorCount,
                distinctInstances: projection.distinctInstances,
                distinctArtifacts: projection.distinctArtifacts,
                crossInstance: projection.crossInstance,
                empty: projection.empty,
                standingCounts: projection.standingCounts,
                contributors: projection.contributors.map((item) => ({
                  occurrenceId: item.occurrenceId,
                  artifactId: item.artifactId,
                  instanceKey: item.instanceKey,
                  partId: item.partId,
                  startLine: item.startLine,
                  endLine: item.endLine,
                  exactQuote: item.exactQuote,
                  standing: item.standing,
                  rationale: item.rationale,
                })),
              },
              groupingCount: groupings.length,
            }),
          );
        }

        if (method === 'POST') {
          const body = await readBody(request);
          const payload = body.text.trimStart().startsWith('{')
            ? (JSON.parse(body.text) as Record<string, unknown>)
            : Object.fromEntries(new URLSearchParams(body.text));
          const parsed = EvidenceV2ClaimGroupingActionSchema.safeParse(
            payload['action'],
          );
          const occurrenceId = String(payload['occurrenceId'] ?? '').trim();
          const rationale = String(payload['rationale'] ?? '').trim();
          if (!parsed.success)
            return void sendText(
              response,
              400,
              'Action must be include or exclude.',
            );
          if (occurrenceId.length === 0 || rationale.length === 0)
            return void sendText(
              response,
              400,
              'An occurrence and a rationale are required.',
            );

          const [occurrence] = await repository.readOccurrencesById([
            occurrenceId,
          ]);
          if (occurrence === undefined)
            return void sendText(response, 404, 'No such occurrence.');
          // The occurrence must belong to this case. Grouping across cases
          // would be a disclosure, not a projection (ADR-0036).
          const owner = await repository.readArtifact(occurrence.artifactId);
          if (owner === undefined || owner.caseId !== caseId)
            return void sendText(response, 404, 'No such occurrence.');

          const history = await repository.readOccurrenceClaimIds(occurrenceId);
          const previous = history
            .filter((item) => item.claimId === claimId)
            .at(-1);
          const decidedAt = options.now();
          const instanceKey =
            String(payload['instanceKey'] ?? '').trim() ||
            previous?.instanceKey ||
            occurrence.windowId.replace(/-window-\d+$/u, '');
          const decision: EvidenceV2ClaimGroupingDecision = {
            schemaVersion: 'evidence-v2-claim-grouping/1',
            decisionId: deriveEvidenceV2ClaimGroupingDecisionId({
              claimId,
              occurrenceId,
              action: parsed.data,
              principal: principal.principalRef,
              decidedAt,
            }),
            caseId,
            claimId,
            artifactId: occurrence.artifactId,
            instanceKey,
            occurrenceId,
            action: parsed.data,
            supersedes: previous?.decisionId ?? null,
            principal: principal.principalRef,
            decidedAt,
            rationale,
          };
          await repository.appendClaimGrouping(decision);
          if (json) return void sendJson(response, 201, decision);
          response.writeHead(303, {
            location: `/cases/${encodeURIComponent(caseId)}/claims/${encodeURIComponent(claimId)}`,
          });
          response.end();
          return;
        }
      }

      // Relations: create and list, case-scoped. A graph is not this surface.
      const relationsMatch = /^\/(?:api\/)?cases\/([^/]+)\/relations$/u.exec(
        path,
      );
      if (relationsMatch?.[1] !== undefined) {
        const caseId = decodeURIComponent(relationsMatch[1]);
        const relationAction: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'review.decide';
        if (!(await authorizeCase(caseId, relationAction))) return;
        const record = await repository.readCase(caseId);
        if (record === undefined)
          return void sendText(response, 404, 'No such case.');

        if (method === 'GET') {
          const listed = await repository.listRelations(caseId, page);
          const rows = [];
          for (const item of listed.items) {
            const viewed = await relationProjection(item);
            rows.push({
              relationId: item.relationId,
              type: item.type,
              provenance: item.provenance,
              standing: viewed.standing?.standing ?? 'pending',
              rationale: item.rationale,
              fromLabel:
                viewed.from === undefined
                  ? item.from.id
                  : endpointLabel(viewed.from),
              fromHref:
                viewed.from === undefined
                  ? null
                  : endpointLink(caseId, viewed.from),
              toLabel:
                viewed.to === undefined ? item.to.id : endpointLabel(viewed.to),
              toHref:
                viewed.to === undefined
                  ? null
                  : endpointLink(caseId, viewed.to),
            });
          }
          if (json)
            return void sendJson(response, 200, { ...listed, items: rows });
          return void sendHtml(
            response,
            200,
            renderRelations({
              caseId,
              caseTitle: record.title,
              caseReference: record.caseReference,
              viewer,
              relations: { ...listed, items: rows },
            }),
          );
        }

        if (method === 'POST') {
          const body = await readBody(request);
          const payload = body.text.trimStart().startsWith('{')
            ? (JSON.parse(body.text) as Record<string, unknown>)
            : Object.fromEntries(new URLSearchParams(body.text));
          const fromKind = EvidenceV2RelationEndpointKindSchema.safeParse(
            payload['fromKind'],
          );
          const toKind = EvidenceV2RelationEndpointKindSchema.safeParse(
            payload['toKind'],
          );
          const type = EvidenceV2RelationTypeSchema.safeParse(payload['type']);
          const scope = EvidenceV2ComparableScopeSchema.safeParse({
            actor: payload['actor'] ?? 'unknown',
            time: payload['time'] ?? 'unknown',
            location: payload['location'] ?? 'unknown',
            entity: payload['entity'] ?? 'unknown',
          });
          const fromId = String(payload['fromId'] ?? '').trim();
          const toId = String(payload['toId'] ?? '').trim();
          const rationale = String(payload['rationale'] ?? '').trim();
          const artifactId = String(payload['artifactId'] ?? '').trim();
          const chainId = String(payload['chainId'] ?? '').trim();
          if (
            !fromKind.success ||
            !toKind.success ||
            !type.success ||
            !scope.success
          )
            return void sendText(
              response,
              400,
              'Type, endpoint kinds and comparable scope are required.',
            );
          if (
            fromId.length === 0 ||
            toId.length === 0 ||
            rationale.length === 0 ||
            artifactId.length === 0 ||
            chainId.length === 0
          )
            return void sendText(
              response,
              400,
              'Both endpoints, a rationale, an artifact and a chain are required.',
            );
          if (type.data === 'contradicts') {
            const issues = evidenceV2ContradictionScopeIssues(scope.data);
            if (issues.length > 0)
              return void sendText(response, 400, issues.join(' '));
          }
          const from = await resolveRelationEndpoint(
            caseId,
            fromKind.data,
            fromId,
          );
          const to = await resolveRelationEndpoint(caseId, toKind.data, toId);
          if (from === undefined || to === undefined)
            return void sendText(response, 404, 'No such endpoint.');
          const owner = await repository.readArtifact(artifactId);
          if (owner === undefined || owner.caseId !== caseId)
            return void sendText(response, 404, 'No such artifact.');
          const createdAt = options.now();
          const relation: EvidenceV2Relation = {
            schemaVersion: EVIDENCE_V2_RELATION_SCHEMA_VERSION,
            relationId: deriveEvidenceV2RelationId({
              caseId,
              fromKind: fromKind.data,
              fromId,
              toKind: toKind.data,
              toId,
              type: type.data,
              createdAt,
            }),
            caseId,
            artifactId,
            chainId,
            from: { kind: fromKind.data, id: fromId },
            to: { kind: toKind.data, id: toId },
            type: type.data,
            comparableScope: scope.data,
            rationale,
            provenance: 'reviewer-authored',
            createdBy: principal.principalRef,
            createdAt,
            executionId: null,
            contractVersion: null,
            windowId: null,
          };
          await repository.createRelation(relation);
          const decidedAt = createdAt;
          await repository.appendRelationReview({
            schemaVersion: EVIDENCE_V2_RELATION_REVIEW_SCHEMA_VERSION,
            decisionId: deriveEvidenceV2RelationReviewDecisionId({
              relationId: relation.relationId,
              action: 'accept',
              principal: principal.principalRef,
              decidedAt,
            }),
            caseId,
            relationId: relation.relationId,
            action: 'accept',
            supersedes: null,
            principal: principal.principalRef,
            decidedAt,
            rationale: 'Reviewer-authored; authorship is acceptance.',
          });
          if (json) return void sendJson(response, 201, relation);
          response.writeHead(303, {
            location: `/cases/${encodeURIComponent(caseId)}/relations/${encodeURIComponent(relation.relationId)}`,
          });
          response.end();
          return;
        }
      }

      const relationMatch =
        /^\/(?:api\/)?cases\/([^/]+)\/relations\/([^/]+)$/u.exec(path);
      if (relationMatch?.[1] !== undefined && relationMatch[2] !== undefined) {
        const caseId = decodeURIComponent(relationMatch[1]);
        const relationId = decodeURIComponent(relationMatch[2]);
        const relationAction: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'review.decide';
        if (!(await authorizeCase(caseId, relationAction))) return;
        const relation = await repository.readRelation(relationId);
        if (relation === undefined || relation.caseId !== caseId)
          return void sendText(response, 404, 'No such relation.');

        if (method === 'GET') {
          const viewed = await relationProjection(relation);
          if (json)
            return void sendJson(response, 200, {
              ...viewed.projection,
              reviews: viewed.reviews,
            });
          const record = await repository.readCase(caseId);
          return void sendHtml(
            response,
            200,
            renderRelation({
              caseId,
              caseTitle: record?.title ?? caseId,
              caseReference: record?.caseReference ?? '',
              viewer,
              relation,
              standing: viewed.standing?.standing ?? 'pending',
              decisionCount: viewed.reviews.length,
              from: {
                label:
                  viewed.from === undefined
                    ? relation.from.id
                    : endpointLabel(viewed.from),
                href:
                  viewed.from === undefined
                    ? null
                    : endpointLink(caseId, viewed.from),
              },
              to: {
                label:
                  viewed.to === undefined
                    ? relation.to.id
                    : endpointLabel(viewed.to),
                href:
                  viewed.to === undefined
                    ? null
                    : endpointLink(caseId, viewed.to),
              },
            }),
          );
        }

        if (method === 'POST') {
          const body = await readBody(request);
          const payload = body.text.trimStart().startsWith('{')
            ? (JSON.parse(body.text) as Record<string, unknown>)
            : Object.fromEntries(new URLSearchParams(body.text));
          const parsed = EvidenceV2RelationReviewActionSchema.safeParse(
            payload['action'],
          );
          const rationale = String(payload['rationale'] ?? '').trim();
          if (!parsed.success)
            return void sendText(
              response,
              400,
              'Action must be accept, reject or revise.',
            );
          if (rationale.length === 0)
            return void sendText(response, 400, 'A rationale is required.');
          const history = await repository.listRelationReviews(relationId);
          const decidedAt = options.now();
          const decision = {
            schemaVersion: 'evidence-v2-relation-review/1' as const,
            decisionId: deriveEvidenceV2RelationReviewDecisionId({
              relationId,
              action: parsed.data,
              principal: principal.principalRef,
              decidedAt,
            }),
            caseId,
            relationId,
            action: parsed.data,
            supersedes: history.at(-1)?.decisionId ?? null,
            principal: principal.principalRef,
            decidedAt,
            rationale,
          };
          await repository.appendRelationReview(decision);
          if (json) return void sendJson(response, 201, decision);
          response.writeHead(303, {
            location: `/cases/${encodeURIComponent(caseId)}/relations/${encodeURIComponent(relationId)}`,
          });
          response.end();
          return;
        }
      }

      // Review: append a decision, or read the log and the folded standings.
      const reviewMatch =
        /^\/(?:api\/)?artifacts\/([^/]+)\/chains\/([^/]+)\/instances\/([^/]+)\/reviews$/u.exec(
          path,
        );
      if (
        reviewMatch?.[1] !== undefined &&
        reviewMatch[2] !== undefined &&
        reviewMatch[3] !== undefined
      ) {
        const artifactId = decodeURIComponent(reviewMatch[1]);
        const chainId = decodeURIComponent(reviewMatch[2]);
        const instanceKey = decodeURIComponent(reviewMatch[3]);
        const action: EvidenceProductAction =
          method === 'GET' ? 'workspace.read' : 'review.decide';
        if ((await authorizeArtifact(artifactId, action)) === undefined) return;

        if (method === 'GET') {
          const occurrences = await repository.listOccurrences(
            artifactId,
            instanceKey,
            page,
          );
          const review = await instanceReview(
            artifactId,
            instanceKey,
            occurrences.items.map((item) => item.occurrenceId),
          );
          return void sendJson(response, 200, {
            completion: review.completion,
            standings: [...review.standings.values()],
            decisions: review.decisions,
          });
        }

        if (method === 'POST') {
          const body = await readBody(request);
          const payload = body.text.trimStart().startsWith('{')
            ? (JSON.parse(body.text) as Record<string, unknown>)
            : Object.fromEntries(new URLSearchParams(body.text));
          const parsedAction = EvidenceV2ReviewActionSchema.safeParse(
            payload['action'],
          );
          const occurrenceId = String(payload['occurrenceId'] ?? '').trim();
          const rationale = String(payload['rationale'] ?? '').trim();
          if (!parsedAction.success)
            return void sendText(
              response,
              400,
              'Action must be accept, reject or revise.',
            );
          if (occurrenceId.length === 0 || rationale.length === 0)
            return void sendText(
              response,
              400,
              'An occurrence and a rationale are required.',
            );

          // The decision must land on an occurrence of this instance. A
          // decision on something the reviewer is not looking at is a
          // cross-instance write, not a review.
          const occurrences = await repository.listOccurrences(
            artifactId,
            instanceKey,
            { offset: 0, limit: 100 },
          );
          if (
            !occurrences.items.some(
              (item) => item.occurrenceId === occurrenceId,
            )
          )
            return void sendText(
              response,
              404,
              'No such occurrence in this instance.',
            );

          // Supersession is read from the stored log rather than accepted from
          // the caller, so a client cannot claim to replace a decision that
          // does not exist or that belongs to someone else.
          const history = await repository.readOccurrenceReviewHistory(
            artifactId,
            occurrenceId,
          );
          const previous = history[history.length - 1];
          const decidedAt = options.now();
          // Server-derived. A principal named in the body is not a principal.
          const decidingPrincipal = principal.principalRef;
          const decision: EvidenceV2ReviewDecision = {
            schemaVersion: EVIDENCE_V2_REVIEW_SCHEMA_VERSION,
            decisionId: deriveEvidenceV2ReviewDecisionId({
              occurrenceId,
              action: parsedAction.data,
              principal: decidingPrincipal,
              decidedAt,
              rationale,
            }),
            artifactId,
            instanceKey,
            occurrenceId,
            action: parsedAction.data,
            supersedes: previous?.decisionId ?? null,
            principal: decidingPrincipal,
            decidedAt,
            rationale,
          };
          await repository.appendReviewDecision(decision);
          if (json) return void sendJson(response, 201, decision);
          response.writeHead(303, {
            location: `/artifacts/${encodeURIComponent(artifactId)}/chains/${encodeURIComponent(chainId)}/instances/${encodeURIComponent(instanceKey)}`,
          });
          response.end();
          return;
        }
      }

      // A reviewer-authored occurrence. It cites a citable unit, exactly as the
      // model does, so the product assembles the quote and locator from the
      // source (ADR-0048 section 2). A reviewer may not supply quote text.
      const authorMatch =
        /^\/(?:api\/)?artifacts\/([^/]+)\/chains\/([^/]+)\/instances\/([^/]+)\/occurrences$/u.exec(
          path,
        );
      if (
        method === 'POST' &&
        authorMatch?.[1] !== undefined &&
        authorMatch[2] !== undefined &&
        authorMatch[3] !== undefined
      ) {
        const artifactId = decodeURIComponent(authorMatch[1]);
        const chainId = decodeURIComponent(authorMatch[2]);
        const instanceKey = decodeURIComponent(authorMatch[3]);
        if (
          (await authorizeArtifact(artifactId, 'review.decide')) === undefined
        )
          return;
        const detail = await repository.readChain(artifactId, chainId);
        const instance = detail?.chain.instances.find(
          (item) => item.instanceKey === instanceKey,
        );
        if (instance === undefined)
          return void sendText(response, 404, 'Not found.');

        const body = await readBody(request);
        const payload = body.text.trimStart().startsWith('{')
          ? (JSON.parse(body.text) as Record<string, unknown>)
          : Object.fromEntries(new URLSearchParams(body.text));
        const unitId = String(payload['unitId'] ?? '').trim();
        const rationale = String(payload['rationale'] ?? '').trim();
        const kind =
          payload['kind'] === 'exhibit-assertion'
            ? ('exhibit-assertion' as const)
            : ('statement-occurrence' as const);
        if (unitId.length === 0 || rationale.length === 0)
          return void sendText(
            response,
            400,
            'A citable unit and a rationale are required.',
          );

        // The unit must exist and lie inside this instance's own parts.
        let found:
          | {
              readonly partId: string;
              readonly unit: {
                readonly unitId: string;
                readonly startLine: number;
                readonly endLine: number;
                readonly exactQuote: string;
              };
            }
          | undefined;
        for (const partId of instance.sourcePartIds) {
          const part = await repository.readPart(artifactId, partId);
          const unit = part?.units.find((item) => item.unitId === unitId);
          if (unit !== undefined) {
            found = { partId, unit };
            break;
          }
        }
        if (found === undefined)
          return void sendText(
            response,
            404,
            'No such citable unit in this instance.',
          );

        const authoringContract = 'evidence-v2-review-authored/1';
        const decidedAt = options.now();
        const authoringDecisionId = deriveEvidenceV2ReviewDecisionId({
          occurrenceId: found.unit.unitId,
          action: 'accept',
          principal: principal.principalRef,
          decidedAt,
          rationale,
        });
        const occurrence: EvidenceV2Occurrence = {
          schemaVersion: 'evidence-v2-occurrence/1',
          occurrenceId: deriveEvidenceV2OccurrenceId({
            artifactId,
            unitId: found.unit.unitId,
            contractVersion: authoringContract,
          }),
          artifactId,
          partId: found.partId,
          unitId: found.unit.unitId,
          startLine: found.unit.startLine,
          endLine: found.unit.endLine,
          // From the unit, never from the request body.
          exactQuote: found.unit.exactQuote,
          kind,
          actorReference: null,
          temporalBound: null,
          executionId: authoringDecisionId,
          contractVersion: authoringContract,
          windowId: 'reviewer-authored',
          authoredBy: 'reviewer',
        };
        await repository.putOccurrences(artifactId, instanceKey, [occurrence]);

        // A reviewer who writes an occurrence has thereby accepted it: the
        // record and the standing come from the same act, and leaving it
        // pending would ask them to review their own entry.
        await repository.appendReviewDecision({
          schemaVersion: EVIDENCE_V2_REVIEW_SCHEMA_VERSION,
          decisionId: authoringDecisionId,
          artifactId,
          instanceKey,
          occurrenceId: occurrence.occurrenceId,
          action: 'accept',
          supersedes: null,
          principal: principal.principalRef,
          decidedAt,
          rationale,
        });
        if (json) return void sendJson(response, 201, occurrence);
        response.writeHead(303, {
          location: `/artifacts/${encodeURIComponent(artifactId)}/chains/${encodeURIComponent(chainId)}/instances/${encodeURIComponent(instanceKey)}`,
        });
        response.end();
        return;
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
      if (error instanceof EvidenceV2ImportRefusal)
        return void sendText(response, 400, error.code);
      if (
        error instanceof RangeError &&
        (error.message === 'EMPTY_TEXT' ||
          error.message === 'REQUEST_BODY_TOO_LARGE')
      )
        return void sendText(response, 400, error.message);
      const message =
        error instanceof Error ? error.message : 'Unexpected error.';
      return void sendText(response, 500, message);
    }
  };
}
