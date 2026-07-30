import {
  createModuleRegistry,
  type AnyDomainModule,
  type DomainIssue,
  type DomainModule,
  type ExecutionReadContext,
  type MemoryCandidate,
  type MemoryLifecycleDecision,
  type MemoryLifecycleHook,
  type MemoryQuery,
  type MemoryRecord,
  type MemoryResolution,
  type ModuleResult,
  type RankedMemory,
  type StateDelta,
  type StateProjectionInput,
  type TaskContractOutput,
  type TaskDefinition,
  type TaskInput,
  type TaskName,
} from '@acme/core';
import { describe, expect, it } from 'vitest';

type ModuleParts<M extends AnyDomainModule> =
  M extends DomainModule<infer TState, infer TDelta, infer TTasks>
    ? readonly [TState, TDelta, TTasks]
    : never;

type ModuleState<M extends AnyDomainModule> = ModuleParts<M>[0];

type ModuleDelta<M extends AnyDomainModule> = ModuleParts<M>[1];

type TaskParts<M extends AnyDomainModule, K extends TaskName<M>> =
  M['tasks'][K] extends TaskDefinition<
    infer TInput,
    infer TContractInput,
    infer TContractOutput,
    infer TState,
    infer TDelta
  >
    ? readonly [TInput, TContractInput, TContractOutput, TState, TDelta]
    : never;

type TaskContractInput<
  M extends AnyDomainModule,
  K extends TaskName<M>,
> = TaskParts<M, K>[1];

export interface DomainModuleTaskConformanceFixture<
  M extends AnyDomainModule,
  K extends TaskName<M>,
> {
  readonly taskName: K;
  readonly input: TaskInput<M, K>;
  readonly invalidInput: unknown;
  readonly contractOutput: TaskContractOutput<M, K>;
  readonly context: ExecutionReadContext<ModuleState<M>>;
  readonly expectedContractInput: TaskContractInput<M, K>;
  readonly expectedResult: ModuleResult<ModuleDelta<M>>;
  readonly projectionInput: StateProjectionInput<ModuleDelta<M>>;
  readonly expectedStateDelta: StateDelta<ModuleDelta<M>> | undefined;
}

export interface DomainModuleStateConformanceFixture<
  M extends AnyDomainModule,
> {
  readonly initialContext: {
    readonly entityId: string;
    readonly now: string;
  };
  readonly expectedInitialState: ModuleState<M>;
  readonly state: ModuleState<M>;
  readonly invalidState: unknown;
  readonly delta: ModuleDelta<M>;
  readonly invalidDelta: unknown;
  readonly expectedReducedState: ModuleState<M>;
  readonly previousState: ModuleState<M> | null;
  readonly expectedInvariantIssues: readonly DomainIssue[];
}

export interface DomainModuleMemoryConformanceFixture {
  readonly candidate: MemoryCandidate;
  readonly expectedValidationIssues: readonly DomainIssue[];
  readonly expectedIdentityKey: string;
  readonly existing: readonly MemoryRecord[];
  readonly query: MemoryQuery;
  readonly expectedRanked: readonly RankedMemory[];
  readonly now: string;
  readonly expectedResolution: MemoryResolution;
  readonly lifecycleRecord: MemoryRecord;
  readonly lifecycleHook: MemoryLifecycleHook;
  readonly expectedLifecycleDecision: MemoryLifecycleDecision;
}

export interface DomainModuleConformanceSubject<
  M extends AnyDomainModule,
  K extends TaskName<M>,
> {
  readonly module: M;
  readonly task: DomainModuleTaskConformanceFixture<M, K>;
  readonly state: DomainModuleStateConformanceFixture<M>;
  readonly memory: DomainModuleMemoryConformanceFixture;
}

export interface DomainModuleConformanceOptions<
  M extends AnyDomainModule,
  K extends TaskName<M>,
> {
  readonly createSubject: () => DomainModuleConformanceSubject<M, K>;
}

function deeplyFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }

  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deeplyFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

function immutableClone<T>(value: T): T {
  return deeplyFreeze(structuredClone(value));
}

function expectDeeplyFrozen(
  value: unknown,
  seen = new WeakSet<object>(),
): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }

  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    expectDeeplyFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

function expectDetached(actual: unknown, source: unknown): void {
  if (
    actual !== null &&
    typeof actual === 'object' &&
    source !== null &&
    typeof source === 'object'
  ) {
    expect(actual).not.toBe(source);
  }
}

function expectUniqueKeys(
  category: string,
  effects: readonly { readonly key: string }[],
): void {
  const keys = effects.map(({ key }) => key);
  for (const key of keys) {
    expect(key, `${category} key must be non-empty`).not.toBe('');
  }
  expect(new Set(keys).size, `${category} keys must be unique`).toBe(
    keys.length,
  );
}

