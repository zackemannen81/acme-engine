import type { TaskContractOutput, TaskInput, TaskName } from '@acme/core';

import {
  researchModule,
  type ResearchContractOutput,
  type ResearchEvidenceInput,
} from '../src/index.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Condition extends true> = Condition;

export type ResearchTaskNameProof = Assert<
  Equal<TaskName<typeof researchModule>, 'observe-evidence'>
>;

export type ResearchTaskInputProof = Assert<
  Equal<
    TaskInput<typeof researchModule, 'observe-evidence'>,
    ResearchEvidenceInput
  >
>;

export type ResearchTaskOutputProof = Assert<
  Equal<
    TaskContractOutput<typeof researchModule, 'observe-evidence'>,
    ResearchContractOutput
  >
>;

const valid: TaskInput<typeof researchModule, 'observe-evidence'> = {
  documentKey: 'research-document-a',
  source: {
    uri: 'https://example.org/a',
    retrievedAt: '2026-07-30T08:00:00.000Z',
    independence: { authority: 'Example', basis: 'publisher' },
  },
  text: 'Evidence text.',
};
void valid;

// @ts-expect-error invalid task names fail at compile time
type InvalidResearchTask = TaskInput<typeof researchModule, 'missing'>;
void (0 as unknown as InvalidResearchTask);

const invalid: TaskInput<typeof researchModule, 'observe-evidence'> = {
  documentKey: 'research-document-a',
  // @ts-expect-error the declared independence assertion is required
  source: {
    uri: 'https://example.org/a',
    retrievedAt: '2026-07-30T08:00:00.000Z',
  },
  text: 'Evidence text.',
};
void invalid;

// @ts-expect-error evidence text is required
const missingText: TaskInput<typeof researchModule, 'observe-evidence'> = {
  documentKey: 'research-document-a',
  source: {
    uri: 'https://example.org/a',
    retrievedAt: '2026-07-30T08:00:00.000Z',
    independence: { authority: 'Example', basis: 'publisher' },
  },
};
void missingText;
