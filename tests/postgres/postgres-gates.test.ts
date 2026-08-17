import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
  createPostgresExecutionRepository,
  dropPostgresSchema,
  migratePostgresSchema,
  migrationChecksum,
  createMigrations,
} from '../../packages/adapter-postgres/src/index.js';
import {
  dropEvidenceProductSchema,
  migrateEvidenceProductSchema,
} from '../../packages/adapter-evidence-product-postgres/src/index.js';
import {
  canonicalJson,
  computeOperationDigest,
  sha256,
} from '../../packages/core/src/index.js';
import {
  createSharedPool,
  randomSchema,
  requirePostgresUrl,
} from './harness.js';

const pool = createSharedPool();
const schemas: string[] = [];
const evidenceSchemas: string[] = [];
const appliedAt = '2026-08-12T00:00:00.000Z';
const timestamp = '2026-08-12T12:00:00.000Z';

afterAll(async () => {
  for (const schema of schemas) {
    try {
      await dropPostgresSchema(pool, schema);
    } catch {
      // ignore
    }
  }
  for (const schema of evidenceSchemas) {
    try {
      await dropEvidenceProductSchema(pool, schema);
    } catch {
      // ignore
    }
  }
  await pool.end();
});

function countingIds() {
  const counts = new Map<string, number>();
  return {
    next(kind: string) {
      const count = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, count);
      return `${kind}-${count}`;
    },
  };
}

function prepared(executionId: string, eventKey: string) {
  const content = {
    executionId,
    expectedRevision: 0,
    documents: [] as const,
    memoryCandidates: [] as const,
    memory: { decisions: [] as const, mutations: [] as const },
    state: null,
    evaluatorRuns: [] as const,
    events: [
      {
        key: eventKey,
        type: 'gate.observed',
        schemaVersion: '1.0.0',
        payload: { executionId },
      },
    ],
    committedAt: timestamp,
  };
  return {
    ...content,
    operationDigest: computeOperationDigest(content),
  };
}

async function acceptAndCommit(
  repository: ReturnType<typeof createPostgresExecutionRepository>,
  executionId: string,
  eventKey: string,
) {
  await repository.accept({
    executionId,
    request: {
      requestKey: executionId,
      namespace: 'gates',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 0,
      input: { executionId },
      model: { profile: 'fixture' },
    },
    requestFingerprint: `fp-${executionId}`,
    inputHash: `input-${executionId}`,
    contract: { id: 'gate.observe', version: '1.0.0' },
    contractFingerprint: 'contract-fp',
    effectivePolicy: {
      timeoutMs: 1000,
      maxModelCalls: 1,
      maxRepairCalls: 0,
      maxRevisionCalls: 0,
      retention: 'hash-only',
    },
    createdAt: timestamp,
  });
  return repository.commit(prepared(executionId, eventKey));
}

