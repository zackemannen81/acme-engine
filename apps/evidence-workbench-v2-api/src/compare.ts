import {
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  type Clock,
  type IdGenerator,
  type ModelGateway,
  type ModelSelection,
} from '@acme/core';
import type {
  EvidenceV2ComparisonWindowState,
  EvidenceV2Repository,
} from '@acme/evidence-v2-contracts';
import {
  EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
  EVIDENCE_V2_COMPARE_NAMESPACE,
  deriveEvidenceV2CompareRequestKey,
  deriveEvidenceV2InstanceCompletion,
  deriveEvidenceV2Standings,
  evidenceV2CompareContract,
  evidenceV2CompareModuleForRegistry,
  planEvidenceV2CompareWindows,
  type EvidenceV2CompareOccurrence,
  type EvidenceV2CompareWindow,
  type EvidenceV2Relation,
} from '@acme/module-evidence-v2';

import type { EvidenceV2Ledger } from './extract.js';

/**
 * J4 instance comparison.
 *
 * One engine execution per compare window, each keyed by
 * `deriveEvidenceV2CompareRequestKey`. Relations are projected into the
 * product in the same step that commits the window — the R-05 rule, applied
 * to comparison. A re-run executes only windows with no committed execution.
 *
 * Observe is a different namespace. This runner never registers the observe
 * module, so prior instances cannot leak into extraction.
 */

export const EVIDENCE_V2_COMPARE_PROFILE = 'evidence-v2-compare';

export interface EvidenceV2ComparePlan {
  readonly instanceKey: string;
  readonly windows: readonly EvidenceV2CompareWindow[];
  readonly plannedModelCalls: number;
  readonly outstandingWindowIds: readonly string[];
  readonly committedWindowIds: readonly string[];
  readonly reason: 'ready' | 'instance-not-reviewed' | 'no-prior-accepted';
}

export interface EvidenceV2CompareOutcome {
  readonly instanceKey: string;
  readonly plannedModelCalls: number;
  readonly actualModelCalls: number;
  readonly committedWindowIds: readonly string[];
  readonly relationCount: number;
  readonly failedWindowId: string | null;
  readonly failureCode: string | null;
  readonly complete: boolean;
}

export interface EvidenceV2ComparerOptions {
  readonly repository: EvidenceV2Repository;
  readonly ledger: EvidenceV2Ledger;
  readonly gateway: ModelGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly selection: ModelSelection;
  readonly emergencyCallCeiling?: number;
}

export interface EvidenceV2Comparer {
  plan(input: {
    readonly artifactId: string;
    readonly chainId: string;
    readonly instanceKey: string;
  }): Promise<EvidenceV2ComparePlan>;
  run(input: {
    readonly caseId: string;
    readonly artifactId: string;
    readonly chainId: string;
    readonly instanceKey: string;
  }): Promise<EvidenceV2CompareOutcome>;
}

async function allOccurrences(
  repository: EvidenceV2Repository,
  artifactId: string,
  instanceKey: string,
) {
  const items = [];
  let offset = 0;
  for (;;) {
    const page = await repository.listOccurrences(artifactId, instanceKey, {
      offset,
      limit: 100,
    });
    items.push(...page.items);
    if (offset + page.items.length >= page.total) return items;
    offset += page.items.length;
  }
}

async function acceptedOf(
  repository: EvidenceV2Repository,
  artifactId: string,
  instanceKey: string,
  instanceOrdinal: number,
): Promise<readonly EvidenceV2CompareOccurrence[]> {
  const listed = await allOccurrences(repository, artifactId, instanceKey);
  const reviews = await repository.listReviewDecisions(artifactId, instanceKey);
  const standings = deriveEvidenceV2Standings(
    listed.map((item) => item.occurrenceId),
    reviews,
  );
  const accepted = new Set(
    standings
      .filter((item) => item.standing === 'accepted')
      .map((item) => item.occurrenceId),
  );
  return listed
    .filter((item) => accepted.has(item.occurrenceId))
    .map((item) => ({
      occurrenceId: item.occurrenceId,
      instanceKey,
      instanceOrdinal,
      partId: item.partId,
      startLine: item.startLine,
      endLine: item.endLine,
      exactQuote: item.exactQuote,
    }));
}

