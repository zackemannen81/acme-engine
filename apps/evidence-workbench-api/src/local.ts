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
import { evaluationObserveCases } from '@acme/evidence-testing/evaluation-candidates';
import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
  EvidenceObservationSchema,
  EvidenceStateSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
  initialEvidenceState,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
} from '@acme/module-evidence';
import { createEvidenceWorkbenchWorker } from '@acme/evidence-workbench-worker';

import {
  createEvidenceWorkbenchApi,
  listenEvidenceWorkbenchApi,
} from './index.js';

const WORKSPACE_ID = 'rillford-annex-local';
const DEVELOPMENT_COMMAND_KEY = 'development-observe-dev-t01-v1';
const SELECTION: ModelSelection = {
  profile: 'evidence-offline-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-observe-1',
};

type SeedMode = 'development' | 'evaluation' | 'none';

interface ObserveFixture {
  readonly commandKey: string;
  readonly requestHash: string;
  readonly input: EvidenceObserveArtifactInput;
  readonly output: EvidenceObserveArtifactOutput;
}

function fixtures(mode: SeedMode): readonly ObserveFixture[] {
  if (mode === 'none') return [];
  if (mode === 'development') {
    return [
      {
        commandKey: DEVELOPMENT_COMMAND_KEY,
        requestHash: EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
        input: developmentObserveArtifactInput(),
        output: developmentObserveArtifactOutput(),
      },
    ];
  }
  return evaluationObserveCases().map((item) => ({
    commandKey: item.caseId,
    requestHash: item.requestHash,
    input: item.input,
    output: item.output,
  }));
}

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
  seedFixtures: readonly ObserveFixture[],
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
    calls: seedFixtures.map((fixture) => {
      const requestKey = `import:${fixture.commandKey}`;
      return {
        executionId: deriveExecutionId('evidence', requestKey),
        callKey: 'model:0',
        selection: SELECTION,
        expectedRequestHash: fixture.requestHash,
        outcome: {
          kind: 'response',
          response: {
            provider: 'deterministic-fixture',
            model: 'evidence-observe-1',
            providerResponseId: fixture.commandKey,
            receivedAt: clock.now(),
            finishReason: 'stop',
            text: canonicalJson(fixture.output as never),
            usage: { inputTokens: 480, outputTokens: 190, totalTokens: 670 },
            metadata: { fixture: fixture.commandKey },
          },
        },
      };
    }),
  });
}

export async function createLocalEvidenceWorkbench(
  options: {
    readonly dataFile?: string;
    readonly clock?: Clock & EvidenceProductClock;
    readonly ids?: IdGenerator;
    readonly reviewIds?: EvidenceProductIds;
    readonly seedDevelopmentSource?: boolean;
    readonly seedMode?: SeedMode;
  } = {},
) {
  const clock = options.clock ?? systemClock();
  const ids = options.ids ?? systemIds();
  const reviewIds = options.reviewIds ?? productIds();
  const seedMode =
    options.seedMode ??
    (options.seedDevelopmentSource === false ? 'none' : 'development');
  const seedFixtures = fixtures(seedMode);
  const dataFile = path.resolve(
    options.dataFile ??
      (seedMode === 'evaluation'
        ? '.local/evidence-workbench/evaluation-product.json'
        : '.local/evidence-workbench/product.json'),
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

  const ledger = createInMemoryExecutionRepository({
    ids,
    payloadEncryptor: createAes256GcmPayloadEncryptor({
      key: new Uint8Array(randomBytes(32)),
      keyId: 'ephemeral-local-session',
    }),
  });
  const gateway = fixtureGateway(seedFixtures, clock);
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

  if (productSnapshot.sources.length === 0) {
    for (const fixture of seedFixtures) {
      const job = await worker.start({
        schemaVersion: 'evidence-import-command/1',
        workspaceId: WORKSPACE_ID,
        commandKey: fixture.commandKey,
        artifactVersion: fixture.input.artifactVersion,
        actorRoster: fixture.input.actorRoster,
      });
      const completed = await worker.wait(job.jobId);
      if (completed.phase !== 'completed') throw new Error(completed.message);
    }
  }

  const server = createEvidenceWorkbenchApi({
    repository: productRepository,
    worker,
    clock,
    ids: reviewIds,
    workspaceId: WORKSPACE_ID,
    technicalAudit: { enabled: false },
    evidenceProjection() {
      const latest = ledger.snapshot().state.snapshots.at(-1);
      return latest === undefined
        ? initialEvidenceState()
        : EvidenceStateSchema.parse(latest.value);
    },
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
