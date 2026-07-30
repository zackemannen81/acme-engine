import { z } from 'zod';

import {
  defineModule,
  defineTask,
  type DomainIssue,
  type ExecutionReadContext,
  type MemoryCandidate,
  type MemoryRecord,
  type ModuleResult,
  type RankedMemory,
  type StateProjectionInput,
} from '../../packages/core/src/index.js';
import { domainModuleConformance } from '../../packages/testing/src/index.js';

function frozen<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    frozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

const timestamp = '2026-07-30T12:00:00.000Z';
const provenance = frozen({
  executionId: 'execution-conformance',
  contract: { id: 'fixture.observe', version: '1.0.0' },
  modelCallId: 'call-conformance',
  documentKeys: ['source'],
});

interface ProducerInput {
  readonly label: string;
}

interface ProducerContractInput {
  readonly prompt: string;
}

interface ProducerContractOutput {
  readonly value: string;
}

interface ProducerState {
  readonly count: number;
}

interface ProducerDelta {
  readonly increment: number;
}

const producerInputSchema = z.object({ label: z.string().min(1) }).strict();
const producerStateSchema = z.object({ count: z.number().int() }).strict();
const producerDeltaSchema = z.object({ increment: z.number().int() }).strict();

const producerCandidate: MemoryCandidate = frozen({
  key: 'memory-1',
  kind: 'fixture-fact',
  schemaVersion: 'fixture-memory/1',
  value: { label: 'alpha' },
  confidence: 0.8,
  source: provenance,
});

const producerResult: ModuleResult<ProducerDelta> = frozen({
  documents: [
    {
      key: 'document-1',
      kind: 'fixture-document',
      schemaVersion: 'fixture-document/1',
      value: { label: 'alpha' },
      contentHash: 'document-hash',
    },
  ],
  memories: [producerCandidate],
  stateIntent: {
    schemaVersion: 'fixture-delta/1',
    value: { increment: 1 },
  },
  events: [
    {
      key: 'event-1',
      type: 'fixture-observed',
      schemaVersion: 'fixture-event/1',
      payload: { label: 'alpha' },
    },
  ],
  diagnostics: [
    {
      code: 'FIXTURE_PRODUCED',
      severity: 'info',
      value: { count: 1 },
    },
  ],
});

const producerProjectionInput: StateProjectionInput<ProducerDelta> = frozen({
  stateIntent: {
    schemaVersion: 'fixture-delta/1',
    value: { increment: 1 },
  },
  memory: [
    {
      candidate: producerCandidate,
      identityKey: 'fixture:alpha',
      resolution: {
        candidateKey: producerCandidate.key,
        action: 'create',
        value: producerCandidate.value,
        strength: 0.8,
      },
      affectedMemoryIds: ['memory-record-1'],
    },
  ],
});

const producerRecord: MemoryRecord = frozen({
  memoryId: 'memory-record-existing',
  namespace: 'fixture-producer',
  entityId: 'entity-1',
  identityKey: 'fixture:existing',
  kind: 'fixture-fact',
  schemaVersion: 'fixture-memory/1',
  value: { label: 'existing' },
  strength: 0.5,
  status: 'active',
  firstSeenAt: timestamp,
  lastSeenAt: timestamp,
  lastReinforcedAt: timestamp,
  provenance: [provenance],
  recordVersion: 1,
});

const producerRanked: readonly RankedMemory[] = frozen([
  {
    record: producerRecord,
    score: 1,
    reasons: ['fixture-match'],
  },
]);

const producerTask = defineTask<
  ProducerInput,
  ProducerContractInput,
  ProducerContractOutput,
  ProducerState,
  ProducerDelta
>({
  role: 'producer',
  inputSchema: producerInputSchema,
  contract: { id: 'fixture.observe', version: '1.0.0' },
  project(input) {
    return frozen({ prompt: input.label });
  },
  interpret(output) {
    if (output.value !== 'alpha') {
      return frozen({
        documents: [],
        memories: [],
        events: [],
        diagnostics: [],
      });
    }
    return producerResult;
  },
  projectState(input) {
    const direct = input.stateIntent?.value.increment ?? 0;
    return frozen({
      schemaVersion: 'fixture-delta/1',
      value: { increment: direct + input.memory.length },
    });
  },
});

