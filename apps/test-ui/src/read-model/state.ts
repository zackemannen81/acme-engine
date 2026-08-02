import type { JsonValue, StateSnapshot, StateTransition } from '@acme/core';

import {
  contentView,
  type PayloadView,
  type RedactionOptions,
} from '../redaction.js';
import {
  available,
  unavailable,
  STATE_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';

/**
 * S6 — state inspector (ADR-0019).
 *
 * Renders revision lineage, value hashes, schema versions and the delta the
 * reducer accepted. Domain field meaning stays in the module: this builder
 * shows structure and identity, never domain policy.
 */

export interface StateEvidence {
  readonly namespace: string;
  readonly entityId: string;
  /**
   * `null` when state evidence was not loaded. An entity that genuinely has
   * no state is `[]`, which is a different fact and renders differently.
   */
  readonly snapshots?: readonly StateSnapshot<JsonValue>[] | null;
  readonly transitions?: readonly StateTransition<JsonValue>[] | null;
}

export type StateViewOptions = RedactionOptions;

export interface StateTransitionView {
  readonly transitionId: string;
  readonly operationKey: string;
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly deltaSchemaVersion: string;
  readonly previousHash: string | null;
  readonly nextHash: string;
  readonly executionId: string;
  readonly createdAt: string;
  readonly delta: PayloadView;
}

export interface StateRevisionView {
  readonly revision: number;
  readonly schemaVersion: string;
  readonly valueHash: string;
  readonly createdAt: string;
  readonly executionId: string;
  readonly value: PayloadView;
  readonly transition: ViewSection<StateTransitionView>;
  /**
   * `linked` when the transition's `previousHash` matches the preceding
   * snapshot's `valueHash`. `unknown` when either side is missing. The
   * interface reports the comparison; it does not repair the lineage.
   */
  readonly continuity: 'linked' | 'broken' | 'unknown';
}

export interface StateView {
  readonly view: typeof STATE_VIEW_VERSION;
  readonly namespace: string;
  readonly entityId: string;
  readonly lineage: ViewSection<{
    readonly revisions: readonly StateRevisionView[];
    readonly revisionCount: number;
    readonly headRevision: number | null;
  }>;
}

function transitionView(
  transition: StateTransition<JsonValue>,
  options: RedactionOptions,
): StateTransitionView {
  return {
    transitionId: transition.transitionId,
    operationKey: transition.operationKey,
    fromRevision: transition.fromRevision,
    toRevision: transition.toRevision,
    deltaSchemaVersion: transition.deltaSchemaVersion,
    previousHash: transition.previousHash,
    nextHash: transition.nextHash,
    executionId: transition.executionId,
    createdAt: transition.createdAt,
    delta: contentView(transition.delta, options),
  };
}

function continuity(
  transition: StateTransition<JsonValue> | undefined,
  previous: StateSnapshot<JsonValue> | undefined,
): 'linked' | 'broken' | 'unknown' {
  if (transition === undefined) {
    return 'unknown';
  }
  if (previous === undefined) {
    return transition.previousHash === null ? 'linked' : 'unknown';
  }
  return transition.previousHash === previous.valueHash ? 'linked' : 'broken';
}

export function buildStateView(
  evidence: StateEvidence,
  options: StateViewOptions = {},
): StateView {
  const snapshots = evidence.snapshots ?? null;
  if (snapshots === null) {
    return {
      view: STATE_VIEW_VERSION,
      namespace: evidence.namespace,
      entityId: evidence.entityId,
      lineage: unavailable(VIEW_UNAVAILABLE.stateEvidence),
    };
  }

  const matching = snapshots.filter(
    (snapshot) =>
      snapshot.namespace === evidence.namespace &&
      snapshot.entityId === evidence.entityId,
  );
  const ordered = [...matching].sort((left, right) =>
    left.revision === right.revision
      ? left.executionId.localeCompare(right.executionId)
      : left.revision - right.revision,
  );
  const transitions = (evidence.transitions ?? []).filter(
    (transition) =>
      transition.namespace === evidence.namespace &&
      transition.entityId === evidence.entityId,
  );
  const byRevision = new Map(
    transitions.map((transition) => [transition.toRevision, transition]),
  );

  const revisions = ordered.map((snapshot, index) => {
    const transition = byRevision.get(snapshot.revision);
    return {
      revision: snapshot.revision,
      schemaVersion: snapshot.schemaVersion,
      valueHash: snapshot.valueHash,
      createdAt: snapshot.createdAt,
      executionId: snapshot.executionId,
      value: contentView(snapshot.value, options),
      transition:
        transition === undefined
          ? unavailable(VIEW_UNAVAILABLE.stateTransition)
          : available<StateTransitionView>(transitionView(transition, options)),
      continuity: continuity(transition, ordered[index - 1]),
    } satisfies StateRevisionView;
  });

  const head = ordered.at(-1);
  return {
    view: STATE_VIEW_VERSION,
    namespace: evidence.namespace,
    entityId: evidence.entityId,
    lineage: available({
      revisions,
      revisionCount: revisions.length,
      headRevision: head === undefined ? null : head.revision,
    }),
  };
}
