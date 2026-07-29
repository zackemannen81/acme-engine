import type {
  EntityId,
  ExecutionId,
  IsoTimestamp,
  Namespace,
} from './common.js';

export interface StateSnapshot<TState> {
  readonly entityId: EntityId;
  readonly namespace: Namespace;
  readonly schemaVersion: string;
  readonly revision: number;
  readonly value: TState;
  readonly valueHash: string;
  readonly createdAt: IsoTimestamp;
  readonly executionId: ExecutionId;
}

export interface StateTransition<TDelta> {
  readonly transitionId: string;
  readonly operationKey: string;
  readonly entityId: EntityId;
  readonly namespace: Namespace;
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly deltaSchemaVersion: string;
  readonly delta: TDelta;
  readonly previousHash: string | null;
  readonly nextHash: string;
  readonly executionId: ExecutionId;
  readonly createdAt: IsoTimestamp;
}

export interface DomainIssue {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export interface PreparedState<TState, TDelta> {
  readonly snapshot: StateSnapshot<TState>;
  readonly transition: StateTransition<TDelta>;
}

export interface StatePrepareContext {
  readonly entityId: EntityId;
  readonly executionId: ExecutionId;
  readonly operationKey: string;
  readonly now: IsoTimestamp;
}
