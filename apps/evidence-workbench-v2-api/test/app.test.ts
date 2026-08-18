import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clampEvidenceV2Page,
  EVIDENCE_V2_MAX_PAGE_SIZE,
  EVIDENCE_V2_SURFACE_GAPS,
  type EvidenceV2CaseOverview,
  type EvidenceV2ArtifactRecord,
  type EvidenceV2CaseRecord,
  type EvidenceV2ChainDecision,
  type EvidenceV2ChainMembership,
  type EvidenceV2ChainSummary,
  type EvidenceV2ExtractionWindowState,
  type EvidenceV2ImportWrite,
  type EvidenceV2Claim,
  type EvidenceV2ClaimGroupingDecision,
  type EvidenceV2ComparisonWindowState,
  type EvidenceV2Occurrence,
  type EvidenceV2Relation,
  type EvidenceV2RelationReviewDecision,
  type EvidenceV2ReviewDecision,
  type EvidenceV2Page,
  type EvidenceV2PageRequest,
  type EvidenceV2Repository,
  type EvidenceV2SourcePart,
} from '@acme/evidence-v2-contracts';
import {
  deriveEvidenceV2ChainState,
  type EvidenceV2Chain,
  type EvidenceV2ChainProposal,
} from '@acme/module-evidence-v2';

import { createDeterministicEvidenceAuthenticator } from '@acme/adapter-evidence-auth-memory';
import { createInMemoryEvidenceIdentityRepository } from '@acme/adapter-evidence-auth-memory';
import { createAes256GcmPayloadEncryptor } from '@acme/core';

import { createEvidenceV2PdfExtractor } from '@acme/adapter-evidence-v2-pdf';

import { createEvidenceV2App } from '../src/app.js';
import { createEvidenceV2Auth } from '../src/auth.js';
import type {
  EvidenceV2StoredText,
  EvidenceV2TextStore,
} from '../src/artifact-store.js';

/**
 * An in-memory stand-in for the PostgreSQL repository, so route behaviour is
 * verified offline. The durable path is covered by the PostgreSQL gate.
 */
