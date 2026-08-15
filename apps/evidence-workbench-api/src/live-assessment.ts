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
  EVIDENCE_LIVE_ASSESSMENT_COMMAND_SCHEMA_VERSION,
  EvidenceLiveAssessmentCommandSchema,
  EvidenceStageATextImportRecordSchema,
  deriveEvidenceLiveAssessmentJobId,
  effectiveReviewDecision,
  type EvidenceArtifactReadAuditContext,
  type EvidenceCaseLiveAssessmentCommand,
  type EvidenceCaseObjectScope,
  type EvidenceLiveAssessmentJob,
  type EvidenceProductClock,
  type EvidenceProductIds,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceLiveAssessmentExecutor,
  EvidenceWorkbenchWorker,
} from '@acme/evidence-workbench-worker';
import {
  EvidenceAssessmentSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
  evidenceObserveArtifactContractV1,
  evidenceObserveArtifactContractV2,
  evidenceProposeAssessmentContract,
  evidenceProposeAssessmentContractV1,
  evidenceRelateObservationsContract,
} from '@acme/module-evidence';

import {
  EvidenceLiveRefused,
  type EvidenceAuthorizedLiveRun,
  type EvidenceLiveCapability,
} from './live.js';
import { createEvidenceSingleCallGateway } from './live-observation.js';

interface SnapshotExecutionRepository {
  snapshot(): RepositoryEvidence | Promise<RepositoryEvidence>;
}

export class EvidenceLiveAssessmentRefused extends Error {
  constructor(
    readonly reason: string,
    readonly status: 403 | 404 = 403,
  ) {
    super(reason);
    this.name = 'EvidenceLiveAssessmentRefused';
  }
}

