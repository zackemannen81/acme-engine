import type { ExecutionPolicy } from '@acme/core';
import { describe, expect, it } from 'vitest';

import {
  buildExecutionView,
  buildMemoryDecisionsView,
  buildStateView,
  isAvailable,
  VIEW_UNAVAILABLE,
  type RetentionMode,
} from '../src/index.js';

import {
  attempts,
  committedExecution,
  entityId,
  executionId,
  hashOnlyModelCall,
  namespace,
  nextSnapshot,
  nextTransition,
  policy,
  preparedCommit,
  priorSnapshot,
  replayEvidence,
  retainedModelCall,
} from './fixtures.js';

const RETENTION_MODES: readonly RetentionMode[] = [
  'none',
  'hash-only',
  'encrypted-payload',
];

function withRetention(retention: RetentionMode): ExecutionPolicy {
  return { ...policy, retention };
}

describe('content redaction', () => {
  it('redacts content by default under every retention mode', () => {
    for (const retention of RETENTION_MODES) {
      const view = buildExecutionView({
        execution: {
          ...committedExecution,
          policy: withRetention(retention),
        },
        attempts,
        modelCalls: [retainedModelCall],
        replayEvidence,
      });

      expect(view.retention).toBe(retention);
      expect(view.header.requestInput).toStrictEqual({
        disclosure: 'redacted',
      });
      expect(view.modelCalls[0]?.response).toStrictEqual({
        disclosure: 'redacted',
      });
      if (isAvailable(view.readSet)) {
        expect(view.readSet.documents[0]?.value).toStrictEqual({
          disclosure: 'redacted',
        });
        expect(view.readSet.state?.value).toStrictEqual({
          disclosure: 'redacted',
        });
        expect(view.readSet.loadedMemories[0]?.value).toStrictEqual({
          disclosure: 'redacted',
        });
      }
    }
  });

  it('reveals content only when the build explicitly asks', () => {
    const view = buildExecutionView(
      {
        execution: committedExecution,
        attempts,
        modelCalls: [retainedModelCall],
        replayEvidence,
      },
      { revealContent: true },
    );

    expect(view.header.requestInput).toStrictEqual({
      disclosure: 'revealed',
      value: { text: 'confidential source text' },
    });
    expect(view.modelCalls[0]?.response).toMatchObject({
      disclosure: 'revealed',
    });
  });

  it('redacts memory candidate, mutation and state values by default', () => {
    const memory = buildMemoryDecisionsView({ executionId, preparedCommit });
    const state = buildStateView({
      namespace,
      entityId,
      snapshots: [priorSnapshot, nextSnapshot],
      transitions: [nextTransition],
    });

    if (!isAvailable(memory.decisions) || !isAvailable(state.lineage)) {
      throw new Error('sections should be available');
    }
    const decision = memory.decisions.decisions[0];
    expect(
      isAvailable(
        decision?.candidate ?? { availability: 'unavailable', reason: '' },
      )
        ? decision?.candidate
        : null,
    ).toMatchObject({
      candidate: { value: { disclosure: 'redacted' } },
    });
    expect(decision?.mutations[0]?.value).toStrictEqual({
      disclosure: 'redacted',
    });
    expect(state.lineage.revisions[1]?.value).toStrictEqual({
      disclosure: 'redacted',
    });
    const transition = state.lineage.revisions[1]?.transition;
    expect(
      transition !== undefined && isAvailable(transition)
        ? transition.delta
        : null,
    ).toStrictEqual({ disclosure: 'redacted' });
  });
});

describe('retention presentation', () => {
  it('states that none and hash-only never stored the payload', () => {
    for (const retention of ['none', 'hash-only'] as const) {
      const view = buildExecutionView(
        {
          execution: {
            ...committedExecution,
            policy: withRetention(retention),
          },
          attempts,
          modelCalls: [hashOnlyModelCall],
        },
        { revealContent: true },
      );

      // Reveal is on, so an empty value here would look like an engine bug.
      expect(view.modelCalls[0]?.response).toStrictEqual({
        disclosure: 'not-retained',
        retention,
      });
      expect(view.modelCalls[0]?.responseHash).toBe('hash-response-1');
    }
  });

  it('reports an unreadable encrypted payload as unavailable, not as absent', () => {
    const view = buildExecutionView(
      {
        execution: {
          ...committedExecution,
          policy: withRetention('encrypted-payload'),
        },
        attempts,
        modelCalls: [hashOnlyModelCall],
      },
      { revealContent: true },
    );

    expect(view.modelCalls[0]?.response).toStrictEqual({
      disclosure: 'unavailable',
      reason: VIEW_UNAVAILABLE.payloadUnreadable,
    });
  });

  it('shows the protection flags the record carries', () => {
    const view = buildExecutionView({
      execution: committedExecution,
      attempts,
      modelCalls: [
        { ...hashOnlyModelCall, protectedResponse: 'sealed-envelope' },
      ],
    });

    expect(view.modelCalls[0]?.responseProtected).toBe(true);
    expect(view.modelCalls[0]?.requestProtected).toBe(false);
  });
});
