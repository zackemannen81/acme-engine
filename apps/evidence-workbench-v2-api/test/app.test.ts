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
  type EvidenceV2Occurrence,
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
  const windows = new Map<string, EvidenceV2ExtractionWindowState[]>();
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
        },
        instancesWithoutExtraction: outstanding.length,
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
    for (const surface of ['timeline', 'relations'] as const) {
      const page = await fetch(`${base}/cases/${caseId}/${surface}`, {
        headers,
      });
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain('Not built');
      expect(html).toContain(EVIDENCE_V2_SURFACE_GAPS[surface].deliveredBy);
      // The defect this exists to prevent: an absent surface answering with an
      // empty result as though the case had none (R-07).
      expect(html).not.toContain('<tbody></tbody>');

      const json = (await (
        await fetch(`${base}/api/cases/${caseId}/${surface}`, { headers })
      ).json()) as { state: string; deliveredBy: string };
      expect(json.state).toBe('not-implemented');
      expect(json.deliveredBy).toBe(
        EVIDENCE_V2_SURFACE_GAPS[surface].deliveredBy,
      );
    }
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

    // Unbuilt surfaces report a condition, never zero.
    expect(Object.keys(overview.unavailable)).toContain('claims');
    expect(overview.unavailable['claims']?.state).toBe('not-implemented');
    expect(overview.counts).not.toHaveProperty('claims');

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
});
