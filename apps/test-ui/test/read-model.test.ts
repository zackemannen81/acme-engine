import { describe, expect, it } from 'vitest';

import {
  buildExecutionView,
  buildMemoryDecisionsView,
  buildReplayView,
  buildStateView,
  isAvailable,
  VIEW_UNAVAILABLE,
  type TrustStage,
  type TrustStageOutcome,
} from '../src/index.js';

import {
  ambiguousModelCall,
  attempts,
  brokenTransition,
  committedExecution,
  contractInputFailure,
  differentReport,
  entityId,
  executionId,
  failedAttempts,
  failedExecution,
  hashOnlyModelCall,
  matchReport,
  namespace,
  nextSnapshot,
  nextTransition,
  prepareCommitFailure,
  preparedCommit,
  priorSnapshot,
  replayEvidence,
  schemaFailure,
  unavailableReport,
} from './fixtures.js';

function outcomes(
  view: ReturnType<typeof buildExecutionView>,
): Record<TrustStage, TrustStageOutcome> {
  const map = {} as Record<TrustStage, TrustStageOutcome>;
  for (const stage of view.trustPipeline) {
    map[stage.stage] = stage.outcome;
  }
  return map;
}

describe('S4 execution inspector', () => {
  it('renders missing evidence as unavailable rather than as zero', () => {
    const view = buildExecutionView({
      execution: committedExecution,
      attempts,
      modelCalls: [hashOnlyModelCall],
    });

    expect(view.readSet).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.replayEvidence,
    });
    expect(view.preparedCommit).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.preparedCommit,
    });
    expect(view.taskInput).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.taskInput,
    });
    // The failure mode this rules out: an inspector reporting "0 documents"
    // for an execution whose evidence was never loaded.
    expect(view.preparedCommit).not.toHaveProperty('documents');
  });

  it('copies the terminal result the engine recorded', () => {
    const view = buildExecutionView({
      execution: committedExecution,
      attempts,
      modelCalls: [hashOnlyModelCall],
      replayEvidence,
    });

    expect(view.terminal).toStrictEqual({
      reached: true,
      status: 'committed',
      committed: true,
      replayed: false,
      revision: 1,
      documentKeys: ['document-1'],
      eventIds: [],
      error: null,
    });
  });

  it('marks an ambiguous model call distinctly', () => {
    const view = buildExecutionView({
      execution: committedExecution,
      attempts,
      modelCalls: [hashOnlyModelCall, ambiguousModelCall],
    });

    expect(view.modelCalls.map((call) => call.ambiguous)).toStrictEqual([
      false,
      true,
    ]);
    expect(view.modelCalls[1]?.status).toBe('ambiguous');
    expect(view.modelCalls[1]?.error?.code).toBe('MODEL_UNAVAILABLE');
  });

  it('reports every trust stage as passed for a committed execution', () => {
    const view = buildExecutionView({
      execution: committedExecution,
      attempts,
      modelCalls: [hashOnlyModelCall],
      replayEvidence,
    });

    for (const stage of view.trustPipeline) {
      expect(stage.outcome).toBe('passed');
    }
  });

  it('locates a response schema failure and stops the pipeline there', () => {
    const view = buildExecutionView({
      execution: failedExecution(schemaFailure),
      attempts: failedAttempts('validating'),
      modelCalls: [hashOnlyModelCall],
    });
    const stages = outcomes(view);

    expect(stages['contract-input']).toBe('passed');
    expect(stages.normalize).toBe('passed');
    expect(stages.parse).toBe('passed');
    expect(stages.schema).toBe('failed');
    expect(stages.semantics).toBe('not-reached');
    expect(stages.interpret).toBe('not-reached');
    expect(stages.commit).toBe('not-reached');
  });

  it('keeps a non-repairable contract input failure distinct', () => {
    const view = buildExecutionView({
      execution: failedExecution(contractInputFailure),
      attempts: failedAttempts('validating'),
      modelCalls: [],
    });
    const stages = outcomes(view);

    expect(stages['contract-input']).toBe('failed');
    expect(stages.normalize).toBe('not-reached');
    expect(stages.schema).toBe('not-reached');

    expect(isAvailable(view.responseValidation)).toBe(true);
    if (isAvailable(view.responseValidation)) {
      expect(view.responseValidation.pipelineStage).toBe('input');
      expect(view.responseValidation.repairable).toBe(false);
      expect(view.responseValidation.issues[0]?.code).toBe(
        'CONTRACT_INPUT_SCHEMA',
      );
    }
  });

  it('reports reached, not a guess, when the failing stage owns several substages', () => {
    const view = buildExecutionView({
      execution: failedExecution(prepareCommitFailure),
      attempts: failedAttempts('preparing-commit'),
      modelCalls: [hashOnlyModelCall],
    });
    const stages = outcomes(view);

    expect(stages.interpret).toBe('passed');
    expect(stages.evaluate).toBe('passed');
    expect(stages.memory).toBe('reached');
    expect(stages.projection).toBe('reached');
    expect(stages.state).toBe('reached');
    expect(stages.commit).toBe('not-reached');
  });

  it('has no response validation section without a pipeline failure', () => {
    const view = buildExecutionView({
      execution: failedExecution(prepareCommitFailure),
      attempts: failedAttempts('preparing-commit'),
      modelCalls: [hashOnlyModelCall],
    });

    expect(view.responseValidation).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.responseValidation,
    });
  });
});

