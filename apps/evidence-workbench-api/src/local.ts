import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createFileEvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-file';
import { createS3EvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-s3';
import {
  createDeterministicEvidenceAuthenticator,
  createInMemoryEvidenceIdentityRepository,
} from '@acme/adapter-evidence-auth-memory';
import {
  createPostgresEvidenceIdentityRepository,
  migrateEvidenceIdentitySchema,
} from '@acme/adapter-evidence-auth-postgres';
import { createFileEvidenceProductRepository } from '@acme/adapter-evidence-product-file';
import { createPostgresEvidenceProductRepository } from '@acme/adapter-evidence-product-postgres';
import { migrateEvidenceProductSchema } from '@acme/adapter-evidence-product-postgres';
import { createInMemoryExecutionRepository } from '@acme/adapter-memory';
import {
  createScriptedModelGateway,
  type ScriptedModelGateway,
} from '@acme/adapter-model-mock';
import type { ProviderTransport } from '@acme/adapter-model-openai';
import {
  createPostgresExecutionRepository,
  migratePostgresSchema,
  verifyPostgresSchema,
} from '@acme/adapter-postgres';
import {
  canonicalJson,
  computeModelRequestHash,
  createAes256GcmPayloadEncryptor,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  nodeHashing,
  type Clock,
  type ExecutionRepository,
  type IdGenerator,
  type ModelSelection,
  type RepositoryEvidence,
} from '@acme/core';
import {
  createEvidenceSessionService,
  deriveEvidencePrincipalRef,
  type EvidenceCredentialAuthenticator,
  type EvidenceIdentityRepository,
  EvidenceCaseMembershipSchema,
  EvidenceCaseSchema,
} from '@acme/evidence-auth';
import {
  createEvidenceArtifactKeyring,
  loadEvidenceArtifactKeyringFromFiles,
  type EvidenceArtifactKeyProvider,
  type EvidenceArtifactObjectStore,
} from '@acme/evidence-artifacts';
import { Pool } from 'pg';
import {
  EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
  effectiveReviewDecision,
  EVIDENCE_WORKSPACE_SCHEMA_VERSION,
  bindLegacySyntheticCaseObjects,
  createEvidenceArtifactService,
  createEvidenceIngestionService,
  createSecureEvidenceProductRepository,
  reconcileEvidenceCases,
  type EvidenceProductClock,
  type EvidenceProductIds,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import {
  EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
  developmentObserveArtifactInput,
  developmentObserveArtifactOutput,
  evaluationAssessmentCases,
} from '@acme/evidence-testing';
import { evaluationObserveCases } from '@acme/evidence-testing/evaluation-candidates';
import { evaluationRelateCase } from '@acme/evidence-testing/evaluation-relate';
import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V3,
  createEvidenceChangeSet,
  deriveEvidenceSourceStructure,
  evidenceCoverageWindowForSource,
  EvidenceAssessmentSchema,
  EvidenceMemoryValueSchema,
  EvidenceObservationSchema,
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  EvidenceStateSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
  evidenceObserveArtifactContractV1,
  evidenceObserveArtifactContractV2,
  evidenceObserveArtifactContractV3,
  evidenceObserveArtifactContractV4,
  evidenceObserveArtifactContractV5,
  evidenceObserveArtifactContractV6,
  evidenceObserveArtifactContractV7,
  evidenceObserveArtifactContractV8,
  evidenceObserveArtifactContractV9,
  evidenceObserveArtifactContractV10,
  evidenceObserveArtifactContractV11,
  evidenceProposeAssessmentContract,
  evidenceProposeAssessmentContractV1,
  evidenceProposeAssessmentContractV2,
  evidenceRelateObservationsContract,
  evidenceRelateObservationsContractV1,
  initialEvidenceState,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
  type EvidenceRelateObservationsInput,
  type EvidenceRelateObservationsOutput,
} from '@acme/module-evidence';
import { createEvidenceWorkbenchWorker } from '@acme/evidence-workbench-worker';
import { isLiveOptInValue } from '@acme/live-safety';

import {
  createEvidenceWorkbenchApi,
  listenEvidenceWorkbenchApi,
} from './index.js';
import {
  createEvidenceLiveCapability,
  type EvidenceLiveCapability,
} from './live.js';
import { createEvidenceLiveObservationService } from './live-observation.js';
import { createEvidenceLiveRelationService } from './live-relation.js';
import { createEvidenceLiveAssessmentService } from './live-assessment.js';

const WORKSPACE_ID = 'rillford-annex-local';
const CASE_ID = 'rillford-annex-synthetic-case';
const ORGANIZATION_ID = 'acme-synthetic-organization';
const DEVELOPMENT_AUTH_ISSUER = 'https://local.auth.invalid/';
const DEVELOPMENT_AUTH_SUBJECT = 'synthetic-reviewer-1';
const DEVELOPMENT_AUTH_EMAIL = 'reviewer@acme.local';
const DEVELOPMENT_AUTH_PASSWORD = 'acme-synthetic-reviewer';
/**
 * Upstream lifetime granted per sign-in and per refresh, never per process.
 * The product session's own idle and absolute bounds still govern the session.
 */
const DEVELOPMENT_UPSTREAM_LIFETIME_MS = 15 * 60 * 1_000;
const DEVELOPMENT_COMMAND_KEY = 'development-observe-dev-t01-v1';
const PRE_LATE_RELATE_COMMAND_KEY = 'evaluation-relate-pre-log-1';
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
const ASSESSMENT_SELECTION: ModelSelection = {
  profile: 'evidence-offline-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-assessment-1',
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
  return evaluationObserveCases()
    .filter(
      ({ input }) => input.artifactVersion.logicalArtifactId !== 'EVAL-E01',
    )
    .map((item) => ({
      commandKey: item.caseId,
      requestHash: item.requestHash,
      input: item.input,
      output: item.output,
    }));
}

function lateObserveFixture(mode: SeedMode): ObserveFixture | null {
  if (mode !== 'evaluation') return null;
  const item = evaluationObserveCases().find(
    ({ input }) => input.artifactVersion.logicalArtifactId === 'EVAL-E01',
  );
  if (item === undefined) throw new Error('Missing EVAL-E01 fixture.');
  return {
    commandKey: item.caseId,
    requestHash: item.requestHash,
    input: item.input,
    output: item.output,
  };
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

function preLateRelateFixture(mode: SeedMode): RelateFixture | null {
  if (mode !== 'evaluation') return null;
  const full = evaluationRelateCase();
  const lateArtifactId =
    lateObserveFixture(mode)?.input.artifactVersion.artifactVersionId;
  const observations = full.input.observations.filter(
    ({ artifactVersionId }) => artifactVersionId !== lateArtifactId,
  );
  const ids = new Set(observations.map(({ observationId }) => observationId));
  const relations = full.output.relations.filter(({ endpoints }) =>
    endpoints.every(({ kind, id }) => kind !== 'observation' || ids.has(id)),
  );
  const rationaleCodes = new Set(
    relations.map(({ rationaleCode }) => rationaleCode),
  );
  const openQuestions = full.output.openQuestions.filter(
    (question) =>
      question.triggeringObservationIds.every((id) => ids.has(id)) &&
      question.triggeringRelationRationaleCodes.every((code) =>
        rationaleCodes.has(code),
      ),
  );
  const input = { ...full.input, observations };
  const output = { ...full.output, relations, openQuestions };
  return {
    commandKey: PRE_LATE_RELATE_COMMAND_KEY,
    requestHash: computeModelRequestHash(
      evidenceRelateObservationsContract.buildRequest(input, {
        executionId: 'hash-only',
        now: '2026-08-11T00:00:00.000Z',
      }),
    ),
    input,
    output,
  };
}

function systemClock(): Clock & EvidenceProductClock {
  return { now: () => new Date().toISOString() };
}

function systemIds(): IdGenerator {
  return { next: (kind) => `${kind}-${randomUUID()}` };
}

function productIds(): EvidenceProductIds {
  return { next: (kind) => `${kind}-${randomUUID()}` };
}

async function localArtifactKey(file: string): Promise<Uint8Array> {
  await mkdir(path.dirname(file), { recursive: true });
  try {
    return Buffer.from((await readFile(file, 'utf8')).trim(), 'base64');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const generated = randomBytes(32);
  try {
    await writeFile(file, generated.toString('base64'), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    return generated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return Buffer.from((await readFile(file, 'utf8')).trim(), 'base64');
  }
}

export async function createEvidenceArtifactInfrastructure(input: {
  readonly basePath: string;
  readonly hosted: boolean;
}): Promise<{
  readonly objectStore: EvidenceArtifactObjectStore;
  readonly keyProvider: EvidenceArtifactKeyProvider;
}> {
  const configuredKeyFile = process.env['ACME_ARTIFACT_KEK_FILE']?.trim();
  const configuredKeyManifest =
    process.env['ACME_ARTIFACT_KEK_MANIFEST']?.trim();
  if (input.hosted && !configuredKeyFile && !configuredKeyManifest)
    throw new Error(
      'Hosted artifact storage requires ACME_ARTIFACT_KEK_FILE or ACME_ARTIFACT_KEK_MANIFEST.',
    );
  const keyFile = path.resolve(
    configuredKeyFile || `${input.basePath}.artifact-kek`,
  );
  const activeKeyId =
    process.env['ACME_ARTIFACT_KEK_ID']?.trim() || 'evidence-kek';
  const activeKeyVersion = Number(
    process.env['ACME_ARTIFACT_KEK_VERSION']?.trim() || '1',
  );
  const manifestedFiles =
    configuredKeyManifest === undefined
      ? null
      : (JSON.parse(
          await readFile(path.resolve(configuredKeyManifest), 'utf8'),
        ) as unknown);
  if (manifestedFiles !== null && !Array.isArray(manifestedFiles))
    throw new Error('Artifact KEK manifest must be an array.');
  const manifestFiles =
    manifestedFiles === null
      ? null
      : manifestedFiles.map((item) => {
          if (
            typeof item !== 'object' ||
            item === null ||
            typeof (item as Record<string, unknown>)['keyId'] !== 'string' ||
            typeof (item as Record<string, unknown>)['keyVersion'] !==
              'number' ||
            typeof (item as Record<string, unknown>)['path'] !== 'string'
          )
            throw new Error('Artifact KEK manifest entry is invalid.');
          return {
            keyId: (item as { keyId: string }).keyId,
            keyVersion: (item as { keyVersion: number }).keyVersion,
            path: path.resolve((item as { path: string }).path),
          };
        });
  const keyProvider =
    configuredKeyFile || manifestFiles !== null
      ? await loadEvidenceArtifactKeyringFromFiles({
          activeKeyId,
          activeKeyVersion,
          files: manifestFiles ?? [
            { keyId: activeKeyId, keyVersion: activeKeyVersion, path: keyFile },
          ],
        })
      : createEvidenceArtifactKeyring({
          activeKeyId: 'local-evidence-kek',
          activeKeyVersion: 1,
          keys: [
            {
              keyId: 'local-evidence-kek',
              keyVersion: 1,
              key: await localArtifactKey(keyFile),
            },
          ],
        });
  const storeKind = process.env['ACME_ARTIFACT_STORE']?.trim().toLowerCase();
  if (input.hosted && storeKind !== 's3')
    throw new Error('Hosted artifact storage requires ACME_ARTIFACT_STORE=s3.');
  if (storeKind === 's3') {
    const endpoint = process.env['ACME_ARTIFACT_S3_ENDPOINT']?.trim();
    const region = process.env['ACME_ARTIFACT_S3_REGION']?.trim();
    const bucket = process.env['ACME_ARTIFACT_S3_BUCKET']?.trim();
    const accessKeyId = process.env['ACME_ARTIFACT_S3_ACCESS_KEY_ID']?.trim();
    const secretFile = process.env['ACME_ARTIFACT_S3_SECRET_FILE']?.trim();
    if (!endpoint || !region || !bucket || !accessKeyId || !secretFile)
      throw new Error('S3 artifact storage configuration is incomplete.');
    return {
      keyProvider,
      objectStore: createS3EvidenceArtifactObjectStore({
        endpoint,
        region,
        bucket,
        accessKeyId,
        secretAccessKey: (
          await readFile(path.resolve(secretFile), 'utf8')
        ).trim(),
      }),
    };
  }
  return {
    keyProvider,
    objectStore: createFileEvidenceArtifactObjectStore({
      root: path.resolve(
        process.env['ACME_ARTIFACT_FILE_ROOT']?.trim() ||
          `${input.basePath}.objects`,
      ),
    }),
  };
}

function fixtureGateway(
  seedFixtures: readonly ObserveFixture[],
  lateFixture: ObserveFixture | null,
  relateFixtures: readonly RelateFixture[],
  assessmentFixtures: ReturnType<typeof evaluationAssessmentCases>,
  clock: EvidenceProductClock,
): ScriptedModelGateway {
  const observeCalls = [
    ...seedFixtures,
    ...(lateFixture === null ? [] : [lateFixture]),
  ].map((fixture) => {
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
  const relateCalls = relateFixtures.map((relate) => ({
    executionId: deriveExecutionId('evidence', `relate:${relate.commandKey}`),
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
  }));
  const assessmentCalls = assessmentFixtures.map((fixture) => ({
    executionId: deriveExecutionId('evidence', `assessment:${fixture.caseId}`),
    callKey: 'model:0',
    selection: ASSESSMENT_SELECTION,
    expectedRequestHash: fixture.requestHash,
    outcome: {
      kind: 'response' as const,
      response: {
        provider: 'deterministic-fixture',
        model: 'evidence-assessment-1',
        providerResponseId: fixture.caseId,
        receivedAt: clock.now(),
        finishReason: 'stop' as const,
        text: canonicalJson(fixture.output as never),
        usage: { inputTokens: 800, outputTokens: 500, totalTokens: 1300 },
        metadata: { fixture: fixture.caseId },
      },
    },
  }));
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
      {
        selection: ASSESSMENT_SELECTION,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
          maxInputTokens: 32_000,
          maxOutputTokens: 8_192,
        },
      },
    ],
    calls: [...observeCalls, ...relateCalls, ...assessmentCalls],
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

export interface EvidenceLiveCompositionOptions {
  readonly liveOptIn?: boolean;
  readonly hosted?: boolean;
  readonly profile?: string;
  readonly model?: string;
  readonly apiKey?: string;
  readonly payloadKey?: Uint8Array;
  readonly payloadKeyId?: string;
  readonly deploymentMaxModelCalls?: number | null;
  readonly deploymentCostCeilingMinor?: number | null;
  readonly deploymentCurrency?: string | null;
  readonly transport?: ProviderTransport;
  /** Fault-injection seam used to prove post-provider restart recovery. */
  readonly afterObservationEngineCommit?: () => void | Promise<void>;
  readonly afterRelationEngineCommit?: () => void | Promise<void>;
  readonly afterAssessmentEngineCommit?: () => void | Promise<void>;
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) return undefined;
  return Number(value);
}

async function configuredLivePayloadKey(input: {
  readonly enabled: boolean;
  readonly injected?: Uint8Array;
}): Promise<Uint8Array | undefined> {
  if (!input.enabled) return undefined;
  if (input.injected !== undefined) return input.injected;
  const file = process.env['ACME_EVIDENCE_PAYLOAD_KEY_FILE']?.trim();
  if (!file) return undefined;
  const encoded = (await readFile(path.resolve(file), 'utf8')).trim();
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}

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
    readonly authenticator?: EvidenceCredentialAuthenticator;
    readonly authIdentity?: {
      readonly issuer: string;
      readonly subject: string;
      readonly displayLabel: string;
      readonly email: string;
    };
    readonly sessionKey?: Uint8Array;
    readonly secureCookies?: boolean;
    readonly publicOrigin?: string;
    /** Test/embedding overrides. Production reads the corresponding env only. */
    readonly live?: EvidenceLiveCompositionOptions;
  } = {},
) {
  const clock = options.clock ?? systemClock();
  const ids = options.ids ?? systemIds();
  const reviewIds = options.reviewIds ?? productIds();
  const seedMode =
    options.seedMode ??
    (options.seedDevelopmentSource === false ? 'none' : 'development');
  const seedFixtures = observeFixtures(seedMode);
  const lateFixture = lateObserveFixture(seedMode);
  const preLateRelate = preLateRelateFixture(seedMode);
  const fullRelate = relateFixture(seedMode);
  const assessmentFixtures =
    seedMode === 'evaluation' ? evaluationAssessmentCases() : [];
  const workspaceId = assessmentFixtures[0]?.input.workspaceId ?? WORKSPACE_ID;
  const postgres = usePostgresPersistence(options);
  const liveOptIn =
    options.live?.liveOptIn ??
    isLiveOptInValue(process.env['ACME_EVIDENCE_LIVE']);
  const livePayloadKey = await configuredLivePayloadKey({
    enabled: liveOptIn,
    ...(options.live?.payloadKey === undefined
      ? {}
      : { injected: options.live.payloadKey }),
  });
  const livePayloadKeyId =
    options.live?.payloadKeyId ??
    process.env['ACME_EVIDENCE_PAYLOAD_KEY_ID']?.trim();
  const liveCapability: EvidenceLiveCapability | null =
    createEvidenceLiveCapability({
      liveOptIn,
      hosted:
        options.live?.hosted ?? process.env['ACME_HOSTED']?.trim() === '1',
      profile:
        options.live?.profile ??
        process.env['ACME_EVIDENCE_COMPOSITION_PROFILE']?.trim(),
      persistence: postgres ? 'durable-postgresql' : 'file',
      modelGateway: 'live-provider',
      model:
        options.live?.model ?? process.env['ACME_EVIDENCE_LIVE_MODEL']?.trim(),
      apiKey: options.live?.apiKey ?? process.env['OPENAI_API_KEY'],
      payloadKey: livePayloadKey,
      payloadKeyId: livePayloadKeyId,
      deploymentBudget: {
        // Absent means the deployment declines to cap the campaign, which
        // ADR-0044 retired. It never means zero calls.
        maxModelCalls:
          options.live?.deploymentMaxModelCalls ??
          optionalNumber(process.env['ACME_EVIDENCE_LIVE_MAX_MODEL_CALLS']) ??
          null,
        costCeilingMinor:
          options.live?.deploymentCostCeilingMinor ??
          optionalNumber(
            process.env['ACME_EVIDENCE_LIVE_COST_CEILING_MINOR'],
          ) ??
          null,
      },
      deploymentCurrency:
        options.live?.deploymentCurrency ??
        process.env['ACME_EVIDENCE_LIVE_CURRENCY']?.trim() ??
        null,
      clock,
      ...(options.live?.transport === undefined
        ? {}
        : { transport: options.live.transport }),
    });
  const ledgerPayloadEncryptor = createAes256GcmPayloadEncryptor({
    key:
      liveCapability === null || livePayloadKey === undefined
        ? new Uint8Array(randomBytes(32))
        : livePayloadKey,
    keyId:
      liveCapability === null || livePayloadKeyId === undefined
        ? 'ephemeral-local-session'
        : livePayloadKeyId,
  });

  let closePersistence: () => Promise<void> = async () => {};
  let rawProductRepository: EvidenceProductRepository;
  let identityRepository: EvidenceIdentityRepository;
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
    await migrateEvidenceIdentitySchema({ pool, appliedAt: clock.now() });
    rawProductRepository = createPostgresEvidenceProductRepository({ pool });
    identityRepository = createPostgresEvidenceIdentityRepository({ pool });
    ledger = createPostgresExecutionRepository({
      pool,
      ids,
      payloadEncryptor: ledgerPayloadEncryptor,
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
    rawProductRepository = createFileEvidenceProductRepository({
      filePath: dataFile,
    });
    identityRepository = createInMemoryEvidenceIdentityRepository();
    ledger = createInMemoryExecutionRepository({
      ids,
      payloadEncryptor: ledgerPayloadEncryptor,
    });
  }

  const authIdentity = options.authIdentity ?? {
    issuer: DEVELOPMENT_AUTH_ISSUER,
    subject: DEVELOPMENT_AUTH_SUBJECT,
    displayLabel: 'Synthetic reviewer',
    email: DEVELOPMENT_AUTH_EMAIL,
  };
  const principalRef = deriveEvidencePrincipalRef(
    nodeHashing,
    authIdentity.issuer,
    authIdentity.subject,
  );
  const identitySnapshot = await identityRepository.snapshot();
  if (
    !identitySnapshot.organizations.some(
      (item) => item.organizationId === ORGANIZATION_ID,
    )
  ) {
    await identityRepository.putOrganization({
      schemaVersion: 'evidence-organization/1',
      organizationId: ORGANIZATION_ID,
      label: 'ACME synthetic review organization',
      createdAt: clock.now(),
    });
  }
  if (
    !identitySnapshot.principals.some(
      (item) => item.principalRef === principalRef,
    )
  ) {
    await identityRepository.putPrincipal({
      schemaVersion: 'evidence-principal-profile/1',
      principalRef,
      issuer: authIdentity.issuer,
      subject: authIdentity.subject,
      displayLabel: authIdentity.displayLabel,
      createdAt: clock.now(),
    });
  }
  if (
    !identitySnapshot.memberships.some(
      (item) => item.principalRef === principalRef,
    )
  ) {
    await identityRepository.putMembership({
      schemaVersion: 'evidence-organization-membership/1',
      membershipId: `membership-${principalRef}`,
      organizationId: ORGANIZATION_ID,
      principalRef,
      role: 'organization-admin',
      status: 'active',
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
  }
  if (
    !identitySnapshot.workspaceBindings.some(
      (item) => item.workspaceId === workspaceId,
    )
  ) {
    await identityRepository.putWorkspaceBinding({
      schemaVersion: 'evidence-workspace-organization-binding/1',
      workspaceId,
      organizationId: ORGANIZATION_ID,
      boundAt: clock.now(),
    });
  }
  const caseNow = clock.now();
  if (!identitySnapshot.cases.some((item) => item.caseId === CASE_ID)) {
    await identityRepository.putCase(
      EvidenceCaseSchema.parse({
        schemaVersion: 'evidence-case/1',
        caseId: CASE_ID,
        organizationId: ORGANIZATION_ID,
        workspaceId,
        title: 'Rillford Annex — local review',
        caseReference: 'SYNTHETIC-RILLFORD-1',
        metadata: { corpus: 'rillford-annex-review-1' },
        dataPolicy: 'synthetic-only',
        status: 'active',
        revision: 1,
        createdAt: caseNow,
        updatedAt: caseNow,
        createdByPrincipalRef: principalRef,
        updatedByPrincipalRef: principalRef,
      }),
    );
  }
  if (
    !identitySnapshot.caseMemberships.some(
      (item) => item.caseId === CASE_ID && item.principalRef === principalRef,
    )
  ) {
    await identityRepository.putCaseMembership(
      EvidenceCaseMembershipSchema.parse({
        schemaVersion: 'evidence-case-membership/1',
        caseMembershipId: `case-membership-${CASE_ID}-${principalRef}`,
        caseId: CASE_ID,
        organizationId: ORGANIZATION_ID,
        principalRef,
        role: 'case-admin',
        status: 'active',
        createdAt: caseNow,
        updatedAt: caseNow,
        updatedByPrincipalRef: principalRef,
      }),
    );
  }
  const provisionedIdentity = await identityRepository.snapshot();
  const provisionedPrincipal = provisionedIdentity.principals.find(
    (item) => item.principalRef === principalRef,
  );
  const provisionedBinding = provisionedIdentity.workspaceBindings.find(
    (item) => item.workspaceId === workspaceId,
  );
  const activeAdmin = provisionedIdentity.memberships.find(
    (item) =>
      item.organizationId === provisionedBinding?.organizationId &&
      item.role === 'organization-admin' &&
      item.status === 'active',
  );
  if (
    provisionedPrincipal === undefined ||
    new URL(provisionedPrincipal.issuer).toString() !==
      new URL(authIdentity.issuer).toString() ||
    provisionedPrincipal.subject !== authIdentity.subject ||
    provisionedBinding?.organizationId !== ORGANIZATION_ID ||
    activeAdmin === undefined
  ) {
    throw new Error(
      'Evidence identity bootstrap is incomplete or inconsistent.',
    );
  }
  const authenticator =
    options.authenticator ??
    createDeterministicEvidenceAuthenticator({
      issuer: authIdentity.issuer,
      accounts: [
        {
          email: authIdentity.email,
          password: DEVELOPMENT_AUTH_PASSWORD,
          subject: authIdentity.subject,
          displayLabel: authIdentity.displayLabel,
        },
      ],
      expiresAt: () =>
        new Date(
          Date.parse(clock.now()) + DEVELOPMENT_UPSTREAM_LIFETIME_MS,
        ).toISOString(),
    });
  const sessionProtector = createAes256GcmPayloadEncryptor({
    key: options.sessionKey ?? new Uint8Array(randomBytes(32)),
    keyId: 'evidence-session-key-1',
  });
  const sessions = createEvidenceSessionService({
    repository: identityRepository,
    authenticator,
    clock,
    secrets: {
      nextToken: () => randomBytes(32).toString('base64url'),
    },
    hashing: nodeHashing,
    protector: sessionProtector,
  });

  const artifactBasePath = path.resolve(
    options.dataFile ??
      (postgres
        ? '.local/evidence-workbench/postgres-product'
        : seedMode === 'evaluation'
          ? '.local/evidence-workbench/evaluation-product.json'
          : '.local/evidence-workbench/product.json'),
  );
  const artifacts = await createEvidenceArtifactInfrastructure({
    basePath: artifactBasePath,
    hosted: process.env['ACME_HOSTED']?.trim() === '1',
  });
  const artifactService = createEvidenceArtifactService({
    repository: rawProductRepository,
    objectStore: artifacts.objectStore,
    keyProvider: artifacts.keyProvider,
    clock,
    ids: { next: (kind) => `${kind}-${randomUUID()}` },
  });
  const ingestionService = createEvidenceIngestionService({
    repository: rawProductRepository,
    artifacts: artifactService,
    clock,
    ids: {
      next: (kind) =>
        kind === 'logical-artifact'
          ? `ART-${randomUUID().toUpperCase()}`
          : `${kind}-${randomUUID()}`,
    },
  });
  const productRepository = createSecureEvidenceProductRepository({
    repository: rawProductRepository,
    service: artifactService,
    auditContext: () => ({
      organizationId: ORGANIZATION_ID,
      principalRef,
      requestId: `system-artifact-${randomUUID()}`,
      policyVersion: 'evidence-authz-policy/1',
    }),
  });

  let productSnapshot = await productRepository.snapshot();
  const caseScope = {
    caseId: CASE_ID,
    workspaceId,
    boundAt: caseNow,
  } as const;
  if (
    !productSnapshot.workspaces.some(
      (workspace) => workspace.workspaceId === workspaceId,
    )
  ) {
    await productRepository.putWorkspace(
      {
        schemaVersion: EVIDENCE_WORKSPACE_SCHEMA_VERSION,
        workspaceId,
        label: 'Rillford Annex — local review',
        dataPolicy: 'synthetic-only',
        evidenceRevision: 0,
        createdAt: clock.now(),
      },
      caseScope,
    );
  }
  await bindLegacySyntheticCaseObjects({
    repository: rawProductRepository,
    caseId: CASE_ID,
    workspaceId,
    boundAt: caseNow,
  });
  const legacyCaseSnapshot = await rawProductRepository.caseSnapshot(
    CASE_ID,
    workspaceId,
  );
  for (const source of legacyCaseSnapshot.sources) {
    if (source.text === '[ACME encrypted artifact representation]') continue;
    await artifactService.secureSource({
      source,
      scope: caseScope,
      commandKey: `legacy-secure-${source.artifactVersionId}`,
      audit: {
        organizationId: ORGANIZATION_ID,
        principalRef,
        requestId: `startup-artifact-${source.artifactVersionId}`,
        policyVersion: 'evidence-authz-policy/1',
      },
    });
  }
  const reconciliation = await artifactService.reconcile({
    scope: caseScope,
    now: clock.now(),
    audit: {
      organizationId: ORGANIZATION_ID,
      principalRef,
      requestId: `startup-artifact-reconcile-${CASE_ID}`,
      policyVersion: 'evidence-case-auth-policy/1',
    },
  });
  if (reconciliation.integrityFailures > 0)
    throw new Error(
      `Artifact reconciliation found ${String(reconciliation.integrityFailures)} integrity failure(s).`,
    );
  productSnapshot = await productRepository.snapshot();
  await reconcileEvidenceCases({
    identity: await identityRepository.snapshot(),
    product: productSnapshot,
  });
  const boundIdentity = await identityRepository.snapshot();
  for (const workspace of productSnapshot.workspaces) {
    const binding = boundIdentity.workspaceBindings.find(
      (item) => item.workspaceId === workspace.workspaceId,
    );
    if (
      binding === undefined ||
      !boundIdentity.memberships.some(
        (item) =>
          item.organizationId === binding.organizationId &&
          item.role === 'organization-admin' &&
          item.status === 'active',
      )
    ) {
      throw new Error(
        `Workspace ${workspace.workspaceId} has no bound organization with an active administrator.`,
      );
    }
  }
  const gateway = fixtureGateway(
    seedFixtures,
    lateFixture,
    [preLateRelate, fullRelate].filter(
      (fixture): fixture is RelateFixture => fixture !== null,
    ),
    assessmentFixtures,
    clock,
  );
  const engine = createExecutionEngine({
    clock,
    ids,
    modules: createModuleRegistry([evidenceModule]),
    contracts: createContractRegistry([
      evidenceObserveArtifactContractV1,
      evidenceObserveArtifactContractV2,
      evidenceObserveArtifactContractV3,
      evidenceObserveArtifactContractV4,
      evidenceObserveArtifactContractV5,
      evidenceObserveArtifactContractV6,
      evidenceObserveArtifactContractV7,
      evidenceObserveArtifactContractV8,
      evidenceObserveArtifactContractV9,
      evidenceObserveArtifactContractV10,
      evidenceObserveArtifactContractV11,
      evidenceObserveArtifactContract,
      evidenceRelateObservationsContractV1,
      evidenceRelateObservationsContract,
      evidenceProposeAssessmentContractV1,
      evidenceProposeAssessmentContractV2,
      evidenceProposeAssessmentContract,
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
        const before = await ledger.snapshot();
        const expectedStateRevision =
          before.state.snapshots.at(-1)?.revision ?? 0;
        const fixtures = [
          ...seedFixtures,
          ...(lateFixture === null ? [] : [lateFixture]),
        ];
        const matched = fixtures.find(
          (fixture) =>
            fixture.input.artifactVersion.artifactVersionId ===
            value.artifactVersion.artifactVersionId,
        );
        const input = matched?.input ?? {
          schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V3,
          artifactVersion: value.artifactVersion,
          actorRoster: value.actorRoster,
          coverageWindow: {
            sourceSegmentIds: [
              ...evidenceCoverageWindowForSource(value.artifactVersion.text)
                .sourceSegmentIds,
            ],
          },
          sourceStructureId: deriveEvidenceSourceStructure(
            value.artifactVersion.text,
          ).structureId,
        };
        const result = await engine.execute(
          {
            requestKey: value.requestKey,
            namespace: 'evidence',
            task: 'observe-artifact',
            entityId: value.workspaceId,
            expectedRevision: expectedStateRevision,
            input,
            model: OBSERVE_SELECTION,
            policy: { retention: 'encrypted-payload' },
          },
          { signal: value.signal },
        );
        if (result.status !== 'committed')
          throw new Error(result.error.message);
        const evidence = await ledger.snapshot();
        const latestState = evidence.state.snapshots.at(-1);
        if (latestState === undefined)
          throw new Error('Evidence state missing after observation.');
        const observations = evidence.memoryRecords.flatMap((record) => {
          const parsed = EvidenceObservationSchema.safeParse(record.value);
          return parsed.success &&
            parsed.data.artifactVersionId ===
              value.artifactVersion.artifactVersionId
            ? [parsed.data]
            : [];
        });
        return {
          revision: EvidenceStateSchema.parse(latestState.value)
            .evidenceRevision,
          stateRevision: latestState.revision,
          observations,
          replayed: result.replayed,
        };
      },
    },
    assessmentExecutor: {
      async propose({ command }) {
        const fixture = assessmentFixtures.find(
          ({ input }) => input.sequence === command.sequence,
        );
        if (fixture === undefined)
          throw new RangeError(
            `No assessment fixture for sequence ${String(command.sequence)}.`,
          );
        if (
          fixture.input.workspaceId !== command.workspaceId ||
          fixture.input.predecessorAssessmentVersionId !==
            command.predecessorAssessmentVersionId
        )
          throw new RangeError(
            'Assessment command does not match its fixed fixture.',
          );
        const snapshot = await productRepository.snapshot();
        const workspace = snapshot.workspaces.find(
          (value) => value.workspaceId === command.workspaceId,
        );
        if (workspace === undefined)
          throw new RangeError('Unknown assessment workspace.');
        if (
          fixture.input.schemaVersion !== 'evidence-propose-assessment-input/1'
        )
          throw new RangeError('Synthetic assessment fixture version changed.');
        const requiredReviewedIds = [
          ...fixture.input.acceptedObservationIds,
          ...fixture.input.acceptedRelationIds,
        ];
        const unaccepted = requiredReviewedIds.filter((targetVersionId) => {
          const decision = effectiveReviewDecision(
            snapshot.reviewDecisions,
            targetVersionId,
          );
          return decision?.action !== 'accept';
        });
        if (unaccepted.length > 0)
          throw new RangeError(
            `Assessment requires accepted source evidence: ${unaccepted.join(', ')}.`,
          );
        const beforeAssessment = await ledger.snapshot();
        const expectedStateRevision =
          beforeAssessment.state.snapshots.at(-1)?.revision ?? 0;
        const result = await engine.execute({
          requestKey: `assessment:${fixture.caseId}`,
          namespace: 'evidence',
          task: 'propose-assessment',
          entityId: command.workspaceId,
          expectedRevision: expectedStateRevision,
          input: fixture.input,
          model: ASSESSMENT_SELECTION,
          policy: { retention: 'encrypted-payload' },
        });
        if (result.status !== 'committed')
          throw new Error(result.error.message);
        const evidence = await ledger.snapshot();
        const assessment = evidence.documents
          .map(({ value }) => EvidenceAssessmentSchema.safeParse(value))
          .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
          .find(
            ({ assessmentVersionId }) =>
              assessmentVersionId === fixture.expectedAssessmentVersionId,
          );
        if (assessment === undefined)
          throw new Error('Assessment document missing after commit.');
        return { assessment, replayed: result.replayed };
      },
    },
    postImportExecutor: {
      async afterImport({ command, expectedStateRevision, signal }) {
        if (
          fullRelate === null ||
          command.artifactVersion.logicalArtifactId !== 'EVAL-E01'
        )
          return null;
        const result = await engine.execute(
          {
            requestKey: `relate:${fullRelate.commandKey}`,
            namespace: 'evidence',
            task: 'relate-observations',
            entityId: command.workspaceId,
            expectedRevision: expectedStateRevision,
            input: fullRelate.input,
            model: RELATE_SELECTION,
            policy: { retention: 'encrypted-payload' },
          },
          { signal },
        );
        if (result.status !== 'committed')
          throw new Error(result.error.message);
        const [evidence, product] = await Promise.all([
          ledger.snapshot(),
          productRepository.snapshot(),
        ]);
        const memories = evidence.memoryRecords.flatMap((record) => {
          const parsed = EvidenceMemoryValueSchema.safeParse(record.value);
          return parsed.success ? [parsed.data] : [];
        });
        const existingRelations = new Set(
          product.relations.map(({ relationId }) => relationId),
        );
        const existingQuestions = new Set(
          product.openQuestions.map(({ openQuestionId }) => openQuestionId),
        );
        const latestState = evidence.state.snapshots.at(-1);
        if (latestState === undefined)
          throw new Error('Evidence state missing after relation analysis.');
        return {
          revision: EvidenceStateSchema.parse(latestState.value)
            .evidenceRevision,
          relations: memories.flatMap((value) => {
            const parsed = EvidenceRelationSchema.safeParse(value);
            return parsed.success &&
              !existingRelations.has(parsed.data.relationId)
              ? [parsed.data]
              : [];
          }),
          openQuestions: memories.flatMap((value) => {
            const parsed = EvidenceOpenQuestionSchema.safeParse(value);
            return parsed.success &&
              !existingQuestions.has(parsed.data.openQuestionId)
              ? [parsed.data]
              : [];
          }),
        };
      },
    },
  });

  let seededThisProcess = false;
  // Seed when no sources yet, or when sources exist without observations
  // (partial prior startup) and this process still requested a seed mode.
  const needsSeed =
    seedFixtures.length > 0 &&
    (productSnapshot.sources.length === 0 ||
      productSnapshot.observations.length === 0);
  if (needsSeed) {
    for (const fixture of seedFixtures) {
      const job = await worker.start(
        {
          schemaVersion: 'evidence-import-command/1',
          workspaceId,
          commandKey: fixture.commandKey,
          artifactVersion: fixture.input.artifactVersion,
          actorRoster: fixture.input.actorRoster,
        },
        caseScope,
      );
      const completed = await worker.wait(job.jobId, caseScope);
      if (completed.phase !== 'completed') throw new Error(completed.message);
    }
    seededThisProcess = true;
    productSnapshot = await productRepository.snapshot();
  }

  if (
    preLateRelate !== null &&
    seededThisProcess &&
    (productSnapshot.relations?.length ?? 0) === 0
  ) {
    const workspace = productSnapshot.workspaces.find(
      (workspace) => workspace.workspaceId === workspaceId,
    );
    if (workspace === undefined)
      throw new Error('Workspace missing before relation seed.');
    const result = await engine.execute({
      requestKey: `relate:${preLateRelate.commandKey}`,
      namespace: 'evidence',
      task: 'relate-observations',
      entityId: workspaceId,
      expectedRevision: workspace.evidenceRevision,
      input: preLateRelate.input,
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
    await productRepository.putRelations(relations, caseScope);
    await productRepository.putOpenQuestions(openQuestions, caseScope);
    await productRepository.advanceEvidenceRevision(
      workspaceId,
      workspace.evidenceRevision,
      result.revision,
    );
    await productRepository.putChangeSet(
      {
        schemaVersion: EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
        workspaceId,
        commandKey: preLateRelate.commandKey,
        recordedAt: clock.now(),
        changeSet: createEvidenceChangeSet({
          fromEvidenceRevision: workspace.evidenceRevision,
          toEvidenceRevision: result.revision,
          addedArtifactVersionIds: [],
          addedObservationIds: [],
          addedRelationIds: relations.map(({ relationId }) => relationId),
          addedOpenQuestionIds: openQuestions.map(
            ({ openQuestionId }) => openQuestionId,
          ),
          standingChanges: [],
          actorReferenceKeys: [],
          relationEndpointIds: relations.flatMap(({ endpoints }) =>
            endpoints.map(({ id }) => id),
          ),
          temporalBounds: relations.flatMap(
            ({ comparableScope }) => comparableScope.temporalBounds,
          ),
        }),
      },
      caseScope,
    );
  }

  const liveObservation =
    liveCapability === null
      ? undefined
      : createEvidenceLiveObservationService({
          capability: liveCapability,
          repository: productRepository,
          artifacts: artifactService,
          worker,
          ledger,
          clock,
          engineIds: ids,
          productIds: reviewIds,
          ...(options.live?.afterObservationEngineCommit === undefined
            ? {}
            : {
                afterEngineCommit: options.live.afterObservationEngineCommit,
              }),
        });
  const liveRelation =
    liveCapability === null
      ? undefined
      : createEvidenceLiveRelationService({
          capability: liveCapability,
          repository: productRepository,
          worker,
          ledger,
          clock,
          engineIds: ids,
          productIds: reviewIds,
          ...(options.live?.afterRelationEngineCommit === undefined
            ? {}
            : { afterEngineCommit: options.live.afterRelationEngineCommit }),
        });
  const liveAssessment =
    liveCapability === null
      ? undefined
      : createEvidenceLiveAssessmentService({
          capability: liveCapability,
          repository: productRepository,
          worker,
          ledger,
          clock,
          engineIds: ids,
          productIds: reviewIds,
          ...(options.live?.afterAssessmentEngineCommit === undefined
            ? {}
            : { afterEngineCommit: options.live.afterAssessmentEngineCommit }),
        });

  const server = createEvidenceWorkbenchApi({
    repository: productRepository,
    worker,
    clock,
    ids: reviewIds,
    workspaceId,
    caseId: CASE_ID,
    auth: {
      sessions,
      repository: identityRepository,
      cookieName:
        options.secureCookies === true ? 'acme_session' : 'acme_session_dev',
      secureCookies: options.secureCookies ?? false,
      ...(options.publicOrigin === undefined
        ? {}
        : { publicOrigin: options.publicOrigin }),
    },
    artifactSecurity: artifactService,
    ingestion: ingestionService,
    stageA: { enabled: liveCapability !== null },
    ...(liveObservation === undefined ? {} : { liveObservation }),
    ...(liveRelation === undefined ? {} : { liveRelation }),
    ...(liveAssessment === undefined ? {} : { liveAssessment }),
    ...(lateFixture === null
      ? {}
      : {
          lateEvidenceCommand: {
            schemaVersion: 'evidence-import-command/1' as const,
            workspaceId,
            commandKey: lateFixture.commandKey,
            artifactVersion: lateFixture.input.artifactVersion,
            actorRoster: lateFixture.input.actorRoster,
          },
        }),
    technicalAudit: { enabled: false },
    async evidenceProjection(requestedWorkspaceId: string) {
      const evidence = await ledger.snapshot();
      // Scoped to the requested workspace: the globally latest snapshot
      // belongs to whichever case committed last, which is not necessarily
      // the case being read.
      const latest = evidence.state.snapshots
        .filter(
          (item) =>
            item.namespace === 'evidence' &&
            item.entityId === requestedWorkspaceId,
        )
        .sort((left, right) => left.revision - right.revision)
        .at(-1);
      return latest === undefined
        ? initialEvidenceState()
        : EvidenceStateSchema.parse(latest.value);
    },
  });
  return {
    server,
    worker,
    productRepository,
    artifactService,
    ingestionService,
    artifactObjectStore: artifacts.objectStore,
    ledger,
    gateway,
    liveCapability,
    engine,
    workspaceId,
    caseId: CASE_ID,
    identityRepository,
    sessions,
    authCredentials: {
      email: authIdentity.email,
      password:
        options.authenticator === undefined
          ? DEVELOPMENT_AUTH_PASSWORD
          : undefined,
    },
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
