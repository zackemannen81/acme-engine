import {
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  type Clock,
  type ExecutionRepository,
  type IdGenerator,
  type RepositoryEvidence,
  type ModelGateway,
  type ModelSelection,
} from '@acme/core';
import type {
  EvidenceV2ExtractionWindowState,
  EvidenceV2Repository,
} from '@acme/evidence-v2-contracts';
import {
  EVIDENCE_V2_NAMESPACE,
  EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
  deriveEvidenceV2WindowRequestKey,
  evidenceV2ModuleForRegistry,
  evidenceV2ObserveContract,
  planEvidenceV2ObserveWindows,
  type EvidenceV2ObserveWindow,
  type EvidenceV2Occurrence,
  type EvidenceV2WindowPart,
} from '@acme/module-evidence-v2';

/**
 * Instance extraction.
 *
 * One engine execution per window, each keyed by
 * `deriveEvidenceV2WindowRequestKey`, and each window's occurrences projected
 * into the product **in the same step that commits it** (ADR-0048 §6). That is
 * the R-05 fix: the frozen extractor projected only after a whole job
 * succeeded, so two runs committed one and six windows to the engine and showed
 * the reviewer nothing.
 *
 * A failed window stops the run and is reported. It is not discarded, and it
 * does not discard anything before it. A re-run executes only the windows with
 * no committed execution (ADR-0048 §7), so nothing already paid for is re-sent.
 */

export const EVIDENCE_V2_OBSERVE_PROFILE = 'evidence-v2-observe';

export interface EvidenceV2ExtractPlan {
  readonly instanceKey: string;
  readonly windows: readonly EvidenceV2ObserveWindow[];
  readonly plannedModelCalls: number;
  readonly outstandingWindowIds: readonly string[];
  readonly committedWindowIds: readonly string[];
}

export interface EvidenceV2ExtractOutcome {
  readonly instanceKey: string;
  readonly plannedModelCalls: number;
  readonly actualModelCalls: number;
  readonly committedWindowIds: readonly string[];
  readonly occurrenceCount: number;
  readonly failedWindowId: string | null;
  readonly failureCode: string | null;
  readonly complete: boolean;
}

/** The engine ledger, plus the snapshot read the projection step needs. */
export type EvidenceV2Ledger = ExecutionRepository & {
  snapshot(): Promise<RepositoryEvidence>;
};

export interface EvidenceV2ExtractorOptions {
  readonly repository: EvidenceV2Repository;
  readonly ledger: EvidenceV2Ledger;
  readonly gateway: ModelGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly selection: ModelSelection;
  /** Guards a runaway only. The plan states the real count (R-09). */
  readonly emergencyCallCeiling?: number;
}

export interface EvidenceV2Extractor {
  plan(input: {
    readonly artifactId: string;
    readonly chainId: string;
    readonly instanceKey: string;
    readonly sourcePartIds: readonly string[];
  }): Promise<EvidenceV2ExtractPlan>;
  run(input: {
    readonly caseId: string;
    readonly artifactId: string;
    readonly chainId: string;
    readonly instanceKey: string;
    readonly sourcePartIds: readonly string[];
  }): Promise<EvidenceV2ExtractOutcome>;
}