describe('S5 memory decision inspector', () => {
  const view = buildMemoryDecisionsView({ executionId, preparedCommit });

  it('preserves prepared decision order', () => {
    expect(isAvailable(view.decisions)).toBe(true);
    if (!isAvailable(view.decisions)) {
      return;
    }
    expect(
      view.decisions.decisions.map((entry) => entry.candidateKey),
    ).toStrictEqual([
      'candidate-created',
      'candidate-ignored',
      'candidate-reinforced',
    ]);
    expect(view.decisions.decisions.map((entry) => entry.order)).toStrictEqual([
      0, 1, 2,
    ]);
  });

  it('keeps an ignored candidate visible with its domain reason', () => {
    if (!isAvailable(view.decisions)) {
      throw new Error('decisions should be available');
    }
    const ignored = view.decisions.decisions[1];

    expect(ignored?.action).toBe('ignore');
    expect(ignored?.reason).toBe('below domain confidence floor');
    expect(ignored?.applied).toBe(false);
    expect(ignored?.mutations).toStrictEqual([]);
    expect(ignored?.candidate.availability).toBe('available');
  });

  it('correlates each mutation with the decision that produced it', () => {
    if (!isAvailable(view.decisions)) {
      throw new Error('decisions should be available');
    }
    const [created, , reinforced] = view.decisions.decisions;

    expect(created?.mutations.map((entry) => entry.memoryId)).toStrictEqual([
      'memory-created-1',
    ]);
    expect(created?.mutations[0]?.action).toBe('create');
    expect(created?.mutations[0]?.expectedRecordVersion).toBeNull();

    expect(reinforced?.mutations.map((entry) => entry.memoryId)).toStrictEqual([
      'memory-existing-1',
    ]);
    expect(reinforced?.mutations[0]?.action).toBe('update');
    expect(reinforced?.mutations[0]?.expectedRecordVersion).toBe(1);

    expect(view.decisions.unattributedMutations).toStrictEqual([]);
    expect(view.decisions.candidateCount).toBe(3);
    expect(view.decisions.decisionCount).toBe(3);
    expect(view.decisions.mutationCount).toBe(2);
  });

  it('renders no prepared commit as unavailable', () => {
    const empty = buildMemoryDecisionsView({ executionId });

    expect(empty.decisions).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.preparedCommit,
    });
  });
});

