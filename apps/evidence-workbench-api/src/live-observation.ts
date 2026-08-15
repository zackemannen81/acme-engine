import {
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
  type ModelGateway,
  type RepositoryEvidence,
} from '@acme/core';
import type { EvidenceCaseAuthorizationContext } from '@acme/evidence-auth';
import { EvidenceSecurityAuditEventSchema } from '@acme/evidence-artifacts';
import {
  EVIDENCE_LIVE_OBSERVATION_COMMAND_SCHEMA_VERSION,
  EvidenceLiveObservationCommandSchema,
  EvidenceStageATextImportRecordSchema,
  deriveEvidenceLiveObservationJobId,
  type EvidenceArtifactReadAuditContext,
  type EvidenceArtifactService,
  type EvidenceCaseLiveObservationCommand,
  type EvidenceCaseObjectScope,
  type EvidenceLiveObservationJob,
  type EvidenceProductClock,
  type EvidenceProductIds,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceLiveObservationExecutor,
  EvidenceWorkbenchWorker,
} from '@acme/evidence-workbench-worker';
import {
  EvidenceObservationSchema,
  EvidenceStateSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
  evidenceObserveArtifactContractV1,
  evidenceObserveArtifactContractV2,
  evidenceObserveArtifactContractV3,
  evidenceObserveArtifactContractV4,
  evidenceObserveArtifactContractV5,
  evidenceProposeAssessmentContract,
  evidenceProposeAssessmentContractV1,
  evidenceRelateObservationsContract,
} from '@acme/module-evidence';

import {
  EvidenceLiveRefused,
  type EvidenceAuthorizedLiveRun,
  type EvidenceLiveCapability,
} from './live.js';

interface SnapshotExecutionRepository {
  snapshot(): RepositoryEvidence | Promise<RepositoryEvidence>;
}

export class EvidenceLiveObservationRefused extends Error {
  constructor(
    readonly reason: string,
    readonly status: 403 | 404 = 403,
  ) {
    super(reason);
    this.name = 'EvidenceLiveObservationRefused';
  }
}

