import type {
  AcmeErrorData,
  DiagnosticFact,
  DomainEventRecord,
  ExecutionAttempt,
  ExecutionPolicy,
  ExecutionRecord,
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
  JsonValue,
  MemoryRecord,
  ModelCallRecord,
  OutboxRecord,
  ProvenanceRef,
  StateSnapshot,
  StateTransition,
  StoredDocument,
} from '@acme/core';

export interface ExecutionRow {
  readonly execution_id: string;
  readonly request_json: string;
  readonly request_fingerprint: string;
  readonly input_hash: string;
  readonly contract_id: string;
  readonly contract_version: string;
  readonly contract_fingerprint: string;
  readonly policy_json: string;
  readonly status: string;
  readonly current_stage: string;
  readonly result_json: string | null;
  readonly error_json: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AttemptRow {
  readonly execution_id: string;
  readonly attempt_number: number;
  readonly stage: string;
  readonly outcome: string;
  readonly retry_at: string | null;
  readonly diagnostic_json: string | null;
  readonly occurred_at: string;
}

export interface DocumentRow {
  readonly document_id: string;
  readonly execution_id: string;
  readonly namespace: string;
  readonly entity_id: string;
  readonly document_key: string;
  readonly kind: string;
  readonly schema_version: string;
  readonly value_json: string;
  readonly content_hash: string;
  readonly created_at: string;
}

export interface MemoryRecordRow {
  readonly memory_id: string;
  readonly namespace: string;
  readonly entity_id: string;
  readonly identity_key: string;
  readonly kind: string;
  readonly schema_version: string;
  readonly value_json: string;
  readonly strength: number;
  readonly status: string;
  readonly record_version: number;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly last_reinforced_at: string;
  readonly provenance_json: string;
}

export interface StateSnapshotRow {
  readonly namespace: string;
  readonly entity_id: string;
  readonly revision: number;
  readonly schema_version: string;
  readonly value_json: string;
  readonly value_hash: string;
  readonly execution_id: string;
  readonly created_at: string;
}

export interface StateTransitionRow {
  readonly transition_id: string;
  readonly operation_key: string;
  readonly namespace: string;
  readonly entity_id: string;
  readonly from_revision: number;
  readonly to_revision: number;
  readonly delta_schema_version: string;
  readonly delta_json: string;
  readonly previous_hash: string | null;
  readonly next_hash: string;
  readonly execution_id: string;
  readonly created_at: string;
}

export interface DomainEventRow {
  readonly event_id: string;
  readonly execution_id: string;
  readonly event_key: string;
  readonly namespace: string;
  readonly entity_id: string;
  readonly type: string;
  readonly schema_version: string;
  readonly payload_json: string;
  readonly occurred_at: string;
}

export interface OutboxRow {
  readonly event_id: string;
  readonly status: string;
  readonly attempt_count: number;
  readonly available_at: string;
  readonly claimed_at: string | null;
  readonly delivered_at: string | null;
  readonly last_error_json: string | null;
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

export function parseOptionalJson<T>(text: string | null): T | undefined {
  return text === null ? undefined : (JSON.parse(text) as T);
}

export function toExecutionRecord(row: ExecutionRow): ExecutionRecord {
  const result = parseOptionalJson<ExecutionResult>(row.result_json);
  const error = parseOptionalJson<AcmeErrorData>(row.error_json);
  return {
    executionId: row.execution_id,
    request: parseJson<ExecutionRequest<JsonValue>>(row.request_json),
    requestFingerprint: row.request_fingerprint,
    inputHash: row.input_hash,
    contract: { id: row.contract_id, version: row.contract_version },
    contractFingerprint: row.contract_fingerprint,
    policy: parseJson<ExecutionPolicy>(row.policy_json),
    status: row.status as ExecutionStatus,
    currentStage: row.current_stage as ExecutionStatus,
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toExecutionAttempt(row: AttemptRow): ExecutionAttempt {
  const diagnostic = parseOptionalJson<DiagnosticFact>(row.diagnostic_json);
  return {
    executionId: row.execution_id,
    attemptNumber: Number(row.attempt_number),
    stage: row.stage as ExecutionStatus,
    outcome: row.outcome as ExecutionAttempt['outcome'],
    ...(row.retry_at === null ? {} : { retryAt: row.retry_at }),
    ...(diagnostic === undefined ? {} : { diagnostic }),
    occurredAt: row.occurred_at,
  };
}

export function toStoredDocument(row: DocumentRow): StoredDocument {
  return {
    documentId: row.document_id,
    executionId: row.execution_id,
    namespace: row.namespace,
    entityId: row.entity_id,
    key: row.document_key,
    kind: row.kind,
    schemaVersion: row.schema_version,
    value: parseJson<JsonValue>(row.value_json),
    contentHash: row.content_hash,
    createdAt: row.created_at,
  };
}

export function toMemoryRecord(row: MemoryRecordRow): MemoryRecord {
  return {
    memoryId: row.memory_id,
    namespace: row.namespace,
    entityId: row.entity_id,
    identityKey: row.identity_key,
    kind: row.kind,
    schemaVersion: row.schema_version,
    value: parseJson<JsonValue>(row.value_json),
    strength: Number(row.strength),
    status: row.status as MemoryRecord['status'],
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastReinforcedAt: row.last_reinforced_at,
    provenance: parseJson<ProvenanceRef[]>(row.provenance_json),
    recordVersion: Number(row.record_version),
  };
}

export function toStateSnapshot(
  row: StateSnapshotRow,
): StateSnapshot<JsonValue> {
  return {
    entityId: row.entity_id,
    namespace: row.namespace,
    schemaVersion: row.schema_version,
    revision: Number(row.revision),
    value: parseJson<JsonValue>(row.value_json),
    valueHash: row.value_hash,
    createdAt: row.created_at,
    executionId: row.execution_id,
  };
}

export function toStateTransition(
  row: StateTransitionRow,
): StateTransition<JsonValue> {
  return {
    transitionId: row.transition_id,
    operationKey: row.operation_key,
    entityId: row.entity_id,
    namespace: row.namespace,
    fromRevision: Number(row.from_revision),
    toRevision: Number(row.to_revision),
    deltaSchemaVersion: row.delta_schema_version,
    delta: parseJson<JsonValue>(row.delta_json),
    previousHash: row.previous_hash,
    nextHash: row.next_hash,
    executionId: row.execution_id,
    createdAt: row.created_at,
  };
}

export function toDomainEventRecord(row: DomainEventRow): DomainEventRecord {
  return {
    eventId: row.event_id,
    executionId: row.execution_id,
    key: row.event_key,
    namespace: row.namespace,
    entityId: row.entity_id,
    type: row.type,
    schemaVersion: row.schema_version,
    payload: parseJson<JsonValue>(row.payload_json),
    occurredAt: row.occurred_at,
  };
}

export function toOutboxRecord(row: OutboxRow): OutboxRecord {
  const lastError = parseOptionalJson<AcmeErrorData>(row.last_error_json);
  return {
    eventId: row.event_id,
    status: row.status as OutboxRecord['status'],
    attemptCount: Number(row.attempt_count),
    availableAt: row.available_at,
    ...(row.claimed_at === null ? {} : { claimedAt: row.claimed_at }),
    ...(row.delivered_at === null ? {} : { deliveredAt: row.delivered_at }),
    ...(lastError === undefined ? {} : { lastError }),
  };
}

export function toModelCallRecord(recordJson: string): ModelCallRecord {
  return parseJson<ModelCallRecord>(recordJson);
}