describe('S6 state inspector', () => {
  it('separates unloaded evidence from an entity with no state', () => {
    const unloaded = buildStateView({ namespace, entityId });
    const loadedEmpty = buildStateView({
      namespace,
      entityId,
      snapshots: [],
      transitions: [],
    });

    expect(unloaded.lineage).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.stateEvidence,
    });
    expect(isAvailable(loadedEmpty.lineage)).toBe(true);
    if (isAvailable(loadedEmpty.lineage)) {
      expect(loadedEmpty.lineage.revisionCount).toBe(0);
      expect(loadedEmpty.lineage.headRevision).toBeNull();
    }
  });

  it('orders revisions and reports transition continuity', () => {
    const view = buildStateView({
      namespace,
      entityId,
      snapshots: [nextSnapshot, priorSnapshot],
      transitions: [nextTransition],
    });

    if (!isAvailable(view.lineage)) {
      throw new Error('lineage should be available');
    }
    expect(view.lineage.revisions.map((entry) => entry.revision)).toStrictEqual(
      [1, 2],
    );
    expect(view.lineage.headRevision).toBe(2);
    // Revision 1's transition was not loaded; revision 2's links backwards.
    expect(view.lineage.revisions[0]?.transition).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.stateTransition,
    });
    expect(view.lineage.revisions[0]?.continuity).toBe('unknown');
    expect(view.lineage.revisions[1]?.continuity).toBe('linked');
  });

  it('reports a broken hash chain instead of repairing it', () => {
    const view = buildStateView({
      namespace,
      entityId,
      snapshots: [priorSnapshot, nextSnapshot],
      transitions: [brokenTransition],
    });

    if (!isAvailable(view.lineage)) {
      throw new Error('lineage should be available');
    }
    expect(view.lineage.revisions[1]?.continuity).toBe('broken');
  });

  it('ignores snapshots belonging to another entity', () => {
    const view = buildStateView({
      namespace,
      entityId: 'entity-other',
      snapshots: [priorSnapshot, nextSnapshot],
      transitions: [nextTransition],
    });

    if (!isAvailable(view.lineage)) {
      throw new Error('lineage should be available');
    }
    expect(view.lineage.revisionCount).toBe(0);
  });
});

describe('S7 replay and digest comparison', () => {
  it('distinguishes "not run" from the engine verdict "unavailable"', () => {
    const notRun = buildReplayView({
      executionId,
      recordedOperationDigest: 'digest-operation-1',
    });
    const engineUnavailable = buildReplayView({
      executionId,
      report: unavailableReport,
    });

    expect(notRun.outcome).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.replayNotRun,
    });
    expect(notRun.recordedOperationDigest).toBe('digest-operation-1');

    expect(isAvailable(engineUnavailable.outcome)).toBe(true);
    if (isAvailable(engineUnavailable.outcome)) {
      expect(engineUnavailable.outcome.status).toBe('unavailable');
    }
  });

  it('copies the engine verdict and compares digests only when both exist', () => {
    const match = buildReplayView({ executionId, report: matchReport });
    const different = buildReplayView({ executionId, report: differentReport });
    const engineUnavailable = buildReplayView({
      executionId,
      report: unavailableReport,
    });

    if (
      !isAvailable(match.outcome) ||
      !isAvailable(different.outcome) ||
      !isAvailable(engineUnavailable.outcome)
    ) {
      throw new Error('outcomes should be available');
    }
    expect(match.outcome.status).toBe('match');
    expect(match.outcome.digest.comparison).toBe('equal');
    expect(different.outcome.status).toBe('different');
    expect(different.outcome.digest.comparison).toBe('different');
    expect(different.outcome.differenceCount).toBe(1);
    expect(engineUnavailable.outcome.digest.comparison).toBe('unavailable');
    expect(engineUnavailable.outcome.digest.replayed).toBeNull();
  });

  it('never invents an outcome the engine cannot produce', () => {
    const statuses = [matchReport, differentReport, unavailableReport].map(
      (report) => {
        const view = buildReplayView({ executionId, report });
        return isAvailable(view.outcome) ? view.outcome.status : null;
      },
    );

    expect(statuses).toStrictEqual(['match', 'different', 'unavailable']);
    expect(statuses).not.toContain('forked');
  });
});