export interface EvidenceLiveObservationService {
  readonly deployment: {
    readonly model: string;
    readonly maxModelCalls: number;
    readonly costCeilingMinor: number | null;
    readonly currency: string | null;
  };
  refuse(input: {
    readonly reasonCode: string;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): Promise<void>;
  start(input: {
    readonly command: EvidenceCaseLiveObservationCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): Promise<EvidenceLiveObservationJob>;
}

function reasonFor(error: unknown): string {
  if (error instanceof EvidenceLiveRefused) return error.reason;
  if (error instanceof EvidenceLiveObservationRefused) return error.reason;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  )
    return error.code;
  return 'LIVE_OBSERVATION_REFUSED';
}

export function createEvidenceSingleCallGateway(input: {
  readonly gateway: ModelGateway;
  readonly calls: { value: 0 | 1 };
}): ModelGateway {
  return {
    capabilities: (selection) => input.gateway.capabilities(selection),
    async generate(request, context) {
      if (input.calls.value >= 1) {
        const error = new Error('LIVE_MODEL_CALL_BUDGET_EXHAUSTED') as Error & {
          code: string;
          actualModelCalls: 1;
        };
        error.code = 'LIVE_MODEL_CALL_BUDGET_EXHAUSTED';
        error.actualModelCalls = 1;
        throw error;
      }
      input.calls.value = 1;
      return input.gateway.generate(request, context);
    },
  };
}

export function createEvidenceLiveObservationService(options: {
  readonly capability: EvidenceLiveCapability;
  readonly repository: EvidenceProductRepository;
  readonly artifacts: EvidenceArtifactService;
  readonly worker: EvidenceWorkbenchWorker;
  readonly ledger: SnapshotExecutionRepository & ExecutionRepository;
  readonly clock: Clock & EvidenceProductClock;
  readonly engineIds: IdGenerator;
  readonly productIds: EvidenceProductIds;
  readonly afterEngineCommit?: () => void | Promise<void>;
}): EvidenceLiveObservationService {
  const appendAudit = async (input: {
    readonly action:
      'live.refused' | 'live.started' | 'live.completed' | 'live.failed';
    readonly outcome: 'succeeded' | 'denied' | 'failed';
    readonly reasonCode: string;
    readonly resourceKind: 'case' | 'live-execution';
    readonly resourceId: string;
    readonly actualModelCalls: 0 | 1;
    readonly command?: EvidenceCaseLiveObservationCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }) =>
    options.repository.appendSecurityAudit(
      EvidenceSecurityAuditEventSchema.parse({
        schemaVersion: 'evidence-security-audit-event/2',
        auditEventId: options.productIds.next('security-audit'),
        organizationId: input.authorization.organizationId,
        caseId: input.scope.caseId,
        principalRef: input.authorization.principalRef,
        action: input.action,
        outcome: input.outcome,
        reasonCode: input.reasonCode,
        resourceKind: input.resourceKind,
        resourceId: input.resourceId,
        requestId: input.audit.requestId,
        policyVersion: input.authorization.policyVersion,
        keyId: null,
        keyVersion: null,
        beforeDigest: null,
        afterDigest: null,
        occurredAt: options.clock.now(),
        task: 'observe-artifact',
        modelId: options.capability.deployment.model,
        maxModelCalls: 1,
        actualModelCalls: input.actualModelCalls,
        costCeilingMinor:
          input.command?.requestedBudget.costCeilingMinor ?? null,
        currency: options.capability.deployment.currency,
      }),
      input.scope,
    );

  const executor = (input: {
    readonly run: EvidenceAuthorizedLiveRun;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
    readonly browserCommand: EvidenceCaseLiveObservationCommand;
  }): EvidenceLiveObservationExecutor => ({
    async observe({ command, signal }) {
      const jobId = deriveEvidenceLiveObservationJobId(command);
      await appendAudit({
        action: 'live.started',
        outcome: 'succeeded',
        reasonCode: 'LIVE_OBSERVATION_STARTED',
        resourceKind: 'live-execution',
        resourceId: jobId,
        actualModelCalls: 0,
        command: input.browserCommand,
        authorization: input.authorization,
        audit: input.audit,
        scope: input.scope,
      });
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const storedSource = snapshot.sources.find(
        ({ artifactVersionId }) =>
          artifactVersionId === command.artifactVersionId,
      );
      if (storedSource === undefined)
        throw new EvidenceLiveObservationRefused(
          'LIVE_OBSERVATION_SOURCE_UNAVAILABLE',
        );
      const source = await options.artifacts.readSource({
        snapshot,
        source: storedSource,
        scope: input.scope,
        audit: input.audit,
      });
      const evidence = await options.ledger.snapshot();
      const requestKey = `live-observe:${command.commandKey}`;
      const executionId = deriveExecutionId('evidence', requestKey);
      const existingExecution = evidence.executions.find(
        (item) => item.executionId === executionId,
      );
      const latestState = evidence.state.snapshots
        .filter(
          (item) =>
            item.namespace === 'evidence' &&
            item.entityId === command.workspaceId,
        )
        .sort((left, right) => left.revision - right.revision)
        .at(-1);
      const calls: { value: 0 | 1 } = { value: 0 };
      const engine = createExecutionEngine({
        clock: options.clock,
        ids: options.engineIds,
        modules: createModuleRegistry([evidenceModule]),
        contracts: createContractRegistry([
          evidenceObserveArtifactContractV1,
          evidenceObserveArtifactContractV2,
          evidenceObserveArtifactContractV3,
          evidenceObserveArtifactContractV4,
          evidenceObserveArtifactContractV5,
          evidenceObserveArtifactContract,
          evidenceRelateObservationsContract,
          evidenceProposeAssessmentContractV1,
          evidenceProposeAssessmentContract,
        ]),
        pipeline: createResponsePipeline(),
        gateway: createEvidenceSingleCallGateway({
          gateway: input.run.gateway,
          calls,
        }),
        memory: createMemoryEngine({ ids: options.engineIds }),
        state: createStateEngine(),
        repository: options.ledger,
      });
      const result = await engine.execute(
        {
          requestKey,
          namespace: 'evidence',
          task: 'observe-artifact',
          entityId: command.workspaceId,
          expectedRevision:
            existingExecution?.request.expectedRevision ??
            latestState?.revision ??
            0,
          input: {
            schemaVersion: 'evidence-observe-artifact-input/1',
            artifactVersion: source,
            actorRoster: command.actorRoster,
          },
          model: input.run.selection('observe-artifact'),
          policy: {
            timeoutMs: 120_000,
            maxModelCalls: 1,
            maxRepairCalls: 0,
            maxRevisionCalls: 0,
            ...(command.requestedBudget.costCeilingMinor === null
              ? {}
              : {
                  maxEstimatedCostMinor:
                    command.requestedBudget.costCeilingMinor,
                }),
            retention: 'encrypted-payload',
          },
        },
        { signal },
      );
      if (result.status !== 'committed') {
        const error = new Error(result.error.code) as Error & {
          code: string;
          actualModelCalls: 0 | 1;
        };
        error.code = result.error.code;
        error.actualModelCalls = calls.value;
        throw error;
      }
      try {
        await options.afterEngineCommit?.();
      } catch {
        const error = new Error(
          'LIVE_PRODUCT_PROJECTION_INTERRUPTED',
        ) as Error & {
          code: string;
          actualModelCalls: 0 | 1;
        };
        error.code = 'LIVE_PRODUCT_PROJECTION_INTERRUPTED';
        error.actualModelCalls = calls.value;
        throw error;
      }
      const committed = await options.ledger.snapshot();
      const observations = committed.memoryRecords.flatMap((record) => {
        const parsed = EvidenceObservationSchema.safeParse(record.value);
        return parsed.success &&
          parsed.data.artifactVersionId === command.artifactVersionId
          ? [parsed.data]
          : [];
      });
      if (observations.length === 0)
        throw new EvidenceLiveObservationRefused(
          'LIVE_OBSERVATION_EMPTY_RESULT',
        );
      const state = committed.state.snapshots
        .filter(
          (item) =>
            item.namespace === 'evidence' &&
            item.entityId === command.workspaceId,
        )
        .sort((left, right) => left.revision - right.revision)
        .at(-1);
      if (state === undefined)
        throw new EvidenceLiveObservationRefused(
          'LIVE_OBSERVATION_STATE_MISSING',
        );
      return {
        executionId,
        evidenceRevision: EvidenceStateSchema.parse(state.value)
          .evidenceRevision,
        observations,
        replayed: calls.value === 0 || result.replayed,
        actualModelCalls: calls.value,
      };
    },
    async settle(settlement) {
      await appendAudit({
        action:
          settlement.phase === 'completed' ? 'live.completed' : 'live.failed',
        outcome: settlement.phase === 'completed' ? 'succeeded' : 'failed',
        reasonCode: settlement.reasonCode,
        resourceKind: 'live-execution',
        resourceId: settlement.jobId,
        actualModelCalls: settlement.actualModelCalls,
        command: input.browserCommand,
        authorization: input.authorization,
        audit: input.audit,
        scope: input.scope,
      });
    },
  });

  return {
    deployment: Object.freeze({
      model: options.capability.deployment.model,
      maxModelCalls: options.capability.deployment.budget.maxModelCalls,
      costCeilingMinor: options.capability.deployment.budget.costCeilingMinor,
      currency: options.capability.deployment.currency,
    }),
    async refuse(input) {
      await appendAudit({
        action: 'live.refused',
        outcome: 'denied',
        reasonCode: input.reasonCode,
        resourceKind: 'case',
        resourceId: input.scope.caseId,
        actualModelCalls: 0,
        authorization: input.authorization,
        audit: input.audit,
        scope: input.scope,
      });
    },
    async start(input) {
      const sourceSnapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      try {
        const importedValue = sourceSnapshot.textImports.find(
          (item) =>
            item.schemaVersion === 'evidence-text-import-record/2' &&
            item.artifactVersionId === input.command.artifactVersionId &&
            item.state === 'activated',
        );
        const imported =
          importedValue === undefined
            ? undefined
            : EvidenceStageATextImportRecordSchema.parse(importedValue);
        const source = sourceSnapshot.sources.find(
          ({ artifactVersionId }) =>
            artifactVersionId === input.command.artifactVersionId,
        );
        if (imported === undefined || source === undefined)
          throw new EvidenceLiveObservationRefused(
            'LIVE_OBSERVATION_SOURCE_UNAVAILABLE',
            404,
          );
        const run = options.capability.authorize({
          confirmation: input.command.confirmation,
          authorization: input.authorization,
          source: {
            sourceOrigin: 'authorized-external',
            dataClass: imported.dataClass,
            artifactVersionId: imported.artifactVersionId,
            externalSourceRef: imported.sourceProvenance.externalSourceRef,
            authorityAttested: true,
          },
          requestedBudget: input.command.requestedBudget,
        });
        const command = EvidenceLiveObservationCommandSchema.parse({
          ...input.command,
          schemaVersion: EVIDENCE_LIVE_OBSERVATION_COMMAND_SCHEMA_VERSION,
          workspaceId: input.scope.workspaceId,
          modelId: run.profile.model,
          currency: run.profile.currency,
        });
        const job = await options.worker.startLiveObservation(
          command,
          executor({
            run,
            authorization: input.authorization,
            audit: input.audit,
            scope: input.scope,
            browserCommand: input.command,
          }),
          input.scope,
        );
        return job;
      } catch (error) {
        const reason = reasonFor(error);
        const status =
          error instanceof EvidenceLiveObservationRefused ? error.status : 403;
        await appendAudit({
          action: 'live.refused',
          outcome: 'denied',
          reasonCode: reason,
          resourceKind: 'case',
          resourceId: input.scope.caseId,
          actualModelCalls: 0,
          command: input.command,
          authorization: input.authorization,
          audit: input.audit,
          scope: input.scope,
        });
        throw new EvidenceLiveObservationRefused(reason, status);
      }
    },
  };
}
