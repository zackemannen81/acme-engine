import { AcmeError, nodeHashing, type Hashing } from '@acme/core';
import type { Database } from 'better-sqlite3';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

interface AppliedMigrationRow {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

const initialSchema: readonly string[] = [
  `CREATE TABLE executions (
    execution_id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    request_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    task TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    input_json TEXT,
    input_hash TEXT NOT NULL,
    request_json TEXT NOT NULL,
    policy_json TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    contract_version TEXT NOT NULL,
    contract_fingerprint TEXT NOT NULL,
    status TEXT NOT NULL,
    current_stage TEXT NOT NULL,
    result_json TEXT,
    error_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    terminal_at TEXT,
    UNIQUE (namespace, request_key)
  )`,
  `CREATE INDEX executions_by_entity_status
    ON executions (namespace, entity_id, status)`,
  `CREATE TABLE execution_attempts (
    attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    attempt_number INTEGER NOT NULL,
    stage TEXT NOT NULL,
    outcome TEXT NOT NULL,
    retry_at TEXT,
    diagnostic_json TEXT,
    occurred_at TEXT NOT NULL,
    UNIQUE (execution_id, attempt_number, stage)
  )`,
  `CREATE TABLE model_calls (
    model_call_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    call_key TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    selection_json TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    request_payload TEXT,
    response_hash TEXT,
    response_payload TEXT,
    provider_response_id TEXT,
    usage_json TEXT,
    record_json TEXT NOT NULL,
    status TEXT NOT NULL,
    error_json TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE (execution_id, call_key, attempt)
  )`,
  `CREATE TABLE documents (
    document_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    namespace TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    document_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    value_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (execution_id, document_key)
  )`,
  `CREATE INDEX documents_by_entity_kind
    ON documents (namespace, entity_id, kind)`,
  `CREATE TABLE memory_candidates (
    candidate_id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    candidate_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    value_json TEXT NOT NULL,
    candidate_json TEXT NOT NULL,
    decision_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (execution_id, candidate_key)
  )`,
  `CREATE TABLE memory_records (
    memory_id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    identity_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    value_json TEXT NOT NULL,
    strength REAL NOT NULL,
    status TEXT NOT NULL,
    record_version INTEGER NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_reinforced_at TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    UNIQUE (namespace, entity_id, identity_key)
  )`,
  `CREATE INDEX memory_records_active_by_entity
    ON memory_records (namespace, entity_id, status)`,
  `CREATE TABLE state_heads (
    namespace TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    value_hash TEXT NOT NULL,
    PRIMARY KEY (namespace, entity_id)
  )`,
  `CREATE TABLE state_snapshots (
    namespace TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    schema_version TEXT NOT NULL,
    value_json TEXT NOT NULL,
    value_hash TEXT NOT NULL,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (namespace, entity_id, revision)
  )`,
  `CREATE TABLE state_transitions (
    transition_id TEXT PRIMARY KEY,
    operation_key TEXT NOT NULL,
    namespace TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    from_revision INTEGER NOT NULL,
    to_revision INTEGER NOT NULL,
    delta_schema_version TEXT NOT NULL,
    delta_json TEXT NOT NULL,
    previous_hash TEXT,
    next_hash TEXT NOT NULL,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    created_at TEXT NOT NULL,
    UNIQUE (namespace, entity_id, operation_key),
    UNIQUE (namespace, entity_id, to_revision)
  )`,
  `CREATE TABLE domain_events (
    event_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    event_key TEXT NOT NULL,
    namespace TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    type TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    UNIQUE (execution_id, event_key)
  )`,
  `CREATE TABLE outbox (
    event_id TEXT PRIMARY KEY REFERENCES domain_events(event_id),
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    available_at TEXT NOT NULL,
    claimed_at TEXT,
    delivered_at TEXT,
    last_error_json TEXT
  )`,
  `CREATE INDEX outbox_pending
    ON outbox (status, available_at)`,
  `CREATE TABLE evaluator_runs (
    evaluator_run_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    evaluator_id TEXT NOT NULL,
    evaluator_version TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    subject_hash TEXT NOT NULL,
    decision_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (execution_id, evaluator_id, attempt)
  )`,
  `CREATE TABLE execution_commits (
    execution_id TEXT PRIMARY KEY REFERENCES executions(execution_id),
    operation_digest TEXT NOT NULL,
    revision INTEGER NOT NULL,
    document_keys_json TEXT NOT NULL,
    event_ids_json TEXT NOT NULL,
    prepared_commit_json TEXT NOT NULL,
    committed_at TEXT NOT NULL
  )`,
];

/**
 * Post-execution quality evaluations (ADR-0025 / ACME-0065). Sibling table:
 * no foreign key to executions, so deleting or retaining ledger rows does not
 * rewrite evaluation evidence identity and evaluations may outlive or
 * predate local execution rows independently.
 */
const qualityEvaluationsSchema: readonly string[] = [
  `CREATE TABLE quality_evaluations (
    evaluation_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    subject_digest TEXT NOT NULL,
    result_digest TEXT NOT NULL,
    evaluator_id TEXT NOT NULL,
    evaluator_version TEXT NOT NULL,
    evaluator_kind TEXT NOT NULL,
    verdict TEXT NOT NULL,
    record_json TEXT NOT NULL
  )`,
  `CREATE INDEX quality_evaluations_by_run
    ON quality_evaluations (run_id, evaluation_id)`,
  `CREATE INDEX quality_evaluations_by_execution
    ON quality_evaluations (execution_id, evaluation_id)`,
];

export const migrations: readonly Migration[] = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'initial-revisioned-unit-of-work',
    statements: Object.freeze(initialSchema),
  }),
  Object.freeze({
    version: 2,
    name: 'quality-evaluations-append-only',
    statements: Object.freeze(qualityEvaluationsSchema),
  }),
]);