function memoryRepository(): EvidenceV2Repository & {
  readonly derivationCalls: { count: number };
} {
  const cases = new Map<string, EvidenceV2CaseRecord>();
  const artifacts = new Map<string, EvidenceV2ArtifactRecord>();
  const structures = new Map<string, readonly EvidenceV2SourcePart[]>();
  const proposals = new Map<string, EvidenceV2ChainProposal>();
  const decisions = new Map<string, EvidenceV2ChainDecision[]>();
  const occurrences = new Map<string, EvidenceV2Occurrence[]>();
  const reviews: EvidenceV2ReviewDecision[] = [];
  const claims = new Map<string, EvidenceV2Claim>();
  const groupings: EvidenceV2ClaimGroupingDecision[] = [];
  const relations = new Map<string, EvidenceV2Relation>();
  const relationReviews: EvidenceV2RelationReviewDecision[] = [];
  const windows = new Map<string, EvidenceV2ExtractionWindowState[]>();
  const comparisons = new Map<string, EvidenceV2ComparisonWindowState[]>();
  const derivationCalls = { count: 0 };

  const paged = <T>(
    items: readonly T[],
    request: EvidenceV2PageRequest,
  ): EvidenceV2Page<T> => ({
    items: items.slice(request.offset, request.offset + request.limit),
    total: items.length,
    offset: request.offset,
    limit: request.limit,
  });

  const effective = (
    artifactId: string,
  ): readonly EvidenceV2ChainMembership[] => {
    const proposal = proposals.get(artifactId);
    if (proposal === undefined) return [];
    return deriveEvidenceV2ChainState(proposal, decisions.get(artifactId) ?? [])
      .memberships;
  };

  return {
    derivationCalls,
    async createCase(record) {
      cases.set(record.caseId, record);
    },
    async listCases(request) {
      return paged([...cases.values()], request);
    },
    async readCase(caseId) {
      return cases.get(caseId);
    },
    async writeImport(write: EvidenceV2ImportWrite) {
      artifacts.set(write.artifact.artifactId, write.artifact);
      structures.set(write.artifact.artifactId, write.structure.parts);
      proposals.set(write.artifact.artifactId, write.proposal);
    },
    async listArtifacts(caseId, request) {
      return paged(
        [...artifacts.values()].filter((item) => item.caseId === caseId),
        request,
      );
    },
    async readArtifact(artifactId) {
      return artifacts.get(artifactId);
    },
    async listParts(artifactId, request) {
      return paged(structures.get(artifactId) ?? [], request);
    },
    async readPart(artifactId, partId) {
      return (structures.get(artifactId) ?? []).find(
        (part) => part.partId === partId,
      );
    },
    async listChains(artifactId, request) {
      const chains: EvidenceV2ChainSummary[] = (
        proposals.get(artifactId)?.chains ?? []
      ).map((chain) => ({
        chainId: chain.chainId,
        subjectLabel: chain.subjectLabel,
        caseFileRef: chain.caseFileRef,
        instanceCount: chain.instances.length,
      }));
      return paged(chains, request);
    },
    async readChain(artifactId, chainId) {
      const chain: EvidenceV2Chain | undefined = proposals
        .get(artifactId)
        ?.chains.find((item) => item.chainId === chainId);
      if (chain === undefined) return undefined;
      const memberships = effective(artifactId).filter(
        (item) => item.chainId === chainId,
      );
      const held = new Set(memberships.map((item) => item.sourcePartId));
      return {
        chain: {
          ...chain,
          instances: chain.instances
            .map((instance) => ({
              ...instance,
              sourcePartIds: instance.sourcePartIds.filter((partId) =>
                held.has(partId),
              ),
            }))
            .filter((instance) => instance.sourcePartIds.length > 0),
        },
        memberships,
      };
    },
    async readProposedMemberships(artifactId) {
      return proposals.get(artifactId)?.memberships ?? [];
    },
    async readEffectiveMemberships(artifactId) {
      return effective(artifactId);
    },
    async appendChainDecision(artifactId, decision) {
      const log = decisions.get(artifactId) ?? [];
      log.push(decision);
      decisions.set(artifactId, log);
    },
    async listChainDecisions(artifactId) {
      return decisions.get(artifactId) ?? [];
    },
    // Extraction storage. These route tests run without a live capability, so
    // the app answers 501 before reaching them; they are held here so the
    // stand-in implements the whole port rather than the half it happens to
    // use.
    async putOccurrences(artifactId, instanceKey, written) {
      const key = `${artifactId}/${instanceKey}`;
      occurrences.set(key, [...(occurrences.get(key) ?? []), ...written]);
    },
    async listOccurrences(artifactId, instanceKey, request) {
      return paged(
        occurrences.get(`${artifactId}/${instanceKey}`) ?? [],
        request,
      );
    },
    async putExtractionWindow(state) {
      const key = `${state.artifactId}/${state.instanceKey}`;
      const held = (windows.get(key) ?? []).filter(
        (item) => item.windowId !== state.windowId,
      );
      windows.set(key, [...held, state]);
    },
    async readExtractionWindows(artifactId, instanceKey) {
      return windows.get(`${artifactId}/${instanceKey}`) ?? [];
    },
    async appendReviewDecision(decision) {
      // Append-only, and idempotent on the content-derived id.
      if (reviews.some((item) => item.decisionId === decision.decisionId))
        return;
      reviews.push(decision);
    },
    async listReviewDecisions(artifactId, instanceKey) {
      return reviews.filter(
        (item) =>
          item.artifactId === artifactId && item.instanceKey === instanceKey,
      );
    },
    async readOccurrenceReviewHistory(artifactId, occurrenceId) {
      return reviews.filter(
        (item) =>
          item.artifactId === artifactId && item.occurrenceId === occurrenceId,
      );
    },
    async readExtractedInstanceKeys(artifactId) {
      return [
        ...new Set(
          [...windows.entries()]
            .filter(([key]) => key.startsWith(`${artifactId}/`))
            .flatMap(([, value]) => value)
            .filter((item) => item.status === 'committed')
            .map((item) => item.instanceKey),
        ),
      ];
    },
    async createClaim(claim) {
      if (!claims.has(claim.claimId)) claims.set(claim.claimId, claim);
    },
    async listClaims(caseId, request) {
      return paged(
        [...claims.values()].filter((item) => item.caseId === caseId),
        request,
      );
    },
    async readClaim(claimId) {
      return claims.get(claimId);
    },
    async appendClaimGrouping(decision) {
      if (groupings.some((item) => item.decisionId === decision.decisionId))
        return;
      groupings.push(decision);
    },
    async listClaimGroupings(claimId) {
      return groupings.filter((item) => item.claimId === claimId);
    },
    async readOccurrenceClaimIds(occurrenceId) {
      return groupings.filter((item) => item.occurrenceId === occurrenceId);
    },
    async readOccurrencesById(ids) {
      const wanted = new Set(ids);
      return [...occurrences.values()]
        .flat()
        .filter((item) => wanted.has(item.occurrenceId));
    },
    async readOccurrenceBindings(ids) {
      const wanted = new Set(ids);
      const bindings = [];
      for (const [key, items] of occurrences) {
        const instanceKey = key.split('/').slice(1).join('/');
        for (const occurrence of items) {
          if (wanted.has(occurrence.occurrenceId))
            bindings.push({ occurrence, instanceKey });
        }
      }
      return bindings.sort((left, right) =>
        left.occurrence.occurrenceId.localeCompare(
          right.occurrence.occurrenceId,
        ),
      );
    },
    async createRelation(relation) {
      if (!relations.has(relation.relationId))
        relations.set(relation.relationId, relation);
    },
    async listRelations(caseId, request) {
      return paged(
        [...relations.values()].filter((item) => item.caseId === caseId),
        request,
      );
    },
    async readRelation(relationId) {
      return relations.get(relationId);
    },
    async appendRelationReview(decision) {
      if (
        relationReviews.some((item) => item.decisionId === decision.decisionId)
      )
        return;
      relationReviews.push(decision);
    },
    async listRelationReviews(relationId) {
      return relationReviews.filter((item) => item.relationId === relationId);
    },
    async putComparisonWindow(state) {
      const key = `${state.artifactId}/${state.instanceKey}`;
      const held = (comparisons.get(key) ?? []).filter(
        (item) => item.windowId !== state.windowId,
      );
      comparisons.set(key, [...held, state]);
    },
    async readComparisonWindows(artifactId, instanceKey) {
      return comparisons.get(`${artifactId}/${instanceKey}`) ?? [];
    },
    async readCaseOverview(caseId) {
      const scoped = [...artifacts.values()].filter(
        (item) => item.caseId === caseId,
      );
      const ids = new Set(scoped.map((item) => item.artifactId));
      const parts = scoped.flatMap(
        (item) => structures.get(item.artifactId) ?? [],
      );
      const chains = scoped.flatMap(
        (item) => proposals.get(item.artifactId)?.chains ?? [],
      );
      const instances = chains.flatMap((chain) => chain.instances);
      const scopedWindows = [...windows.entries()]
        .filter(([key]) => ids.has(key.split('/')[0] ?? ''))
        .flatMap(([, value]) => value);
      const scopedOccurrences = [...occurrences.entries()]
        .filter(([key]) => ids.has(key.split('/')[0] ?? ''))
        .flatMap(([, value]) => value);
      const committed = new Set(
        scopedWindows
          .filter((item) => item.status === 'committed')
          .map((item) => item.instanceKey),
      );
      const outstanding = instances.filter(
        (instance) => !committed.has(instance.instanceKey),
      );
      const first = outstanding[0];
      const owner = chains.find((chain) =>
        chain.instances.some((item) => item.instanceKey === first?.instanceKey),
      );
      return {
        caseId,
        counts: {
          artifacts: scoped.length,
          lines: scoped.reduce((total, item) => total + item.lineCount, 0),
          parts: parts.length,
          citableUnits: parts.reduce(
            (total, part) => total + part.units.length,
            0,
          ),
          chains: chains.length,
          instances: instances.length,
          occurrences: scopedOccurrences.length,
          committedWindows: scopedWindows.filter(
            (item) => item.status === 'committed',
          ).length,
          failedWindows: scopedWindows.filter(
            (item) => item.status === 'failed',
          ).length,
          chainDecisions: [...decisions.entries()]
            .filter(([artifactId]) => ids.has(artifactId))
            .reduce((total, [, log]) => total + log.length, 0),
          reviewDecisions: reviews.filter((item) => ids.has(item.artifactId))
            .length,
          pending: scopedOccurrences.filter(
            (item) =>
              !reviews.some((r) => r.occurrenceId === item.occurrenceId),
          ).length,
          accepted: 0,
          rejected: 0,
          needsRevision: 0,
          reviewerAuthored: scopedOccurrences.filter(
            (item) => item.authoredBy === 'reviewer',
          ).length,
          claims: [...claims.values()].filter((item) => item.caseId === caseId)
            .length,
          claimGroupingDecisions: groupings.filter(
            (item) => item.caseId === caseId,
          ).length,
          groupedOccurrences: 0,
          crossInstanceClaims: 0,
          relations: [...relations.values()].filter(
            (item) => item.caseId === caseId,
          ).length,
          relationReviewDecisions: relationReviews.filter(
            (item) => item.caseId === caseId,
          ).length,
          acceptedRelations: 0,
          pendingRelations: 0,
          rejectedRelations: 0,
          modelProposedRelations: [...relations.values()].filter(
            (item) =>
              item.caseId === caseId && item.provenance === 'model-proposed',
          ).length,
          reviewerAuthoredRelations: [...relations.values()].filter(
            (item) =>
              item.caseId === caseId && item.provenance === 'reviewer-authored',
          ).length,
        },
        instancesWithoutExtraction: outstanding.length,
        instancesPendingReview: 0,
        resumeAt:
          first === undefined || owner === undefined
            ? null
            : {
                artifactId: scoped[0]?.artifactId ?? '',
                chainId: owner.chainId,
                instanceKey: first.instanceKey,
                subjectLabel: owner.subjectLabel,
                instanceOrdinal: first.instanceOrdinal,
              },
        unavailable: EVIDENCE_V2_SURFACE_GAPS,
      };
    },
  };
}

function memoryTextStore(): EvidenceV2TextStore {
  const texts = new Map<string, string>();
  return {
    async put(input) {
      const objectKey = `v2/${input.caseId}/${input.artifactId}/canonical-text`;
      texts.set(objectKey, input.text);
      return {
        objectKey,
        canonicalSha256: 'a'.repeat(64),
        canonicalByteLength: Buffer.byteLength(input.text, 'utf8'),
        representation: {
          objectKey,
        } as unknown as EvidenceV2StoredText['representation'],
        envelope: { objectKey } as unknown as EvidenceV2StoredText['envelope'],
      };
    },
    async get(stored) {
      return texts.get(stored.objectKey) ?? '';
    },
    async putBytes(input) {
      const objectKey = `v2/${input.caseId}/${input.artifactId}/received`;
      return {
        objectKey,
        sha256: 'b'.repeat(64),
        byteLength: input.bytes.byteLength,
        representation: {
          objectKey,
        } as unknown as EvidenceV2StoredText['representation'],
        envelope: { objectKey } as unknown as EvidenceV2StoredText['envelope'],
      };
    },
  };
}

const header = (title: string): string =>
  `Förhör med ${title}   diarienr: 0500-K39890-04`;
