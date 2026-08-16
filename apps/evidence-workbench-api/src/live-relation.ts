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
  type RepositoryEvidence,
} from '@acme/core';
import type { EvidenceCaseAuthorizationContext } from '@acme/evidence-auth';
import { EvidenceSecurityAuditEventSchema } from '@acme/evidence-artifacts';
import {
  EVIDENCE_LIVE_RELATION_COMMAND_SCHEMA_VERSION,
  EvidenceLiveRelationCommandSchema,
  EvidenceStageATextImportRecordSchema,
  deriveEvidenceLiveRelationJobId,
  type EvidenceArtifactReadAuditContext,
  type EvidenceCaseLiveRelationCommand,
  type EvidenceCaseObjectScope,
  type EvidenceLiveRelationJob,
  type EvidenceProductClock,
  type EvidenceProductIds,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceLiveRelationExecutor,
  EvidenceWorkbenchWorker,
} from '@acme/evidence-workbench-worker';
import {
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  EvidenceDeltaSchema,
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
  evidenceRelateObservationsContract,
  evidenceRelateObservationsContractV2,
} from '@acme/module-evidence';

import {
  EvidenceLiveRefused,
  type EvidenceAuthorizedLiveRun,
  type EvidenceLiveCapability,
} from './live.js';
import {
  createEvidenceSingleCallGateway,
  EVIDENCE_LIVE_PROVIDER_CALL_CEILING,
  EVIDENCE_LIVE_REPAIR_BUDGET,
} from './live-observation.js';

interface SnapshotExecutionRepository {
  snapshot(): RepositoryEvidence | Promise<RepositoryEvidence>;
}

export class EvidenceLiveRelationRefused extends Error {
  constructor(
    readonly reason: string,
    readonly status: 403 | 404 = 403,
  ) {
    super(reason);
    this.name = 'EvidenceLiveRelationRefused';
  }
}