export function migrationChecksum(
  migration: Migration,
  hashing: Hashing = nodeHashing,
): string {
  return hashing.sha256(
    hashing.canonicalJson({
      version: migration.version,
      name: migration.name,
      statements: [...migration.statements],
    }),
  );
}

function corruption(message: string, details: Record<string, unknown>): never {
  throw new AcmeError({
    code: 'PERSISTENCE_CORRUPTION',
    message,
    stage: 'preparing-commit',
    retryable: false,
    details: details as never,
  });
}

/**
 * Applies every pending migration in version order inside one transaction and
 * refuses to open a database whose recorded checksums no longer match the
 * migration source. ADR-0003 requires ordered, checksum-verified migrations.
 */
export function applyMigrations(
  database: Database,
  appliedAt: string,
  source: readonly Migration[] = migrations,
  hashing: Hashing = nodeHashing,
): void {
  database.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );

  const applied = new Map<number, AppliedMigrationRow>(
    database
      .prepare<[], AppliedMigrationRow>(
        'SELECT version, name, checksum FROM schema_migrations ORDER BY version',
      )
      .all()
      .map((row) => [row.version, row]),
  );
  const known = new Set(source.map((migration) => migration.version));
  for (const version of applied.keys()) {
    if (!known.has(version)) {
      corruption('The database contains an unknown migration version.', {
        version,
      });
    }
  }

  const ordered = [...source].sort(
    (left, right) => left.version - right.version,
  );
  const record = database.prepare(
    `INSERT INTO schema_migrations (version, name, checksum, applied_at)
     VALUES (?, ?, ?, ?)`,
  );
  const apply = database.transaction(() => {
    for (const migration of ordered) {
      const checksum = migrationChecksum(migration, hashing);
      const existing = applied.get(migration.version);
      if (existing !== undefined) {
        if (
          existing.checksum !== checksum ||
          existing.name !== migration.name
        ) {
          corruption('A recorded migration checksum no longer matches.', {
            version: migration.version,
            recordedChecksum: existing.checksum,
            expectedChecksum: checksum,
          });
        }
        continue;
      }
      for (const statement of migration.statements) {
        database.exec(statement);
      }
      record.run(migration.version, migration.name, checksum, appliedAt);
    }
  });
  apply.immediate();
}
