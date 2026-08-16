import { randomBytes } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildEvidenceV2Migrations,
  createEvidenceV2PostgresRepository,
} from '../../packages/adapter-evidence-v2-postgres/src/index.js';
import { migratePostgresSchema } from '../../packages/adapter-postgres/src/index.js';
import {
  EVIDENCE_V2_ARTIFACT_RECORD_VERSION,
  EVIDENCE_V2_CASE_RECORD_VERSION,
  type EvidenceV2ArtifactRecord,
  type EvidenceV2Repository,
} from '../../packages/evidence-v2-contracts/src/index.js';
import {
  deriveEvidenceV2SourceStructure,
  proposeEvidenceV2Chains,
} from '../../packages/module-evidence-v2/src/index.js';

import { requirePostgresUrl } from './harness.js';

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

const TEXT = [
  header('Ammouri, HUSSEIN; 2007-04-25 14:10'),
  block('Ammouri, Allia', '2004-11-09', '11:27'),
  'Allia berättar om kvällen.',
  header('Ammouri, Allia; 2004-11-09 11:27'),
  block('Ammouri, Hussein', '2004-10-22', '07:55'),
  'Hussein berättar om resan.',
].join('\n');

describe('evidence v2 postgres persistence', () => {
  const schema = `evidence_v2_test_${randomBytes(6).toString('hex')}`;
  let pool: Pool;
  let repository: EvidenceV2Repository;
  let artifact: EvidenceV2ArtifactRecord;

  beforeAll(async () => {
    pool = new Pool({ connectionString: requirePostgresUrl() });
    await migratePostgresSchema({
      pool,
      schema,
      appliedAt: '2026-08-16T00:00:00.000Z',
      migrations: buildEvidenceV2Migrations(schema),
    });
    repository = createEvidenceV2PostgresRepository({ pool, schema });

    await repository.createCase({
      schemaVersion: EVIDENCE_V2_CASE_RECORD_VERSION,
      caseId: 'case-v2-test',
      title: 'V2 persistence',
      caseReference: 'V2-TEST',
      createdAt: '2026-08-16T00:00:00.000Z',
    });

    const structure = deriveEvidenceV2SourceStructure(TEXT);
    const proposal = proposeEvidenceV2Chains(structure, TEXT);
    artifact = {
      schemaVersion: EVIDENCE_V2_ARTIFACT_RECORD_VERSION,
      artifactId: 'artifact-v2-test',
      caseId: 'case-v2-test',
      title: 'source',
      canonicalSha256: 'b'.repeat(64),
      canonicalByteLength: Buffer.byteLength(TEXT, 'utf8'),
      lineCount: structure.lineCount,
      partCount: structure.parts.length,
      chainCount: proposal.chains.length,
      objectKey: 'v2/case-v2-test/artifact-v2-test/canonical-text',
      representation: {} as EvidenceV2ArtifactRecord['representation'],
      envelope: {} as EvidenceV2ArtifactRecord['envelope'],
      importedAt: '2026-08-16T00:00:00.000Z',
      structureRuleVersion: structure.ruleVersion,
      chainRuleVersion: proposal.ruleVersion,
      provenance: {
        parentKind: 'pdf',
        parentSha256: 'c'.repeat(64),
        parentByteLength: 1,
        pageCount: 1,
        extractionMethod: 'test',
        extractedAt: '2026-08-16T00:00:00.000Z',
      },
    };
    await repository.writeImport({ artifact, structure, proposal });
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  });

  it('stores parts, units and chains in one import', async () => {
    const parts = await repository.listParts(artifact.artifactId, {
      offset: 0,
      limit: 100,
    });
    const chains = await repository.listChains(artifact.artifactId, {
      offset: 0,
      limit: 100,
    });

    expect(parts.total).toBe(artifact.partCount);
    expect(chains.total).toBe(artifact.chainCount);
    expect(chains.items.map((item) => item.subjectLabel).sort()).toEqual([
      'Ammouri, Allia',
      'Ammouri, Hussein',
    ]);
  });

  it('reads a part back with its citable units', async () => {
    const parts = await repository.listParts(artifact.artifactId, {
      offset: 0,
      limit: 1,
    });
    const first = parts.items[0];
    if (first === undefined) throw new Error('expected a part');
    const part = await repository.readPart(artifact.artifactId, first.partId);

    expect(part?.units.length).toBeGreaterThan(0);
    for (const unit of part?.units ?? []) {
      expect(TEXT).toContain(unit.exactQuote);
    }
  });

  it('bounds a list request at the contract maximum', async () => {
    const parts = await repository.listParts(artifact.artifactId, {
      offset: 0,
      limit: 1,
    });
    expect(parts.items).toHaveLength(1);
    expect(parts.total).toBeGreaterThan(1);
  });

  it('appends a decision and leaves the stored proposal byte-identical', async () => {
    const proposedBefore = JSON.stringify(
      await repository.readProposedMemberships(artifact.artifactId),
    );
    const chains = await repository.listChains(artifact.artifactId, {
      offset: 0,
      limit: 10,
    });
    const from = chains.items[0];
    const to = chains.items[1];
    if (from === undefined || to === undefined)
      throw new Error('expected two chains');
    const detail = await repository.readChain(
      artifact.artifactId,
      from.chainId,
    );
    const movedPart = detail?.chain.instances[0]?.sourcePartIds[0];
    if (movedPart === undefined) throw new Error('expected a part');

    await repository.appendChainDecision(artifact.artifactId, {
      decisionId: 'decision-postgres-1',
      action: 'assign',
      sourcePartId: movedPart,
      chainId: to.chainId,
      supersedes: null,
      principal: 'test',
      decidedAt: '2026-08-16T00:00:00.000Z',
      rationale: 'Moved by test.',
    });

    const effective = await repository.readEffectiveMemberships(
      artifact.artifactId,
    );
    expect(
      effective.find((item) => item.sourcePartId === movedPart)?.chainId,
    ).toBe(to.chainId);
    expect(
      JSON.stringify(
        await repository.readProposedMemberships(artifact.artifactId),
      ),
    ).toBe(proposedBefore);
    expect(
      await repository.listChainDecisions(artifact.artifactId),
    ).toHaveLength(1);
  });
});
