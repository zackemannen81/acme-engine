import { describe, expect, it } from 'vitest';

import {
  EXECUTION_VIEW_VERSION,
  MEMORY_DECISION_VIEW_VERSION,
  REPLAY_VIEW_VERSION,
  STATE_VIEW_VERSION,
  buildExecutionView,
  buildMemoryDecisionsView,
  buildReplayView,
  buildStateView,
} from '../src/index.js';

import {
  attempts,
  committedExecution,
  entityId,
  executionId,
  hashOnlyModelCall,
  matchReport,
  namespace,
  nextSnapshot,
  nextTransition,
  preparedCommit,
  priorSnapshot,
  replayEvidence,
} from './fixtures.js';

/**
 * View contracts are asserted as JSON, never as markup. A view that cannot
 * survive `JSON.stringify` is not a contract a renderer or a report can rely
 * on, so every surface is round-tripped here.
 */
function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

const execution = buildExecutionView({
  execution: committedExecution,
  attempts,
  modelCalls: [hashOnlyModelCall],
  replayEvidence,
});
const memory = buildMemoryDecisionsView({ executionId, preparedCommit });
const state = buildStateView({
  namespace,
  entityId,
  snapshots: [priorSnapshot, nextSnapshot],
  transitions: [nextTransition],
});
const replay = buildReplayView({
  executionId,
  report: matchReport,
  recordedOperationDigest: 'digest-operation-1',
});

describe('view contract versions', () => {
  it('publishes one explicit version per surface', () => {
    expect(EXECUTION_VIEW_VERSION).toBe('acme-view-execution/1');
    expect(MEMORY_DECISION_VIEW_VERSION).toBe('acme-view-memory-decisions/1');
    expect(STATE_VIEW_VERSION).toBe('acme-view-state/1');
    expect(REPLAY_VIEW_VERSION).toBe('acme-view-replay/1');
  });

  it('carries the version inside every built view', () => {
    expect(execution.view).toBe(EXECUTION_VIEW_VERSION);
    expect(memory.view).toBe(MEMORY_DECISION_VIEW_VERSION);
    expect(state.view).toBe(STATE_VIEW_VERSION);
    expect(replay.view).toBe(REPLAY_VIEW_VERSION);
  });
});

describe('view contracts are JSON', () => {
  it('round-trips every surface without loss', () => {
    expect(roundTrip(execution)).toStrictEqual(execution);
    expect(roundTrip(memory)).toStrictEqual(memory);
    expect(roundTrip(state)).toStrictEqual(state);
    expect(roundTrip(replay)).toStrictEqual(replay);
  });

  it('exposes the S4 sections a renderer depends on', () => {
    expect(Object.keys(execution).sort()).toStrictEqual([
      'attempts',
      'header',
      'modelCalls',
      'preparedCommit',
      'readSet',
      'responseValidation',
      'retention',
      'taskInput',
      'terminal',
      'trustPipeline',
      'view',
    ]);
  });

  it('separates request input from validated task input', () => {
    // ADR-0010 keeps contract input and task input distinct values; the
    // inspector must not merge them into one panel.
    expect(execution.header.requestInput).toBeDefined();
    expect(execution.taskInput.availability).toBe('available');
  });

  it('names every trust pipeline stage in order', () => {
    expect(execution.trustPipeline.map((stage) => stage.stage)).toStrictEqual([
      'contract-input',
      'normalize',
      'parse',
      'schema',
      'semantics',
      'interpret',
      'evaluate',
      'memory',
      'projection',
      'state',
      'commit',
    ]);
  });
});