export interface EvidenceLiveAssessmentService {
  refuse(input: {
    readonly reasonCode: string;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): Promise<void>;
  start(input: {
    readonly command: EvidenceCaseLiveAssessmentCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): Promise<EvidenceLiveAssessmentJob>;
}

function reasonFor(error: unknown): string {
  if (error instanceof EvidenceLiveRefused) return error.reason;
  if (error instanceof EvidenceLiveAssessmentRefused) return error.reason;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  )
    return error.code;
  return error instanceof Error
    ? `LIVE_ASSESSMENT_${error.name.replaceAll(/[^A-Za-z0-9]+/gu, '_').toUpperCase()}`
    : 'LIVE_ASSESSMENT_REFUSED';
}

export function createEvidenceLiveAssessmentService(options: {
  readonly capability: EvidenceLiveCapability;
  readonly repository: EvidenceProductRepository;
  readonly worker: EvidenceWorkbenchWorker;
  readonly ledger: SnapshotExecutionRepository & ExecutionRepository;
  readonly clock: Clock & EvidenceProductClock;
  readonly engineIds: IdGenerator;
  readonly productIds: EvidenceProductIds;
  readonly afterEngineCommit?: () => void | Promise<void>;
}): EvidenceLiveAssessmentService {
  const appendAudit = async (input: {
    readonly action:
      | 'live-assessment.refused'
      | 'live-assessment.started'
      | 'live-assessment.completed'
      | 'live-assessment.failed';
    readonly outcome: 'succeeded' | 'denied' | 'failed';
    readonly reasonCode: string;
    readonly resourceKind: 'case' | 'live-execution';
    readonly resourceId: string;
    readonly actualModelCalls: 0 | 1;
    readonly command?: EvidenceCaseLiveAssessmentCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }) =>
    options.repository.appendSecurityAudit(
      EvidenceSecurityAuditEventSchema.parse({
        schemaVersion: 'evidence-security-audit-event/4',
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
        task: 'propose-assessment',
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
    readonly browserCommand: EvidenceCaseLiveAssessmentCommand;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly audit: EvidenceArtifactReadAuditContext;
    readonly scope: EvidenceCaseObjectScope;
  }): EvidenceLiveAssessmentExecutor => ({
    async assess({ command, signal }) {
      const jobId = deriveEvidenceLiveAssessmentJobId(command);
      await appendAudit({
        action: 'live-assessment.started',
        outcome: 'succeeded',
        reasonCode: 'LIVE_ASSESSMENT_STARTED',
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
      const observationMap = new Map(
        product.observations.map((item) => [item.observationId, item]),
      );
      const relationMap = new Map(
        product.relations.map((item) => [item.relationId, item]),
      );
      const questionMap = new Map(
        product.openQuestions.map((item) => [item.openQuestionId, item]),
      );
      const acceptedObservations = command.observationIds.map((id) =>
        observationMap.get(id),
      );
      const acceptedRelations = command.relationIds.map((id) =>
        relationMap.get(id),
      );
      const acceptedOpenQuestions = command.openQuestionIds.map((id) =>
        questionMap.get(id),
      );
      if (
        [
          ...acceptedObservations,
          ...acceptedRelations,
          ...acceptedOpenQuestions,
        ].some((item) => item === undefined)
      )
        throw new EvidenceLiveAssessmentRefused(
          'LIVE_ASSESSMENT_EVIDENCE_UNAVAILABLE',
          404,
        );
      const evidence = await options.ledger.snapshot();
      const requestKey = `live-assess:${command.commandKey}`;
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
          task: 'propose-assessment',
          entityId: command.workspaceId,
          expectedRevision:
            existingExecution?.request.expectedRevision ??
            latestState?.revision ??
            0,
          input: {
            schemaVersion: 'evidence-propose-assessment-input/2',
            workspaceId: command.workspaceId,
            sequence: command.sequence,
            basisEvidenceRevision: command.basisEvidenceRevision,
            acceptedObservations,
            acceptedRelations,
            acceptedOpenQuestions,
            predecessorAssessmentVersionId:
              command.predecessorAssessmentVersionId,
          },
          model: input.run.selection('propose-assessment'),
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
          'LIVE_ASSESSMENT_PRODUCT_PROJECTION_INTERRUPTED',
        ) as Error & { code: string; actualModelCalls: 0 | 1 };
        error.code = 'LIVE_ASSESSMENT_PRODUCT_PROJECTION_INTERRUPTED';
        error.actualModelCalls = calls.value;
        throw error;
      }
      const committed = await options.ledger.snapshot();
      const assessment = committed.documents
        .flatMap((record) => {
          const parsed = EvidenceAssessmentSchema.safeParse(record.value);
          return parsed.success ? [parsed.data] : [];
        })
        .find(
          (value) =>
            value.workspaceId === command.workspaceId &&
            value.sequence === command.sequence &&
            value.basisEvidenceRevision === command.basisEvidenceRevision &&
            value.predecessorAssessmentVersionId ===
              command.predecessorAssessmentVersionId,
        );
      if (assessment === undefined)
        throw new EvidenceLiveAssessmentRefused('LIVE_ASSESSMENT_EMPTY_RESULT');
      return {
        executionId,
        assessment,
        replayed: calls.value === 0 || result.replayed,
        actualModelCalls: calls.value,
      };
    },
    async settle(settlement) {
      await appendAudit({
        action:
          settlement.phase === 'completed'
            ? 'live-assessment.completed'
            : 'live-assessment.failed',
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
        action: 'live-assessment.refused',
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
        const workspace = snapshot.workspaces.find(
          (item) => item.workspaceId === input.scope.workspaceId,
        );
        if (workspace === undefined)
          throw new EvidenceLiveAssessmentRefused(
            'LIVE_ASSESSMENT_CASE_UNAVAILABLE',
            404,
          );
        const standings = new Map(
          snapshot.observations.map((item) => [item.observationId, 'current']),
        );
        for (const changeSet of [...snapshot.changeSets].sort(
          (a, b) =>
            a.recordedAt.localeCompare(b.recordedAt) ||
            a.commandKey.localeCompare(b.commandKey),
        ))
          for (const change of changeSet.changeSet.standingChanges)
            if (standings.has(change.objectId))
              standings.set(change.objectId, change.to);
        const accepted = (kind: 'observation' | 'relation', id: string) =>
          effectiveReviewDecision(
            snapshot.reviewDecisions.filter((item) => item.targetKind === kind),
            id,
          )?.action === 'accept';
        const observations = snapshot.observations
          .filter(
            (item) =>
              standings.get(item.observationId) === 'current' &&
              accepted('observation', item.observationId),
          )
          .sort((a, b) => a.observationId.localeCompare(b.observationId));
        const observationIds = new Set(
          observations.map((item) => item.observationId),
        );
        const relations = snapshot.relations
          .filter(
            (item) =>
              accepted('relation', item.relationId) &&
              item.endpoints.every(
                (endpoint) =>
                  endpoint.kind !== 'observation' ||
                  observationIds.has(endpoint.id),
              ),
          )
          .sort((a, b) => a.relationId.localeCompare(b.relationId));
        const questions = [...snapshot.openQuestions].sort((a, b) =>
          a.openQuestionId.localeCompare(b.openQuestionId),
        );
        if (observations.length === 0 || relations.length === 0)
          throw new EvidenceLiveAssessmentRefused(
            'LIVE_ASSESSMENT_ACCEPTED_EVIDENCE_REQUIRED',
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
        const authorities = observations.map((item) =>
          imports.get(item.artifactVersionId),
        );
        if (authorities.some((item) => item === undefined))
          throw new EvidenceLiveAssessmentRefused(
            'LIVE_ASSESSMENT_SOURCE_UNAVAILABLE',
            404,
          );
        const authority = authorities[0];
        if (authority === undefined)
          throw new EvidenceLiveAssessmentRefused(
            'LIVE_ASSESSMENT_ACCEPTED_EVIDENCE_REQUIRED',
          );
        const previous = [...snapshot.assessments]
          .sort(
            (a, b) =>
              a.sequence - b.sequence ||
              a.assessmentVersionId.localeCompare(b.assessmentVersionId),
          )
          .at(-1);
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
        const command = EvidenceLiveAssessmentCommandSchema.parse({
          ...input.command,
          schemaVersion: EVIDENCE_LIVE_ASSESSMENT_COMMAND_SCHEMA_VERSION,
          workspaceId: input.scope.workspaceId,
          modelId: run.profile.model,
          currency: run.profile.currency,
          sequence: (previous?.sequence ?? 0) + 1,
          basisEvidenceRevision: workspace.evidenceRevision,
          observationIds: observations.map((item) => item.observationId),
          relationIds: relations.map((item) => item.relationId),
          openQuestionIds: questions.map((item) => item.openQuestionId),
          predecessorAssessmentVersionId: previous?.assessmentVersionId ?? null,
        });
        return await options.worker.startLiveAssessment(
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
          error instanceof EvidenceLiveAssessmentRefused ? error.status : 403;
        await appendAudit({
          action: 'live-assessment.refused',
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
        throw new EvidenceLiveAssessmentRefused(reason, status);
      }
    },
  };
}
