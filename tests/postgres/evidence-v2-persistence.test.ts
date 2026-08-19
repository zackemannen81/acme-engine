import { randomBytes } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildEvidenceV2Migrations,
  createEvidenceV2PostgresRepository,
} from '../../packages/adapter-evidence-v2-postgres/src/index.js';
import { createDeterministicEvidenceAuthenticator } from '../../packages/adapter-evidence-auth-memory/src/index.js';
import {
  createEvidenceIdentityMigrations,
  createPostgresEvidenceIdentityRepository,
} from '../../packages/adapter-evidence-auth-postgres/src/index.js';
import { migratePostgresSchema } from '../../packages/adapter-postgres/src/index.js';
import { createAes256GcmPayloadEncryptor } from '../../packages/core/src/index.js';
import { createEvidenceV2Auth } from '../../apps/evidence-workbench-v2-api/src/auth.js';
import {
  EVIDENCE_V2_ARTIFACT_RECORD_VERSION,
  EVIDENCE_V2_CASE_RECORD_VERSION,
  type EvidenceV2ArtifactRecord,
  type EvidenceV2Repository,
} from '../../packages/evidence-v2-contracts/src/index.js';
import {
  deriveEvidenceV2ClaimMemberships,
  deriveEvidenceV2SourceStructure,
  deriveEvidenceV2Standings,
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

  it('stores occurrences idempotently and window state per window', async () => {
    const parts = await repository.listParts(artifact.artifactId, {
      offset: 0,
      limit: 1,
    });
    const first = parts.items[0];
    if (first === undefined) throw new Error('expected a part');
    const stored = await repository.readPart(artifact.artifactId, first.partId);
    const unit = stored?.units[0];
    if (unit === undefined) throw new Error('expected a unit');

    const occurrence = {
      schemaVersion: 'evidence-v2-occurrence/1' as const,
      occurrenceId: 'occurrence-postgres-1',
      artifactId: artifact.artifactId,
      partId: first.partId,
      unitId: unit.unitId,
      startLine: unit.startLine,
      endLine: unit.endLine,
      exactQuote: unit.exactQuote,
      kind: 'statement-occurrence' as const,
      actorReference: null,
      temporalBound: null,
      executionId: 'execution-postgres-1',
      contractVersion: '1.0.0',
      windowId: `${first.partId}-window-0001`,
    };

    await repository.putOccurrences(artifact.artifactId, 'instance-1', [
      occurrence,
    ]);
    // Content-identified and immutable: storing it again is the same record.
    await repository.putOccurrences(artifact.artifactId, 'instance-1', [
      occurrence,
    ]);

    const listed = await repository.listOccurrences(
      artifact.artifactId,
      'instance-1',
      { offset: 0, limit: 10 },
    );
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.exactQuote).toBe(unit.exactQuote);

    await repository.putExtractionWindow({
      artifactId: artifact.artifactId,
      instanceKey: 'instance-1',
      windowId: `${first.partId}-window-0001`,
      partId: first.partId,
      status: 'committed',
      unitCount: stored?.units.length ?? 0,
      occurrenceCount: 1,
      executionId: 'execution-postgres-1',
      failureCode: null,
      decidedAt: '2026-08-16T00:00:00.000Z',
    });
    await repository.putExtractionWindow({
      artifactId: artifact.artifactId,
      instanceKey: 'instance-1',
      windowId: `${first.partId}-window-0002`,
      partId: first.partId,
      status: 'failed',
      unitCount: 3,
      occurrenceCount: 0,
      executionId: null,
      failureCode: 'MODEL_INVALID_RESPONSE',
      decidedAt: '2026-08-16T00:00:00.000Z',
    });

    const windows = await repository.readExtractionWindows(
      artifact.artifactId,
      'instance-1',
    );
    expect(windows.map((window) => window.status).sort()).toEqual([
      'committed',
      'failed',
    ]);
    expect(
      windows.find((window) => window.status === 'failed')?.failureCode,
    ).toBe('MODEL_INVALID_RESPONSE');
    // The committed window's occurrence is untouched by the failed one.
    expect(
      (
        await repository.listOccurrences(artifact.artifactId, 'instance-1', {
          offset: 0,
          limit: 10,
        })
      ).total,
    ).toBe(1);
  });

  it('appends review decisions and never updates one', async () => {
    const listed = await repository.listOccurrences(
      artifact.artifactId,
      'instance-1',
      { offset: 0, limit: 10 },
    );
    const occurrenceId = listed.items[0]?.occurrenceId;
    if (occurrenceId === undefined) throw new Error('expected an occurrence');

    const accept = {
      schemaVersion: 'evidence-v2-review/1' as const,
      decisionId: 'review-postgres-accept',
      artifactId: artifact.artifactId,
      instanceKey: 'instance-1',
      occurrenceId,
      action: 'accept' as const,
      supersedes: null,
      principal: 'principal-postgres',
      decidedAt: '2026-08-18T10:00:00.000Z',
      rationale: 'Verified against the source lines.',
    };
    await repository.appendReviewDecision(accept);
    // Content-derived identity: an identical retry is the same decision.
    await repository.appendReviewDecision(accept);
    expect(
      (
        await repository.readOccurrenceReviewHistory(
          artifact.artifactId,
          occurrenceId,
        )
      ).length,
    ).toBe(1);

    await repository.appendReviewDecision({
      ...accept,
      decisionId: 'review-postgres-reject',
      action: 'reject',
      supersedes: accept.decisionId,
      decidedAt: '2026-08-18T11:00:00.000Z',
      rationale: 'On a second read this quotes the index.',
    });

    const history = await repository.readOccurrenceReviewHistory(
      artifact.artifactId,
      occurrenceId,
    );
    expect(history.map((item) => item.action)).toEqual(['accept', 'reject']);
    // The superseded decision is stored exactly as it was written.
    expect(history[0]).toEqual(accept);

    const standings = deriveEvidenceV2Standings([occurrenceId], history);
    expect(standings[0]?.standing).toBe('rejected');
    expect(standings[0]?.decisionCount).toBe(2);

    // Scoped: another instance's log does not see these.
    expect(
      (await repository.listReviewDecisions(artifact.artifactId, 'instance-2'))
        .length,
    ).toBe(0);

    const extracted = await repository.readExtractedInstanceKeys(
      artifact.artifactId,
    );
    expect(extracted).toContain('instance-1');
  });

  it('groups occurrences into a claim append-only, across instances', async () => {
    const listed = await repository.listOccurrences(
      artifact.artifactId,
      'instance-1',
      { offset: 0, limit: 10 },
    );
    const first = listed.items[0];
    if (first === undefined) throw new Error('expected an occurrence');

    // A second occurrence in a different instance, so the claim can span both.
    const second = {
      ...first,
      occurrenceId: 'occurrence-postgres-2',
      exactQuote: first.exactQuote,
    };
    await repository.putOccurrences(artifact.artifactId, 'instance-2', [
      second,
    ]);

    const claim = {
      schemaVersion: 'evidence-v2-claim/1' as const,
      claimId: 'claim-postgres-1',
      caseId: 'case-v2-test',
      label: 'The blue car',
      statement: 'Statements about the colour of the car.',
      createdBy: 'principal-postgres',
      createdAt: '2026-08-18T12:00:00.000Z',
    };
    await repository.createClaim(claim);
    await repository.createClaim(claim);
    expect(
      (
        await repository.listClaims('case-v2-test', {
          offset: 0,
          limit: 10,
        })
      ).total,
    ).toBe(1);

    const include = (
      occurrenceId: string,
      instanceKey: string,
      id: string,
    ) => ({
      schemaVersion: 'evidence-v2-claim-grouping/1' as const,
      decisionId: id,
      caseId: 'case-v2-test',
      claimId: claim.claimId,
      artifactId: artifact.artifactId,
      instanceKey,
      occurrenceId,
      action: 'include' as const,
      supersedes: null,
      principal: 'principal-postgres',
      decidedAt: '2026-08-18T12:00:00.000Z',
      rationale: 'Concerns the same proposition.',
    });
    await repository.appendClaimGrouping(
      include(first.occurrenceId, 'instance-1', 'grouping-1'),
    );
    await repository.appendClaimGrouping(
      include('occurrence-postgres-2', 'instance-2', 'grouping-2'),
    );

    const memberships = deriveEvidenceV2ClaimMemberships(
      claim.claimId,
      await repository.listClaimGroupings(claim.claimId),
    );
    expect(memberships).toHaveLength(2);
    // Identical quotes from two instances stay two contributors.
    const occurrences = await repository.readOccurrencesById(
      memberships.map((item) => item.occurrenceId),
    );
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]?.exactQuote).toBe(occurrences[1]?.exactQuote);

    // Excluding one is a further row; the first is still stored unchanged.
    await repository.appendClaimGrouping({
      ...include('occurrence-postgres-2', 'instance-2', 'grouping-3'),
      action: 'exclude',
      supersedes: 'grouping-2',
      decidedAt: '2026-08-18T13:00:00.000Z',
      rationale: 'On reflection it is a different proposition.',
    });
    const log = await repository.listClaimGroupings(claim.claimId);
    expect(log.map((item) => item.action)).toEqual([
      'include',
      'include',
      'exclude',
    ]);
    expect(log[1]).toEqual(
      include('occurrence-postgres-2', 'instance-2', 'grouping-2'),
    );
    expect(
      deriveEvidenceV2ClaimMemberships(claim.claimId, log).map(
        (item) => item.occurrenceId,
      ),
    ).toEqual([first.occurrenceId]);

    // The excluded occurrence is untouched.
    expect(
      (await repository.readOccurrencesById(['occurrence-postgres-2'])).length,
    ).toBe(1);
  });

  it('stores a relation append-only and never deletes its endpoints', async () => {
    const [first] = await repository.readOccurrencesById(
      (
        await repository.listOccurrences(artifact.artifactId, 'instance-1', {
          offset: 0,
          limit: 1,
        })
      ).items.map((item) => item.occurrenceId),
    );
    if (first === undefined) throw new Error('expected an occurrence');

    const relation = {
      schemaVersion: 'evidence-v2-relation/1' as const,
      relationId: 'relation-postgres-1',
      caseId: 'case-v2-test',
      artifactId: artifact.artifactId,
      chainId: 'chain-1',
      from: { kind: 'occurrence' as const, id: first.occurrenceId },
      to: { kind: 'occurrence' as const, id: 'occurrence-postgres-2' },
      type: 'contradicts' as const,
      comparableScope: {
        actor: 'comparable' as const,
        time: 'comparable' as const,
        location: 'unknown' as const,
        entity: 'comparable' as const,
      },
      rationale: 'Blue versus the later colour.',
      provenance: 'reviewer-authored' as const,
      createdBy: 'principal-postgres',
      createdAt: '2026-08-18T14:00:00.000Z',
      executionId: null,
      contractVersion: null,
      windowId: null,
    };
    await repository.createRelation(relation);
    await repository.createRelation(relation);
    expect(
      (
        await repository.listRelations('case-v2-test', {
          offset: 0,
          limit: 10,
        })
      ).total,
    ).toBe(1);

    await repository.appendRelationReview({
      schemaVersion: 'evidence-v2-relation-review/1',
      decisionId: 'relation-review-1',
      caseId: 'case-v2-test',
      relationId: relation.relationId,
      action: 'accept',
      supersedes: null,
      principal: 'principal-postgres',
      decidedAt: '2026-08-18T14:00:00.000Z',
      rationale: 'Authorship is acceptance.',
    });
    await repository.appendRelationReview({
      schemaVersion: 'evidence-v2-relation-review/1',
      decisionId: 'relation-review-2',
      caseId: 'case-v2-test',
      relationId: relation.relationId,
      action: 'reject',
      supersedes: 'relation-review-1',
      principal: 'principal-postgres',
      decidedAt: '2026-08-18T15:00:00.000Z',
      rationale: 'On reflection the scopes are not the same evening.',
    });
    const log = await repository.listRelationReviews(relation.relationId);
    expect(log.map((item) => item.action)).toEqual(['accept', 'reject']);
    expect(log[0]?.decisionId).toBe('relation-review-1');

    const bindings = await repository.readOccurrenceBindings([
      first.occurrenceId,
      'occurrence-postgres-2',
    ]);
    expect(bindings).toHaveLength(2);
    expect(
      (await repository.readOccurrencesById([first.occurrenceId])).length,
    ).toBe(1);
  });

  it('projects a case overview from stored rows, not from import totals', async () => {
    const overview = await repository.readCaseOverview('case-v2-test');

    // Counts must agree with what the list routes page through, because a
    // status surface that disagrees with a list is R-07 rebuilt.
    const parts = await repository.listParts(artifact.artifactId, {
      offset: 0,
      limit: 1,
    });
    const chains = await repository.listChains(artifact.artifactId, {
      offset: 0,
      limit: 1,
    });
    expect(overview.caseId).toBe('case-v2-test');
    expect(overview.counts.artifacts).toBe(1);
    expect(overview.counts.parts).toBe(parts.total);
    expect(overview.counts.chains).toBe(chains.total);
    expect(overview.counts.parts).toBeGreaterThan(0);
    expect(overview.counts.citableUnits).toBeGreaterThan(0);

    // The previous test committed one window and failed another against
    // instance-1, and stored one occurrence.
    expect(overview.counts.occurrences).toBe(2);
    expect(overview.counts.committedWindows).toBe(1);
    expect(overview.counts.failedWindows).toBe(1);

    // The committed window above was stored against the synthetic key
    // `instance-1`, which is not one of this artifact's chain instances. Every
    // real instance is therefore still outstanding — outstanding work is
    // counted against instances that exist, not against whatever key a window
    // happens to carry.
    expect(overview.instancesWithoutExtraction).toBe(overview.counts.instances);
    expect(overview.resumeAt).not.toBeNull();
    expect(overview.resumeAt?.instanceKey).not.toBe('instance-1');
    expect(overview.resumeAt?.subjectLabel.length).toBeGreaterThan(0);
    expect(overview.resumeAt?.artifactId).toBe(artifact.artifactId);

    // Claims are counted from the same aggregate read.
    expect(overview.counts.claims).toBe(1);
    expect(overview.counts.claimGroupingDecisions).toBe(3);
    expect(overview.counts.groupedOccurrences).toBe(1);
    expect(overview.counts.crossInstanceClaims).toBe(0);
    expect(overview.counts.relations).toBe(1);
    expect(overview.counts.relationReviewDecisions).toBe(2);
    expect(overview.counts.rejectedRelations).toBe(1);
    expect(overview.counts.reviewerAuthoredRelations).toBe(1);

    // Standing is folded from the log by the same aggregate read.
    expect(overview.counts.reviewDecisions).toBe(2);
    expect(overview.counts.rejected).toBe(1);
    expect(overview.counts.accepted).toBe(0);
    // The claim test's second occurrence has no decision, so it is pending.
    // Grouping an occurrence into a claim gives it no standing: the two are
    // separate acts over the same immutable record.
    expect(overview.counts.pending).toBe(1);
    expect(overview.counts.reviewerAuthored).toBe(0);

    // ACME-0162 retired the last ADR-0049 gaps. Consensus counts stay 0
    // here because the overview SQL does not fold J6; the app recomputes
    // them on the status route from the same snapshot this port returns.
    expect(overview.unavailable).toEqual({});
    expect(overview.unavailable).not.toHaveProperty('timeline');
    expect(overview.unavailable).not.toHaveProperty('consensus');
    expect(overview.counts).toHaveProperty('consensusSupported');
    expect(overview.counts.consensusSupported).toBe(0);

    const snapshot = await repository.readCaseProjectionInputs('case-v2-test');
    expect(snapshot.occurrences).toHaveLength(2);
    expect(snapshot.reviews).toHaveLength(2);
    expect(snapshot.claims).toHaveLength(1);
    expect(snapshot.groupings).toHaveLength(3);
    expect(snapshot.relations).toHaveLength(1);
    expect(snapshot.relationReviews).toHaveLength(2);

    // An unrelated case sees nothing of this one.
    const empty = await repository.readCaseOverview('case-that-does-not-exist');
    expect(empty.counts.artifacts).toBe(0);
    expect(empty.counts.parts).toBe(0);
    expect(empty.resumeAt).toBeNull();
  });

  it('keeps sessions and case membership across a new composition', async () => {
    const identitySchema = `${schema}_identity`;
    await migratePostgresSchema({
      pool,
      schema: identitySchema,
      appliedAt: '2026-08-16T00:00:00.000Z',
      migrations: createEvidenceIdentityMigrations(identitySchema),
    });

    const build = () =>
      createEvidenceV2Auth({
        identity: createPostgresEvidenceIdentityRepository({
          pool,
          schema: identitySchema,
        }),
        authenticator: createDeterministicEvidenceAuthenticator({
          issuer: 'https://local.acme.invalid/',
          accounts: [
            {
              email: 'durable@acme.local',
              password: 'durable-secret',
              subject: 'durable',
              displayLabel: 'Durable reviewer',
            },
          ],
          expiresAt: () => new Date(Date.now() + 3_600_000).toISOString(),
        }),
        protector: createAes256GcmPayloadEncryptor({
          key: Buffer.alloc(32, 9),
          keyId: 'durable-session',
        }),
        issuer: 'https://local.acme.invalid/',
        organizationId: 'durable-org',
        organizationLabel: 'Durable organization',
        accounts: [
          {
            email: 'durable@acme.local',
            subject: 'durable',
            displayLabel: 'Durable reviewer',
            organizationRole: 'organization-admin',
          },
        ],
        now: () => new Date().toISOString(),
        nextToken: (kind) => `${kind}-${randomBytes(8).toString('hex')}`,
      });

    const first = build();
    await first.bootstrap();
    const session = await first.login({
      email: 'durable@acme.local',
      password: 'durable-secret',
    });
    await first.registerCase({
      caseId: 'durable-case',
      title: 'Durable case',
      caseReference: 'D-1',
      principalRef: session.principal.principalRef,
    });

    // A second composition reads the same rows: nothing was held in memory.
    const second = build();
    const visible = await second.visibleCaseIds(session.principal.principalRef);
    expect([...visible]).toContain('durable-case');
    const context = await second.requireCase({
      principalRef: session.principal.principalRef,
      caseId: 'durable-case',
      action: 'workspace.read',
    });
    expect(context.effectiveCaseRole).toBe('case-admin');

    await pool.query(`DROP SCHEMA IF EXISTS "${identitySchema}" CASCADE`);
  }, 60_000);
});