export function createEvidenceV2Extractor(
  options: EvidenceV2ExtractorOptions,
): EvidenceV2Extractor {
  const ceiling = options.emergencyCallCeiling ?? 200;

  const engine = createExecutionEngine({
    clock: options.clock,
    ids: options.ids,
    modules: createModuleRegistry([evidenceV2ModuleForRegistry]),
    contracts: createContractRegistry([evidenceV2ObserveContract]),
    pipeline: createResponsePipeline(),
    gateway: options.gateway,
    memory: createMemoryEngine({ ids: options.ids }),
    state: createStateEngine(),
    repository: options.ledger,
  });

  async function windowsOf(
    artifactId: string,
    sourcePartIds: readonly string[],
  ): Promise<readonly EvidenceV2ObserveWindow[]> {
    const parts: EvidenceV2WindowPart[] = [];
    for (const partId of sourcePartIds) {
      const part = await options.repository.readPart(artifactId, partId);
      if (part === undefined) continue;
      parts.push({
        partId: part.partId,
        units: part.units.map((unit) => ({
          unitId: unit.unitId,
          startLine: unit.startLine,
          endLine: unit.endLine,
          exactQuote: unit.exactQuote,
        })),
      });
    }
    return planEvidenceV2ObserveWindows(parts);
  }

  async function planFor(input: {
    readonly artifactId: string;
    readonly chainId: string;
    readonly instanceKey: string;
    readonly sourcePartIds: readonly string[];
  }): Promise<EvidenceV2ExtractPlan> {
    const windows = await windowsOf(input.artifactId, input.sourcePartIds);
    const states = await options.repository.readExtractionWindows(
      input.artifactId,
      input.instanceKey,
    );
    const committed = new Set(
      states
        .filter((state) => state.status === 'committed')
        .map((state) => state.windowId),
    );
    const outstanding = windows
      .filter((window) => !committed.has(window.windowId))
      .map((window) => window.windowId);
    return {
      instanceKey: input.instanceKey,
      windows,
      plannedModelCalls: outstanding.length,
      outstandingWindowIds: outstanding,
      committedWindowIds: [...committed],
    };
  }

  return {
    plan: planFor,

    async run(input) {
      const plan = await planFor(input);
      if (plan.plannedModelCalls > ceiling) {
        throw new RangeError('EVIDENCE_V2_EXTRACTION_ABOVE_EMERGENCY_CEILING');
      }

      const outstanding = new Set(plan.outstandingWindowIds);
      let actualModelCalls = 0;
      let occurrenceCount = 0;
      const committedWindowIds: string[] = [];
      let failedWindowId: string | null = null;
      let failureCode: string | null = null;

      for (const window of plan.windows) {
        if (!outstanding.has(window.windowId)) continue;

        const requestKey = deriveEvidenceV2WindowRequestKey({
          artifactId: input.artifactId,
          windowId: window.windowId,
          contractVersion: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
        });
        const before = await options.ledger.snapshot();
        const latest = before.state.snapshots
          .filter(
            (item) =>
              item.namespace === EVIDENCE_V2_NAMESPACE &&
              item.entityId === input.instanceKey,
          )
          .sort((left, right) => left.revision - right.revision)
          .at(-1);

        const result = await engine.execute({
          requestKey,
          namespace: EVIDENCE_V2_NAMESPACE,
          task: 'observe-window',
          entityId: input.instanceKey,
          expectedRevision: latest?.revision ?? 0,
          input: {
            schemaVersion: 'evidence-v2-observe-task/1',
            caseId: input.caseId,
            chainId: input.chainId,
            instanceKey: input.instanceKey,
            window: {
              schemaVersion: 'evidence-v2-observe-input/1',
              artifactId: input.artifactId,
              partId: window.partId,
              windowId: window.windowId,
              units: window.units,
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

        if (result.status !== 'committed') {
          // The call was made and paid for even though the window failed.
          actualModelCalls += 1;
          // Fail closed, for this window only. Everything already committed
          // stays committed and stays visible.
          failedWindowId = window.windowId;
          failureCode = result.error.code;
          await options.repository.putExtractionWindow({
            artifactId: input.artifactId,
            instanceKey: input.instanceKey,
            windowId: window.windowId,
            partId: window.partId,
            status: 'failed',
            unitCount: window.units.length,
            occurrenceCount: 0,
            executionId: null,
            failureCode: result.error.code,
            decidedAt: options.clock.now(),
          });
          break;
        }

        // A replayed execution reuses its recorded call and spends nothing.
        actualModelCalls += result.replayed ? 0 : 1;

        // Project this window now, in the same step that committed it.
        const committed = await options.ledger.snapshot();
        const occurrences = committed.memoryRecords
          .map(
            (record: RepositoryEvidence['memoryRecords'][number]) =>
              record.value as unknown as EvidenceV2Occurrence,
          )
          .filter(
            (occurrence) =>
              occurrence.windowId === window.windowId &&
              occurrence.artifactId === input.artifactId,
          );
        await options.repository.putOccurrences(
          input.artifactId,
          input.instanceKey,
          occurrences,
        );
        await options.repository.putExtractionWindow({
          artifactId: input.artifactId,
          instanceKey: input.instanceKey,
          windowId: window.windowId,
          partId: window.partId,
          status: 'committed',
          unitCount: window.units.length,
          occurrenceCount: occurrences.length,
          executionId: result.executionId,
          failureCode: null,
          decidedAt: options.clock.now(),
        });

        committedWindowIds.push(window.windowId);
        occurrenceCount += occurrences.length;
      }

      return {
        instanceKey: input.instanceKey,
        plannedModelCalls: plan.plannedModelCalls,
        actualModelCalls,
        committedWindowIds,
        occurrenceCount,
        failedWindowId,
        failureCode,
        complete: failedWindowId === null,
      };
    },
  };
}

export type { EvidenceV2ExtractionWindowState };
