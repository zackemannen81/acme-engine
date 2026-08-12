import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';

import { createFileEvidenceProductRepository } from '@acme/adapter-evidence-product-file';
import { createPostgresEvidenceProductRepository } from '@acme/adapter-evidence-product-postgres';
import { migrateEvidenceProductSchema } from '@acme/adapter-evidence-product-postgres';
import { createInMemoryExecutionRepository } from '@acme/adapter-memory';
import {
  createScriptedModelGateway,
  type ScriptedModelGateway,
} from '@acme/adapter-model-mock';
import {
  createPostgresExecutionRepository,
  migratePostgresSchema,
  verifyPostgresSchema,
} from '@acme/adapter-postgres';
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
  type ExecutionRepository,
  type IdGenerator,
  type ModelSelection,
  type RepositoryEvidence,
} from '@acme/core';
import { Pool } from 'pg';
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
import { evaluationRelateCase } from '@acme/evidence-testing/evaluation-relate';
import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
  EvidenceMemoryValueSchema,
  EvidenceObservationSchema,
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  EvidenceStateSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
  evidenceRelateObservationsContract,
  initialEvidenceState,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
  type EvidenceRelateObservationsInput,
  type EvidenceRelateObservationsOutput,
} from '@acme/module-evidence';
import { createEvidenceWorkbenchWorker } from '@acme/evidence-workbench-worker';

import {
  createEvidenceWorkbenchApi,
  listenEvidenceWorkbenchApi,
} from './index.js';

const WORKSPACE_ID = 'rillford-annex-local';
const DEVELOPMENT_COMMAND_KEY = 'development-observe-dev-t01-v1';
const RELATE_COMMAND_KEY = 'evaluation-relate-observations-1';
const OBSERVE_SELECTION: ModelSelection = {
  profile: 'evidence-offline-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-observe-1',
};
const RELATE_SELECTION: ModelSelection = {
  profile: 'evidence-offline-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-relate-1',
};

type SeedMode = 'development' | 'evaluation' | 'none';

interface ObserveFixture {
  readonly commandKey: string;
  readonly requestHash: string;
  readonly input: EvidenceObserveArtifactInput;
  readonly output: EvidenceObserveArtifactOutput;
}

interface RelateFixture {
  readonly commandKey: string;
  readonly requestHash: string;
  readonly input: EvidenceRelateObservationsInput;
  readonly output: EvidenceRelateObservationsOutput;
}

function observeFixtures(mode: SeedMode): readonly ObserveFixture[] {
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

function relateFixture(mode: SeedMode): RelateFixture | null {
  if (mode !== 'evaluation') return null;
  const item = evaluationRelateCase();
  return {
    commandKey: item.caseId,
    requestHash: item.requestHash,
    input: item.input,
    output: item.output,
  };
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
  relate: RelateFixture | null,
  clock: EvidenceProductClock,
): ScriptedModelGateway {
  const observeCalls = seedFixtures.map((fixture) => {
    const requestKey = `import:${fixture.commandKey}`;
    return {
      executionId: deriveExecutionId('evidence', requestKey),
      callKey: 'model:0',
      selection: OBSERVE_SELECTION,
      expectedRequestHash: fixture.requestHash,
      outcome: {
        kind: 'response' as const,
        response: {
          provider: 'deterministic-fixture',
          model: 'evidence-observe-1',
          providerResponseId: fixture.commandKey,
          receivedAt: clock.now(),
          finishReason: 'stop' as const,
          text: canonicalJson(fixture.output as never),
          usage: { inputTokens: 480, outputTokens: 190, totalTokens: 670 },
          metadata: { fixture: fixture.commandKey },
        },
      },
    };
  });
  const relateCalls =
    relate === null
      ? []
      : [
          {
            executionId: deriveExecutionId(
              'evidence',
              `relate:${relate.commandKey}`,
            ),
            callKey: 'model:0',
            selection: RELATE_SELECTION,
            expectedRequestHash: relate.requestHash,
            outcome: {
              kind: 'response' as const,
              response: {
                provider: 'deterministic-fixture',
                model: 'evidence-relate-1',
                providerResponseId: relate.commandKey,
                receivedAt: clock.now(),
                finishReason: 'stop' as const,
                text: canonicalJson(relate.output as never),
                usage: {
                  inputTokens: 900,
                  outputTokens: 700,
                  totalTokens: 1600,
                },
                metadata: { fixture: relate.commandKey },
              },
            },
          },
        ];
  return createScriptedModelGateway({
    profiles: [
      {
        selection: OBSERVE_SELECTION,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
          maxInputTokens: 32_000,
          maxOutputTokens: 4_096,
        },
      },
      {
        selection: RELATE_SELECTION,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
          maxInputTokens: 32_000,
          maxOutputTokens: 8_192,
        },
      },
    ],
    calls: [...observeCalls, ...relateCalls],
  });
}

