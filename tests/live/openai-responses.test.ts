import { beforeAll, describe, expect, it } from 'vitest';

import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import {
  createOpenAiResponsesGateway,
  OpenAiResponseSchema,
  type ProviderTransport,
  type ProviderTransportRequest,
  type ProviderTransportResult,
} from '../../packages/adapter-model-openai/src/index.js';
import { createFetchTransport } from '../../packages/adapter-model-openai/src/transport-fetch.js';
import {
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  type IdGenerator,
} from '../../packages/core/src/index.js';
import {
  researchModule,
  researchObserveEvidenceContract,
} from '../../packages/module-research/src/index.js';

/**
 * ACME-0028. This is the only gate in the repository that reaches a network
 * and spends money. It is excluded from `vitest.config.ts`, so no default run
 * and no CI step can reach it, and it refuses to run without an explicit
 * opt-in rather than skipping quietly.
 */
const OPT_IN = process.env['ACME_LIVE_TEST'];
const API_KEY = process.env['OPENAI_API_KEY'];
const MODEL = process.env['ACME_LIVE_MODEL'] ?? 'gpt-5.6-terra';
const MAX_OUTPUT_TOKENS = Number(
  process.env['ACME_LIVE_MAX_OUTPUT_TOKENS'] ?? '512',
);

const selection = { profile: 'live-openai' };
const namespace = 'research';
const entityId = 'live-topic-1';
const requestKey = `live-${new Date().toISOString()}`;

/**
 * The charter was amended to `research.observe-evidence` after the first live
 * call: the Narrative output schema compiles a discriminated union to
 * `oneOf`, which OpenAI's strict structured-output subset rejects. The
 * Research contract emits no `oneOf`. See docs/backlog/.
 *
 * Small synthetic evidence written for this task. No personal data and no
 * repository content is sent, and the URI is never dereferenced.
 */
const input = {
  documentKey: 'live-evidence-1',
  source: {
    uri: 'https://alpha.example.org/reports/boiling?id=1',
    title: 'Alpha boiling-point report',
    retrievedAt: '2026-07-30T08:00:00.000Z',
    publisher: 'Alpha Institute Press',
    independence: {
      authority: 'Alpha Institute',
      basis: 'publisher' as const,
    },
  },
  text: 'Alpha measured that water boils at 100 °C at standard atmospheric pressure.',
};

/** Records what the provider actually returned so the fixtures can be judged. */
const observed: {
  status?: number;
  body?: string;
  result?: unknown;
  usage?: unknown;
} = {};

function recordingTransport(): ProviderTransport {
  const inner = createFetchTransport();
  return {
    async send(
      request: ProviderTransportRequest,
    ): Promise<ProviderTransportResult> {
      const result = await inner.send(request);
      if (result.kind === 'response') {
        observed.status = result.status;
        observed.body = result.body;
      }
      return result;
    },
  };
}

function createIds(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next(kind) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-live-${String(counts[kind]).padStart(3, '0')}`;
    },
  };
}

describe('live OpenAI Responses call', () => {
  beforeAll(() => {
    // A refusal, not a silent skip: running this gate without opt-in is a
    // mistake worth failing loudly.
    if (OPT_IN !== '1') {
      throw new Error(
        'The live gate requires ACME_LIVE_TEST=1. It makes a real, billed provider call.',
      );
    }
    if (API_KEY === undefined || API_KEY.trim().length === 0) {
      throw new Error(
        'The live gate requires OPENAI_API_KEY in the environment. It is never read from a file in the repository.',
      );
    }
    if (!Number.isSafeInteger(MAX_OUTPUT_TOKENS) || MAX_OUTPUT_TOKENS <= 0) {
      throw new Error(
        'The live gate requires a positive ACME_LIVE_MAX_OUTPUT_TOKENS budget.',
      );
    }
  });

  it('commits one real execution and reports what the provider returned', async () => {
    const ids = createIds();
    const repository = createInMemoryExecutionRepository({ ids });
    const gateway = createOpenAiResponsesGateway({
      transport: recordingTransport(),
      now: () => new Date().toISOString(),
      headers: () => ({ authorization: `Bearer ${String(API_KEY)}` }),
      profiles: [
        {
          selection,
          model: MODEL,
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
          },
        },
      ],
    });
    const engine = createExecutionEngine({
      clock: { now: () => new Date().toISOString() },
      ids,
      modules: createModuleRegistry([researchModule]),
      contracts: createContractRegistry([researchObserveEvidenceContract]),
      pipeline: createResponsePipeline(),
      gateway,
      memory: createMemoryEngine({ ids }),
      state: createStateEngine(),
      repository,
    });

    const executionId = deriveExecutionId(namespace, requestKey);
    let thrown: unknown;
    try {
      observed.result = await engine.execute({
        requestKey,
        namespace,
        task: 'observe-evidence',
        entityId,
        expectedRevision: 0,
        input,
        model: selection,
        // ADR-0014 mandates hash-only for live executions until encrypted
        // retention exists. The payload is deliberately not persisted.
        policy: { retention: 'hash-only', maxOutputTokens: MAX_OUTPUT_TOKENS },
      });
    } catch (error: unknown) {
      thrown = error;
    }

    // Everything below is evidence, printed whether or not the call succeeded.
    console.log(
      JSON.stringify(
        {
          model: MODEL,
          httpStatus: observed.status,
          result: observed.result,
          thrown:
            thrown === null || thrown === undefined
              ? undefined
              : String(thrown),
          rawBody: observed.body,
        },
        null,
        2,
      ),
    );

    expect(observed.status).toBeDefined();

    // The load-bearing question: does the real body satisfy the wire schema we
    // hand-wrote in ACME-0025?
    if (observed.status === 200 && observed.body !== undefined) {
      const parsed = OpenAiResponseSchema.safeParse(
        JSON.parse(observed.body) as unknown,
      );
      if (!parsed.success) {
        console.error(
          'The hand-written wire schema does not match reality:',
          JSON.stringify(parsed.error.issues, null, 2),
        );
      }
      expect(parsed.success).toBe(true);
    }

    const evidence = repository.snapshot();
    const call = evidence.modelCalls[0];
    expect(call).toBeDefined();

    if (observed.status === 200) {
      expect(observed.result).toMatchObject({ status: 'committed' });

      // hash-only must persist the hash and not the payload.
      expect(call?.responseHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(call?.response).toBeUndefined();
      expect(JSON.stringify(evidence)).not.toContain(String(API_KEY));

      // A live execution cannot be replayed while hash-only is mandated.
      const replay = await engine.replayVerify(executionId);
      expect(replay.status).toBe('unavailable');

      console.log('token usage:', JSON.stringify(call?.response ?? {}));
    }
  });
});