const producerModule = defineModule<
  ProducerState,
  ProducerDelta,
  { readonly observe: typeof producerTask }
>({
  namespace: 'fixture-producer',
  stateSchemaVersion: 'fixture-state/1',
  deltaSchemaVersion: 'fixture-delta/1',
  stateSchema: producerStateSchema,
  deltaSchema: producerDeltaSchema,
  tasks: { observe: producerTask },
  memoryPolicy: {
    validate() {
      return frozen([]);
    },
    identity(candidate) {
      const value = candidate.value as { readonly label: string };
      return `fixture:${value.label}`;
    },
    retrieve() {
      return producerRanked;
    },
    resolve(candidate) {
      return frozen({
        candidateKey: candidate.key,
        action: 'create',
        value: candidate.value,
        strength: candidate.confidence ?? 0,
      });
    },
    lifecycle() {
      return frozen({ action: 'retain' });
    },
  },
  initialState() {
    return frozen({ count: 0 });
  },
  reduce(state, delta) {
    return frozen({ count: state.count + delta.increment });
  },
  invariants() {
    return frozen([]);
  },
});

const producerContext: ExecutionReadContext<ProducerState> = frozen({
  executionId: 'execution-conformance',
  entityId: 'entity-1',
  now: timestamp,
  state: null,
  memories: [],
  documents: [],
});

domainModuleConformance('testing-owned producer fixture', {
  createSubject: () => ({
    module: producerModule,
    task: {
      taskName: 'observe',
      input: { label: 'alpha' },
      invalidInput: { label: '' },
      contractOutput: { value: 'alpha' },
      context: producerContext,
      expectedContractInput: { prompt: 'alpha' },
      expectedResult: producerResult,
      projectionInput: producerProjectionInput,
      expectedStateDelta: {
        schemaVersion: 'fixture-delta/1',
        value: { increment: 2 },
      },
    },
    state: {
      initialContext: { entityId: 'entity-1', now: timestamp },
      expectedInitialState: { count: 0 },
      state: { count: 2 },
      invalidState: { count: 1.5 },
      delta: { increment: 1 },
      invalidDelta: { increment: 1.5 },
      expectedReducedState: { count: 3 },
      previousState: { count: 2 },
      expectedInvariantIssues: [],
    },
    memory: {
      candidate: producerCandidate,
      expectedValidationIssues: [],
      expectedIdentityKey: 'fixture:alpha',
      existing: [producerRecord],
      query: {
        namespace: 'fixture-producer',
        entityId: 'entity-1',
        task: 'observe',
        limit: 5,
      },
      expectedRanked: producerRanked,
      now: timestamp,
      expectedResolution: {
        candidateKey: 'memory-1',
        action: 'create',
        value: { label: 'alpha' },
        strength: 0.8,
      },
      lifecycleRecord: producerRecord,
      lifecycleHook: 'execution-commit',
      expectedLifecycleDecision: { action: 'retain' },
    },
  }),
});

interface AnalyzerInput {
  readonly text: string;
}

interface AnalyzerContractInput {
  readonly text: string;
}

interface AnalyzerContractOutput {
  readonly accepted: boolean;
}

interface AnalyzerState {
  readonly inspected: number;
}

interface AnalyzerDelta {
  readonly inspected: number;
}

const analyzerInputSchema = z.object({ text: z.string().min(1) }).strict();
const analyzerStateSchema = z
  .object({ inspected: z.number().int().nonnegative() })
  .strict();
const analyzerDeltaSchema = z
  .object({ inspected: z.number().int().nonnegative() })
  .strict();
