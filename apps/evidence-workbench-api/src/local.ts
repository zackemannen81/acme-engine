import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';

import { createFileEvidenceProductRepository } from '@acme/adapter-evidence-product-file';
import { createInMemoryExecutionRepository } from '@acme/adapter-memory';
import {
  createScriptedModelGateway,
  type ScriptedModelGateway,
} from '@acme/adapter-model-mock';
import {
  canonicalJson,
  createAes256GcmPayloadEncryptor,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  type Clock,
  type IdGenerator,
  type ModelSelection,
} from '@acme/core';
import {
  EVIDENCE_WORKSPACE_SCHEMA_VERSION,
  type EvidenceProductClock,
  type EvidenceProductIds,
} from '@acme/evidence-product-contracts';
import {
  EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
  developmentObserveArtifactInput,
  developmentObserveArtifactOutput,
} from '@acme/evidence-testing';
import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
  EvidenceObservationSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
} from '@acme/module-evidence';
import { createEvidenceWorkbenchWorker } from '@acme/evidence-workbench-worker';

import {
  createEvidenceWorkbenchApi,
  listenEvidenceWorkbenchApi,
} from './index.js';

const WORKSPACE_ID = 'rillford-annex-local';
const DEVELOPMENT_COMMAND_KEY = 'development-observe-dev-t01-v1';
const SELECTION: ModelSelection = {
  profile: 'evidence-development-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-observe-1',
};

function systemClock(): Clock & EvidenceProductClock {
  return { now: () => new Date().toISOString() };
}

function systemIds(): IdGenerator {
  return { next: (kind) => `${kind}-${randomUUID()}` };
}

function productIds(): EvidenceProductIds {
  return { next: () => `review-decision-${randomUUID()}` };
}

function fixtureGateway(
  requestKey: string,
  clock: EvidenceProductClock,
): ScriptedModelGateway {
  return createScriptedModelGateway({
    profiles: [
      {
        selection: SELECTION,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
          maxInputTokens: 32_000,
          maxOutputTokens: 4_096,
        },
      },
    ],
    calls: [
      {
        executionId: deriveExecutionId('evidence', requestKey),
        callKey: 'model:0',
        selection: SELECTION,
        expectedRequestHash: EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
        outcome: {
          kind: 'response',
          response: {
            provider: 'deterministic-fixture',
            model: 'evidence-observe-1',
            providerResponseId: 'development-observe-dev-t01-v1',
            receivedAt: clock.now(),
            finishReason: 'stop',
            text: canonicalJson(developmentObserveArtifactOutput() as never),
            usage: { inputTokens: 480, outputTokens: 190, totalTokens: 670 },
            metadata: { fixture: 'development-observe-dev-t01-v1' },
          },
        },
      },
    ],
  });
}

export async function createLocalEvidenceWorkbench(
  options: {
    readonly dataFile?: string;
    readonly clock?: Clock & EvidenceProductClock;
    readonly ids?: IdGenerator;
    readonly reviewIds?: EvidenceProductIds;
    readonly seedDevelopmentSource?: boolean;
  } = {},
) {
  const clock = options.clock ?? systemClock();
  const ids = options.ids ?? systemIds();
  const reviewIds = options.reviewIds ?? productIds();
  const dataFile = path.resolve(
    options.dataFile ?? '.local/evidence-workbench/product.json',
  );
  const productRepository = createFileEvidenceProductRepository({
    filePath: dataFile,
  });
  let productSnapshot = await productRepository.snapshot();
  if (
    !productSnapshot.workspaces.some(
      ({ workspaceId }) => workspaceId === WORKSPACE_ID,
    )
  ) {
    await productRepository.putWorkspace({
      schemaVersion: EVIDENCE_WORKSPACE_SCHEMA_VERSION,
      workspaceId: WORKSPACE_ID,
      label: 'Rillford Annex — local review',
      dataPolicy: 'synthetic-only',
      evidenceRevision: 0,
      createdAt: clock.now(),
    });
    productSnapshot = await productRepository.snapshot();
  }

  const requestKey = `import:${DEVELOPMENT_COMMAND_KEY}`;
  const ledger = createInMemoryExecutionRepository({
    ids,
    payloadEncryptor: createAes256GcmPayloadEncryptor({
      key: new Uint8Array(randomBytes(32)),
      keyId: 'ephemeral-local-session',
    }),
  });
  const gateway = fixtureGateway(requestKey, clock);
  const engine = createExecutionEngine({
    clock,
    ids,
    modules: createModuleRegistry([evidenceModule]),
    contracts: createContractRegistry([evidenceObserveArtifactContract]),
    pipeline: createResponsePipeline(),
    gateway,
    memory: createMemoryEngine({ ids }),
    state: createStateEngine(),
    repository: ledger,
  });
  const worker = createEvidenceWorkbenchWorker({
    repository: productRepository,
    clock,
    executor: {
      async observe(value) {
        const result = await engine.execute(
          {
            requestKey: value.requestKey,
            namespace: 'evidence',
            task: 'observe-artifact',
            entityId: value.workspaceId,
            expectedRevision: value.expectedRevision,
            input: {
              schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
              artifactVersion: value.artifactVersion,
              actorRoster: value.actorRoster,
            },
            model: SELECTION,
            policy: { retention: 'encrypted-payload' },
          },
          { signal: value.signal },
        );
        if (result.status !== 'committed')
          throw new Error(result.error.message);
        const observations = ledger
          .snapshot()
          .memoryRecords.flatMap((record) => {
            const parsed = EvidenceObservationSchema.safeParse(record.value);
            return parsed.success &&
              parsed.data.artifactVersionId ===
                value.artifactVersion.artifactVersionId
              ? [parsed.data]
              : [];
          });
        return {
          revision: result.revision,
          observations,
          replayed: result.replayed,
        };
      },
    },
  });

  if (
    options.seedDevelopmentSource !== false &&
    productSnapshot.sources.length === 0
  ) {
    const fixture = developmentObserveArtifactInput();
    const job = await worker.start({
      schemaVersion: 'evidence-import-command/1',
      workspaceId: WORKSPACE_ID,
      commandKey: DEVELOPMENT_COMMAND_KEY,
      artifactVersion: fixture.artifactVersion,
      actorRoster: fixture.actorRoster,
    });
    const completed = await worker.wait(job.jobId);
    if (completed.phase !== 'completed') throw new Error(completed.message);
  }

  const server = createEvidenceWorkbenchApi({
    repository: productRepository,
    worker,
    clock,
    ids: reviewIds,
    workspaceId: WORKSPACE_ID,
    technicalAudit: { enabled: false },
  });
  return {
    server,
    worker,
    productRepository,
    ledger,
    gateway,
    engine,
    workspaceId: WORKSPACE_ID,
    dataFile,
  };
}

export { listenEvidenceWorkbenchApi };
