import type {
  AcmeErrorData,
  ContractRef,
  DiagnosticFact,
  JsonValue,
  MemoryRecord,
  ModelSelection,
  RecordedRankedMemory,
  StateSnapshot,
  StoredDocument,
} from '@acme/core';

import {
  contentView,
  type PayloadView,
  type RedactionOptions,
} from '../redaction.js';

/**
 * Shared evidence-to-view mappers.
 *
 * Every function here copies recorded values and applies the disclosure rule.
 * None of them derives a domain fact, a verdict or an ordering the evidence
 * did not already have.
 */

export interface ContractRefView {
  readonly id: string;
  readonly version: string;
}

export interface ModelSelectionView {
  readonly profile: string;
  readonly providerHint: string | null;
  readonly modelHint: string | null;
}

export interface DiagnosticView {
  readonly code: string;
  readonly severity: DiagnosticFact['severity'];
  readonly value: PayloadView | null;
}

export interface ErrorView {
  readonly code: AcmeErrorData['code'];
  readonly message: string;
  readonly stage: AcmeErrorData['stage'];
  readonly retryable: boolean;
  readonly causeRef: string | null;
  readonly details: PayloadView | null;
}

export interface DocumentView {
  readonly documentId: string;
  readonly executionId: string;
  readonly namespace: string;
  readonly entityId: string;
  readonly key: string;
  readonly kind: string;
  readonly schemaVersion: string;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly value: PayloadView;
}

export interface MemoryRecordView {
  readonly memoryId: string;
  readonly namespace: string;
  readonly entityId: string;
  readonly identityKey: string;
  readonly kind: string;
  readonly schemaVersion: string;
  readonly strength: number;
  readonly status: MemoryRecord['status'];
  readonly recordVersion: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly lastReinforcedAt: string;
  readonly provenanceExecutionIds: readonly string[];
  readonly value: PayloadView;
}

export interface RankedMemoryView {
  readonly rank: number;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly record: MemoryRecordView;
}

export interface StateSnapshotView {
  readonly namespace: string;
  readonly entityId: string;
  readonly revision: number;
  readonly schemaVersion: string;
  readonly valueHash: string;
  readonly createdAt: string;
  readonly executionId: string;
  readonly value: PayloadView;
}

export function contractRefView(ref: ContractRef): ContractRefView {
  return { id: ref.id, version: ref.version };
}

export function modelSelectionView(
  selection: ModelSelection,
): ModelSelectionView {
  return {
    profile: selection.profile,
    providerHint: selection.providerHint ?? null,
    modelHint: selection.modelHint ?? null,
  };
}

export function diagnosticView(
  fact: DiagnosticFact,
  options: RedactionOptions,
): DiagnosticView {
  return {
    code: fact.code,
    severity: fact.severity,
    value: fact.value === undefined ? null : contentView(fact.value, options),
  };
}

/**
 * Error code, message and stage are engine-authored operational metadata and
 * are shown. `details` can carry model or domain content, so it follows the
 * content rule.
 */
export function errorView(
  error: AcmeErrorData,
  options: RedactionOptions,
): ErrorView {
  return {
    code: error.code,
    message: error.message,
    stage: error.stage,
    retryable: error.retryable,
    causeRef: error.causeRef ?? null,
    details:
      error.details === undefined ? null : contentView(error.details, options),
  };
}

export function documentView(
  document: StoredDocument,
  options: RedactionOptions,
): DocumentView {
  return {
    documentId: document.documentId,
    executionId: document.executionId,
    namespace: document.namespace,
    entityId: document.entityId,
    key: document.key,
    kind: document.kind,
    schemaVersion: document.schemaVersion,
    contentHash: document.contentHash,
    createdAt: document.createdAt,
    value: contentView(document.value, options),
  };
}

export function memoryRecordView(
  record: MemoryRecord,
  options: RedactionOptions,
): MemoryRecordView {
  return {
    memoryId: record.memoryId,
    namespace: record.namespace,
    entityId: record.entityId,
    identityKey: record.identityKey,
    kind: record.kind,
    schemaVersion: record.schemaVersion,
    strength: record.strength,
    status: record.status,
    recordVersion: record.recordVersion,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    lastReinforcedAt: record.lastReinforcedAt,
    provenanceExecutionIds: record.provenance.map((entry) => entry.executionId),
    value: contentView(record.value, options),
  };
}

export function rankedMemoryView(
  ranked: RecordedRankedMemory,
  options: RedactionOptions,
): RankedMemoryView {
  return {
    rank: ranked.rank,
    score: ranked.score,
    reasons: [...ranked.reasons],
    record: memoryRecordView(ranked.record, options),
  };
}

export function stateSnapshotView(
  snapshot: StateSnapshot<JsonValue>,
  options: RedactionOptions,
): StateSnapshotView {
  return {
    namespace: snapshot.namespace,
    entityId: snapshot.entityId,
    revision: snapshot.revision,
    schemaVersion: snapshot.schemaVersion,
    valueHash: snapshot.valueHash,
    createdAt: snapshot.createdAt,
    executionId: snapshot.executionId,
    value: contentView(snapshot.value, options),
  };
}
