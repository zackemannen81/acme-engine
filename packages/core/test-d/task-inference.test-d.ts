import type {
  DomainModule,
  TaskContractOutput,
  TaskDefinition,
  TaskInput,
  TaskName,
} from '../src/index.js';

interface FixtureState {
  readonly total: number;
}

interface FixtureDelta {
  readonly amount: number;
}

interface FixtureInput {
  readonly amount: number;
}

interface FixtureContractInput {
  readonly current: number;
  readonly amount: number;
}

interface FixtureContractOutput {
  readonly accepted: boolean;
}

type FixtureTasks = {
  readonly adjust: TaskDefinition<
    FixtureInput,
    FixtureContractInput,
    FixtureContractOutput,
    FixtureState,
    FixtureDelta
  >;
};

type FixtureModule = DomainModule<FixtureState, FixtureDelta, FixtureTasks>;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Assert<Condition extends true> = Condition;

export type TaskNameProof = Assert<Equal<TaskName<FixtureModule>, 'adjust'>>;

export type TaskInputProof = Assert<
  Equal<TaskInput<FixtureModule, 'adjust'>, FixtureInput>
>;

export type TaskOutputProof = Assert<
  Equal<TaskContractOutput<FixtureModule, 'adjust'>, FixtureContractOutput>
>;

// @ts-expect-error "missing" is not a registered task name.
export type InvalidTaskNameProof = TaskInput<FixtureModule, 'missing'>;
