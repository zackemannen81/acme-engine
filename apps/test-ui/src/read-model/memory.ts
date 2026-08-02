import type {
  MemoryCandidate,
  MemoryMutation,
  MemoryResolution,
  PreparedCommit,
  PreparedMemoryDecision,
} from '@acme/core';

import {
  contentView,
  type PayloadView,
  type RedactionOptions,
} from '../redaction.js';
import {
  available,
  unavailable,
  MEMORY_DECISION_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';

/**
 * S5 — memory decision inspector (ADR-0019).
 *
 * Three correlated columns:
 *
 * ```text
 * MemoryCandidate  ->  decision + domain reason  ->  prepared mutation
 * ```
 *
 * Ignored and reject-candidate decisions stay visible. They are audit
 * evidence: a candidate the domain refused is exactly what a reviewer needs
 * to see, and dropping it would make the inspector lie by omission.
 */

export interface MemoryDecisionEvidence {
  readonly executionId: string;
  /** `null` when no prepared commit was recorded for this execution. */
  readonly preparedCommit?: PreparedCommit | null;
}

export type MemoryDecisionViewOptions = RedactionOptions;

export interface MemoryCandidateView {
  readonly key: string;
  readonly kind: string;
  readonly schemaVersion: string;
  readonly confidence: number | null;
  readonly sourceExecutionId: string;
  readonly sourceContract: { readonly id: string; readonly version: string };
  readonly sourceModelCallId: string | null;
  readonly sourceDocumentKeys: readonly string[];
  readonly value: PayloadView;
}

export interface MemoryMutationView {
  readonly action: MemoryMutation['action'];
  readonly memoryId: string;
  readonly identityKey: string;
  readonly status: string;
  readonly strength: number;
  readonly recordVersion: number;
  readonly expectedRecordVersion: number | null;
  readonly value: PayloadView;
}

export interface MemoryDecisionView {
  readonly order: number;
  readonly candidateKey: string;
  readonly identityKey: string;
  readonly action: MemoryResolution['action'];
  /** Present only for `contradict`; the domain owns the disposition. */
  readonly disposition: string | null;
  /** The domain's own reason string for an ignored candidate. */
  readonly reason: string | null;
  /** Whether the decision produced prepared mutations. */
  readonly applied: boolean;
  readonly affectedMemoryIds: readonly string[];
  readonly candidate: ViewSection<{ readonly candidate: MemoryCandidateView }>;
  readonly mutations: readonly MemoryMutationView[];
}

export interface MemoryDecisionsView {
  readonly view: typeof MEMORY_DECISION_VIEW_VERSION;
  readonly executionId: string;
  readonly decisions: ViewSection<{
    readonly decisions: readonly MemoryDecisionView[];
    readonly candidateCount: number;
    readonly decisionCount: number;
    readonly mutationCount: number;
    /**
     * Mutations no decision claimed. Always empty for evidence the engine
     * produced; surfaced rather than hidden so corrupt evidence is visible.
     */
    readonly unattributedMutations: readonly MemoryMutationView[];
  }>;
}

function candidateView(
  candidate: MemoryCandidate,
  options: RedactionOptions,
): MemoryCandidateView {
  return {
    key: candidate.key,
    kind: candidate.kind,
    schemaVersion: candidate.schemaVersion,
    confidence: candidate.confidence ?? null,
    sourceExecutionId: candidate.source.executionId,
    sourceContract: {
      id: candidate.source.contract.id,
      version: candidate.source.contract.version,
    },
    sourceModelCallId: candidate.source.modelCallId ?? null,
    sourceDocumentKeys: [...candidate.source.documentKeys],
    value: contentView(candidate.value, options),
  };
}

function mutationView(
  mutation: MemoryMutation,
  options: RedactionOptions,
): MemoryMutationView {
  return {
    action: mutation.action,
    memoryId: mutation.record.memoryId,
    identityKey: mutation.record.identityKey,
    status: mutation.record.status,
    strength: mutation.record.strength,
    recordVersion: mutation.record.recordVersion,
    expectedRecordVersion:
      mutation.action === 'update' ? mutation.expectedRecordVersion : null,
    value: contentView(mutation.record.value, options),
  };
}

function resolutionDisposition(resolution: MemoryResolution): string | null {
  return resolution.action === 'contradict' ? resolution.disposition : null;
}

function resolutionReason(resolution: MemoryResolution): string | null {
  return resolution.action === 'ignore' ? resolution.reason : null;
}

/**
 * Correlate mutations to the decision that produced them.
 *
 * `MemoryEngine.prepare` appends each decision's mutations immediately after
 * evaluating that decision, and records the memory IDs it touched in
 * `affectedMemoryIds`. Walking both lists with one cursor therefore recovers
 * the exact grouping even when two decisions touch the same record, which
 * matching by ID alone could not.
 */
function correlate(
  decisions: readonly PreparedMemoryDecision[],
  mutations: readonly MemoryMutation[],
): {
  readonly grouped: ReadonlyMap<number, readonly MemoryMutation[]>;
  readonly unattributed: readonly MemoryMutation[];
} {
  const grouped = new Map<number, readonly MemoryMutation[]>();
  let cursor = 0;
  for (const [index, decision] of decisions.entries()) {
    const affected = new Set(decision.affectedMemoryIds);
    const own: MemoryMutation[] = [];
    while (cursor < mutations.length) {
      const mutation = mutations[cursor];
      if (mutation === undefined || !affected.has(mutation.record.memoryId)) {
        break;
      }
      own.push(mutation);
      cursor += 1;
    }
    grouped.set(index, own);
  }
  return { grouped, unattributed: mutations.slice(cursor) };
}

export function buildMemoryDecisionsView(
  evidence: MemoryDecisionEvidence,
  options: MemoryDecisionViewOptions = {},
): MemoryDecisionsView {
  const prepared = evidence.preparedCommit ?? null;
  if (prepared === null) {
    return {
      view: MEMORY_DECISION_VIEW_VERSION,
      executionId: evidence.executionId,
      decisions: unavailable(VIEW_UNAVAILABLE.preparedCommit),
    };
  }

  const candidates = new Map<string, MemoryCandidate>(
    prepared.memoryCandidates.map((candidate) => [candidate.key, candidate]),
  );
  const { grouped, unattributed } = correlate(
    prepared.memory.decisions,
    prepared.memory.mutations,
  );

  // Registry order is decision order. The inspector never re-sorts.
  const decisions = prepared.memory.decisions.map((decision, index) => {
    const candidate = candidates.get(decision.candidateKey);
    const own = grouped.get(index) ?? [];
    return {
      order: index,
      candidateKey: decision.candidateKey,
      identityKey: decision.identityKey,
      action: decision.resolution.action,
      disposition: resolutionDisposition(decision.resolution),
      reason: resolutionReason(decision.resolution),
      applied: own.length > 0,
      affectedMemoryIds: [...decision.affectedMemoryIds],
      candidate:
        candidate === undefined
          ? unavailable(VIEW_UNAVAILABLE.memoryCandidate)
          : available({ candidate: candidateView(candidate, options) }),
      mutations: own.map((mutation) => mutationView(mutation, options)),
    } satisfies MemoryDecisionView;
  });

  return {
    view: MEMORY_DECISION_VIEW_VERSION,
    executionId: evidence.executionId,
    decisions: available({
      decisions,
      candidateCount: prepared.memoryCandidates.length,
      decisionCount: prepared.memory.decisions.length,
      mutationCount: prepared.memory.mutations.length,
      unattributedMutations: unattributed.map((mutation) =>
        mutationView(mutation, options),
      ),
    }),
  };
}