describe('ADR-0033 postgres gates', () => {
  it('keeps provider, model and usage queryable without retaining output', async () => {
    // ADR-0044 governs cost by measurement. `hash-only` retains no response,
    // so these columns are the only place a query can read what a call cost.
    const schema = randomSchema('acme_usage');
    schemas.push(schema);
    await migratePostgresSchema({ pool, schema, appliedAt });
    const repository = createPostgresExecutionRepository({
      pool,
      schema,
      ids: countingIds(),
    });
    // Accepted but not committed: a terminal execution cannot be mutated.
    await repository.accept({
      executionId: 'exec-usage',
      request: {
        requestKey: 'exec-usage',
        namespace: 'gates',
        task: 'observe',
        entityId: 'entity-1',
        expectedRevision: 0,
        input: { executionId: 'exec-usage' },
        model: { profile: 'fixture' },
      },
      requestFingerprint: 'fp-exec-usage',
      inputHash: 'input-exec-usage',
      contract: { id: 'gate.observe', version: '1.0.0' },
      contractFingerprint: 'contract-fp',
      effectivePolicy: {
        timeoutMs: 1000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        retention: 'hash-only',
      },
      createdAt: timestamp,
    });
    await repository.reserveModelCall({
      modelCallId: 'call-usage',
      executionId: 'exec-usage',
      callKey: 'model:0',
      attempt: 1,
      purpose: 'primary',
      selection: { profile: 'fixture' },
      requestHash: 'request-hash',
      startedAt: timestamp,
    });
    await repository.completeModelCall({
      modelCallId: 'call-usage',
      response: {
        provider: 'openai',
        model: 'gpt-5.6-luna',
        receivedAt: timestamp,
        finishReason: 'stop',
        text: '{"secret":"must-not-rest"}',
        usage: { inputTokens: 66_819, outputTokens: 650 },
        metadata: {},
      },
      responseHash: 'response-hash',
      completedAt: timestamp,
    });

    const row = await pool.query<{
      provider: string | null;
      model: string | null;
      usage_json: string | null;
      response_payload: string | null;
    }>(
      `SELECT provider, model, usage_json, response_payload
         FROM ${schema}.model_calls WHERE model_call_id = $1`,
      ['call-usage'],
    );
    const call = row.rows[0];
    expect(call?.provider).toBe('openai');
    expect(call?.model).toBe('gpt-5.6-luna');
    expect(JSON.parse(call?.usage_json ?? '{}')).toEqual({
      inputTokens: 66_819,
      outputTokens: 650,
    });
    expect(call?.response_payload).toBeNull();

    const stored = await pool.query<{ record_json: string }>(
      `SELECT record_json FROM ${schema}.model_calls WHERE model_call_id = $1`,
      ['call-usage'],
    );
    expect(stored.rows[0]?.record_json ?? '').not.toContain('must-not-rest');
  });

  it('two concurrent drains lease disjoint outbox sets', async () => {
    const schema = randomSchema('acme_lease');
    schemas.push(schema);
    await migratePostgresSchema({ pool, schema, appliedAt });
    const repository = createPostgresExecutionRepository({
      pool,
      schema,
      ids: countingIds(),
    });

    for (let index = 0; index < 6; index += 1) {
      await acceptAndCommit(
        repository,
        `exec-lease-${index}`,
        `event-lease-${index}`,
      );
    }

    const [batchA, batchB] = await Promise.all([
      repository.leaseOutbox({
        now: timestamp,
        leaseExpiresAt: '2026-08-12T12:01:00.000Z',
        limit: 3,
      }),
      repository.leaseOutbox({
        now: timestamp,
        leaseExpiresAt: '2026-08-12T12:01:00.000Z',
        limit: 3,
      }),
    ]);

    const idsA = batchA.map((entry) => entry.record.eventId);
    const idsB = batchB.map((entry) => entry.record.eventId);
    expect(idsA).toHaveLength(3);
    expect(idsB).toHaveLength(3);
    const intersection = idsA.filter((id) => idsB.includes(id));
    expect(intersection).toEqual([]);
  });

  it('two concurrent migrations apply exactly one migration set', async () => {
    const schema = randomSchema('acme_mig');
    schemas.push(schema);
    const [first, second] = await Promise.allSettled([
      migratePostgresSchema({ pool, schema, appliedAt }),
      migratePostgresSchema({ pool, schema, appliedAt }),
    ]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('fulfilled');

    const source = createMigrations(schema);
    const rows = await pool.query<{ version: number; checksum: string }>(
      `SELECT version, checksum FROM "${schema}".schema_migrations ORDER BY version`,
    );
    expect(rows.rows).toHaveLength(source.length);
    const baseline = source[0];
    if (baseline === undefined) {
      throw new Error('Expected at least one migration.');
    }
    expect(rows.rows[0]?.checksum).toBe(migrationChecksum(baseline));
  });

  it('contended expected-revision write yields one commit and CONFLICT_STATE_REVISION', async () => {
    const schema = randomSchema('acme_cas');
    schemas.push(schema);
    await migratePostgresSchema({ pool, schema, appliedAt });

    const value = { note: 'cas' };
    const contentHash = sha256(canonicalJson(value));
    const stateValue = { revision: 1 };
    const valueHash = sha256(canonicalJson(stateValue));

    async function writer(
      executionId: string,
      ids: ReturnType<typeof countingIds>,
    ) {
      const repository = createPostgresExecutionRepository({
        pool,
        schema,
        ids,
      });
      await repository.accept({
        executionId,
        request: {
          requestKey: executionId,
          namespace: 'gates',
          task: 'observe',
          entityId: 'shared-entity',
          expectedRevision: 0,
          input: { executionId },
          model: { profile: 'fixture' },
        },
        requestFingerprint: `fp-${executionId}`,
        inputHash: `input-${executionId}`,
        contract: { id: 'gate.observe', version: '1.0.0' },
        contractFingerprint: 'contract-fp',
        effectivePolicy: {
          timeoutMs: 1000,
          maxModelCalls: 1,
          maxRepairCalls: 0,
          maxRevisionCalls: 0,
          retention: 'hash-only',
        },
        createdAt: timestamp,
      });
      const content = {
        executionId,
        expectedRevision: 0,
        documents: [
          {
            key: 'doc-1',
            kind: 'note',
            schemaVersion: '1.0.0',
            value,
            contentHash,
          },
        ],
        memoryCandidates: [] as const,
        memory: { decisions: [] as const, mutations: [] as const },
        state: {
          snapshot: {
            entityId: 'shared-entity',
            namespace: 'gates',
            schemaVersion: '1.0.0',
            revision: 1,
            value: stateValue,
            valueHash,
            createdAt: timestamp,
            executionId,
          },
          transition: {
            transitionId: `transition-${executionId}`,
            operationKey: `op-${executionId}`,
            entityId: 'shared-entity',
            namespace: 'gates',
            fromRevision: 0,
            toRevision: 1,
            deltaSchemaVersion: '1.0.0',
            delta: { set: stateValue },
            previousHash: null,
            nextHash: valueHash,
            executionId,
            createdAt: timestamp,
          },
        },
        evaluatorRuns: [] as const,
        events: [] as const,
        committedAt: timestamp,
      };
      return repository.commit({
        ...content,
        operationDigest: computeOperationDigest(content),
      });
    }

    const results = await Promise.allSettled([
      writer('exec-cas-a', countingIds()),
      writer('exec-cas-b', countingIds()),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason as {
      data?: { code?: string };
    };
    // Compare by code: vitest may load AcmeError from distinct module graphs.
    expect(reason?.data?.code).toBe('CONFLICT_STATE_REVISION');
  });

  it('aggregate transaction rollback leaves no side effects', async () => {
    const schema = randomSchema('acme_rb');
    schemas.push(schema);
    await migratePostgresSchema({ pool, schema, appliedAt });

    let events = 0;
    const repository = createPostgresExecutionRepository({
      pool,
      schema,
      ids: {
        next(kind) {
          if (kind !== 'event') {
            return `${kind}-1`;
          }
          events += 1;
          if (events === 1) {
            throw new Error('Simulated storage fault.');
          }
          return `event-${events}`;
        },
      },
    });

    const executionId = 'exec-rollback';
    await repository.accept({
      executionId,
      request: {
        requestKey: executionId,
        namespace: 'gates',
        task: 'observe',
        entityId: 'entity-rb',
        expectedRevision: 0,
        input: { executionId },
        model: { profile: 'fixture' },
      },
      requestFingerprint: `fp-${executionId}`,
      inputHash: `input-${executionId}`,
      contract: { id: 'gate.observe', version: '1.0.0' },
      contractFingerprint: 'contract-fp',
      effectivePolicy: {
        timeoutMs: 1000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        retention: 'hash-only',
      },
      createdAt: timestamp,
    });

    const documentValue = { note: 'must-not-rest' };
    const content = {
      executionId,
      expectedRevision: 0,
      documents: [
        {
          key: 'doc-rb',
          kind: 'note',
          schemaVersion: '1.0.0',
          value: documentValue,
          contentHash: sha256(canonicalJson(documentValue)),
        },
      ],
      memoryCandidates: [] as const,
      memory: { decisions: [] as const, mutations: [] as const },
      state: null,
      evaluatorRuns: [] as const,
      events: [
        {
          key: 'evt-rb',
          type: 'gate.observed',
          schemaVersion: '1.0.0',
          payload: { executionId },
        },
      ],
      committedAt: timestamp,
    };
    const prepared = {
      ...content,
      operationDigest: computeOperationDigest(content),
    };

    await expect(repository.commit(prepared)).rejects.toMatchObject({
      data: { code: 'INTERNAL' },
    });

    const docs = await pool.query(
      `SELECT count(*)::int AS n FROM "${schema}".documents`,
    );
    const eventsCount = await pool.query(
      `SELECT count(*)::int AS n FROM "${schema}".domain_events`,
    );
    const commits = await pool.query(
      `SELECT count(*)::int AS n FROM "${schema}".execution_commits`,
    );
    expect(docs.rows[0]?.n).toBe(0);
    expect(eventsCount.rows[0]?.n).toBe(0);
    expect(commits.rows[0]?.n).toBe(0);

    // Repository stays usable for a successful retry.
    await repository.commit(prepared);
    const after = await pool.query(
      `SELECT count(*)::int AS n FROM "${schema}".execution_commits`,
    );
    expect(after.rows[0]?.n).toBe(1);
  });

  it('migration reopen yields identical operation digest', async () => {
    const schema = randomSchema('acme_reopen');
    schemas.push(schema);
    await migratePostgresSchema({ pool, schema, appliedAt });
    const repository = createPostgresExecutionRepository({
      pool,
      schema,
      ids: countingIds(),
    });
    const committed = await acceptAndCommit(
      repository,
      'exec-reopen',
      'event-reopen',
    );

    const reopened = createPostgresExecutionRepository({
      pool,
      schema,
      ids: countingIds(),
    });
    const again = await reopened.commit(
      prepared('exec-reopen', 'event-reopen'),
    );
    expect(again.operationDigest).toBe(committed.operationDigest);
    expect(again).toEqual(committed);
  });

  it('anonymous role is denied against acme and evidence schemas', async () => {
    requirePostgresUrl();
    const acmeSchema = randomSchema('acme_iso');
    const evidenceSchema = randomSchema('evidence_iso');
    schemas.push(acmeSchema);
    evidenceSchemas.push(evidenceSchema);
    await migratePostgresSchema({ pool, schema: acmeSchema, appliedAt });
    await migrateEvidenceProductSchema({
      pool,
      schema: evidenceSchema,
      appliedAt,
    });

    // Ensure a local `anon` stand-in exists for ephemeral postgres:15.
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOINHERIT NOLOGIN;
        END IF;
      END
      $$;
    `);
    await pool.query(`REVOKE ALL ON SCHEMA "${acmeSchema}" FROM PUBLIC, anon`);
    await pool.query(
      `REVOKE ALL ON SCHEMA "${evidenceSchema}" FROM PUBLIC, anon`,
    );
    await pool.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA "${acmeSchema}" FROM PUBLIC, anon`,
    );
    await pool.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA "${evidenceSchema}" FROM PUBLIC, anon`,
    );

    await expect(
      pool.query(
        `SET ROLE anon; SELECT 1 FROM "${acmeSchema}".executions LIMIT 1`,
      ),
    ).rejects.toThrow();

    // Reset role for subsequent queries on this pool connection path.
    await pool.query('RESET ROLE');

    await expect(
      pool.query(
        `SET ROLE anon; SELECT 1 FROM "${evidenceSchema}".workspaces LIMIT 1`,
      ),
    ).rejects.toThrow();
    await pool.query('RESET ROLE');
  });
});

describe('roles SQL is present', () => {
  it('ships browser isolation script', () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(
      join(root, '../../packages/adapter-postgres/sql/roles.sql'),
      'utf8',
    );
    expect(sql).toContain('REVOKE ALL ON SCHEMA acme FROM anon');
    expect(sql).toContain('acme_engine');
    expect(sql).toContain('evidence_app');
  });
});