export interface EvidenceLiveRelationService {
  refuse(input: {
    readonly reasonCode: string;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): Promise<void>;
  start(input: {
    readonly command: EvidenceCaseLiveRelationCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): Promise<EvidenceLiveRelationJob>;
}

function reasonFor(error: unknown): string {
  if (error instanceof EvidenceLiveRefused) return error.reason;
  if (error instanceof EvidenceLiveRelationRefused) return error.reason;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  )
    return error.code;
  return error instanceof Error
    ? `LIVE_RELATION_${error.name.replaceAll(/[^A-Za-z0-9]+/gu, '_').toUpperCase()}`
    : 'LIVE_RELATION_REFUSED';
}

export function createEvidenceLiveRelationService(options: {
  readonly capability: EvidenceLiveCapability;
  readonly repository: EvidenceProductRepository;
  readonly worker: EvidenceWorkbenchWorker;
  readonly ledger: SnapshotExecutionRepository & ExecutionRepository;
  readonly clock: Clock & EvidenceProductClock;
  readonly engineIds: IdGenerator;
  readonly productIds: EvidenceProductIds;
  readonly afterEngineCommit?: () => void | Promise<void>;
}): EvidenceLiveRelationService {
  const appendAudit = async (input: {
    readonly action:
      | 'live-relation.refused'
      | 'live-relation.started'
      | 'live-relation.completed'
      | 'live-relation.failed';
    readonly outcome: 'succeeded' | 'denied' | 'failed';
    readonly reasonCode: string;
    readonly resourceKind: 'case' | 'live-execution';
    readonly resourceId: string;
    readonly actualModelCalls: number;
    readonly command?: EvidenceCaseLiveRelationCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }) =>
    options.repository.appendSecurityAudit(
      EvidenceSecurityAuditEventSchema.parse({
        schemaVersion: 'evidence-security-audit-event/3',
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
        task: 'relate-observations',
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
    readonly browserCommand: EvidenceCaseLiveRelationCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): EvidenceLiveRelationExecutor => ({
    async relate({ command, signal }) {
      const jobId = deriveEvidenceLiveRelationJobId(command);
      await appendAudit({
        action: 'live-relation.started',
        outcome: 'succeeded',
        reasonCode: 'LIVE_RELATION_STARTED',
        resourceKind: 'live-execution',
        resourceId: jobId,
        actualModelCalls: 0,
        command: input.browserCommand,
        authorization: input.authorization,
        audit: input.audit,
        scope: input.scope,
      });
      const product = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const byId = new Map(
        product.observations.map((observation) => [
          observation.observationId,
          observation,
        ]),
      );
      const observations = command.observationIds.map((id) => {
        const observation = byId.get(id);
        if (observation === undefined)
          throw new EvidenceLiveRelationRefused(
            'LIVE_RELATION_OBSERVATIONS_UNAVAILABLE',
            404,
          );
        return observation;
      });
      const evidence = await options.ledger.snapshot();
      const requestKey = `live-relate:${command.commandKey}`;
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
          evidenceRelateObservationsContractV2,
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
          task: 'relate-observations',
          entityId: command.workspaceId,
          expectedRevision:
            existingExecution?.request.expectedRevision ??
            latestState?.revision ??
            0,
          input: {
            schemaVersion: 'evidence-relate-observations-input/1',
            observations,
          },
          model: input.run.selection('relate-observations'),
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
      if (result.status !== 'committed') {
        const error = new Error(result.error.code) as Error & {
          code: string;
          actualModelCalls: number;
        };
        error.code = result.error.code;
        error.actualModelCalls = calls.value;
        throw error;
      }
      try {
        await options.afterEngineCommit?.();
      } catch {
        const error = new Error(
          'LIVE_RELATION_PRODUCT_PROJECTION_INTERRUPTED',
        ) as Error & { code: string; actualModelCalls: number };
        error.code = 'LIVE_RELATION_PRODUCT_PROJECTION_INTERRUPTED';
        error.actualModelCalls = calls.value;
        throw error;
      }
      const committed = await options.ledger.snapshot();
      const produced = committed.memoryRecords.filter((record) =>
        record.provenance.some(
          (provenance) => provenance.executionId === executionId,
        ),
      );
      const relations = produced.flatMap((record) => {
        const parsed = EvidenceRelationSchema.safeParse(record.value);
        return parsed.success ? [parsed.data] : [];
      });
      const openQuestions = produced.flatMap((record) => {
        const parsed = EvidenceOpenQuestionSchema.safeParse(record.value);
        return parsed.success ? [parsed.data] : [];
      });
      if (relations.length === 0 && openQuestions.length === 0)
        throw new EvidenceLiveRelationRefused('LIVE_RELATION_EMPTY_RESULT');
      const transition = committed.state.transitions.find(
        (item) => item.executionId === executionId,
      );
      const standingChanges =
        transition === undefined
          ? []
          : EvidenceDeltaSchema.parse(transition.delta).standingChanges.filter(
              (change) => command.observationIds.includes(change.objectId),
            );
      return {
        executionId,
        relations,
        openQuestions,
        standingChanges,
        replayed: calls.value === 0 || result.replayed,
        actualModelCalls: calls.value,
      };
    },
    async settle(settlement) {
      await appendAudit({
        action:
          settlement.phase === 'completed'
            ? 'live-relation.completed'
            : 'live-relation.failed',
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
    async refuse(input) {
      await appendAudit({
        action: 'live-relation.refused',
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
      try {
        const snapshot = await options.repository.caseSnapshot(
          input.scope.caseId,
          input.scope.workspaceId,
        );
        const standings = new Map(
          snapshot.observations.map(({ observationId }) => [
            observationId,
            'current',
          ]),
        );
        for (const changeSet of [...snapshot.changeSets].sort(
          (left, right) =>
            left.recordedAt.localeCompare(right.recordedAt) ||
            left.commandKey.localeCompare(right.commandKey),
        ))
          for (const change of changeSet.changeSet.standingChanges)
            if (standings.has(change.objectId))
              standings.set(change.objectId, change.to);
        const observations = snapshot.observations
          .filter(
            ({ observationId }) => standings.get(observationId) === 'current',
          )
          .sort((left, right) =>
            left.observationId.localeCompare(right.observationId),
          );
        if (observations.length < 2)
          throw new EvidenceLiveRelationRefused(
            'LIVE_RELATION_OBSERVATIONS_REQUIRED',
            403,
          );
        const imports = new Map(
          snapshot.textImports.flatMap((value) => {
            if (
              value.schemaVersion !== 'evidence-text-import-record/2' ||
              value.state !== 'activated'
            )
              return [];
            const parsed = EvidenceStageATextImportRecordSchema.parse(value);
            return [[parsed.artifactVersionId, parsed] as const];
          }),
        );
        const authorities = observations.map((observation) =>
          imports.get(observation.artifactVersionId),
        );
        if (authorities.some((value) => value === undefined))
          throw new EvidenceLiveRelationRefused(
            'LIVE_RELATION_SOURCE_UNAVAILABLE',
            404,
          );
        const authority = authorities[0];
        if (authority === undefined)
          throw new EvidenceLiveRelationRefused(
            'LIVE_RELATION_OBSERVATIONS_REQUIRED',
            403,
          );
        const run = options.capability.authorize({
          confirmation: input.command.confirmation,
          authorization: input.authorization,
          source: {
            sourceOrigin: 'authorized-external',
            dataClass: authority.dataClass,
            artifactVersionId: authority.artifactVersionId,
            externalSourceRef: authority.sourceProvenance.externalSourceRef,
            authorityAttested: true,
          },
          requestedBudget: input.command.requestedBudget,
        });
        const command = EvidenceLiveRelationCommandSchema.parse({
          ...input.command,
          schemaVersion: EVIDENCE_LIVE_RELATION_COMMAND_SCHEMA_VERSION,
          workspaceId: input.scope.workspaceId,
          modelId: run.profile.model,
          currency: run.profile.currency,
          observationIds: observations.map(
            ({ observationId }) => observationId,
          ),
        });
        return await options.worker.startLiveRelation(
          command,
          executor({
            run,
            browserCommand: input.command,
            authorization: input.authorization,
            audit: input.audit,
            scope: input.scope,
          }),
          input.scope,
        );
      } catch (error) {
        const reason = reasonFor(error);
        const status =
          error instanceof EvidenceLiveRelationRefused ? error.status : 403;
        await appendAudit({
          action: 'live-relation.refused',
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
        throw new EvidenceLiveRelationRefused(reason, status);
      }
    },
  };
}
