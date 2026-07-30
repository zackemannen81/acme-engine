import type {
  DiagnosticFact,
  EntityId,
  ExecutionId,
  IsoTimestamp,
  JsonValue,
  Namespace,
  Schema,
  StoredDocument,
} from './common.js';
import type { ContractRef } from './contracts.js';
import type {
  AppliedMemoryResolution,
  DomainMemoryPolicy,
  MemoryCandidate,
  MemoryRecord,
} from './memory.js';
import type { DomainIssue, StateSnapshot } from './state.js';

export type ModuleRole = 'producer' | 'analyzer' | 'transformer';

export interface ExecutionReadContext<TState> {
  readonly executionId: ExecutionId;
  readonly entityId: EntityId;
  readonly now: IsoTimestamp;
  readonly state: StateSnapshot<TState> | null;
  readonly memories: readonly MemoryRecord[];
  readonly documents: readonly StoredDocument[];
}

export interface CandidateDocument {
  readonly key: string;
  readonly kind: string;
  readonly schemaVersion: string;
  readonly value: JsonValue;
  readonly contentHash: string;
}

export interface CandidateEvent {
  readonly key: string;
  readonly type: string;
  readonly schemaVersion: string;
  readonly payload: JsonValue;
}

export interface StateDelta<TDelta> {
  readonly schemaVersion: string;
  readonly value: TDelta;
}

export interface ModuleResult<TDelta> {
  readonly documents: readonly CandidateDocument[];
  readonly memories: readonly MemoryCandidate[];
  readonly stateIntent?: StateDelta<TDelta>;
  readonly events: readonly CandidateEvent[];
  readonly diagnostics: readonly DiagnosticFact[];
}

export interface StateProjectionMemoryDecision {
  readonly candidate: MemoryCandidate;
  readonly identityKey: string;
  readonly resolution: AppliedMemoryResolution;
  readonly affectedMemoryIds: readonly string[];
}

export interface StateProjectionInput<TDelta> {
  readonly stateIntent?: StateDelta<TDelta>;
  readonly memory: readonly StateProjectionMemoryDecision[];
}

export interface TaskDefinition<
  TInput,
  TContractInput,
  TContractOutput,
  TState,
  TDelta,
> {
  readonly role: ModuleRole;
  readonly inputSchema: Schema<TInput>;
  readonly contract: ContractRef;
  project(
    input: TInput,
    context: ExecutionReadContext<TState>,
  ): Promise<TContractInput> | TContractInput;
  interpret(
    output: TContractOutput,
    input: TInput,
    context: ExecutionReadContext<TState>,
  ): Promise<ModuleResult<TDelta>> | ModuleResult<TDelta>;
  projectState(
    input: StateProjectionInput<TDelta>,
    context: ExecutionReadContext<TState>,
  ): StateDelta<TDelta> | undefined;
}

// Generic erasure is intentionally confined to the runtime registry boundary.
export type AnyTaskDefinition<TState, TDelta> = TaskDefinition<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  TState,
  TDelta
>;

export type TaskMap<TState, TDelta> = Readonly<
  Record<string, AnyTaskDefinition<TState, TDelta>>
>;

export interface DomainModule<
  TState,
  TDelta,
  TTasks extends TaskMap<TState, TDelta>,
> {
  readonly namespace: Namespace;
  readonly stateSchemaVersion: string;
  readonly deltaSchemaVersion: string;
  readonly stateSchema: Schema<TState>;
  readonly deltaSchema: Schema<TDelta>;
  readonly tasks: TTasks;
  readonly memoryPolicy: DomainMemoryPolicy;
  initialState(context: {
    readonly entityId: EntityId;
    readonly now: IsoTimestamp;
  }): TState;
  reduce(state: TState, delta: TDelta): TState;
  invariants(next: TState, previous: TState | null): readonly DomainIssue[];
}

// This alias is the single intentional erased authoring boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDomainModule = DomainModule<any, any, TaskMap<any, any>>;

export type TaskName<M extends AnyDomainModule> = Extract<
  keyof M['tasks'],
  string
>;

export type TaskInput<M extends AnyDomainModule, K extends TaskName<M>> =
  M['tasks'][K] extends TaskDefinition<
    infer TInput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? TInput
    : never;

export type TaskContractOutput<
  M extends AnyDomainModule,
  K extends TaskName<M>,
> =
  M['tasks'][K] extends TaskDefinition<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    infer TContractOutput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? TContractOutput
    : never;

export interface ModuleRegistry {
  get(namespace: Namespace): AnyDomainModule;
  list(): readonly Namespace[];
}

export function defineTask<
  TInput,
  TContractInput,
  TContractOutput,
  TState,
  TDelta,
>(
  task: TaskDefinition<TInput, TContractInput, TContractOutput, TState, TDelta>,
): TaskDefinition<TInput, TContractInput, TContractOutput, TState, TDelta> {
  return task;
}

export function defineModule<
  TState,
  TDelta,
  const TTasks extends TaskMap<TState, TDelta>,
>(
  module: DomainModule<TState, TDelta, TTasks>,
): DomainModule<TState, TDelta, TTasks> {
  return module;
}