const emptyAnalyzerResult: ModuleResult<AnalyzerDelta> = frozen({
  documents: [],
  memories: [],
  events: [],
  diagnostics: [],
});
const analyzerIssue: DomainIssue = frozen({
  code: 'ANALYZER_FIXTURE',
  path: [],
  message: 'Testing-owned validation result.',
});
const analyzerCandidate: MemoryCandidate = frozen({
  key: 'analyzer-memory',
  kind: 'analyzer-fixture',
  schemaVersion: 'analyzer-memory/1',
  value: { text: 'inspect' },
  source: provenance,
});
const analyzerRecord: MemoryRecord = frozen({
  ...producerRecord,
  memoryId: 'analyzer-record',
  namespace: 'fixture-analyzer',
  identityKey: 'analyzer:analyzer-fixture',
  kind: 'analyzer-fixture',
  value: { text: 'inspect' },
});

const analyzerTask = defineTask<
  AnalyzerInput,
  AnalyzerContractInput,
  AnalyzerContractOutput,
  AnalyzerState,
  AnalyzerDelta
>({
  role: 'analyzer',
  inputSchema: analyzerInputSchema,
  contract: { id: 'fixture.inspect', version: '1.0.0' },
  project(input) {
    return frozen({ text: input.text });
  },
  interpret() {
    return emptyAnalyzerResult;
  },
  projectState() {
    return undefined;
  },
});

const analyzerModule = defineModule<
  AnalyzerState,
  AnalyzerDelta,
  { readonly inspect: typeof analyzerTask }
>({
  namespace: 'fixture-analyzer',
  stateSchemaVersion: 'analyzer-state/1',
  deltaSchemaVersion: 'analyzer-delta/1',
  stateSchema: analyzerStateSchema,
  deltaSchema: analyzerDeltaSchema,
  tasks: { inspect: analyzerTask },
  memoryPolicy: {
    validate() {
      return frozen([analyzerIssue]);
    },
    identity(candidate) {
      return `analyzer:${candidate.kind}`;
    },
    retrieve() {
      return frozen([]);
    },
    resolve(candidate) {
      return frozen({
        candidateKey: candidate.key,
        action: 'ignore',
        reason: 'analyzer fixture',
      });
    },
    lifecycle() {
      return frozen({ action: 'update-strength', strength: 0.25 });
    },
  },
  initialState() {
    return frozen({ inspected: 0 });
  },
  reduce(state, delta) {
    return frozen({ inspected: state.inspected + delta.inspected });
  },
  invariants() {
    return frozen([]);
  },
});

const analyzerContext: ExecutionReadContext<AnalyzerState> = frozen({
  executionId: 'execution-analyzer',
  entityId: 'entity-analyzer',
  now: timestamp,
  state: null,
  memories: [],
  documents: [],
});

domainModuleConformance('testing-owned empty analyzer fixture', {
  createSubject: () => ({
    module: analyzerModule,
    task: {
      taskName: 'inspect',
      input: { text: 'inspect' },
      invalidInput: { text: '' },
      contractOutput: { accepted: true },
      context: analyzerContext,
      expectedContractInput: { text: 'inspect' },
      expectedResult: emptyAnalyzerResult,
      projectionInput: { memory: [] },
      expectedStateDelta: undefined,
    },
    state: {
      initialContext: { entityId: 'entity-analyzer', now: timestamp },
      expectedInitialState: { inspected: 0 },
      state: { inspected: 2 },
      invalidState: { inspected: -1 },
      delta: { inspected: 1 },
      invalidDelta: { inspected: -1 },
      expectedReducedState: { inspected: 3 },
      previousState: { inspected: 2 },
      expectedInvariantIssues: [],
    },
    memory: {
      candidate: analyzerCandidate,
      expectedValidationIssues: [analyzerIssue],
      expectedIdentityKey: 'analyzer:analyzer-fixture',
      existing: [analyzerRecord],
      query: {
        namespace: 'fixture-analyzer',
        entityId: 'entity-analyzer',
        task: 'inspect',
        limit: 1,
      },
      expectedRanked: [],
      now: timestamp,
      expectedResolution: {
        candidateKey: 'analyzer-memory',
        action: 'ignore',
        reason: 'analyzer fixture',
      },
      lifecycleRecord: analyzerRecord,
      lifecycleHook: 'maintenance',
      expectedLifecycleDecision: {
        action: 'update-strength',
        strength: 0.25,
      },
    },
  }),
});
