import type {
  EntityId,
  ExecutionId,
  IsoTimestamp,
  JsonValue,
  ModelCallId,
  Namespace,
} from './common.js';
import type { ContractRef } from './contracts.js';
import type { DomainIssue } from './state.js';

export interface ProvenanceRef {
  readonly executionId: ExecutionId;
  readonly contract: ContractRef;
  readonly modelCallId?: ModelCallId;
  readonly documentKeys: readonly string[];
}

export interface MemoryCandidate {
  readonly key: string;
  readonly kind: string;
  readonly schemaVersion: string;
  readonly value: JsonValue;
  readonly confidence?: number;
  readonly source: ProvenanceRef;
}

export interface MemoryRecord {
  readonly memoryId: string;
  readonly namespace: Namespace;
  readonly entityId: EntityId;
  readonly identityKey: string;
  readonly kind: string;
  readonly schemaVersion: string;
  readonly value: JsonValue;
  readonly strength: number;
  readonly status: 'active' | 'superseded' | 'contested' | 'forgotten';
  readonly firstSeenAt: IsoTimestamp;
  readonly lastSeenAt: IsoTimestamp;
  readonly lastReinforcedAt: IsoTimestamp;
  readonly provenance: readonly ProvenanceRef[];
  readonly recordVersion: number;
}

export interface MemoryQuery {
  readonly namespace: Namespace;
  readonly entityId: EntityId;
  readonly task: string;
  readonly kinds?: readonly string[];
  readonly text?: string;
  readonly limit: number;
}

export interface RankedMemory {
  readonly record: MemoryRecord;
  readonly score: number;
  readonly reasons: readonly string[];
}

export type MemoryLifecycleDecision =
  | { readonly action: 'retain' }
  | { readonly action: 'update-strength'; readonly strength: number }
  | { readonly action: 'forget'; readonly reason: string };

export type MemoryResolution = { readonly candidateKey: string } & (
  | {
      readonly action: 'create';
      readonly identityKey: string;
      readonly value: JsonValue;
    }
  | { readonly action: 'reinforce'; readonly memoryId: string }
  | {
      readonly action: 'merge';
      readonly memoryId: string;
      readonly value: JsonValue;
    }
  | {
      readonly action: 'contradict';
      readonly memoryIds: readonly string[];
      readonly disposition:
        'contest' | 'supersede-existing' | 'reject-candidate';
    }
  | { readonly action: 'ignore'; readonly reason: string }
);

export interface DomainMemoryPolicy {
  validate(candidate: MemoryCandidate): readonly DomainIssue[];
  identity(candidate: MemoryCandidate): string;
  retrieve(
    query: MemoryQuery,
    records: readonly MemoryRecord[],
  ): readonly RankedMemory[];
  resolve(
    candidate: MemoryCandidate,
    existing: readonly MemoryRecord[],
    context: { readonly now: IsoTimestamp },
  ): MemoryResolution;
  lifecycle(
    record: MemoryRecord,
    hook: 'execution-start' | 'execution-commit' | 'maintenance',
    context: { readonly now: IsoTimestamp },
  ): MemoryLifecycleDecision;
}
