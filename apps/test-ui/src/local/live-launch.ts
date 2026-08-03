import {
  resolveExecutionPolicy,
  type Clock,
  type ExecutionRequest,
  type IdGenerator,
  type PayloadEncryptor,
} from '@acme/core';
import {
  createOpenAiResponsesGateway,
  type ProviderTransport,
} from '@acme/adapter-model-openai';
import { createFetchTransport } from '@acme/adapter-model-openai/transport-fetch';

import {
  assertWithinBudget,
  isLiveOptInEnv,
  LIVE_GATE_REFUSAL,
  LiveGateRefused,
  requireLiveGate,
  type LiveEvaluationConfirmation,
} from '../live-gate.js';
import {
  RUN_RECORD_VERSION,
  isSafeRunId,
  type LiveRunMetadata,
  type RunRecord,
} from '../run-record.js';
import {
  createInterfaceComposition,
  type InterfaceComposition,
} from './composition.js';
import type { Workspace } from './workspace.js';

/**
 * Gated live launch (ADR-0023).
 *
 * Two keys: process opt-in and a validated confirmation. Credentials come
 * only from the environment (or a test injection), never from the
 * confirmation document.
 */

export interface LiveLaunchOptions {
  readonly confirmation: unknown;
  readonly request: ExecutionRequest;
  readonly workspace: Workspace;
  readonly runId: string;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly repository: 'memory' | 'sqlite';
  readonly database?: string;
  readonly payloadEncryptor?: PayloadEncryptor;
  /**
   * When set, overrides `ACME_TEST_UI_LIVE`. Production callers omit this and
   * let the function read the environment.
   */
  readonly liveOptIn?: boolean;
  /**
   * Test injection. Production never sets this; default is fetch transport.
   */
  readonly openAiTransport?: ProviderTransport;
  /**
   * Test injection of the API key. Production reads `OPENAI_API_KEY`.
   */
  readonly apiKey?: string;
}

export interface LiveLaunchResult {
  readonly record: RunRecord;
  readonly confirmation: LiveEvaluationConfirmation;
  readonly composition: InterfaceComposition;
  readonly executionId: string;
}

function resolveLiveOptIn(override: boolean | undefined): boolean {
  if (override !== undefined) {
    return override;
  }
  return isLiveOptInEnv(process.env['ACME_TEST_UI_LIVE']);
}

function resolveApiKey(override: string | undefined): string {
  const key = override ?? process.env['OPENAI_API_KEY'];
  if (key === undefined || key.trim().length === 0) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.apiKey,
      'Live evaluation requires OPENAI_API_KEY in the environment.',
    );
  }
  return key.trim();
}

/**
 * Confirm, execute one request against OpenAI Responses, record a live run.
 */
export async function launchLiveExecution(
  options: LiveLaunchOptions,
): Promise<LiveLaunchResult> {
  if (!isSafeRunId(options.runId)) {
    throw new Error(
      `A run identifier must be a safe file name: ${JSON.stringify(options.runId)}`,
    );
  }

  const confirmation = requireLiveGate({
    liveOptIn: resolveLiveOptIn(options.liveOptIn),
    confirmation: options.confirmation,
  });
  const effectivePolicy = resolveExecutionPolicy(options.request.policy);
  assertWithinBudget(confirmation, effectivePolicy.maxModelCalls);

  const selection = options.request.model;
  const apiKey = resolveApiKey(options.apiKey);
  const transport = options.openAiTransport ?? createFetchTransport();
  const gateway = createOpenAiResponsesGateway({
    transport,
    now: () => options.clock.now(),
    headers: () => ({ authorization: `Bearer ${apiKey}` }),
    profiles: [
      {
        selection,
        model: confirmation.model,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
        },
      },
    ],
  });

  const composition = createInterfaceComposition({
    repository: options.repository,
    ...(options.database === undefined ? {} : { database: options.database }),
    clock: options.clock,
    ids: options.ids,
    ...(options.payloadEncryptor === undefined
      ? {}
      : { payloadEncryptor: options.payloadEncryptor }),
  });

  const startedAt = options.clock.now();
  const engine = composition.engine(gateway);
  const request: ExecutionRequest = {
    ...options.request,
    policy: effectivePolicy,
  };

  let executionId = '';
  let status: 'passed' | 'failed';
  let failure: RunRecord['failure'] = null;
  let liveMeta: LiveRunMetadata = {
    provider: confirmation.provider,
    model: confirmation.model,
    confirmer: confirmation.confirmer,
    maxModelCalls: confirmation.maxModelCalls,
    costCeilingMinor: confirmation.costCeilingMinor,
  };

  try {
    const result = await engine.execute(request);
    executionId = result.executionId;
    if (result.status === 'committed') {
      status = 'passed';
    } else {
      status = 'failed';
      failure = {
        stepIndex: 0,
        message: result.error.message,
      };
    }

    const evidence = composition.repository.snapshot();
    const modelCall = evidence.modelCalls.find(
      (entry) => entry.executionId === executionId,
    );
    const usage = modelCall?.response?.usage;
    if (usage !== undefined) {
      liveMeta = {
        ...liveMeta,
        usage: {
          ...(usage.inputTokens === undefined
            ? {}
            : { inputTokens: usage.inputTokens }),
          ...(usage.outputTokens === undefined
            ? {}
            : { outputTokens: usage.outputTokens }),
          ...(usage.totalTokens === undefined
            ? {}
            : { totalTokens: usage.totalTokens }),
          ...(usage.estimatedCostMinor === undefined
            ? {}
            : { estimatedCostMinor: usage.estimatedCostMinor }),
          ...(usage.currency === undefined ? {} : { currency: usage.currency }),
        },
      };
    }
  } catch (error: unknown) {
    status = 'failed';
    failure = {
      stepIndex: 0,
      message:
        error instanceof Error ? error.message : 'Live execution failed.',
    };
  }

  const finishedAt = options.clock.now();
  const record: RunRecord = {
    version: RUN_RECORD_VERSION,
    runId: options.runId,
    planName: 'live-evaluation',
    scenarioName: 'live-evaluation',
    startedAt,
    finishedAt,
    composition: {
      repository: options.repository,
      gateway: confirmation.provider,
    },
    status,
    steps: [{ index: 0, kind: 'execute', status }],
    cases: executionId.length > 0 ? [{ alias: 'live', executionId }] : [],
    failure,
    live: liveMeta,
  };

  await options.workspace.recordRun(record);

  return {
    record,
    confirmation,
    composition,
    executionId,
  };
}
