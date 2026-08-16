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
  type EvidenceObservation,
  EvidenceObservationSchema,
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
  planEvidenceStructuralObservationCoverage,
  evidenceObserveArtifactContractV11,
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
    /** `null` when the deployment declines to cap the campaign. */
    readonly maxModelCalls: number | null;
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

/**
 * The observations one execution produced for one source.
 *
 * Selecting on the artifact alone re-collects every observation any earlier
 * run produced for the same source, so a repeated analysis re-projects
 * historical records as if they were this run's output. Resume is unaffected:
 * a resumed execution keeps its original identity, so its own records still
 * match.
 */
export function selectExecutionObservations(input: {
  readonly records: RepositoryEvidence['memoryRecords'];
  readonly executionId: string;
  readonly artifactVersionId: string;
}): readonly EvidenceObservation[] {
  return input.records.flatMap((record) => {
    if (
      !record.provenance.some((item) => item.executionId === input.executionId)
    )
      return [];
    const parsed = EvidenceObservationSchema.safeParse(record.value);
    return parsed.success &&
      parsed.data.artifactVersionId === input.artifactVersionId
      ? [parsed.data]
      : [];
  });
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

/** One primary plus one ADR-0045 §5 repair. */
export const EVIDENCE_LIVE_REPAIR_BUDGET = 1 as const;
export const EVIDENCE_LIVE_PROVIDER_CALL_CEILING = 2 as const;

export function deriveEvidenceObservationWindowRequestKey(
  commandKey: string,
  windowIndex: number,
): string {
  return `live-observe:${commandKey}:w${String(windowIndex).padStart(5, '0')}`;
}

export function createEvidenceSingleCallGateway(input: {
  readonly gateway: ModelGateway;
  readonly calls: { value: number };
  readonly maxCalls?: number;
}): ModelGateway {
  const maxCalls = input.maxCalls ?? 1;
  return {
    capabilities: (selection) => input.gateway.capabilities(selection),
    async generate(request, context) {
      if (input.calls.value >= maxCalls) {
        const error = new Error('LIVE_MODEL_CALL_BUDGET_EXHAUSTED') as Error & {
          code: string;
          actualModelCalls: number;
        };
        error.code = 'LIVE_MODEL_CALL_BUDGET_EXHAUSTED';
        error.actualModelCalls = input.calls.value;
        throw error;
      }
      input.calls.value += 1;
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
    readonly actualModelCalls: number;
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
    async observe({ command, signal, onProgress }) {
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
      const windows = planEvidenceStructuralObservationCoverage(source.text);
      const collected: EvidenceObservation[] = [];
      let actualModelCalls = 0;
      let lastExecutionId = '';
      let lastReplayed = true;
      for (const window of windows) {
        await onProgress?.({
          windowIndex: window.index + 1,
          windowCount: windows.length,
          actualModelCalls,
          lastExecutionId,
        });
        const requestKey = deriveEvidenceObservationWindowRequestKey(
          command.commandKey,
          window.index,
        );
        const executionId = deriveExecutionId('evidence', requestKey);
        const evidence = await options.ledger.snapshot();
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
        const calls: { value: number } = { value: 0 };
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
            evidenceObserveArtifactContractV6,
            evidenceObserveArtifactContractV7,
            evidenceObserveArtifactContractV8,
            evidenceObserveArtifactContractV9,
            evidenceObserveArtifactContractV10,
            evidenceObserveArtifactContractV11,
            evidenceObserveArtifactContract,
            evidenceRelateObservationsContract,
            evidenceProposeAssessmentContractV1,
            evidenceProposeAssessmentContract,
          ]),
          pipeline: createResponsePipeline(),
          gateway: createEvidenceSingleCallGateway({
            gateway: input.run.gateway,
            calls,
            maxCalls: EVIDENCE_LIVE_PROVIDER_CALL_CEILING,
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
              schemaVersion: 'evidence-observe-artifact-input/3',
              artifactVersion: source,
              actorRoster: command.actorRoster,
              coverageWindow: {
                sourceSegmentIds: [...window.sourceSegmentIds],
                ...(window.contextSegmentIds.length === 0
                  ? {}
                  : {
                      contextSegmentIds: [...window.contextSegmentIds],
                    }),
              },
              sourceStructureId: window.structureId,
            },
            model: input.run.selection('observe-artifact'),
            policy: {
              timeoutMs: 120_000,
              maxModelCalls: 1,
              maxRepairCalls: EVIDENCE_LIVE_REPAIR_BUDGET,
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
        actualModelCalls += calls.value;
        lastExecutionId = executionId;
        if (result.status !== 'committed') {
          const error = new Error(result.error.code) as Error & {
            code: string;
            actualModelCalls: number;
          };
          error.code = result.error.code;
          error.actualModelCalls = actualModelCalls;
          throw error;
        }
        lastReplayed = lastReplayed && (calls.value === 0 || result.replayed);
        try {
          await options.afterEngineCommit?.();
        } catch {
          const error = new Error(
            'LIVE_PRODUCT_PROJECTION_INTERRUPTED',
          ) as Error & {
            code: string;
            actualModelCalls: number;
          };
          error.code = 'LIVE_PRODUCT_PROJECTION_INTERRUPTED';
          error.actualModelCalls = actualModelCalls;
          throw error;
        }
        const committed = await options.ledger.snapshot();
        collected.push(
          ...selectExecutionObservations({
            records: committed.memoryRecords,
            executionId,
            artifactVersionId: command.artifactVersionId,
          }),
        );
      }
      if (collected.length === 0)
        throw new EvidenceLiveObservationRefused(
          'LIVE_OBSERVATION_EMPTY_RESULT',
        );
      const finalEvidence = await options.ledger.snapshot();
      const state = finalEvidence.state.snapshots
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
        executionId: lastExecutionId,
        evidenceRevision: EvidenceStateSchema.parse(state.value)
          .evidenceRevision,
        observations: collected,
        replayed: lastReplayed,
        actualModelCalls,
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