const block = (subject: string, date: string, time: string): string =>
  [
    'Hörd person',
    subject,
    'Diarienr',
    '0500-K39890-04',
    'Förhörsdatum',
    date,
    'Förhör påbörjat',
    time,
    'Berättelse',
  ].join('\n');

const CORPUS = [
  header('Ammouri, HUSSEIN; 2007-04-25 14:10'),
  block('Ammouri, Allia', '2004-11-09', '11:27'),
  'Allia berättar om kvällen.',
  header('Ammouri, Allia; 2004-11-09 11:27'),
  block('Ammouri, Hussein', '2004-10-22', '07:55'),
  'Hussein berättar om resan.',
].join('\n');

describe('evidence v2 api', () => {
  let server: Server;
  let base: string;
  let repository: ReturnType<typeof memoryRepository>;

  beforeEach(async () => {
    repository = memoryRepository();
    let counter = 0;
    const auth = createEvidenceV2Auth({
      identity: createInMemoryEvidenceIdentityRepository(),
      authenticator: createDeterministicEvidenceAuthenticator({
        issuer: 'https://local.acme.invalid/',
        accounts: [
          {
            email: 'first@acme.local',
            password: 'first-secret',
            subject: 'first',
            displayLabel: 'First reviewer',
          },
          {
            email: 'second@acme.local',
            password: 'second-secret',
            subject: 'second',
            displayLabel: 'Second reviewer',
          },
        ],
        expiresAt: () => new Date(Date.now() + 3_600_000).toISOString(),
      }),
      protector: createAes256GcmPayloadEncryptor({
        key: Buffer.alloc(32, 7),
        keyId: 'test-session',
      }),
      issuer: 'https://local.acme.invalid/',
      organizationId: 'test-org',
      organizationLabel: 'Test organization',
      accounts: [
        {
          email: 'first@acme.local',
          subject: 'first',
          displayLabel: 'First reviewer',
          organizationRole: 'organization-admin',
        },
        {
          email: 'second@acme.local',
          subject: 'second',
          displayLabel: 'Second reviewer',
          organizationRole: 'reviewer',
        },
      ],
      now: () => new Date().toISOString(),
      nextToken: () => {
        counter += 1;
        return `token-${String(counter)}`;
      },
    });
    await auth.bootstrap();
    const handler = createEvidenceV2App({
      repository,
      textStore: memoryTextStore(),
      auth,
      pdfExtractor: createEvidenceV2PdfExtractor(),
      now: () => '2026-08-16T00:00:00.000Z',
    });
    server = createServer((request, response) => {
      void handler(request, response);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (address === null || typeof address === 'string')
      throw new Error('expected a bound port');
    base = `http://127.0.0.1:${String(address.port)}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function signIn(
    email: string,
    password: string,
  ): Promise<Record<string, string>> {
    const response = await fetch(`${base}/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.status !== 201)
      throw new Error(`sign-in failed: ${String(response.status)}`);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const body = (await response.json()) as { csrfToken: string };
    return {
      cookie,
      'x-acme-csrf': body.csrfToken,
      'content-type': 'application/json',
    };
  }

  async function seed(): Promise<{
    caseId: string;
    artifactId: string;
    headers: Record<string, string>;
  }> {
    const headers = await signIn('first@acme.local', 'first-secret');
    const created = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Test case', caseReference: 'T-1' }),
    });
    const record = (await created.json()) as EvidenceV2CaseRecord;
    const imported = await fetch(
      `${base}/api/cases/${record.caseId}/artifacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'source-A', text: CORPUS }),
      },
    );
    const artifact = (await imported.json()) as { artifactId: string };
    return { caseId: record.caseId, artifactId: artifact.artifactId, headers };
  }

  it('imports once and reports what was derived', async () => {
    const { artifactId } = await seed();
    const artifact = await repository.readArtifact(artifactId);

    expect(artifact?.partCount).toBeGreaterThan(0);
    expect(artifact?.chainCount).toBe(2);
    expect(artifact?.structureRuleVersion).toBe(
      'evidence-v2-source-structure-rules/1',
    );
    expect(artifact?.chainRuleVersion).toBe('evidence-v2-chain-rules/1');
  });

  it('chains by body subject, so a mis-titled part opens under the right person', async () => {
    const { artifactId, headers } = await seed();
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as EvidenceV2Page<EvidenceV2ChainSummary>;

    expect(chains.items.map((item) => item.subjectLabel).sort()).toEqual([
      'Ammouri, Allia',
      'Ammouri, Hussein',
    ]);

    const allia = chains.items.find(
      (item) => item.subjectLabel === 'Ammouri, Allia',
    );
    const detail = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${allia?.chainId ?? ''}`,
        { headers },
      )
    ).json()) as { chain: EvidenceV2Chain };
    const firstPart = detail.chain.instances[0]?.sourcePartIds[0] ?? '';
    const part = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts/${firstPart}`, {
        headers,
      })
    ).json()) as { part: EvidenceV2SourcePart };

    // The part's own label names Hussein; the chain it belongs to is Allia's.
    expect(part.part.title?.text).toContain('Ammouri, HUSSEIN');
  });

  it('bounds every list route', async () => {
    const { artifactId, headers } = await seed();
    const response = await fetch(
      `${base}/api/artifacts/${artifactId}/parts?limit=100000`,
      { headers },
    );
    const parts =
      (await response.json()) as EvidenceV2Page<EvidenceV2SourcePart>;

    expect(parts.limit).toBeLessThanOrEqual(EVIDENCE_V2_MAX_PAGE_SIZE);
    expect(clampEvidenceV2Page(0, 100000).limit).toBe(
      EVIDENCE_V2_MAX_PAGE_SIZE,
    );
  });

  it('serves a part with its exact source lines', async () => {
    const { artifactId, headers } = await seed();
    const parts = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts`, { headers })
    ).json()) as EvidenceV2Page<EvidenceV2SourcePart>;
    const first = parts.items[0];
    if (first === undefined) throw new Error('expected a part');

    const view = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts/${first.partId}`, {
        headers,
      })
    ).json()) as { lines: string[] };

    expect(view.lines.length).toBe(first.endLine - first.startLine + 1);
    expect(
      CORPUS.split('\n').slice(first.startLine - 1, first.endLine),
    ).toEqual(view.lines);
  });

  it('appends a membership decision without disturbing the proposal', async () => {
    const { artifactId, headers } = await seed();
    const before = await repository.readProposedMemberships(artifactId);
    const frozen = JSON.stringify(before);
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as EvidenceV2Page<EvidenceV2ChainSummary>;
    const target = chains.items[1];
    const moved = before[0];
    if (target === undefined || moved === undefined)
      throw new Error('expected two chains and a membership');

    const decision: EvidenceV2ChainDecision = {
      decisionId: 'decision-1',
      action: 'assign',
      sourcePartId: moved.sourcePartId,
      chainId: target.chainId,
      supersedes: null,
      principal: 'local-operator',
      decidedAt: '2026-08-16T00:00:00.000Z',
      rationale: 'Reviewer moved it.',
    };
    const response = await fetch(
      `${base}/api/artifacts/${artifactId}/chain-decisions`,
      { method: 'POST', headers, body: JSON.stringify(decision) },
    );

    expect(response.status).toBe(201);
    const effective = await repository.readEffectiveMemberships(artifactId);
    expect(
      effective.find((item) => item.sourcePartId === moved.sourcePartId)
        ?.chainId,
    ).toBe(target.chainId);
    expect(
      JSON.stringify(await repository.readProposedMemberships(artifactId)),
    ).toBe(frozen);
  });

  it('shows a corrected membership on the chain it was moved off', async () => {
    const { artifactId, headers } = await seed();
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as EvidenceV2Page<EvidenceV2ChainSummary>;
    const from = chains.items[0];
    const to = chains.items[1];
    if (from === undefined || to === undefined)
      throw new Error('expected two chains');
    const before = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${from.chainId}`,
        { headers },
      )
    ).json()) as { chain: EvidenceV2Chain };
    const movedPart = before.chain.instances[0]?.sourcePartIds[0];
    if (movedPart === undefined) throw new Error('expected a part');

    await fetch(`${base}/api/artifacts/${artifactId}/chain-decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        decisionId: 'decision-move',
        action: 'assign',
        sourcePartId: movedPart,
        chainId: to.chainId,
        supersedes: null,
        principal: 'local-operator',
        decidedAt: '2026-08-16T00:00:00.000Z',
        rationale: 'Moved.',
      } satisfies EvidenceV2ChainDecision),
    });

    const after = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${from.chainId}`,
        { headers },
      )
    ).json()) as { chain: EvidenceV2Chain };
    const stillThere = after.chain.instances.flatMap(
      (instance) => instance.sourcePartIds,
    );
    expect(stillThere).not.toContain(movedPart);

    const target = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains/${to.chainId}`, {
        headers,
      })
    ).json()) as { memberships: EvidenceV2ChainMembership[] };
    expect(
      target.memberships.some((item) => item.sourcePartId === movedPart),
    ).toBe(true);
  });

  it('renders navigable HTML for every surface', async () => {
    const { caseId, artifactId, headers } = await seed();

    const cases = await (await fetch(`${base}/`, { headers })).text();
    expect(cases).toContain('<h1>Cases</h1>');
    expect(cases).toContain(`/cases/${caseId}`);

    const casePage = await (
      await fetch(`${base}/cases/${caseId}`, { headers })
    ).text();
    expect(casePage).toContain(`/artifacts/${artifactId}/parts`);
    expect(casePage).toContain(`/artifacts/${artifactId}/chains`);

    const partsPage = await (
      await fetch(`${base}/artifacts/${artifactId}/parts`, { headers })
    ).text();
    expect(partsPage).toContain('Source parts');

    const chainsPage = await (
      await fetch(`${base}/artifacts/${artifactId}/chains`, { headers })
    ).text();
    expect(chainsPage).toContain('Ammouri, Hussein');
  });

  it('shows the surface bar on every case-scoped page', async () => {
    const { caseId, artifactId, headers } = await seed();
    const pages = [
      `/cases/${caseId}`,
      `/cases/${caseId}/documents`,
      `/cases/${caseId}/status`,
      `/cases/${caseId}/timeline`,
      `/cases/${caseId}/relations`,
      `/artifacts/${artifactId}/parts`,
      `/artifacts/${artifactId}/chains`,
    ];
    for (const path of pages) {
      const html = await (await fetch(`${base}${path}`, { headers })).text();
      // Every surface reachable, and the case named, from every page.
      expect(html, path).toContain('nav class="surfaces"');
      expect(html, path).toContain(`/cases/${caseId}/status`);
      expect(html, path).toContain(`/cases/${caseId}/timeline`);
      expect(html, path).toContain('Test case');
      expect(html, path).toContain('aria-current="page"');
    }
  });

  it('states the page bound rather than implying it', async () => {
    const { artifactId, headers } = await seed();
    // The corpus holds two parts, so a bound of one must both state itself and
    // offer the page that is being withheld.
    const html = await (
      await fetch(`${base}/artifacts/${artifactId}/parts?limit=1`, { headers })
    ).text();
    expect(html).toContain('1–1 of 2 · page bound 1 of at most 100');
    expect(html).toContain('offset=1');
  });

  it('reports an unbuilt surface as a named condition, never an empty list', async () => {
    const { caseId, headers } = await seed();
    const page = await fetch(`${base}/cases/${caseId}/timeline`, { headers });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('Not built');
    expect(html).toContain(EVIDENCE_V2_SURFACE_GAPS.timeline.deliveredBy);
    // The defect this exists to prevent: an absent surface answering with an
    // empty result as though the case had none (R-07).
    expect(html).not.toContain('<tbody></tbody>');

    const json = (await (
      await fetch(`${base}/api/cases/${caseId}/timeline`, { headers })
    ).json()) as { state: string; deliveredBy: string };
    expect(json.state).toBe('not-implemented');
    expect(json.deliveredBy).toBe(
      EVIDENCE_V2_SURFACE_GAPS.timeline.deliveredBy,
    );
  });

  it('reports status counts that agree with the list routes', async () => {
    const { caseId, artifactId, headers } = await seed();
    const overview = (await (
      await fetch(`${base}/api/cases/${caseId}/status`, { headers })
    ).json()) as EvidenceV2CaseOverview;
    const parts = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts`, { headers })
    ).json()) as EvidenceV2Page<EvidenceV2SourcePart>;
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as EvidenceV2Page<unknown>;

    expect(overview.counts.artifacts).toBe(1);
    expect(overview.counts.parts).toBe(parts.total);
    expect(overview.counts.chains).toBe(chains.total);
    expect(overview.counts.occurrences).toBe(0);
    expect(overview.counts.committedWindows).toBe(0);

    // Nothing extracted, so every instance is outstanding and the resume
    // pointer names one of them rather than reporting a number alone.
    expect(overview.instancesWithoutExtraction).toBe(overview.counts.instances);
    expect(overview.resumeAt).not.toBeNull();
    expect(overview.resumeAt?.subjectLabel.length).toBeGreaterThan(0);

    // Unbuilt surfaces report a condition, never zero. ACME-0160 retired
    // `claims`, so `timeline` is the standing example now.
    expect(Object.keys(overview.unavailable)).toContain('timeline');
    expect(overview.unavailable['timeline']?.state).toBe('not-implemented');
    expect(overview.counts).not.toHaveProperty('timeline');

    const html = await (
      await fetch(`${base}/cases/${caseId}/status`, { headers })
    ).text();
    expect(html).toContain('<h1>Status</h1>');
    expect(html).toContain(String(parts.total));
    // No chart, gauge or score on a surface that only counts.
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<progress');
  });

  it('sends a single-source case straight to its chains', async () => {
    const { caseId, artifactId, headers } = await seed();
    const response = await fetch(`${base}/cases/${caseId}/chains`, {
      headers,
      redirect: 'manual',
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `/artifacts/${artifactId}/chains`,
    );
  });

  async function seedOccurrence(
    caseId: string,
    artifactId: string,
    headers: Record<string, string>,
  ): Promise<{ instanceKey: string; chainId: string; occurrenceId: string }> {
    void caseId;
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as { items: { chainId: string }[] };
    const chainId = chains.items[0]?.chainId ?? '';
    const detail = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains/${chainId}`, {
        headers,
      })
    ).json()) as {
      chain: {
        instances: { instanceKey: string; sourcePartIds: string[] }[];
      };
    };
    const instance = detail.chain.instances[0];
    if (instance === undefined) throw new Error('expected an instance');
    // A reviewer-authored occurrence is the offline way to get real evidence
    // into an instance: extraction needs a provider and this suite has none.
    const part = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/parts/${instance.sourcePartIds[0] ?? ''}`,
        { headers },
      )
    ).json()) as { part: { units: { unitId: string }[] } };
    const unitId = part.part.units[0]?.unitId ?? '';
    const created = await fetch(
      `${base}/api/artifacts/${artifactId}/chains/${chainId}/instances/${instance.instanceKey}/occurrences`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ unitId, rationale: 'The model missed this.' }),
      },
    );
    const occurrence = (await created.json()) as { occurrenceId: string };
    return {
      instanceKey: instance.instanceKey,
      chainId,
      occurrenceId: occurrence.occurrenceId,
    };
  }

  it('builds a reviewer-authored occurrence from the cited unit, not from the request', async () => {
    const { caseId, artifactId, headers } = await seed();
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as { items: { chainId: string }[] };
    const chainId = chains.items[0]?.chainId ?? '';
    const detail = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains/${chainId}`, {
        headers,
      })
    ).json()) as {
      chain: { instances: { instanceKey: string; sourcePartIds: string[] }[] };
    };
    const instance = detail.chain.instances[0];
    if (instance === undefined) throw new Error('expected an instance');
    const part = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/parts/${instance.sourcePartIds[0] ?? ''}`,
        { headers },
      )
    ).json()) as {
      part: { units: { unitId: string; exactQuote: string }[] };
    };
    const unit = part.part.units[0];
    if (unit === undefined) throw new Error('expected a unit');

    const created = await fetch(
      `${base}/api/artifacts/${artifactId}/chains/${chainId}/instances/${instance.instanceKey}/occurrences`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          unitId: unit.unitId,
          rationale: 'The model missed this sentence.',
          // Ignored by construction: the record is assembled from the unit.
          exactQuote: 'Something the source never says.',
          startLine: 9999,
        }),
      },
    );
    expect(created.status).toBe(201);
    const occurrence = (await created.json()) as EvidenceV2Occurrence;
    expect(occurrence.exactQuote).toBe(unit.exactQuote);
    expect(occurrence.exactQuote).not.toContain('never says');
    expect(occurrence.startLine).not.toBe(9999);
    expect(occurrence.authoredBy).toBe('reviewer');
    expect(occurrence.windowId).toBe('reviewer-authored');

    // Authoring is itself an acceptance, so it does not sit pending awaiting
    // its own author.
    const review = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${chainId}/instances/${instance.instanceKey}/reviews`,
        { headers },
      )
    ).json()) as { standings: { standing: string }[] };
    expect(review.standings[0]?.standing).toBe('accepted');
    void caseId;
  });

  it('refuses a reviewer-authored occurrence citing a unit outside the instance', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const response = await fetch(
      `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}/occurrences`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          unitId: 'unit-that-does-not-exist',
          rationale: 'Should be refused.',
        }),
      },
    );
    expect(response.status).toBe(404);
  });

  it('appends a review decision and folds standing without storing it', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const reviewPath = `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}/reviews`;

    const rejected = await fetch(reviewPath, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        occurrenceId: seeded.occurrenceId,
        action: 'reject',
        rationale: 'The quote is an index line, not testimony.',
      }),
    });
    expect(rejected.status).toBe(201);
    const decision = (await rejected.json()) as {
      principal: string;
      supersedes: string | null;
      action: string;
    };
    expect(decision.action).toBe('reject');
    // The authoring acceptance is superseded, explicitly.
    expect(decision.supersedes).not.toBeNull();

    const after = (await (await fetch(reviewPath, { headers })).json()) as {
      standings: { standing: string; decisionCount: number }[];
      decisions: { action: string }[];
      completion: { state: string; rejectedCount: number };
    };
    expect(after.standings[0]?.standing).toBe('rejected');
    // Rejection removes nothing: both decisions are still in the log.
    expect(after.decisions.map((item) => item.action)).toEqual([
      'accept',
      'reject',
    ]);
    expect(after.standings[0]?.decisionCount).toBe(2);
    expect(after.completion.rejectedCount).toBe(1);

    // The occurrence itself is untouched by the decision.
    const occurrences = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}`,
        { headers },
      )
    ).json()) as { occurrences: { total: number } };
    expect(occurrences.occurrences.total).toBe(1);
  });

  it('records the server-derived principal and ignores one in the body', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const response = await fetch(
      `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}/reviews`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          occurrenceId: seeded.occurrenceId,
          action: 'accept',
          rationale: 'Verified against the source lines.',
          principal: 'somebody-else',
        }),
      },
    );
    const decision = (await response.json()) as { principal: string };
    expect(decision.principal).not.toBe('somebody-else');
    expect(decision.principal).toContain('evidence_principal');
  });

  it('refuses a decision without a rationale, an action or a known occurrence', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const reviewPath = `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}/reviews`;
    const cases: [Record<string, unknown>, number][] = [
      [{ occurrenceId: seeded.occurrenceId, action: 'accept' }, 400],
      [
        { occurrenceId: seeded.occurrenceId, action: 'move', rationale: 'x' },
        400,
      ],
      [
        { occurrenceId: seeded.occurrenceId, action: 'delete', rationale: 'x' },
        400,
      ],
      [
        { occurrenceId: 'occurrence-nope', action: 'accept', rationale: 'x' },
        404,
      ],
    ];
    for (const [body, status] of cases) {
      const response = await fetch(reviewPath, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      expect(response.status, JSON.stringify(body)).toBe(status);
    }
  });

  it('reports instance and chain completion without storing a flag', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);

    // The authored occurrence is accepted, but its instance has no committed
    // extraction window, so the instance is not reviewed and the chain is not
    // complete. Work that was never started is not finished work.
    const chain = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}`,
        { headers },
      )
    ).json()) as {
      completion: { complete: boolean; notExtractedCount: number };
      instanceReviewStates: { instanceKey: string; state: string }[];
    };
    expect(chain.completion.complete).toBe(false);
    expect(chain.completion.notExtractedCount).toBeGreaterThan(0);
    expect(
      chain.instanceReviewStates.find(
        (item) => item.instanceKey === seeded.instanceKey,
      )?.state,
    ).toBe('not-extracted');
  });

  it('requires review.decide, CSRF and membership for every review write', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const paths = [
      `/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}/reviews`,
      `/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}/occurrences`,
    ];
    const body = JSON.stringify({
      occurrenceId: seeded.occurrenceId,
      action: 'accept',
      rationale: 'x',
      unitId: 'x',
    });

    for (const path of paths) {
      // Unauthenticated.
      expect(
        (await fetch(`${base}${path}`, { method: 'POST', body })).status,
      ).toBe(401);
      // Authenticated without the CSRF header.
      const noCsrf = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          cookie: headers['cookie'] ?? '',
          'content-type': 'application/json',
        },
        body,
      });
      expect(noCsrf.status).toBe(401);
      // A different principal is not a member: indistinguishable from missing.
      const other = await signIn('second@acme.local', 'second-secret');
      const nonMember = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: other,
        body,
      });
      expect(nonMember.status).toBe(404);
    }
    void caseId;
  });

  it('computes completion over the instance, not over the rendered page', async () => {
    // R-07, found by the ACME-0159 close-out run: a 27-occurrence instance
    // with a page of 25 reported `reviewed` on its own page while the chain
    // and the case still reported it pending. Completion is a property of the
    // instance; the page bound is a property of the display.
    const headers = await signIn('first@acme.local', 'first-secret');
    const created = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Paging case', caseReference: 'T-PAGE' }),
    });
    const record = (await created.json()) as EvidenceV2CaseRecord;
    // One hearing whose body holds several narrative sentences, so the
    // instance has more citable units than one page will show.
    const text = [
      header('Ammouri, Hussein; 2004-10-19 15:40'),
      block('Ammouri, Hussein', '2004-10-19', '15:40'),
      'Hussein berättar om resan.',
      'Han beskriver bilen som blå.',
      'Han säger att de åkte på kvällen.',
    ].join('\n');
    const imported = await fetch(
      `${base}/api/cases/${record.caseId}/artifacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'paging-source', text }),
      },
    );
    const artifactId = ((await imported.json()) as { artifactId: string })
      .artifactId;

    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as { items: { chainId: string }[] };
    const chainId = chains.items[0]?.chainId ?? '';
    const detail = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains/${chainId}`, {
        headers,
      })
    ).json()) as {
      chain: { instances: { instanceKey: string; sourcePartIds: string[] }[] };
    };
    const instance = detail.chain.instances[0];
    if (instance === undefined) throw new Error('expected an instance');
    const path = `${base}/api/artifacts/${artifactId}/chains/${chainId}/instances/${instance.instanceKey}`;

    const units: string[] = [];
    for (const partId of instance.sourcePartIds) {
      const part = (await (
        await fetch(`${base}/api/artifacts/${artifactId}/parts/${partId}`, {
          headers,
        })
      ).json()) as { part: { units: { unitId: string }[] } };
      units.push(...part.part.units.map((item) => item.unitId));
    }
    expect(units.length).toBeGreaterThan(1);

    for (const unitId of units.slice(0, 2))
      await fetch(`${path}/occurrences`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ unitId, rationale: 'For the paging proof.' }),
      });

    // One occurrence per page. Whatever the page shows, completion must speak
    // for the whole instance.
    const firstPage = (await (
      await fetch(`${path}/reviews?limit=1`, { headers })
    ).json()) as {
      standings: unknown[];
      completion: { occurrenceCount: number };
    };
    expect(firstPage.standings).toHaveLength(1);
    expect(firstPage.completion.occurrenceCount).toBe(2);

    const whole = (await (
      await fetch(`${path}/reviews`, { headers })
    ).json()) as {
      completion: { occurrenceCount: number };
    };
    expect(whole.completion.occurrenceCount).toBe(2);
    expect(firstPage.completion).toEqual(whole.completion);
  });

  async function seedClaim(
    caseId: string,
    headers: Record<string, string>,
  ): Promise<string> {
    const created = await fetch(`${base}/api/cases/${caseId}/claims`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        label: 'The blue car',
        statement: 'Statements about the colour of the car.',
      }),
    });
    return ((await created.json()) as { claimId: string }).claimId;
  }

  it('groups occurrences without merging, absorbing or owning them', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const claimId = await seedClaim(caseId, headers);
    const claimPath = `${base}/api/cases/${caseId}/claims/${claimId}`;

    const before = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}`,
        { headers },
      )
    ).json()) as { occurrences: { items: EvidenceV2Occurrence[] } };
    const original = before.occurrences.items[0];

    const grouped = await fetch(claimPath, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        occurrenceId: seeded.occurrenceId,
        action: 'include',
        instanceKey: seeded.instanceKey,
        rationale: 'Concerns the same proposition.',
      }),
    });
    expect(grouped.status).toBe(201);

    const projection = (await (await fetch(claimPath, { headers })).json()) as {
      contributorCount: number;
      empty: boolean;
      contributors: { occurrenceId: string; exactQuote: string }[];
    };
    expect(projection.contributorCount).toBe(1);
    expect(projection.empty).toBe(false);
    expect(projection.contributors[0]?.exactQuote).toBe(original?.exactQuote);

    // The occurrence is unchanged by having been grouped: the claim owns
    // nothing.
    const after = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}`,
        { headers },
      )
    ).json()) as { occurrences: { items: EvidenceV2Occurrence[] } };
    expect(after.occurrences.items[0]).toEqual(original);
  });

  it('excludes an occurrence without touching it or the superseded decision', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const claimId = await seedClaim(caseId, headers);
    const claimPath = `${base}/api/cases/${caseId}/claims/${claimId}`;

    for (const action of ['include', 'exclude'] as const)
      await fetch(claimPath, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          occurrenceId: seeded.occurrenceId,
          action,
          instanceKey: seeded.instanceKey,
          rationale: `${action} for the exclusion proof.`,
        }),
      });

    const projection = (await (await fetch(claimPath, { headers })).json()) as {
      contributorCount: number;
      empty: boolean;
      groupings: {
        action: string;
        decisionId: string;
        supersedes: string | null;
      }[];
    };
    expect(projection.contributorCount).toBe(0);
    expect(projection.empty).toBe(true);
    // Both decisions survive, and the exclusion names what it replaced.
    expect(projection.groupings.map((item) => item.action)).toEqual([
      'include',
      'exclude',
    ]);
    // The exclusion names what it replaced, rather than leaving it implied.
    expect(projection.groupings[1]?.supersedes).toBe(
      projection.groupings[0]?.decisionId,
    );

    // The occurrence itself is still there, still reviewable.
    const occurrences = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}`,
        { headers },
      )
    ).json()) as { occurrences: { total: number } };
    expect(occurrences.occurrences.total).toBe(1);
  });

  it('refuses grouping an occurrence of another case, and an unknown one', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const claimId = await seedClaim(caseId, headers);

    const other = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Other case', caseReference: 'T-OTHER' }),
    });
    const otherCase = (await other.json()) as EvidenceV2CaseRecord;
    const otherClaimId = await seedClaim(otherCase.caseId, headers);

    // Grouping this case's occurrence into the other case's claim is a
    // disclosure, not a projection (ADR-0036).
    const crossCase = await fetch(
      `${base}/api/cases/${otherCase.caseId}/claims/${otherClaimId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          occurrenceId: seeded.occurrenceId,
          action: 'include',
          rationale: 'Should be refused.',
        }),
      },
    );
    expect(crossCase.status).toBe(404);

    const unknown = await fetch(
      `${base}/api/cases/${caseId}/claims/${claimId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          occurrenceId: 'occurrence-nope',
          action: 'include',
          rationale: 'Should be refused.',
        }),
      },
    );
    expect(unknown.status).toBe(404);
  });

  it('refuses a claim without a label, and a grouping without an action', async () => {
    const { caseId, headers } = await seed();
    const claimId = await seedClaim(caseId, headers);
    expect(
      (
        await fetch(`${base}/api/cases/${caseId}/claims`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ label: '', statement: 'x' }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${base}/api/cases/${caseId}/claims/${claimId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            occurrenceId: 'x',
            action: 'merge',
            rationale: 'x',
          }),
        })
      ).status,
    ).toBe(400);
  });

  it('hides another case\u2019s claim behind 404, and refuses non-members', async () => {
    const { caseId, headers } = await seed();
    const claimId = await seedClaim(caseId, headers);
    const other = await signIn('second@acme.local', 'second-secret');
    for (const path of [
      `/api/cases/${caseId}/claims`,
      `/api/cases/${caseId}/claims/${claimId}`,
    ]) {
      expect((await fetch(`${base}${path}`, { headers: other })).status).toBe(
        404,
      );
      expect((await fetch(`${base}${path}`)).status).toBe(401);
    }
  });

  it('shows Claims in the surface bar and no longer as an unbuilt surface', async () => {
    const { caseId, headers } = await seed();
    const html = await (
      await fetch(`${base}/cases/${caseId}/claims`, { headers })
    ).text();
    expect(html).toContain('<h1>Claims</h1>');
    expect(html).toContain('aria-current="page"');

    const overview = (await (
      await fetch(`${base}/api/cases/${caseId}/status`, { headers })
    ).json()) as EvidenceV2CaseOverview;
    expect(Object.keys(overview.unavailable)).not.toContain('claims');
    expect(overview.counts).toHaveProperty('claims');
  });

  it('no longer reports standing as an unbuilt surface', async () => {
    const { caseId, headers } = await seed();
    const overview = (await (
      await fetch(`${base}/api/cases/${caseId}/status`, { headers })
    ).json()) as EvidenceV2CaseOverview;
    expect(Object.keys(overview.unavailable)).not.toContain('standing');
    expect(Object.keys(overview.unavailable)).toContain('timeline');
    expect(overview.counts).toHaveProperty('accepted');
  });

  it('records a relation without deleting either endpoint', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const claimId = await seedClaim(caseId, headers);
    const created = await fetch(`${base}/api/cases/${caseId}/relations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        artifactId,
        chainId: seeded.chainId,
        fromKind: 'occurrence',
        fromId: seeded.occurrenceId,
        toKind: 'claim',
        toId: claimId,
        type: 'adds',
        actor: 'comparable',
        time: 'comparable',
        location: 'unknown',
        entity: 'unknown',
        rationale: 'The occurrence adds to this grouping.',
      }),
    });
    expect(created.status).toBe(201);
    const relation = (await created.json()) as {
      relationId: string;
      type: string;
      provenance: string;
    };
    expect(relation.type).toBe('adds');
    expect(relation.provenance).toBe('reviewer-authored');

    const viewed = (await (
      await fetch(
        `${base}/api/cases/${caseId}/relations/${relation.relationId}`,
        { headers },
      )
    ).json()) as {
      standing: string;
      from: { id: string };
      to: { id: string };
      reviews: { action: string }[];
    };
    expect(viewed.standing).toBe('accepted');
    expect(viewed.from.id).toBe(seeded.occurrenceId);
    expect(viewed.to.id).toBe(claimId);
    expect(viewed.reviews.map((item) => item.action)).toEqual(['accept']);

    const after = (await (
      await fetch(
        `${base}/api/artifacts/${artifactId}/chains/${seeded.chainId}/instances/${seeded.instanceKey}`,
        { headers },
      )
    ).json()) as { occurrences: { total: number } };
    expect(after.occurrences.total).toBe(1);
  });

  it('rejects a relation without deleting the superseded decision or the endpoints', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const created = await fetch(`${base}/api/cases/${caseId}/relations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        artifactId,
        chainId: seeded.chainId,
        fromKind: 'occurrence',
        fromId: seeded.occurrenceId,
        toKind: 'occurrence',
        toId: seeded.occurrenceId,
        type: 'supports',
        actor: 'comparable',
        time: 'comparable',
        location: 'unknown',
        entity: 'unknown',
        rationale: 'Same occurrence cited twice as a pair of endpoints.',
      }),
    });
    const relation = (await created.json()) as { relationId: string };
    const rejected = await fetch(
      `${base}/api/cases/${caseId}/relations/${relation.relationId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'reject',
          rationale: 'Self-relation is not useful here.',
        }),
      },
    );
    expect(rejected.status).toBe(201);
    const viewed = (await (
      await fetch(
        `${base}/api/cases/${caseId}/relations/${relation.relationId}`,
        { headers },
      )
    ).json()) as {
      standing: string;
      reviews: { action: string; supersedes: string | null }[];
    };
    expect(viewed.standing).toBe('rejected');
    expect(viewed.reviews.map((item) => item.action)).toEqual([
      'accept',
      'reject',
    ]);
    expect(viewed.reviews[1]?.supersedes).toBeTruthy();
  });

  it('refuses a contradiction whose actor is not comparable', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const refused = await fetch(`${base}/api/cases/${caseId}/relations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        artifactId,
        chainId: seeded.chainId,
        fromKind: 'occurrence',
        fromId: seeded.occurrenceId,
        toKind: 'occurrence',
        toId: seeded.occurrenceId,
        type: 'contradicts',
        actor: 'incomparable',
        time: 'comparable',
        location: 'unknown',
        entity: 'unknown',
        rationale: 'Different people.',
      }),
    });
    expect(refused.status).toBe(400);
  });

  it('refuses a relation whose endpoint belongs to another case', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const other = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Other case', caseReference: 'T-REL' }),
    });
    const otherCase = (await other.json()) as EvidenceV2CaseRecord;
    const cross = await fetch(
      `${base}/api/cases/${otherCase.caseId}/relations`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          artifactId,
          chainId: seeded.chainId,
          fromKind: 'occurrence',
          fromId: seeded.occurrenceId,
          toKind: 'occurrence',
          toId: seeded.occurrenceId,
          type: 'adds',
          actor: 'unknown',
          time: 'unknown',
          location: 'unknown',
          entity: 'unknown',
          rationale: 'Should be refused.',
        }),
      },
    );
    expect(cross.status).toBe(404);
  });

  it('hides another case’s relation behind 404, and refuses non-members', async () => {
    const { caseId, artifactId, headers } = await seed();
    const seeded = await seedOccurrence(caseId, artifactId, headers);
    const created = await fetch(`${base}/api/cases/${caseId}/relations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        artifactId,
        chainId: seeded.chainId,
        fromKind: 'occurrence',
        fromId: seeded.occurrenceId,
        toKind: 'occurrence',
        toId: seeded.occurrenceId,
        type: 'qualifies',
        actor: 'unknown',
        time: 'unknown',
        location: 'unknown',
        entity: 'unknown',
        rationale: 'A condition.',
      }),
    });
    const relation = (await created.json()) as { relationId: string };
    const other = await signIn('second@acme.local', 'second-secret');
    for (const path of [
      `/api/cases/${caseId}/relations`,
      `/api/cases/${caseId}/relations/${relation.relationId}`,
    ]) {
      expect((await fetch(`${base}${path}`, { headers: other })).status).toBe(
        404,
      );
      expect((await fetch(`${base}${path}`)).status).toBe(401);
    }
  });

  it('shows Relations in the surface bar and no longer as an unbuilt surface', async () => {
    const { caseId, headers } = await seed();
    const html = await (
      await fetch(`${base}/cases/${caseId}/relations`, { headers })
    ).text();
    expect(html).toContain('<h1>Relations</h1>');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('Not built');

    const overview = (await (
      await fetch(`${base}/api/cases/${caseId}/status`, { headers })
    ).json()) as EvidenceV2CaseOverview;
    expect(Object.keys(overview.unavailable)).not.toContain('relations');
    expect(overview.counts).toHaveProperty('relations');
  });

  it('refuses every route without a session', async () => {
    const { caseId, artifactId } = await seed();
    const paths = [
      '/',
      `/cases/${caseId}`,
      `/artifacts/${artifactId}/parts`,
      `/artifacts/${artifactId}/chains`,
      '/api/cases',
      `/api/cases/${caseId}`,
      `/api/artifacts/${artifactId}/parts`,
      `/api/artifacts/${artifactId}/chains`,
      `/api/artifacts/${artifactId}/chain-decisions`,
      `/cases/${caseId}/status`,
      `/cases/${caseId}/documents`,
      `/cases/${caseId}/timeline`,
      `/api/cases/${caseId}/status`,
    ];
    for (const path of paths) {
      const response = await fetch(`${base}${path}`);
      expect([401, 403]).toContain(response.status);
    }
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  it('shows a non-member 404 on every case-scoped route, never 403', async () => {
    const { caseId, artifactId, headers } = await seed();
    const parts = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts`, { headers })
    ).json()) as EvidenceV2Page<EvidenceV2SourcePart>;
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`, { headers })
    ).json()) as EvidenceV2Page<EvidenceV2ChainSummary>;
    const partId = parts.items[0]?.partId ?? '';
    const chainId = chains.items[0]?.chainId ?? '';

    const stranger = await signIn('second@acme.local', 'second-secret');
    const routes = [
      `/api/cases/${caseId}`,
      `/api/artifacts/${artifactId}/parts`,
      `/api/artifacts/${artifactId}/parts/${partId}`,
      `/api/artifacts/${artifactId}/chains`,
      `/api/artifacts/${artifactId}/chains/${chainId}`,
      `/api/artifacts/${artifactId}/chain-decisions`,
    ];
    for (const route of routes) {
      const response = await fetch(`${base}${route}`, { headers: stranger });
      expect(response.status, route).toBe(404);
    }

    // Writing is refused the same way, and says nothing more.
    const write = await fetch(`${base}/api/cases/${caseId}/artifacts`, {
      method: 'POST',
      headers: stranger,
      body: JSON.stringify({ title: 'x', text: 'y' }),
    });
    expect(write.status).toBe(404);

    // And the stranger's own case list is empty rather than filtered-looking.
    const cases = (await (
      await fetch(`${base}/api/cases`, { headers: stranger })
    ).json()) as EvidenceV2Page<EvidenceV2CaseRecord>;
    expect(cases.total).toBe(0);
  });

  it('refuses a write with a missing or wrong CSRF token', async () => {
    const { caseId, headers } = await seed();
    const noCsrf = {
      cookie: headers['cookie'] ?? '',
      'content-type': 'application/json',
    };
    const wrongCsrf = { ...noCsrf, 'x-acme-csrf': 'not-the-token' };

    for (const attempt of [noCsrf, wrongCsrf]) {
      const response = await fetch(`${base}/api/cases/${caseId}/artifacts`, {
        method: 'POST',
        headers: attempt,
        body: JSON.stringify({ title: 'x', text: 'y' }),
      });
      expect([401, 403]).toContain(response.status);
    }
  });

  it('refuses a cross-origin write', async () => {
    const { caseId, headers } = await seed();
    const response = await fetch(`${base}/api/cases/${caseId}/artifacts`, {
      method: 'POST',
      headers: { ...headers, origin: 'http://evil.example' },
      body: JSON.stringify({ title: 'x', text: 'y' }),
    });
    expect(response.status).toBe(403);
  });

  it('ends the session on sign-out', async () => {
    const { headers } = await seed();
    expect((await fetch(`${base}/api/cases`, { headers })).status).toBe(200);

    const out = await fetch(`${base}/auth/session`, {
      method: 'DELETE',
      headers,
    });
    expect(out.status).toBe(204);
    expect([401, 403]).toContain(
      (await fetch(`${base}/api/cases`, { headers })).status,
    );
  });

  it('answers 404 for an unknown case, artifact, part and chain', async () => {
    const headers = await signIn('first@acme.local', 'first-secret');
    expect((await fetch(`${base}/cases/nope`, { headers })).status).toBe(404);
    expect(
      (await fetch(`${base}/api/artifacts/nope/parts`, { headers })).status,
    ).toBe(404);
    expect(
      (await fetch(`${base}/api/artifacts/nope/parts/part-1`, { headers }))
        .status,
    ).toBe(404);
    expect(
      (await fetch(`${base}/api/artifacts/nope/chains/chain-1`, { headers }))
        .status,
    ).toBe(404);
  });

  function helloPdf(text = 'Hello from the source document'): Buffer {
    const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET\n`;
    const objects = [
      '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
      '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n',
      `4 0 obj<< /Length ${String(stream.length)} >>stream\n${stream}endstream\nendobj\n`,
      '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
    ];
    let body = '%PDF-1.1\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(body, 'latin1'));
      body += object;
    }
    const xrefStart = Buffer.byteLength(body, 'latin1');
    let xref = `xref\n0 6\n0000000000 65535 f \n`;
    for (let index = 1; index <= 5; index += 1) {
      xref += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    body += xref;
    body += `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;
    return Buffer.from(body, 'latin1');
  }

  it('imports a PDF and keeps received bytes distinct from canonical text', async () => {
    const headers = await signIn('first@acme.local', 'first-secret');
    const created = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'PDF case', caseReference: 'PDF-1' }),
    });
    const record = (await created.json()) as EvidenceV2CaseRecord;
    const pdf = helloPdf();
    const imported = await fetch(
      `${base}/api/cases/${record.caseId}/artifacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'A hearing',
          pdfBase64: pdf.toString('base64'),
        }),
      },
    );
    expect(imported.status).toBe(201);
    const body = (await imported.json()) as {
      artifactId: string;
      canonicalSha256: string;
      receivedSha256: string;
      sourceClass: string;
      lineCount: number;
      partCount: number;
    };
    expect(body.sourceClass).toBe('stage-a-pdf-extracted-text/1');
    expect(body.receivedSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(body.canonicalSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(body.receivedSha256).not.toBe(body.canonicalSha256);
    expect(body.partCount).toBeGreaterThan(0);
    expect(body.lineCount).toBeGreaterThan(0);

    const page = await (
      await fetch(`${base}/cases/${record.caseId}`, { headers })
    ).text();
    expect(page).toContain('Import a PDF');
    expect(page).toContain('accept="application/pdf"');
  });

  it('refuses encrypted and empty PDFs and persists nothing', async () => {
    const headers = await signIn('first@acme.local', 'first-secret');
    const created = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Refuse more', caseReference: 'PDF-R' }),
    });
    const record = (await created.json()) as EvidenceV2CaseRecord;
    const encrypted = helloPdf()
      .toString('latin1')
      .replace(
        'trailer<< /Size 6 /Root 1 0 R >>',
        'trailer<< /Size 6 /Root 1 0 R /Encrypt 6 0 R >>',
      );
    const emptyStream = 'BT ET\n';
    const emptyObjects = [
      '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
      '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>endobj\n',
      `4 0 obj<< /Length ${String(emptyStream.length)} >>stream\n${emptyStream}endstream\nendobj\n`,
    ];
    let emptyBody = '%PDF-1.1\n';
    const emptyOffsets = [0];
    for (const object of emptyObjects) {
      emptyOffsets.push(Buffer.byteLength(emptyBody, 'latin1'));
      emptyBody += object;
    }
    const emptyXrefAt = Buffer.byteLength(emptyBody, 'latin1');
    let emptyXref = 'xref\n0 5\n0000000000 65535 f \n';
    for (let index = 1; index <= 4; index += 1) {
      emptyXref += `${String(emptyOffsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    emptyBody += `${emptyXref}trailer<< /Size 5 /Root 1 0 R >>\nstartxref\n${String(emptyXrefAt)}\n%%EOF\n`;

    for (const [label, bytes, code] of [
      [
        'encrypted',
        Buffer.from(encrypted, 'latin1'),
        'EVIDENCE_V2_PDF_ENCRYPTED',
      ],
      ['empty', Buffer.from(emptyBody, 'latin1'), 'EVIDENCE_V2_PDF_EMPTY_TEXT'],
    ] as const) {
      const refused = await fetch(
        `${base}/api/cases/${record.caseId}/artifacts`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: label,
            pdfBase64: bytes.toString('base64'),
          }),
        },
      );
      expect(refused.status, label).toBe(400);
      expect(await refused.text(), label).toBe(code);
    }
    const listed = (await (
      await fetch(`${base}/api/cases/${record.caseId}`, { headers })
    ).json()) as { artifacts: { total: number } };
    expect(listed.artifacts.total).toBe(0);
  });

  it('refuses a bad PDF and persists nothing', async () => {
    const headers = await signIn('first@acme.local', 'first-secret');
    const created = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Refuse case', caseReference: 'PDF-0' }),
    });
    const record = (await created.json()) as EvidenceV2CaseRecord;
    const refused = await fetch(
      `${base}/api/cases/${record.caseId}/artifacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'Nope',
          pdfBase64: Buffer.from('not a pdf').toString('base64'),
        }),
      },
    );
    expect(refused.status).toBe(400);
    expect(await refused.text()).toBe('EVIDENCE_V2_PDF_NOT_PDF');
    const listed = (await (
      await fetch(`${base}/api/cases/${record.caseId}`, { headers })
    ).json()) as { artifacts: { total: number } };
    expect(listed.artifacts.total).toBe(0);
  });

  it('hides PDF import from a non-member and refuses a write without CSRF', async () => {
    const headers = await signIn('first@acme.local', 'first-secret');
    const created = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Auth case', caseReference: 'PDF-A' }),
    });
    const record = (await created.json()) as EvidenceV2CaseRecord;
    const other = await signIn('second@acme.local', 'second-secret');
    expect(
      (
        await fetch(`${base}/api/cases/${record.caseId}/artifacts`, {
          method: 'POST',
          headers: other,
          body: JSON.stringify({
            title: 'x',
            pdfBase64: helloPdf().toString('base64'),
          }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await fetch(`${base}/api/cases/${record.caseId}/artifacts`, {
          method: 'POST',
          headers: {
            cookie: headers['cookie'] ?? '',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title: 'x',
            pdfBase64: helloPdf().toString('base64'),
          }),
        })
      ).status,
    ).toBe(401);
  });
});
