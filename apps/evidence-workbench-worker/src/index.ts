import { sha256 } from '@acme/core';
import {
  EVIDENCE_PRODUCT_JOB_SCHEMA_VERSION,
  EVIDENCE_LIVE_OBSERVATION_JOB_SCHEMA_VERSION,
  EVIDENCE_LIVE_RELATION_JOB_SCHEMA_VERSION,
  EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
  EvidenceAnyProductJobSchema,
  EvidenceAssessmentCommandSchema,
  EvidenceImportCommandSchema,
  EvidenceLiveObservationCommandSchema,
  EvidenceLiveObservationJobSchema,
  EvidenceLiveRelationCommandSchema,
  EvidenceLiveRelationJobSchema,
  deriveEvidenceLiveObservationJobId,
  deriveEvidenceLiveRelationJobId,
  EvidenceProductCommandCollisionError,
  EvidenceProductJobSchema,
  EvidenceProductChangeSetSchema,
  type EvidenceAssessmentCommand,
  type EvidenceImportCommand,
  type EvidenceLiveObservationCommand,
  type EvidenceLiveObservationJob,
  type EvidenceLiveRelationCommand,
  type EvidenceLiveRelationJob,
  type EvidenceProductClock,
  type EvidenceCaseObjectScope,
  type EvidenceProductJob,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import {
  createEvidenceChangeSet,
  type EvidenceAssessment,
  type EvidenceObservation,
  type EvidenceOpenQuestion,
  type EvidenceRelation,
  type EvidenceStandingChange,
} from '@acme/module-evidence';

export interface EvidenceObservationExecutor {
  observe(input: {
    readonly workspaceId: string;
    readonly requestKey: string;
    readonly expectedRevision: number;
    readonly artifactVersion: EvidenceImportCommand['artifactVersion'];
    readonly actorRoster: EvidenceImportCommand['actorRoster'];
    readonly signal: AbortSignal;
  }): Promise<{
    readonly revision: number;
    readonly stateRevision: number;
    readonly observations: readonly EvidenceObservation[];
    readonly replayed: boolean;
  }>;
}

export interface EvidenceAssessmentExecutor {
  propose(input: { readonly command: EvidenceAssessmentCommand }): Promise<{
    readonly assessment: EvidenceAssessment;
    readonly replayed: boolean;
  }>;
}

export interface EvidencePostImportExecutor {
  afterImport(input: {
    readonly command: EvidenceImportCommand;
    readonly observedRevision: number;
    readonly expectedStateRevision: number;
    readonly observations: readonly EvidenceObservation[];
    readonly signal: AbortSignal;
  }): Promise<{
    readonly revision: number;
    readonly relations: readonly EvidenceRelation[];
    readonly openQuestions: readonly EvidenceOpenQuestion[];
  } | null>;
}

export interface EvidenceLiveObservationExecutor {
  observe(input: {
    readonly command: EvidenceLiveObservationCommand;
    readonly signal: AbortSignal;
  }): Promise<{
    readonly executionId: string;
    readonly observations: readonly EvidenceObservation[];
    readonly replayed: boolean;
    readonly actualModelCalls: 0 | 1;
  }>;
  settle?(input: {
    readonly jobId: string;
    readonly phase: 'completed' | 'failed';
    readonly reasonCode: string;
    readonly actualModelCalls: 0 | 1;
  }): Promise<void>;
}

export interface EvidenceLiveRelationExecutor {
  relate(input: {
    readonly command: EvidenceLiveRelationCommand;
    readonly signal: AbortSignal;
  }): Promise<{
    readonly executionId: string;
    readonly relations: readonly EvidenceRelation[];
    readonly openQuestions: readonly EvidenceOpenQuestion[];
    readonly standingChanges: readonly EvidenceStandingChange[];
    readonly replayed: boolean;
    readonly actualModelCalls: 0 | 1;
  }>;
  settle?(input: {
    readonly jobId: string;
    readonly phase: 'completed' | 'failed';
    readonly reasonCode: string;
    readonly actualModelCalls: 0 | 1;
  }): Promise<void>;
}

export interface EvidenceWorkbenchWorker {
  start(
    command: EvidenceImportCommand,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceProductJob>;
  wait(
    jobId: string,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceProductJob>;
  cancel(
    jobId: string,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceProductJob>;
  startLiveObservation(
    command: EvidenceLiveObservationCommand,
    executor: EvidenceLiveObservationExecutor,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceLiveObservationJob>;
  startLiveRelation(
    command: EvidenceLiveRelationCommand,
    executor: EvidenceLiveRelationExecutor,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceLiveRelationJob>;
  proposeAssessment(
    command: EvidenceAssessmentCommand,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceAssessment>;
}

function jobIdFor(command: EvidenceImportCommand): string {
  return `evidence-job-${sha256(`${command.workspaceId}\u0000${command.commandKey}`)}`;
}

export function createEvidenceWorkbenchWorker(options: {
  readonly repository: EvidenceProductRepository;
  readonly executor: EvidenceObservationExecutor;
  readonly assessmentExecutor?: EvidenceAssessmentExecutor;
  readonly postImportExecutor?: EvidencePostImportExecutor;
  readonly clock: EvidenceProductClock;
}): EvidenceWorkbenchWorker {
  const running = new Map<string, Promise<EvidenceProductJob>>();
  const controllers = new Map<string, AbortController>();

  async function update<TJob extends EvidenceProductJob>(
    job: TJob,
    patch: Partial<TJob>,
    scope?: EvidenceCaseObjectScope,
  ): Promise<TJob> {
    return (await options.repository.putJob(
      EvidenceAnyProductJobSchema.parse({
        ...job,
        ...patch,
        updatedAt: options.clock.now(),
      }),
      scope,
    )) as TJob;
  }

  async function runLiveObservation(
    command: EvidenceLiveObservationCommand,
    queued: EvidenceLiveObservationJob,
    controller: AbortController,
    executor: EvidenceLiveObservationExecutor,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceLiveObservationJob> {
    let job = queued;
    try {
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Live observation cancelled before source hydration.',
            reasonCode: 'LIVE_CANCELLED',
          },
          scope,
        );
      job = await update(
        job,
        {
          phase: 'hydrating',
          completedUnits: 1,
          message: 'Preparing the authorized source.',
        },
        scope,
      );
      const executed = await executor.observe({
        command,
        signal: controller.signal,
      });
      const cumulativeModelCalls: 0 | 1 =
        job.actualModelCalls === 1 || executed.actualModelCalls === 1 ? 1 : 0;
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Live observation cancelled before product projection.',
            reasonCode: 'LIVE_CANCELLED',
            actualModelCalls: cumulativeModelCalls,
            executionId: executed.executionId,
          },
          scope,
        );
      job = await update(
        job,
        {
          phase: 'projecting',
          completedUnits: 3,
          message: 'Saving validated source-bound observations.',
          actualModelCalls: cumulativeModelCalls,
          executionId: executed.executionId,
        },
        scope,
      );
      const snapshot = await options.repository.caseSnapshot(
        scope.caseId,
        scope.workspaceId,
      );
      const workspace = snapshot.workspaces.find(
        ({ workspaceId }) => workspaceId === command.workspaceId,
      );
      if (workspace === undefined)
        throw new RangeError(`Unknown workspace ${command.workspaceId}.`);
      await options.repository.putObservations(executed.observations, scope);
      const nextRevision = workspace.evidenceRevision + 1;
      await options.repository.advanceEvidenceRevision(
        command.workspaceId,
        workspace.evidenceRevision,
        nextRevision,
      );
      await options.repository.putChangeSet(
        EvidenceProductChangeSetSchema.parse({
          schemaVersion: EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
          workspaceId: command.workspaceId,
          commandKey: command.commandKey,
          recordedAt: queued.createdAt,
          changeSet: createEvidenceChangeSet({
            fromEvidenceRevision: workspace.evidenceRevision,
            toEvidenceRevision: nextRevision,
            addedArtifactVersionIds: [],
            addedObservationIds: executed.observations.map(
              ({ observationId }) => observationId,
            ),
            addedRelationIds: [],
            addedOpenQuestionIds: [],
            standingChanges: executed.observations.map(({ observationId }) => ({
              objectId: observationId,
              from: null,
              to: 'current',
            })),
            actorReferenceKeys: [
              ...new Set(
                executed.observations.flatMap((observation) => {
                  const actor =
                    observation.kind === 'statement-occurrence'
                      ? observation.actorReference
                      : observation.sourceActorReference;
                  return actor === null ? [] : [actor.actorReferenceKey];
                }),
              ),
            ],
            relationEndpointIds: [],
            temporalBounds: executed.observations.flatMap(
              ({ temporalBound }) =>
                temporalBound === null ? [] : [temporalBound],
            ),
          }),
        }),
        scope,
      );
      const completedReason = executed.replayed
        ? 'LIVE_OBSERVATION_RESUMED'
        : 'LIVE_OBSERVATION_COMPLETED';
      await executor.settle?.({
        jobId: job.jobId,
        phase: 'completed',
        reasonCode: completedReason,
        actualModelCalls: cumulativeModelCalls,
      });
      return update(
        job,
        {
          phase: 'completed',
          completedUnits: 4,
          message: 'Source observations are ready for review.',
          reasonCode: completedReason,
        },
        scope,
      );
    } catch (error) {
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Live observation cancelled.',
            reasonCode: 'LIVE_CANCELLED',
          },
          scope,
        );
      const value = error as {
        readonly reason?: unknown;
        readonly code?: unknown;
        readonly actualModelCalls?: unknown;
      };
      const reasonCode =
        typeof value.reason === 'string'
          ? value.reason
          : typeof value.code === 'string'
            ? value.code
            : 'LIVE_OBSERVATION_FAILED';
      const actualModelCalls: 0 | 1 =
        job.actualModelCalls === 1 || value.actualModelCalls === 1 ? 1 : 0;
      await executor
        .settle?.({
          jobId: job.jobId,
          phase: 'failed',
          reasonCode,
          actualModelCalls,
        })
        .catch(() => undefined);
      return update(
        job,
        {
          phase: 'failed',
          message: 'Live observation failed before product projection.',
          reasonCode,
          actualModelCalls,
        },
        scope,
      );
    } finally {
      controllers.delete(queued.jobId);
    }
  }

  async function runLiveRelation(
    command: EvidenceLiveRelationCommand,
    queued: EvidenceLiveRelationJob,
    controller: AbortController,
    executor: EvidenceLiveRelationExecutor,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceLiveRelationJob> {
    let job = queued;
    try {
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Live relation analysis cancelled before preparation.',
            reasonCode: 'LIVE_RELATION_CANCELLED',
          },
          scope,
        );
      job = await update(
        job,
        {
          phase: 'preparing',
          completedUnits: 1,
          message: 'Preparing current case observations.',
        },
        scope,
      );
      const executed = await executor.relate({
        command,
        signal: controller.signal,
      });
      const calls: 0 | 1 =
        job.actualModelCalls === 1 || executed.actualModelCalls === 1 ? 1 : 0;
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Live relation analysis cancelled before projection.',
            reasonCode: 'LIVE_RELATION_CANCELLED',
            actualModelCalls: calls,
            executionId: executed.executionId,
          },
          scope,
        );
      job = await update(
        job,
        {
          phase: 'projecting',
          completedUnits: 3,
          message: 'Saving validated relations and open questions.',
          actualModelCalls: calls,
          executionId: executed.executionId,
        },
        scope,
      );
      const snapshot = await options.repository.caseSnapshot(
        scope.caseId,
        scope.workspaceId,
      );
      const workspace = snapshot.workspaces.find(
        ({ workspaceId }) => workspaceId === command.workspaceId,
      );
      if (workspace === undefined)
        throw new RangeError(`Unknown workspace ${command.workspaceId}.`);
      const nextRevision = workspace.evidenceRevision + 1;
      const changeSet = EvidenceProductChangeSetSchema.parse({
        schemaVersion: EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
        workspaceId: command.workspaceId,
        commandKey: command.commandKey,
        recordedAt: queued.createdAt,
        changeSet: createEvidenceChangeSet({
          fromEvidenceRevision: workspace.evidenceRevision,
          toEvidenceRevision: nextRevision,
          addedArtifactVersionIds: [],
          addedObservationIds: [],
          addedRelationIds: executed.relations.map(
            ({ relationId }) => relationId,
          ),
          addedOpenQuestionIds: executed.openQuestions.map(
            ({ openQuestionId }) => openQuestionId,
          ),
          standingChanges: executed.standingChanges.map(
            ({ objectId, from, to }) => ({ objectId, from, to }),
          ),
          actorReferenceKeys: [],
          relationEndpointIds: executed.relations.flatMap(({ endpoints }) =>
            endpoints.map(({ id }) => id),
          ),
          temporalBounds: executed.relations.flatMap(
            ({ comparableScope }) => comparableScope.temporalBounds,
          ),
        }),
      });
      await options.repository.commitRelationProjection({
        relations: executed.relations,
        openQuestions: executed.openQuestions,
        changeSet,
        workspaceId: command.workspaceId,
        expectedRevision: workspace.evidenceRevision,
        nextRevision,
        scope,
      });
      const reasonCode = executed.replayed
        ? 'LIVE_RELATION_RESUMED'
        : 'LIVE_RELATION_COMPLETED';
      await executor.settle?.({
        jobId: job.jobId,
        phase: 'completed',
        reasonCode,
        actualModelCalls: calls,
      });
      return update(
        job,
        {
          phase: 'completed',
          completedUnits: 4,
          message: 'Relations and open questions are ready for review.',
          reasonCode,
        },
        scope,
      );
    } catch (error) {
      const value = error as {
        readonly reason?: unknown;
        readonly code?: unknown;
        readonly actualModelCalls?: unknown;
      };
      const reasonCode =
        typeof value.reason === 'string'
          ? value.reason
          : typeof value.code === 'string'
            ? value.code
            : 'LIVE_RELATION_FAILED';
      const calls: 0 | 1 =
        job.actualModelCalls === 1 || value.actualModelCalls === 1 ? 1 : 0;
      await executor
        .settle?.({
          jobId: job.jobId,
          phase: 'failed',
          reasonCode,
          actualModelCalls: calls,
        })
        .catch(() => undefined);
      return update(
        job,
        {
          phase: controller.signal.aborted ? 'cancelled' : 'failed',
          message: 'Live relation analysis failed before product projection.',
          reasonCode,
          actualModelCalls: calls,
        },
        scope,
      );
    } finally {
      controllers.delete(queued.jobId);
    }
  }

  async function run(
    command: EvidenceImportCommand,
    queued: EvidenceProductJob,
    controller: AbortController,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceProductJob> {
    let job = queued;
    try {
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Import cancelled before source review.',
          },
          scope,
        );
      await options.repository.putSource(command.artifactVersion, scope);
      job = await update(
        job,
        {
          phase: 'observing',
          completedUnits: 1,
          message: 'Reading exact source lines.',
        },
        scope,
      );
      const snapshot = await options.repository.snapshot();
      const workspace = snapshot.workspaces.find(
        ({ workspaceId }) => workspaceId === command.workspaceId,
      );
      if (workspace === undefined)
        throw new RangeError(`Unknown workspace ${command.workspaceId}.`);
      const observed = await options.executor.observe({
        workspaceId: command.workspaceId,
        requestKey: `import:${command.commandKey}`,
        expectedRevision: workspace.evidenceRevision,
        artifactVersion: command.artifactVersion,
        actorRoster: command.actorRoster,
        signal: controller.signal,
      });
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Import cancelled before review items were saved.',
          },
          scope,
        );
      await options.repository.putObservations(observed.observations, scope);
      await options.repository.advanceEvidenceRevision(
        command.workspaceId,
        workspace.evidenceRevision,
        observed.revision,
      );
      const postImport = await options.postImportExecutor?.afterImport({
        command,
        observedRevision: observed.revision,
        expectedStateRevision: observed.stateRevision,
        observations: observed.observations,
        signal: controller.signal,
      });
      if (postImport !== undefined && postImport !== null) {
        await options.repository.putRelations(postImport.relations, scope);
        await options.repository.putOpenQuestions(
          postImport.openQuestions,
          scope,
        );
        await options.repository.advanceEvidenceRevision(
          command.workspaceId,
          observed.revision,
          postImport.revision,
        );
      }
      const finalRevision = postImport?.revision ?? observed.revision;
      await options.repository.putChangeSet(
        EvidenceProductChangeSetSchema.parse({
          schemaVersion: EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
          workspaceId: command.workspaceId,
          commandKey: command.commandKey,
          recordedAt: queued.createdAt,
          changeSet: createEvidenceChangeSet({
            fromEvidenceRevision: workspace.evidenceRevision,
            toEvidenceRevision: finalRevision,
            addedArtifactVersionIds: [
              command.artifactVersion.artifactVersionId,
            ],
            addedObservationIds: observed.observations.map(
              ({ observationId }) => observationId,
            ),
            addedRelationIds:
              postImport?.relations.map(({ relationId }) => relationId) ?? [],
            addedOpenQuestionIds:
              postImport?.openQuestions.map(
                ({ openQuestionId }) => openQuestionId,
              ) ?? [],
            standingChanges: observed.observations.map(({ observationId }) => ({
              objectId: observationId,
              from: null,
              to: 'current',
            })),
            actorReferenceKeys: [
              ...new Set(
                observed.observations.flatMap((observation) => {
                  const actor =
                    observation.kind === 'statement-occurrence'
                      ? observation.actorReference
                      : observation.sourceActorReference;
                  return actor === null ? [] : [actor.actorReferenceKey];
                }),
              ),
            ],
            relationEndpointIds:
              postImport?.relations.flatMap(({ endpoints }) =>
                endpoints.map(({ id }) => id),
              ) ?? [],
            temporalBounds: observed.observations.flatMap(
              ({ temporalBound }) =>
                temporalBound === null ? [] : [temporalBound],
            ),
          }),
        }),
        scope,
      );
      return update(
        job,
        {
          phase: 'completed',
          completedUnits: 2,
          message: 'Source observations are ready for review.',
        },
        scope,
      );
    } catch (error) {
      if (controller.signal.aborted)
        return update(
          job,
          {
            phase: 'cancelled',
            message: 'Import cancelled.',
          },
          scope,
        );
      return update(
        job,
        {
          phase: 'failed',
          message: error instanceof Error ? error.message : 'Import failed.',
        },
        scope,
      );
    } finally {
      controllers.delete(queued.jobId);
    }
  }

  return {
    async start(commandValue, scope) {
      const command = EvidenceImportCommandSchema.parse(commandValue);
      if (scope !== undefined && scope.workspaceId !== command.workspaceId)
        throw new Error('Worker case scope does not match workspace command.');
      const snapshot =
        scope === undefined
          ? await options.repository.snapshot()
          : await options.repository.caseSnapshot(
              scope.caseId,
              scope.workspaceId,
            );
      const existing = snapshot.jobs.find(
        ({ workspaceId, commandKey }) =>
          workspaceId === command.workspaceId &&
          commandKey === command.commandKey,
      );
      if (existing !== undefined) {
        if (
          existing.artifactVersionId !==
          command.artifactVersion.artifactVersionId
        )
          throw new EvidenceProductCommandCollisionError(command.commandKey);
        return existing;
      }
      const now = options.clock.now();
      if (scope !== undefined)
        await options.repository.putSource(command.artifactVersion, scope);
      const queued = await options.repository.putJob(
        EvidenceProductJobSchema.parse({
          schemaVersion: EVIDENCE_PRODUCT_JOB_SCHEMA_VERSION,
          jobId: jobIdFor(command),
          workspaceId: command.workspaceId,
          commandKey: command.commandKey,
          artifactVersionId: command.artifactVersion.artifactVersionId,
          phase: 'queued',
          completedUnits: 0,
          totalUnits: 2,
          message: 'Import queued.',
          cancelRequested: false,
          createdAt: now,
          updatedAt: now,
        }),
        scope,
      );
      const controller = new AbortController();
      controllers.set(queued.jobId, controller);
      const promise = run(command, queued, controller, scope);
      running.set(queued.jobId, promise);
      void promise.finally(() => running.delete(queued.jobId));
      return queued;
    },
    async wait(jobId, scope) {
      const promise = running.get(jobId);
      if (promise !== undefined) return promise;
      const job = (
        scope === undefined
          ? await options.repository.snapshot()
          : await options.repository.caseSnapshot(
              scope.caseId,
              scope.workspaceId,
            )
      ).jobs.find((value) => value.jobId === jobId);
      if (job === undefined) throw new RangeError(`Unknown job ${jobId}.`);
      return job;
    },
    async startLiveObservation(commandValue, executor, scope) {
      const command = EvidenceLiveObservationCommandSchema.parse(commandValue);
      if (scope.workspaceId !== command.workspaceId)
        throw new Error('Worker case scope does not match live command.');
      const snapshot = await options.repository.caseSnapshot(
        scope.caseId,
        scope.workspaceId,
      );
      if (
        !snapshot.sources.some(
          ({ artifactVersionId }) =>
            artifactVersionId === command.artifactVersionId,
        )
      )
        throw new RangeError('Live observation source is unavailable.');
      const existing = snapshot.jobs.find(
        ({ workspaceId, commandKey }) =>
          workspaceId === command.workspaceId &&
          commandKey === command.commandKey,
      );
      let existingLive: EvidenceLiveObservationJob | undefined;
      if (existing !== undefined) {
        if (
          existing.schemaVersion !==
            EVIDENCE_LIVE_OBSERVATION_JOB_SCHEMA_VERSION ||
          existing.artifactVersionId !== command.artifactVersionId ||
          existing.modelId !== command.modelId ||
          existing.maxModelCalls !== command.requestedBudget.maxModelCalls ||
          existing.costCeilingMinor !==
            command.requestedBudget.costCeilingMinor ||
          existing.currency !== command.currency
        )
          throw new EvidenceProductCommandCollisionError(command.commandKey);
        existingLive = EvidenceLiveObservationJobSchema.parse(existing);
        if (
          ['completed', 'cancelled', 'refused'].includes(existingLive.phase) ||
          (existingLive.phase === 'failed' &&
            existingLive.reasonCode !== 'LIVE_PRODUCT_PROJECTION_INTERRUPTED')
        )
          return existingLive;
      }
      const now = options.clock.now();
      const queued =
        existingLive !== undefined
          ? await update(
              existingLive,
              {
                phase: 'queued',
                message: 'Resuming live observation.',
                cancelRequested: false,
                reasonCode: null,
              },
              scope,
            )
          : EvidenceLiveObservationJobSchema.parse(
              await options.repository.putJob(
                EvidenceLiveObservationJobSchema.parse({
                  schemaVersion: EVIDENCE_LIVE_OBSERVATION_JOB_SCHEMA_VERSION,
                  jobKind: 'live-observation',
                  jobId: deriveEvidenceLiveObservationJobId(command),
                  workspaceId: command.workspaceId,
                  commandKey: command.commandKey,
                  artifactVersionId: command.artifactVersionId,
                  task: 'observe-artifact',
                  modelId: command.modelId,
                  phase: 'queued',
                  completedUnits: 0,
                  totalUnits: 4,
                  message: 'Live observation queued.',
                  cancelRequested: false,
                  maxModelCalls: command.requestedBudget.maxModelCalls,
                  actualModelCalls: 0,
                  costCeilingMinor: command.requestedBudget.costCeilingMinor,
                  currency: command.currency,
                  reasonCode: null,
                  executionId: null,
                  createdAt: now,
                  updatedAt: now,
                }),
                scope,
              ),
            );
      const controller = new AbortController();
      controllers.set(queued.jobId, controller);
      const promise = runLiveObservation(
        command,
        queued,
        controller,
        executor,
        scope,
      );
      running.set(queued.jobId, promise);
      void promise.finally(() => running.delete(queued.jobId));
      return queued;
    },
    async startLiveRelation(commandValue, executor, scope) {
      const command = EvidenceLiveRelationCommandSchema.parse(commandValue);
      if (scope.workspaceId !== command.workspaceId)
        throw new Error('Worker case scope does not match live command.');
      const snapshot = await options.repository.caseSnapshot(
        scope.caseId,
        scope.workspaceId,
      );
      const currentIds = new Set(
        snapshot.observations.map(({ observationId }) => observationId),
      );
      if (command.observationIds.some((id) => !currentIds.has(id)))
        throw new RangeError('Live relation observations are unavailable.');
      const existing = snapshot.jobs.find(
        ({ workspaceId, commandKey }) =>
          workspaceId === command.workspaceId &&
          commandKey === command.commandKey,
      );
      let existingLive: EvidenceLiveRelationJob | undefined;
      if (existing !== undefined) {
        if (
          existing.schemaVersion !==
            EVIDENCE_LIVE_RELATION_JOB_SCHEMA_VERSION ||
          existing.modelId !== command.modelId ||
          JSON.stringify(existing.observationIds) !==
            JSON.stringify(command.observationIds) ||
          existing.maxModelCalls !== command.requestedBudget.maxModelCalls ||
          existing.costCeilingMinor !==
            command.requestedBudget.costCeilingMinor ||
          existing.currency !== command.currency
        )
          throw new EvidenceProductCommandCollisionError(command.commandKey);
        existingLive = EvidenceLiveRelationJobSchema.parse(existing);
        if (
          ['completed', 'cancelled', 'refused'].includes(existingLive.phase) ||
          (existingLive.phase === 'failed' &&
            existingLive.reasonCode !==
              'LIVE_RELATION_PRODUCT_PROJECTION_INTERRUPTED')
        )
          return existingLive;
      }
      const now = options.clock.now();
      const queued =
        existingLive === undefined
          ? EvidenceLiveRelationJobSchema.parse(
              await options.repository.putJob(
                EvidenceLiveRelationJobSchema.parse({
                  schemaVersion: EVIDENCE_LIVE_RELATION_JOB_SCHEMA_VERSION,
                  jobKind: 'live-relation',
                  jobId: deriveEvidenceLiveRelationJobId(command),
                  workspaceId: command.workspaceId,
                  commandKey: command.commandKey,
                  artifactVersionId: 'case-observation-set',
                  observationIds: command.observationIds,
                  task: 'relate-observations',
                  modelId: command.modelId,
                  phase: 'queued',
                  completedUnits: 0,
                  totalUnits: 4,
                  message: 'Live relation analysis queued.',
                  cancelRequested: false,
                  maxModelCalls: 1,
                  actualModelCalls: 0,
                  costCeilingMinor: command.requestedBudget.costCeilingMinor,
                  currency: command.currency,
                  reasonCode: null,
                  executionId: null,
                  createdAt: now,
                  updatedAt: now,
                }),
                scope,
              ),
            )
          : await update(
              existingLive,
              {
                phase: 'queued',
                message: 'Resuming live relation analysis.',
                cancelRequested: false,
                reasonCode: null,
              },
              scope,
            );
      const controller = new AbortController();
      controllers.set(queued.jobId, controller);
      const promise = runLiveRelation(
        command,
        queued,
        controller,
        executor,
        scope,
      );
      running.set(queued.jobId, promise);
      void promise.finally(() => running.delete(queued.jobId));
      return queued;
    },
    async cancel(jobId, scope) {
      const snapshot =
        scope === undefined
          ? await options.repository.snapshot()
          : await options.repository.caseSnapshot(
              scope.caseId,
              scope.workspaceId,
            );
      const job = snapshot.jobs.find((value) => value.jobId === jobId);
      if (job === undefined) throw new RangeError(`Unknown job ${jobId}.`);
      if (
        job.phase === 'completed' ||
        job.phase === 'failed' ||
        job.phase === 'cancelled'
      )
        return job;
      controllers.get(jobId)?.abort();
      return update(
        job,
        {
          cancelRequested: true,
          message: 'Cancellation requested.',
        },
        scope,
      );
    },
    async proposeAssessment(commandValue, scope) {
      const command = EvidenceAssessmentCommandSchema.parse(commandValue);
      if (scope !== undefined && scope.workspaceId !== command.workspaceId)
        throw new Error('Worker case scope does not match assessment command.');
      if (options.assessmentExecutor === undefined)
        throw new RangeError('Assessment execution is unavailable.');
      const existing = (
        scope === undefined
          ? await options.repository.snapshot()
          : await options.repository.caseSnapshot(
              scope.caseId,
              scope.workspaceId,
            )
      ).assessments.find(
        (assessment) =>
          assessment.workspaceId === command.workspaceId &&
          assessment.sequence === command.sequence,
      );
      if (existing !== undefined) return existing;
      const result = await options.assessmentExecutor.propose({ command });
      const [stored] = await options.repository.putAssessments(
        [result.assessment],
        scope,
      );
      if (stored === undefined) throw new Error('Assessment was not stored.');
      return stored;
    },
  };
}
