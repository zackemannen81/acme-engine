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

export type MemoryLifecycleHook =
  'execution-start' | 'execution-commit' | 'maintenance';

export type MemoryResolution =
  | {
      readonly candidateKey: string;
      readonly action: 'create';
      readonly value: JsonValue;
      readonly strength: number;
    }
  | {
      readonly candidateKey: string;
      readonly action: 'reinforce';
      readonly memoryId: string;
      readonly strength: number;
    }
  | {
      readonly candidateKey: string;
      readonly action: 'merge';
      readonly memoryId: string;
      readonly value: JsonValue;
      readonly strength: number;
    }
  | {
      readonly candidateKey: string;
      readonly action: 'contradict';
      readonly memoryIds: readonly string[];
      readonly disposition: 'contest' | 'reject-candidate';
    }
  | {
      readonly candidateKey: string;
      readonly action: 'contradict';
      readonly memoryIds: readonly string[];
      readonly disposition: 'supersede-existing';
      readonly replacement: {
        readonly value: JsonValue;
        readonly strength: number;
      };
    }
  | {
      readonly candidateKey: string;
      readonly action: 'ignore';
      readonly reason: string;
    };

export interface MemoryPrepareContext {
  readonly namespace: Namespace;
  readonly entityId: EntityId;
  readonly executionId: ExecutionId;
  readonly now: IsoTimestamp;
}

export interface MemoryLifecycleContext {
  readonly namespace: Namespace;
  readonly entityId: EntityId;
  readonly now: IsoTimestamp;
}

export type MemoryMutation =
  | {
      readonly action: 'create';
      readonly record: MemoryRecord;
    }
  | {
      readonly action: 'update';
      readonly expectedRecordVersion: number;
      readonly record: MemoryRecord;
    };

export interface PreparedMemoryDecision {
  readonly candidateKey: string;
  readonly identityKey: string;
  readonly resolution: MemoryResolution;
  readonly affectedMemoryIds: readonly string[];
}

export interface PreparedMemory {
  readonly decisions: readonly PreparedMemoryDecision[];
  readonly mutations: readonly MemoryMutation[];
}

export interface PreparedMemoryLifecycleDecision {
  readonly memoryId: string;
  readonly decision: MemoryLifecycleDecision;
}

export interface PreparedMemoryLifecycle {
  readonly decisions: readonly PreparedMemoryLifecycleDecision[];
  readonly mutations: readonly MemoryMutation[];
}

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
    hook: MemoryLifecycleHook,
    context: { readonly now: IsoTimestamp },
  ): MemoryLifecycleDecision;
}