function postgresUrlFromEnv(): string {
  const direct = process.env['ACME_POSTGRES_URL'];
  if (direct !== undefined && direct.trim().length > 0) {
    return direct;
  }
  const host = process.env['ACME_POSTGRES_HOST'];
  if (host === undefined || host.trim().length === 0) {
    throw new Error(
      'ACME_PERSISTENCE=postgres requires ACME_POSTGRES_URL or ACME_POSTGRES_HOST.',
    );
  }
  const port = process.env['ACME_POSTGRES_PORT'] ?? '5432';
  const user = process.env['ACME_POSTGRES_USER'] ?? 'acme';
  const password = process.env['ACME_POSTGRES_PASSWORD'] ?? 'acme';
  const database = process.env['ACME_POSTGRES_DATABASE'] ?? 'acme';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function usePostgresPersistence(options: {
  readonly persistence?: 'file' | 'postgres';
}): boolean {
  if (options.persistence === 'postgres') {
    return true;
  }
  if (options.persistence === 'file') {
    return false;
  }
  const env = process.env['ACME_PERSISTENCE']?.trim().toLowerCase();
  return env === 'postgres';
}

type SnapshotLedger = ExecutionRepository & {
  snapshot(): RepositoryEvidence | Promise<RepositoryEvidence>;
};

export async function createLocalEvidenceWorkbench(
  options: {
    readonly dataFile?: string;
    readonly clock?: Clock & EvidenceProductClock;
    readonly ids?: IdGenerator;
    readonly reviewIds?: EvidenceProductIds;
    readonly seedDevelopmentSource?: boolean;
    readonly seedMode?: SeedMode;
    /** Override persistence selection; default reads ACME_PERSISTENCE. */
    readonly persistence?: 'file' | 'postgres';
  } = {},
) {
  const clock = options.clock ?? systemClock();
  const ids = options.ids ?? systemIds();
  const reviewIds = options.reviewIds ?? productIds();
  const seedMode =
    options.seedMode ??
    (options.seedDevelopmentSource === false ? 'none' : 'development');
  const seedFixtures = observeFixtures(seedMode);
  const relate = relateFixture(seedMode);
  const postgres = usePostgresPersistence(options);

  let closePersistence: () => Promise<void> = async () => {};
  let productRepository;
  let ledger: SnapshotLedger;

  if (postgres) {
    const pool = new Pool({
      connectionString: postgresUrlFromEnv(),
      max: 8,
      application_name: 'acme-evidence-workbench',
    });
    await migratePostgresSchema({ pool, appliedAt: clock.now() });
    await verifyPostgresSchema({ pool });
    await migrateEvidenceProductSchema({ pool, appliedAt: clock.now() });
    productRepository = createPostgresEvidenceProductRepository({ pool });
    const payloadEncryptor = createAes256GcmPayloadEncryptor({
      key: new Uint8Array(randomBytes(32)),
      keyId: 'ephemeral-local-session',
    });
    ledger = createPostgresExecutionRepository({
      pool,
      ids,
      payloadEncryptor,
    });
    closePersistence = async () => {
      await pool.end();
    };
  } else {
    const dataFile = path.resolve(
      options.dataFile ??
        (seedMode === 'evaluation'
          ? '.local/evidence-workbench/evaluation-product.json'
          : '.local/evidence-workbench/product.json'),
    );
    productRepository = createFileEvidenceProductRepository({
      filePath: dataFile,
    });
    ledger = createInMemoryExecutionRepository({
      ids,
      payloadEncryptor: createAes256GcmPayloadEncryptor({
        key: new Uint8Array(randomBytes(32)),
        keyId: 'ephemeral-local-session',
      }),
    });
  }

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
  const gateway = fixtureGateway(seedFixtures, relate, clock);
  const engine = createExecutionEngine({
    clock,
    ids,
    modules: createModuleRegistry([evidenceModule]),
    contracts: createContractRegistry([
      evidenceObserveArtifactContract,
      evidenceRelateObservationsContract,
    ]),
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
            model: OBSERVE_SELECTION,
            policy: { retention: 'encrypted-payload' },
          },
          { signal: value.signal },
        );
        if (result.status !== 'committed')
          throw new Error(result.error.message);
        const evidence = await ledger.snapshot();
        const observations = evidence.memoryRecords.flatMap((record) => {
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

  let seededThisProcess = false;
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
    seededThisProcess = true;
    productSnapshot = await productRepository.snapshot();
  }

  if (
    relate !== null &&
    seededThisProcess &&
    (productSnapshot.relations?.length ?? 0) === 0
  ) {
    const workspace = productSnapshot.workspaces.find(
      ({ workspaceId }) => workspaceId === WORKSPACE_ID,
    );
    if (workspace === undefined)
      throw new Error('Workspace missing before relation seed.');
    const result = await engine.execute({
      requestKey: `relate:${RELATE_COMMAND_KEY}`,
      namespace: 'evidence',
      task: 'relate-observations',
      entityId: WORKSPACE_ID,
      expectedRevision: workspace.evidenceRevision,
      input: relate.input,
      model: RELATE_SELECTION,
      policy: { retention: 'encrypted-payload' },
    });
    if (result.status !== 'committed') throw new Error(result.error.message);
    const evidence = await ledger.snapshot();
    const memories = evidence.memoryRecords.flatMap((record) => {
      const parsed = EvidenceMemoryValueSchema.safeParse(record.value);
      return parsed.success ? [parsed.data] : [];
    });
    const relations = memories.flatMap((value) => {
      const parsed = EvidenceRelationSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    });
    const openQuestions = memories.flatMap((value) => {
      const parsed = EvidenceOpenQuestionSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    });
    await productRepository.putRelations(relations);
    await productRepository.putOpenQuestions(openQuestions);
    await productRepository.advanceEvidenceRevision(
      WORKSPACE_ID,
      workspace.evidenceRevision,
      result.revision,
    );
  }

  const server = createEvidenceWorkbenchApi({
    repository: productRepository,
    worker,
    clock,
    ids: reviewIds,
    workspaceId: WORKSPACE_ID,
    technicalAudit: { enabled: false },
    async evidenceProjection() {
      const evidence = await ledger.snapshot();
      const latest = evidence.state.snapshots.at(-1);
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
    dataFile: postgres
      ? undefined
      : path.resolve(
          options.dataFile ??
            (seedMode === 'evaluation'
              ? '.local/evidence-workbench/evaluation-product.json'
              : '.local/evidence-workbench/product.json'),
        ),
    persistence: postgres ? ('postgres' as const) : ('file' as const),
    close: closePersistence,
  };
}

export { listenEvidenceWorkbenchApi };
