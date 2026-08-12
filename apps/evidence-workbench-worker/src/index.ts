import { sha256 } from '@acme/core';
import {
  EVIDENCE_PRODUCT_JOB_SCHEMA_VERSION,
  EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
  EvidenceAssessmentCommandSchema,
  EvidenceImportCommandSchema,
  EvidenceProductCommandCollisionError,
  EvidenceProductJobSchema,
  EvidenceProductChangeSetSchema,
  type EvidenceAssessmentCommand,
  type EvidenceImportCommand,
  type EvidenceProductClock,
  type EvidenceProductJob,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import {
  createEvidenceChangeSet,
  type EvidenceAssessment,
  type EvidenceObservation,
  type EvidenceOpenQuestion,
  type EvidenceRelation,
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

export interface EvidenceWorkbenchWorker {
  start(command: EvidenceImportCommand): Promise<EvidenceProductJob>;
  wait(jobId: string): Promise<EvidenceProductJob>;
  cancel(jobId: string): Promise<EvidenceProductJob>;
  proposeAssessment(
    command: EvidenceAssessmentCommand,
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

  async function update(
    job: EvidenceProductJob,
    patch: Partial<EvidenceProductJob>,
  ): Promise<EvidenceProductJob> {
    return options.repository.putJob(
      EvidenceProductJobSchema.parse({
        ...job,
        ...patch,
        updatedAt: options.clock.now(),
      }),
    );
  }

  async function run(
    command: EvidenceImportCommand,
    queued: EvidenceProductJob,
    controller: AbortController,
  ): Promise<EvidenceProductJob> {
    let job = queued;
    try {
      if (controller.signal.aborted)
        return update(job, {
          phase: 'cancelled',
          message: 'Import cancelled before source review.',
        });
      await options.repository.putSource(command.artifactVersion);
      job = await update(job, {
        phase: 'observing',
        completedUnits: 1,
        message: 'Reading exact source lines.',
      });
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
        return update(job, {
          phase: 'cancelled',
          message: 'Import cancelled before review items were saved.',
        });
      await options.repository.putObservations(observed.observations);
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
        await options.repository.putRelations(postImport.relations);
        await options.repository.putOpenQuestions(postImport.openQuestions);
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
      );
      return update(job, {
        phase: 'completed',
        completedUnits: 2,
        message: 'Source observations are ready for review.',
      });
    } catch (error) {
      if (controller.signal.aborted)
        return update(job, {
          phase: 'cancelled',
          message: 'Import cancelled.',
        });
      return update(job, {
        phase: 'failed',
        message: error instanceof Error ? error.message : 'Import failed.',
      });
    } finally {
      controllers.delete(queued.jobId);
    }
  }

  return {
    async start(commandValue) {
      const command = EvidenceImportCommandSchema.parse(commandValue);
      const snapshot = await options.repository.snapshot();
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
      );
      const controller = new AbortController();
      controllers.set(queued.jobId, controller);
      const promise = run(command, queued, controller);
      running.set(queued.jobId, promise);
      void promise.finally(() => running.delete(queued.jobId));
      return queued;
    },
    async wait(jobId) {
      const promise = running.get(jobId);
      if (promise !== undefined) return promise;
      const job = (await options.repository.snapshot()).jobs.find(
        (value) => value.jobId === jobId,
      );
      if (job === undefined) throw new RangeError(`Unknown job ${jobId}.`);
      return job;
    },
    async cancel(jobId) {
      const snapshot = await options.repository.snapshot();
      const job = snapshot.jobs.find((value) => value.jobId === jobId);
      if (job === undefined) throw new RangeError(`Unknown job ${jobId}.`);
      if (
        job.phase === 'completed' ||
        job.phase === 'failed' ||
        job.phase === 'cancelled'
      )
        return job;
      controllers.get(jobId)?.abort();
      return update(job, {
        cancelRequested: true,
        message: 'Cancellation requested.',
      });
    },
    async proposeAssessment(commandValue) {
      const command = EvidenceAssessmentCommandSchema.parse(commandValue);
      if (options.assessmentExecutor === undefined)
        throw new RangeError('Assessment execution is unavailable.');
      const existing = (await options.repository.snapshot()).assessments.find(
        (assessment) =>
          assessment.workspaceId === command.workspaceId &&
          assessment.sequence === command.sequence,
      );
      if (existing !== undefined) return existing;
      const result = await options.assessmentExecutor.propose({ command });
      const [stored] = await options.repository.putAssessments([
        result.assessment,
      ]);
      if (stored === undefined) throw new Error('Assessment was not stored.');
      return stored;
    },
  };
}