export function createEvidenceV2Comparer(
  options: EvidenceV2ComparerOptions,
): EvidenceV2Comparer {
  const ceiling = options.emergencyCallCeiling ?? 200;

  const engine = createExecutionEngine({
    clock: options.clock,
    ids: options.ids,
    modules: createModuleRegistry([evidenceV2CompareModuleForRegistry]),
    contracts: createContractRegistry([evidenceV2CompareContract]),
    pipeline: createResponsePipeline(),
    gateway: options.gateway,
    memory: createMemoryEngine({ ids: options.ids }),
    state: createStateEngine(),
    repository: options.ledger,
  });

  async function planFor(input: {
    readonly artifactId: string;
    readonly chainId: string;
    readonly instanceKey: string;
  }): Promise<EvidenceV2ComparePlan> {
    const detail = await options.repository.readChain(
      input.artifactId,
      input.chainId,
    );
    const instances = detail?.chain.instances ?? [];
    const current = instances.find(
      (item) => item.instanceKey === input.instanceKey,
    );
    const empty = (
      reason: EvidenceV2ComparePlan['reason'],
    ): EvidenceV2ComparePlan => ({
      instanceKey: input.instanceKey,
      windows: [],
      plannedModelCalls: 0,
      outstandingWindowIds: [],
      committedWindowIds: [],
      reason,
    });
    if (current === undefined) return empty('instance-not-reviewed');

    const listed = await allOccurrences(
      options.repository,
      input.artifactId,
      input.instanceKey,
    );
    const reviews = await options.repository.listReviewDecisions(
      input.artifactId,
      input.instanceKey,
    );
    const windows = await options.repository.readExtractionWindows(
      input.artifactId,
      input.instanceKey,
    );
    const completion = deriveEvidenceV2InstanceCompletion({
      instanceKey: input.instanceKey,
      standings: deriveEvidenceV2Standings(
        listed.map((item) => item.occurrenceId),
        reviews,
      ),
      hasCommittedWindow: windows.some((item) => item.status === 'committed'),
    });
    if (completion.state !== 'reviewed') return empty('instance-not-reviewed');

    const earlier = instances.filter(
      (item) => item.instanceOrdinal < current.instanceOrdinal,
    );
    const priors = [];
    for (const instance of earlier) {
      const accepted = await acceptedOf(
        options.repository,
        input.artifactId,
        instance.instanceKey,
        instance.instanceOrdinal,
      );
      priors.push({
        instanceKey: instance.instanceKey,
        instanceOrdinal: instance.instanceOrdinal,
        occurrences: accepted,
      });
    }
    const currentAccepted = await acceptedOf(
      options.repository,
      input.artifactId,
      input.instanceKey,
      current.instanceOrdinal,
    );
    const planned = planEvidenceV2CompareWindows({
      currentInstanceKey: input.instanceKey,
      current: currentAccepted,
      priors,
    });
    if (planned.length === 0) return empty('no-prior-accepted');

    const states = await options.repository.readComparisonWindows(
      input.artifactId,
      input.instanceKey,
    );
    const committed = new Set(
      states
        .filter((state) => state.status === 'committed')
        .map((state) => state.windowId),
    );
    const outstanding = planned
      .filter((window) => !committed.has(window.windowId))
      .map((window) => window.windowId);
    return {
      instanceKey: input.instanceKey,
      windows: planned,
      plannedModelCalls: outstanding.length,
      outstandingWindowIds: outstanding,
      committedWindowIds: [...committed],
      reason: 'ready',
    };
  }

  return {
    plan: planFor,

    async run(input) {
      const plan = await planFor(input);
      if (plan.plannedModelCalls > ceiling) {
        throw new RangeError('EVIDENCE_V2_COMPARE_ABOVE_EMERGENCY_CEILING');
      }

      const outstanding = new Set(plan.outstandingWindowIds);
      let actualModelCalls = 0;
      let relationCount = 0;
      const committedWindowIds: string[] = [];
      let failedWindowId: string | null = null;
      let failureCode: string | null = null;

      for (const window of plan.windows) {
        if (!outstanding.has(window.windowId)) continue;

        const requestKey = deriveEvidenceV2CompareRequestKey({
          artifactId: input.artifactId,
          windowId: window.windowId,
          contractVersion: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
        });
        const before = await options.ledger.snapshot();
        const latest = before.state.snapshots
          .filter(
            (item) =>
              item.namespace === EVIDENCE_V2_COMPARE_NAMESPACE &&
              item.entityId === input.instanceKey,
          )
          .sort((left, right) => left.revision - right.revision)
          .at(-1);

        const result = await engine.execute({
          requestKey,
          namespace: EVIDENCE_V2_COMPARE_NAMESPACE,
          task: 'compare-window',
          entityId: input.instanceKey,
          expectedRevision: latest?.revision ?? 0,
          input: {
            schemaVersion: 'evidence-v2-compare-task/1',
            caseId: input.caseId,
            chainId: input.chainId,
            instanceKey: input.instanceKey,
            window: {
              schemaVersion: 'evidence-v2-compare-input/1',
              artifactId: input.artifactId,
              chainId: input.chainId,
              windowId: window.windowId,
              currentInstanceKey: window.currentInstanceKey,
              priorInstanceKey: window.priorInstanceKey,
              current: window.current.map((item) => ({
                occurrenceId: item.occurrenceId,
                instanceKey: item.instanceKey,
                partId: item.partId,
                startLine: item.startLine,
                endLine: item.endLine,
                exactQuote: item.exactQuote,
              })),
              prior: window.prior.map((item) => ({
                occurrenceId: item.occurrenceId,
                instanceKey: item.instanceKey,
                partId: item.partId,
                startLine: item.startLine,
                endLine: item.endLine,
                exactQuote: item.exactQuote,
              })),
            },
          },
          model: options.selection,
          policy: {
            timeoutMs: 120_000,
            maxModelCalls: 1,
            maxRepairCalls: 1,
            maxRevisionCalls: 0,
            retention: 'encrypted-payload',
          },
        });

        const recordWindow = async (
          state: Pick<
            EvidenceV2ComparisonWindowState,
            'status' | 'relationCount' | 'executionId' | 'failureCode'
          >,
        ): Promise<void> => {
          await options.repository.putComparisonWindow({
            artifactId: input.artifactId,
            instanceKey: input.instanceKey,
            windowId: window.windowId,
            priorInstanceKey: window.priorInstanceKey,
            status: state.status,
            currentCount: window.current.length,
            priorCount: window.prior.length,
            relationCount: state.relationCount,
            executionId: state.executionId,
            failureCode: state.failureCode,
            decidedAt: options.clock.now(),
          });
        };

        if (result.status !== 'committed') {
          actualModelCalls += 1;
          failedWindowId = window.windowId;
          failureCode = result.error.code;
          await recordWindow({
            status: 'failed',
            relationCount: 0,
            executionId: null,
            failureCode: result.error.code,
          });
          break;
        }

        actualModelCalls += result.replayed ? 0 : 1;

        const committed = await options.ledger.snapshot();
        const relations = committed.memoryRecords
          .map((record) => record.value as unknown as EvidenceV2Relation)
          .filter(
            (relation) =>
              relation.windowId === window.windowId &&
              relation.artifactId === input.artifactId,
          );
        for (const relation of relations)
          await options.repository.createRelation(relation);
        await recordWindow({
          status: 'committed',
          relationCount: relations.length,
          executionId: result.executionId,
          failureCode: null,
        });

        committedWindowIds.push(window.windowId);
        relationCount += relations.length;
      }

      return {
        instanceKey: input.instanceKey,
        plannedModelCalls: plan.plannedModelCalls,
        actualModelCalls,
        committedWindowIds,
        relationCount,
        failedWindowId,
        failureCode,
        complete: failedWindowId === null,
      };
    },
  };
}
