import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clampEvidenceV2Page,
  EVIDENCE_V2_MAX_PAGE_SIZE,
  type EvidenceV2ArtifactRecord,
  type EvidenceV2CaseRecord,
  type EvidenceV2ChainDecision,
  type EvidenceV2ChainMembership,
  type EvidenceV2ChainSummary,
  type EvidenceV2ImportWrite,
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

import { createEvidenceV2App } from '../src/app.js';
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
    const handler = createEvidenceV2App({
      repository,
      textStore: memoryTextStore(),
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

  async function seed(): Promise<{ caseId: string; artifactId: string }> {
    const created = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Test case', caseReference: 'T-1' }),
    });
    const record = (await created.json()) as EvidenceV2CaseRecord;
    const imported = await fetch(
      `${base}/api/cases/${record.caseId}/artifacts`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'source-A', text: CORPUS }),
      },
    );
    const artifact = (await imported.json()) as { artifactId: string };
    return { caseId: record.caseId, artifactId: artifact.artifactId };
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
    const { artifactId } = await seed();
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`)
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
      )
    ).json()) as { chain: EvidenceV2Chain };
    const firstPart = detail.chain.instances[0]?.sourcePartIds[0] ?? '';
    const part = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts/${firstPart}`)
    ).json()) as { part: EvidenceV2SourcePart };

    // The part's own label names Hussein; the chain it belongs to is Allia's.
    expect(part.part.title?.text).toContain('Ammouri, HUSSEIN');
  });

  it('bounds every list route', async () => {
    const { artifactId } = await seed();
    const response = await fetch(
      `${base}/api/artifacts/${artifactId}/parts?limit=100000`,
    );
    const parts =
      (await response.json()) as EvidenceV2Page<EvidenceV2SourcePart>;

    expect(parts.limit).toBeLessThanOrEqual(EVIDENCE_V2_MAX_PAGE_SIZE);
    expect(clampEvidenceV2Page(0, 100000).limit).toBe(
      EVIDENCE_V2_MAX_PAGE_SIZE,
    );
  });

  it('serves a part with its exact source lines', async () => {
    const { artifactId } = await seed();
    const parts = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts`)
    ).json()) as EvidenceV2Page<EvidenceV2SourcePart>;
    const first = parts.items[0];
    if (first === undefined) throw new Error('expected a part');

    const view = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/parts/${first.partId}`)
    ).json()) as { lines: string[] };

    expect(view.lines.length).toBe(first.endLine - first.startLine + 1);
    expect(
      CORPUS.split('\n').slice(first.startLine - 1, first.endLine),
    ).toEqual(view.lines);
  });

  it('appends a membership decision without disturbing the proposal', async () => {
    const { artifactId } = await seed();
    const before = await repository.readProposedMemberships(artifactId);
    const frozen = JSON.stringify(before);
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`)
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
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(decision),
      },
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
    const { artifactId } = await seed();
    const chains = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains`)
    ).json()) as EvidenceV2Page<EvidenceV2ChainSummary>;
    const from = chains.items[0];
    const to = chains.items[1];
    if (from === undefined || to === undefined)
      throw new Error('expected two chains');
    const before = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains/${from.chainId}`)
    ).json()) as { chain: EvidenceV2Chain };
    const movedPart = before.chain.instances[0]?.sourcePartIds[0];
    if (movedPart === undefined) throw new Error('expected a part');

    await fetch(`${base}/api/artifacts/${artifactId}/chain-decisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      await fetch(`${base}/api/artifacts/${artifactId}/chains/${from.chainId}`)
    ).json()) as { chain: EvidenceV2Chain };
    const stillThere = after.chain.instances.flatMap(
      (instance) => instance.sourcePartIds,
    );
    expect(stillThere).not.toContain(movedPart);

    const target = (await (
      await fetch(`${base}/api/artifacts/${artifactId}/chains/${to.chainId}`)
    ).json()) as { memberships: EvidenceV2ChainMembership[] };
    expect(
      target.memberships.some((item) => item.sourcePartId === movedPart),
    ).toBe(true);
  });

  it('renders navigable HTML for every surface', async () => {
    const { caseId, artifactId } = await seed();

    const cases = await (await fetch(`${base}/`)).text();
    expect(cases).toContain('<h1>Cases</h1>');
    expect(cases).toContain(`/cases/${caseId}`);

    const casePage = await (await fetch(`${base}/cases/${caseId}`)).text();
    expect(casePage).toContain(`/artifacts/${artifactId}/parts`);
    expect(casePage).toContain(`/artifacts/${artifactId}/chains`);

    const partsPage = await (
      await fetch(`${base}/artifacts/${artifactId}/parts`)
    ).text();
    expect(partsPage).toContain('Source parts');

    const chainsPage = await (
      await fetch(`${base}/artifacts/${artifactId}/chains`)
    ).text();
    expect(chainsPage).toContain('Ammouri, Hussein');
  });

  it('answers 404 for an unknown case, artifact, part and chain', async () => {
    expect((await fetch(`${base}/cases/nope`)).status).toBe(404);
    expect((await fetch(`${base}/api/artifacts/nope/parts`)).status).toBe(404);
    expect(
      (await fetch(`${base}/api/artifacts/nope/parts/part-1`)).status,
    ).toBe(404);
    expect(
      (await fetch(`${base}/api/artifacts/nope/chains/chain-1`)).status,
    ).toBe(404);
  });
});
