import type { TaskContractOutput, TaskInput, TaskName } from '@acme/core';

import {
  narrativeModule,
  type NarrativeContractOutput,
  type NarrativeObserveInput,
} from '../src/index.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Condition extends true> = Condition;

export type NarrativeTaskNameProof = Assert<
  Equal<TaskName<typeof narrativeModule>, 'observe-document'>
>;

export type NarrativeTaskInputProof = Assert<
  Equal<
    TaskInput<typeof narrativeModule, 'observe-document'>,
    NarrativeObserveInput
  >
>;

export type NarrativeTaskOutputProof = Assert<
  Equal<
    TaskContractOutput<typeof narrativeModule, 'observe-document'>,
    NarrativeContractOutput
  >
>;

const valid: TaskInput<typeof narrativeModule, 'observe-document'> = {
  documentKey: 'chapter-1',
  text: 'Text.',
};
void valid;

// @ts-expect-error invalid task names fail at compile time
type InvalidNarrativeTask = TaskInput<typeof narrativeModule, 'missing'>;
void (0 as unknown as InvalidNarrativeTask);

// @ts-expect-error task input text is required
const invalid: TaskInput<typeof narrativeModule, 'observe-document'> = {
  documentKey: 'chapter-1',
};
void invalid;
