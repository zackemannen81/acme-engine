import {
  type DomainModule,
  type TaskDefinition,
  type TaskInput,
} from '@acme/core';

import {
  domainModuleConformance,
  type DomainModuleConformanceSubject,
} from '../src/index.js';

interface TypedInput {
  readonly value: string;
}

interface TypedState {
  readonly count: number;
}

interface TypedDelta {
  readonly increment: number;
}

type TypedTask = TaskDefinition<
  TypedInput,
  { readonly prompt: string },
  { readonly accepted: boolean },
  TypedState,
  TypedDelta
>;

declare const typedModule: DomainModule<
  TypedState,
  TypedDelta,
  { readonly observe: TypedTask }
>;
declare const typedSubject: DomainModuleConformanceSubject<
  typeof typedModule,
  'observe'
>;
void typedModule;

domainModuleConformance('typed fixture', {
  createSubject: () => typedSubject,
});

const validInput: TaskInput<typeof typedModule, 'observe'> = {
  value: 'valid',
};
void validInput;

// @ts-expect-error task input remains task-specific
const invalidInput: TaskInput<typeof typedModule, 'observe'> = { value: 1 };
void invalidInput;

type InvalidSubject = DomainModuleConformanceSubject<
  typeof typedModule,
  // @ts-expect-error invalid task names cannot instantiate the conformance kit
  'missing'
>;
void (0 as unknown as InvalidSubject);