function getTaskDefinition<M extends AnyDomainModule, K extends TaskName<M>>(
  module: M,
  taskName: K,
): M['tasks'][K] {
  const definition = module.tasks[taskName];
  if (definition === undefined) {
    throw new Error(`Conformance task is not registered: ${taskName}.`);
  }
  // Generic erasure is confined to DomainModule.tasks at the core registry
  // boundary; K restores the concrete task selected by the caller.
  return definition as M['tasks'][K];
}

export function domainModuleConformance<
  M extends AnyDomainModule,
  K extends TaskName<M>,
>(name: string, options: DomainModuleConformanceOptions<M, K>): void {
  describe(`DomainModule conformance: ${name}`, () => {
    it('registers stable non-empty module and task identities', () => {
      const { module, task } = options.createSubject();
      const taskNames = Object.keys(module.tasks);

      expect(module.namespace).not.toBe('');
      expect(module.stateSchemaVersion).not.toBe('');
      expect(module.deltaSchemaVersion).not.toBe('');
      expect(task.taskName).not.toBe('');
      expect(taskNames).toContain(task.taskName);
      expect(taskNames.every((taskName) => taskName.length > 0)).toBe(true);
      expect(module.tasks[task.taskName]?.contract.id).not.toBe('');
      expect(module.tasks[task.taskName]?.contract.version).not.toBe('');

      const registry = createModuleRegistry([module]);
      expect(registry.get(module.namespace)).toBe(module);
      expect(registry.list()).toEqual([module.namespace]);
      expectDeeplyFrozen(registry.list());
    });

    it('accepts valid schemas and rejects supplied invalid fixtures', () => {
      const { module, task, state } = options.createSubject();
      const definition = getTaskDefinition(module, task.taskName);

      expect(definition.inputSchema.safeParse(task.input).success).toBe(true);
      expect(definition.inputSchema.safeParse(task.invalidInput).success).toBe(
        false,
      );
      expect(module.stateSchema.safeParse(state.state).success).toBe(true);
      expect(module.stateSchema.safeParse(state.invalidState).success).toBe(
        false,
      );
      expect(module.deltaSchema.safeParse(state.delta).success).toBe(true);
      expect(module.deltaSchema.safeParse(state.invalidDelta).success).toBe(
        false,
      );
    });

    it('projects, interprets, and projects state deterministically and immutably', async () => {
      const { module, task } = options.createSubject();
      const definition = getTaskDefinition(module, task.taskName);

      const firstInput = immutableClone(task.input);
      const firstContext = immutableClone(task.context);
      const secondInput = immutableClone(task.input);
      const secondContext = immutableClone(task.context);
      const firstContractInput = await definition.project(
        firstInput,
        firstContext,
      );
      const secondContractInput = await definition.project(
        secondInput,
        secondContext,
      );

      expect(firstContractInput).toEqual(task.expectedContractInput);
      expect(secondContractInput).toEqual(firstContractInput);
      expectDetached(firstContractInput, firstInput);
      expectDeeplyFrozen(firstContractInput);
      expectDeeplyFrozen(secondContractInput);

      const firstOutput = immutableClone(task.contractOutput);
      const firstInterpretInput = immutableClone(task.input);
      const firstInterpretContext = immutableClone(task.context);
      const secondOutput = immutableClone(task.contractOutput);
      const secondInterpretInput = immutableClone(task.input);
      const secondInterpretContext = immutableClone(task.context);
      const firstResult = await definition.interpret(
        firstOutput,
        firstInterpretInput,
        firstInterpretContext,
      );
      const secondResult = await definition.interpret(
        secondOutput,
        secondInterpretInput,
        secondInterpretContext,
      );

      expect(firstResult).toEqual(task.expectedResult);
      expect(secondResult).toEqual(firstResult);
      expectDetached(firstResult, firstOutput);
      expectDetached(firstResult, firstInterpretInput);
      expectDeeplyFrozen(firstResult);
      expectDeeplyFrozen(secondResult);

      const firstProjectionInput = immutableClone(task.projectionInput);
      const firstProjectionContext = immutableClone(task.context);
      const secondProjectionInput = immutableClone(task.projectionInput);
      const secondProjectionContext = immutableClone(task.context);
      const firstDelta = definition.projectState(
        firstProjectionInput,
        firstProjectionContext,
      );
      const secondDelta = definition.projectState(
        secondProjectionInput,
        secondProjectionContext,
      );

      expect(firstDelta).toEqual(task.expectedStateDelta);
      expect(secondDelta).toEqual(firstDelta);
      expectDetached(firstDelta, firstProjectionInput);
      expectDeeplyFrozen(firstDelta);
      expectDeeplyFrozen(secondDelta);
    });

    it('initializes, reduces, and checks invariants without mutation', () => {
      const { module, state } = options.createSubject();
      const firstInitialContext = immutableClone(state.initialContext);
      const secondInitialContext = immutableClone(state.initialContext);
      const firstInitial = module.initialState(firstInitialContext);
      const secondInitial = module.initialState(secondInitialContext);

      expect(firstInitial).toEqual(state.expectedInitialState);
      expect(secondInitial).toEqual(firstInitial);
      expectDetached(firstInitial, firstInitialContext);
      expectDeeplyFrozen(firstInitial);
      expectDeeplyFrozen(secondInitial);

      const firstState = immutableClone(state.state);
      const firstDelta = immutableClone(state.delta);
      const secondState = immutableClone(state.state);
      const secondDelta = immutableClone(state.delta);
      const firstReduced = module.reduce(firstState, firstDelta);
      const secondReduced = module.reduce(secondState, secondDelta);

      expect(firstReduced).toEqual(state.expectedReducedState);
      expect(secondReduced).toEqual(firstReduced);
      expectDetached(firstReduced, firstState);
      expectDetached(firstReduced, firstDelta);
      expectDeeplyFrozen(firstReduced);
      expectDeeplyFrozen(secondReduced);

      const firstNext = immutableClone(state.expectedReducedState);
      const firstPrevious = immutableClone(state.previousState);
      const secondNext = immutableClone(state.expectedReducedState);
      const secondPrevious = immutableClone(state.previousState);
      const firstIssues = module.invariants(firstNext, firstPrevious);
      const secondIssues = module.invariants(secondNext, secondPrevious);

      expect(firstIssues).toEqual(state.expectedInvariantIssues);
      expect(secondIssues).toEqual(firstIssues);
      expectDetached(firstIssues, firstNext);
      expectDeeplyFrozen(firstIssues);
      expectDeeplyFrozen(secondIssues);
    });

    it('returns non-empty unique effect keys or an explicit empty result', async () => {
      const { module, task } = options.createSubject();
      const definition = getTaskDefinition(module, task.taskName);
      const result = await definition.interpret(
        immutableClone(task.contractOutput),
        immutableClone(task.input),
        immutableClone(task.context),
      );

      expectUniqueKeys('document', result.documents);
      expectUniqueKeys('memory candidate', result.memories);
      expectUniqueKeys('event', result.events);
    });

    it('executes memory policy fixtures deterministically without mutating inputs', () => {
      const { module, memory } = options.createSubject();
      const policy = module.memoryPolicy;

      const firstCandidate = immutableClone(memory.candidate);
      const secondCandidate = immutableClone(memory.candidate);
      const firstValidation = policy.validate(firstCandidate);
      const secondValidation = policy.validate(secondCandidate);
      expect(firstValidation).toEqual(memory.expectedValidationIssues);
      expect(secondValidation).toEqual(firstValidation);

      const firstIdentity = policy.identity(immutableClone(memory.candidate));
      const secondIdentity = policy.identity(immutableClone(memory.candidate));
      expect(firstIdentity).toBe(memory.expectedIdentityKey);
      expect(secondIdentity).toBe(firstIdentity);
      expect(firstIdentity).not.toBe('');

      const firstRanked = policy.retrieve(
        immutableClone(memory.query),
        immutableClone(memory.existing),
      );
      const secondRanked = policy.retrieve(
        immutableClone(memory.query),
        immutableClone(memory.existing),
      );
      expect(firstRanked).toEqual(memory.expectedRanked);
      expect(secondRanked).toEqual(firstRanked);

      const firstResolution = policy.resolve(
        immutableClone(memory.candidate),
        immutableClone(memory.existing),
        immutableClone({ now: memory.now }),
      );
      const secondResolution = policy.resolve(
        immutableClone(memory.candidate),
        immutableClone(memory.existing),
        immutableClone({ now: memory.now }),
      );
      expect(firstResolution).toEqual(memory.expectedResolution);
      expect(secondResolution).toEqual(firstResolution);
      expect(firstResolution.candidateKey).toBe(memory.candidate.key);

      const firstLifecycle = policy.lifecycle(
        immutableClone(memory.lifecycleRecord),
        memory.lifecycleHook,
        immutableClone({ now: memory.now }),
      );
      const secondLifecycle = policy.lifecycle(
        immutableClone(memory.lifecycleRecord),
        memory.lifecycleHook,
        immutableClone({ now: memory.now }),
      );
      expect(firstLifecycle).toEqual(memory.expectedLifecycleDecision);
      expect(secondLifecycle).toEqual(firstLifecycle);
    });
  });
}
