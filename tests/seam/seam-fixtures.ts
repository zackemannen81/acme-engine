/**
 * Fixtures for the seam translation experiment: a well-formed
 * `aal-acme-adapter/2` request aimed at the neutral module, and a real engine
 * assembled the way `apps/cli/src/composition.ts` assembles one, with the
 * deterministic scripted gateway standing in for a provider.
 */
import {
  computeModelRequestHash,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  sha256,
  type AcmeErrorData,
  type ExecutionEngine,
  type IdGenerator,
  type ModelSelection,
} from '../../packages/core/src/index.js';
import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import {
  createScriptedModelGateway,
  type ScriptedModelCall,
  type ScriptedModelGateway,
} from '../../packages/adapter-model-mock/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';

import {
  neutralContract,
  neutralInput,
  neutralModule,
  neutralNow,
  neutralResponse,
  neutralSelection,
} from '../fixtures/neutral-execution.js';
import {
  ACME_ADAPTER_CONTRACT_VERSION,
  type AcmeAdapterRequest,
} from './aal-acme-adapter-2.js';
import type { SeamGapCode } from './seam-gaps.js';

/**
 * A second, equally valid model selection. Nothing in `aal-acme-adapter/2`
 * can distinguish a request routed to this one from a request routed to
 * `neutralSelection`.
 */
export const alternateSelection: ModelSelection = Object.freeze({
  profile: 'neutral-offline-alternate',
  providerHint: 'fixture',
  modelHint: 'fixture-json-1',
});

export interface SeamRequestOverrides {
  readonly contractVersion?: string;
  readonly requestKey?: string;
  readonly correlationId?: string;
  readonly workspaceId?: string;
  readonly subjectEntityType?: string;
  readonly subjectEntityId?: string;
  readonly expectedApplicationVersion?: number;
  readonly namespace?: string;
  readonly task?: string;
  readonly contractRef?: string;
  readonly engineTargetEntityId?: string;
  readonly expectedEngineRevision?: number;
  readonly sourceArtifactIds?: readonly string[];
  readonly input?: AcmeAdapterRequest['input'];
}

/**
 * A seam request that is valid on its own terms: every required field is
 * populated with something an application would plausibly send.
 */
export function seamRequest(
  overrides: SeamRequestOverrides = {},
): AcmeAdapterRequest {
  const entityId = overrides.subjectEntityId ?? 'neutral-entity-1';
  return {
    contractVersion: (overrides.contractVersion ??
      ACME_ADAPTER_CONTRACT_VERSION) as typeof ACME_ADAPTER_CONTRACT_VERSION,
    requestKey: overrides.requestKey ?? 'seam-request-1',
    correlationId: overrides.correlationId ?? 'correlation-1',
    workspaceId: overrides.workspaceId ?? 'workspace-a',
    subject: {
      entityType: overrides.subjectEntityType ?? 'observation',
      entityId,
      expectedApplicationVersion: overrides.expectedApplicationVersion ?? 7,
    },
    engineTarget: {
      namespace: overrides.namespace ?? 'neutral',
      task: overrides.task ?? 'observe',
      contractRef: overrides.contractRef ?? 'neutral.observe@1.0.0',
      entityId: overrides.engineTargetEntityId ?? entityId,
      ...(overrides.expectedEngineRevision === undefined
        ? {}
        : { expectedEngineRevision: overrides.expectedEngineRevision }),
    },
    task: {
      id: 'neutral.observe',
      version: '1.0.0',
      // Real digests over stable labels; the seam treats them as opaque.
      inputSchemaSha256: sha256('neutral.observe/input/1.0.0'),
      outputSchemaSha256: sha256('neutral.observe/output/1.0.0'),
    },
    sourceArtifactIds: overrides.sourceArtifactIds ?? [],
    input: overrides.input ?? neutralInput,
  };
}

/** Every acknowledgeable loss on the request side of a default seam request. */
export const REQUEST_DROPS: readonly SeamGapCode[] = Object.freeze([
  'SEAM_WORKSPACE_ID_UNROUTABLE',
  'SEAM_CORRELATION_ID_UNROUTABLE',
  'SEAM_ENTITY_TYPE_UNROUTABLE',
  'SEAM_APPLICATION_VERSION_UNROUTABLE',
  'SEAM_CONTRACT_REF_UNENFORCEABLE',
  'SEAM_TASK_PINS_UNENFORCEABLE',
  'SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE',
  'SEAM_EXECUTION_POLICY_ABSENT',
]);

/** Every acknowledgeable loss on the result side. */
export const RESULT_DROPS: readonly SeamGapCode[] = Object.freeze([
  'SEAM_DOCUMENT_KEYS_DROPPED',
  'SEAM_EVENT_IDS_DROPPED',
  'SEAM_SUGGESTION_SET_UNPRODUCED',
  'SEAM_ERROR_STAGE_DROPPED',
  'SEAM_ERROR_DETAILS_DROPPED',
  'SEAM_ERROR_CAUSE_REF_DROPPED',
]);

export interface ScriptEntry {
  readonly requestKey: string;
  readonly namespace?: string;
  readonly selection?: ModelSelection;
  readonly error?: AcmeErrorData;
}

export interface SeamHarness {
  readonly engine: ExecutionEngine;
  readonly gateway: ScriptedModelGateway;
  readonly repository: ReturnType<typeof createInMemoryExecutionRepository>;
}

function deterministicIds(): IdGenerator {
  const counts = new Map<string, number>();
  return {
    next(kind) {
      if (kind === 'execution') {
        throw new Error('Execution IDs must be derived, never generated.');
      }
      const seen = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, seen);
      return `${kind}-${seen}`;
    },
  };
}

/**
 * A real ExecutionEngine over the in-memory repository and the deterministic
 * mock gateway. One scripted model call per entry; entries with `error` make
 * that call fail the way a provider outage would.
 */
export function createSeamHarness(script: readonly ScriptEntry[]): SeamHarness {
  const calls: ScriptedModelCall[] = script.map((entry) => {
    const namespace = entry.namespace ?? 'neutral';
    const executionId = deriveExecutionId(namespace, entry.requestKey);
    const selection = entry.selection ?? neutralSelection;
    return {
      executionId,
      callKey: 'model:0',
      selection,
      expectedRequestHash: computeModelRequestHash(
        neutralContract.buildRequest(neutralInput, {
          executionId,
          now: neutralNow,
        }),
      ),
      outcome:
        entry.error === undefined
          ? { kind: 'response', response: neutralResponse }
          : { kind: 'error', error: entry.error },
    };
  });

  const gateway = createScriptedModelGateway({
    profiles: [
      {
        selection: neutralSelection,
        capabilities: { structuredOutput: true, tools: false, vision: false },
      },
      {
        selection: alternateSelection,
        capabilities: { structuredOutput: true, tools: false, vision: false },
      },
    ],
    calls,
  });

  const ids = deterministicIds();
  const repository = createInMemoryExecutionRepository({
    ids,
    payloadEncryptor: createTestPayloadEncryptor(),
  });
  const engine = createExecutionEngine({
    clock: { now: () => neutralNow },
    ids,
    modules: createModuleRegistry([neutralModule]),
    contracts: createContractRegistry([neutralContract]),
    pipeline: createResponsePipeline(),
    gateway,
    memory: createMemoryEngine({ ids }),
    state: createStateEngine(),
    repository,
  });

  return { engine, gateway, repository };
}

export { neutralInput, neutralSelection };
