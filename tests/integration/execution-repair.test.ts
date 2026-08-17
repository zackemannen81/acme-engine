import {
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  type ExecutionRequest,
  type IdGenerator,
  type ModelGateway,
  type ContractRepairContext,
  type ModelRequest,
  type NormalizedModelResponse,
  type PromptContract,
} from '../../packages/core/src/index.js';
import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import { describe, expect, it, vi } from 'vitest';

import {
  neutralContract,
  neutralInput,
  neutralModule,
  neutralNow,
  neutralResponse,
  neutralSelection,
} from '../fixtures/neutral-execution.js';
import { processLossAt } from '../fixtures/process-loss.js';

type NeutralContract = typeof neutralContract;

function ids(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next: vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
      if (kind === 'execution') throw new Error('Execution IDs are derived.');
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-${String(counts[kind])}`;
    }),
  };
}

/** The neutral contract plus an optional contract-owned repair request. */
function repairableContract(options: { readonly offersRepair: boolean }) {
  const base = neutralContract as unknown as PromptContract<unknown, unknown>;
  const contract: PromptContract<unknown, unknown> = {
    ...base,
    buildRequest: (input, context) => base.buildRequest(input, context),
    validateSemantics: (output, input) => base.validateSemantics(output, input),
  };
  if (!options.offersRepair) return contract as unknown as NeutralContract;
  return {
    ...contract,
    buildRepairRequest(
      input: unknown,
      context: ContractRepairContext,
    ): ModelRequest {
      const request = base.buildRequest(input, context);
      return {
        ...request,
        messages: [
          ...request.messages,
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `repair ${String(context.attempt)} ${JSON.stringify(
                  context.issues.map((issue) => issue.code),
                )}`,
              },
            ],
          },
        ],
      };
    },
  } as unknown as NeutralContract;
}

/**
 * Returns an invalid response for the primary call and, from `validFrom`
 * onward, a valid one. Records every call key it was asked for.
 */
function gatewayThatRepairs(options: { readonly validFrom: number }): {
  readonly gateway: ModelGateway;
  readonly callKeys: string[];
} {
  const callKeys: string[] = [];
  let calls = 0;
  const gateway: ModelGateway = {
    async capabilities() {
      return { structuredOutput: true, tools: false, vision: false };
    },
    async generate(_request, context): Promise<NormalizedModelResponse> {
      calls += 1;
      callKeys.push(context.callKey);
      return {
        ...neutralResponse,
        // `fact` must be a non-empty string; an empty one fails the schema
        // stage, which the pipeline classifies as repairable.
        text: JSON.stringify({ fact: calls >= options.validFrom ? 'ok' : '' }),
      };
    },
  };
  return { gateway, callKeys };
}

function engineWith(options: {
  readonly gateway: ModelGateway;
  readonly offersRepair: boolean;
}) {
  const id = ids();
  const repository = createInMemoryExecutionRepository({
    ids: id,
    payloadEncryptor: createTestPayloadEncryptor(),
  });
  const engine = createExecutionEngine({
    clock: { now: () => neutralNow },
    ids: id,
    modules: createModuleRegistry([neutralModule]),
    contracts: createContractRegistry([
      repairableContract({ offersRepair: options.offersRepair }),
    ]),
    pipeline: createResponsePipeline(),
    gateway: options.gateway,
    memory: createMemoryEngine({ ids: id }),
    state: createStateEngine(),
    repository,
  });
  return { engine, repository };
}

function request(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    requestKey: 'repair-request-1',
    namespace: 'neutral',
    task: 'observe',
    entityId: 'neutral-entity-1',
    expectedRevision: 0,
    input: neutralInput,
    model: neutralSelection,
    policy: { retention: 'encrypted-payload' },
    ...overrides,
  };
}

describe('bounded repair call (ACME-0135)', () => {
  it('repairs a recoverably invalid response within budget and commits', async () => {
    const { gateway, callKeys } = gatewayThatRepairs({ validFrom: 2 });
    const { engine, repository } = engineWith({
      gateway,
      offersRepair: true,
    });

    const result = await engine.execute(
      request({
        policy: { retention: 'encrypted-payload', maxRepairCalls: 1 },
      }),
    );

    expect(result.status).toBe('committed');
    // The repair is its own call, under its own key, not a retry of model:0.
    expect(callKeys).toEqual(['model:0', 'repair:1']);
    const snapshot = repository.snapshot();
    expect(snapshot.modelCalls).toHaveLength(2);
    expect(snapshot.modelCalls.map((call) => call.purpose)).toEqual([
      'primary',
      'repair',
    ]);
    expect(
      snapshot.modelCalls.every((call) => call.status === 'succeeded'),
    ).toBe(true);
  });

  it('fails with the original error when the repair budget is exhausted', async () => {
    const { gateway, callKeys } = gatewayThatRepairs({ validFrom: 99 });
    const { engine, repository } = engineWith({
      gateway,
      offersRepair: true,
    });

    const result = await engine.execute(
      request({
        policy: { retention: 'encrypted-payload', maxRepairCalls: 1 },
      }),
    );

    expect(result.status).not.toBe('committed');
    // Bounded: exactly one repair, then the same refusal as before.
    expect(callKeys).toEqual(['model:0', 'repair:1']);
    expect(repository.snapshot().modelCalls).toHaveLength(2);
  });

  it('spends no repair call when the contract offers no repair request', async () => {
    const { gateway, callKeys } = gatewayThatRepairs({ validFrom: 2 });
    const { engine } = engineWith({ gateway, offersRepair: false });

    const result = await engine.execute(
      request({
        policy: { retention: 'encrypted-payload', maxRepairCalls: 1 },
      }),
    );

    expect(result.status).not.toBe('committed');
    expect(callKeys).toEqual(['model:0']);
  });

  it('spends no repair call when the budget is zero', async () => {
    const { gateway, callKeys } = gatewayThatRepairs({ validFrom: 2 });
    const { engine } = engineWith({ gateway, offersRepair: true });

    const result = await engine.execute(
      request({
        policy: { retention: 'encrypted-payload', maxRepairCalls: 0 },
      }),
    );

    expect(result.status).not.toBe('committed');
    expect(callKeys).toEqual(['model:0']);
  });

  it('spends no repair call when the pipeline classifies the failure non-repairable', async () => {
    const { gateway, callKeys } = gatewayThatRepairs({ validFrom: 2 });
    const id = ids();
    const repository = createInMemoryExecutionRepository({
      ids: id,
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    const engine = createExecutionEngine({
      clock: { now: () => neutralNow },
      ids: id,
      modules: createModuleRegistry([neutralModule]),
      contracts: createContractRegistry([
        repairableContract({ offersRepair: true }),
      ]),
      pipeline: {
        process() {
          return {
            ok: false,
            stage: 'semantic',
            issues: [
              {
                code: 'NON_REPAIRABLE_FIXTURE',
                path: [],
                message: 'Fixture non-repairable failure.',
                severity: 'error',
              },
            ],
            repairable: false,
          };
        },
      },
      gateway,
      memory: createMemoryEngine({ ids: id }),
      state: createStateEngine(),
      repository,
    });

    const result = await engine.execute(
      request({
        policy: { retention: 'encrypted-payload', maxRepairCalls: 1 },
      }),
    );

    expect(result.status).not.toBe('committed');
    expect(callKeys).toEqual(['model:0']);
  });

  it('makes no provider call when resuming from a recorded primary response', async () => {
    const { gateway, callKeys } = gatewayThatRepairs({ validFrom: 1 });
    const id = ids();
    const repository = createInMemoryExecutionRepository({
      ids: id,
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    const lost = processLossAt(repository, 'commit');
    const interrupted = createExecutionEngine({
      clock: { now: () => neutralNow },
      ids: id,
      modules: createModuleRegistry([neutralModule]),
      contracts: createContractRegistry([
        repairableContract({ offersRepair: true }),
      ]),
      pipeline: createResponsePipeline(),
      gateway,
      memory: createMemoryEngine({ ids: id }),
      state: createStateEngine(),
      repository: lost,
    });

    await expect(
      interrupted.execute(
        request({
          policy: { retention: 'encrypted-payload', maxRepairCalls: 1 },
        }),
      ),
    ).rejects.toThrow('Simulated process loss.');
    expect(callKeys).toEqual(['model:0']);

    let resumeCalls = 0;
    const resumeGateway: ModelGateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        resumeCalls += 1;
        throw new Error('Resume must not contact the provider.');
      },
    };
    const resumed = createExecutionEngine({
      clock: { now: () => neutralNow },
      ids: ids(),
      modules: createModuleRegistry([neutralModule]),
      contracts: createContractRegistry([
        repairableContract({ offersRepair: true }),
      ]),
      pipeline: createResponsePipeline(),
      gateway: resumeGateway,
      memory: createMemoryEngine({ ids: ids() }),
      state: createStateEngine(),
      repository,
    });
    const result = await resumed.execute(
      request({
        policy: { retention: 'encrypted-payload', maxRepairCalls: 1 },
      }),
    );
    expect(result.status).toBe('committed');
    expect(resumeCalls).toBe(0);
    expect(callKeys).toEqual(['model:0']);
  });

  it('derives the same execution identity regardless of repair', async () => {
    const executionId = deriveExecutionId('neutral', 'repair-request-1');
    const { gateway } = gatewayThatRepairs({ validFrom: 2 });
    const { engine, repository } = engineWith({
      gateway,
      offersRepair: true,
    });
    await engine.execute(
      request({
        policy: { retention: 'encrypted-payload', maxRepairCalls: 1 },
      }),
    );
    expect(repository.snapshot().executions[0]?.executionId).toBe(executionId);
  });
});
