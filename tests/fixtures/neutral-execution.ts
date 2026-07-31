import { z } from 'zod';

import {
  canonicalJson,
  defineModule,
  defineTask,
  sha256,
  type DomainMemoryPolicy,
  type JsonValue,
  type ModelRequest,
  type PromptContract,
} from '../../packages/core/src/index.js';

export const neutralNow = '2026-07-31T10:00:00.000Z';
export const neutralResponseNow = '2026-07-31T10:00:01.000Z';
export const neutralSelection = Object.freeze({
  profile: 'neutral-offline',
  providerHint: 'fixture',
  modelHint: 'fixture-json-1',
});
export const neutralInput = Object.freeze({
  documentKey: 'neutral-document-1',
  text: 'Alpha is stable.',
});
export const neutralOutput = Object.freeze({ fact: 'alpha' });

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

const inputSchema = z
  .object({
    documentKey: z.string().min(1),
    text: z.string().min(1),
  })
  .strict();
const outputSchema = z.object({ fact: z.string().min(1) }).strict();
const stateSchema = z
  .object({ count: z.number().int().nonnegative() })
  .strict();
const deltaSchema = z
  .object({ increment: z.number().int().positive() })
  .strict();

type NeutralInput = z.infer<typeof inputSchema>;
type NeutralOutput = z.infer<typeof outputSchema>;
type NeutralState = z.infer<typeof stateSchema>;
type NeutralDelta = z.infer<typeof deltaSchema>;

export const neutralContract: PromptContract<NeutralInput, NeutralOutput> =
  frozen({
    ref: { id: 'neutral.observe', version: '1.0.0' },
    inputSchema,
    outputSchema,
    requiredCapabilities: { structuredOutput: true },
    retention: 'hash-only',
    buildRequest(input, context) {
      return frozen({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: canonicalJson({
                  input,
                  executionId: context.executionId,
                  now: context.now,
                }),
              },
            ],
          },
        ],
        output: {
          mode: 'json',
          schemaName: 'neutral_observe_1',
          jsonSchema: z.toJSONSchema(outputSchema) as JsonValue,
        },
        temperature: 0,
      } satisfies ModelRequest);
    },
    validateSemantics() {
      return frozen([]);
    },
  });

const neutralTask = defineTask<
  NeutralInput,
  NeutralInput,
  NeutralOutput,
  NeutralState,
  NeutralDelta
>({
  role: 'producer',
  inputSchema,
  contract: neutralContract.ref,
  project(input) {
    return frozen(input);
  },
  interpret(output, input, context) {
    const documentValue = { text: input.text };
    return frozen({
      documents: [
        {
          key: input.documentKey,
          kind: 'neutral.source',
          schemaVersion: 'neutral-source/1',
          value: documentValue,
          contentHash: sha256(canonicalJson(documentValue)),
        },
      ],
      memories: [
        {
          key: 'neutral-memory-1',
          kind: 'neutral.fact',
          schemaVersion: 'neutral-memory/1',
          value: { fact: output.fact },
          confidence: 0.8,
          source: {
            executionId: context.executionId,
            contract: neutralContract.ref,
            documentKeys: [input.documentKey],
          },
        },
      ],
      stateIntent: {
        schemaVersion: 'neutral-delta/1',
        value: { increment: 1 },
      },
      events: [],
      diagnostics: [],
    });
  },
  projectState(input) {
    return input.stateIntent;
  },
});

const neutralMemoryPolicy: DomainMemoryPolicy = {
  validate() {
    return frozen([]);
  },
  identity(candidate) {
    return `neutral:${(candidate.value as { readonly fact: string }).fact}`;
  },
  retrieve(_query, records) {
    return frozen(
      records.map((record) => ({
        record,
        score: record.strength,
        reasons: ['neutral-strength'],
      })),
    );
  },
  resolve(candidate, existing) {
    const identity = `neutral:${
      (candidate.value as { readonly fact: string }).fact
    }`;
    const match = existing.find(
      (record) =>
        record.identityKey === identity &&
        (record.status === 'active' || record.status === 'contested'),
    );
    if (match !== undefined) {
      return frozen({
        candidateKey: candidate.key,
        action: 'reinforce' as const,
        memoryId: match.memoryId,
        strength: Math.min(1, match.strength + 0.1),
      });
    }
    return frozen({
      candidateKey: candidate.key,
      action: 'create' as const,
      value: candidate.value,
      strength: candidate.confidence ?? 0.5,
    });
  },
  lifecycle() {
    return frozen({ action: 'retain' as const });
  },
};
Object.freeze(neutralMemoryPolicy);

export const neutralModule = defineModule<
  NeutralState,
  NeutralDelta,
  { readonly observe: typeof neutralTask }
>({
  namespace: 'neutral',
  stateSchemaVersion: 'neutral-state/1',
  deltaSchemaVersion: 'neutral-delta/1',
  stateSchema,
  deltaSchema,
  tasks: Object.freeze({ observe: neutralTask }),
  memoryPolicy: neutralMemoryPolicy,
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

export const neutralResponse = frozen({
  provider: 'fixture',
  model: 'fixture-json-1',
  receivedAt: neutralResponseNow,
  finishReason: 'stop' as const,
  text: JSON.stringify(neutralOutput),
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
  },
  metadata: {},
});
