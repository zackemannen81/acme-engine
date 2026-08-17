import { describe, expect, it } from 'vitest';

import { createInMemoryExecutionRepository } from '@acme/adapter-memory';
import { createAes256GcmPayloadEncryptor } from '@acme/core';
import type {
  ModelCapabilities,
  ModelGateway,
  ModelRequest,
  NormalizedModelResponse,
} from '@acme/core';
import type {
  EvidenceV2ArtifactRecord,
  EvidenceV2ExtractionWindowState,
  EvidenceV2Occurrence,
  EvidenceV2Page,
  EvidenceV2PageRequest,
  EvidenceV2Repository,
  EvidenceV2SourcePart,
} from '@acme/evidence-v2-contracts';

import { createEvidenceV2Extractor } from '../src/extract.js';

/**
 * A gateway that answers per call and can be told to fail one window.
 *
 * The scripted mock gateway pins execution ids and request hashes, which is the
 * wrong tool for asserting blast radius: these tests need to fail window 2 and
 * then resume, so the stub counts calls and refuses by window instead.
 */
function stubGateway(options: {
  readonly failWindowsContaining?: readonly string[];
  readonly invalid?: readonly string[];
}): ModelGateway & { readonly calls: string[] } {
  const calls: string[] = [];
  const capabilities: ModelCapabilities = {
    structuredOutput: true,
    tools: false,
    vision: false,
    maxInputTokens: 32_000,
    maxOutputTokens: 4_096,
  };
  return {
    calls,
    async capabilities() {
      return capabilities;
    },
    async generate(request: ModelRequest): Promise<NormalizedModelResponse> {
      const prompt = request.messages
        .flatMap((message) => message.content)
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('\n');
      const windowId = /window-\d+/u.exec(prompt)?.[0] ?? 'unknown';
      calls.push(windowId);

      if (options.failWindowsContaining?.some((id) => prompt.includes(id))) {
        throw new Error('provider refused this window');
      }

      // Cite the first unit of the window, taken from the prompt itself.
      const unitId = /(part-\d+-unit-\d+)/u.exec(prompt)?.[1] ?? 'missing-unit';
      const body = options.invalid?.some((id) => prompt.includes(id))
        ? {
            schemaVersion: 'evidence-v2-observe-output/1',
            observations: [
              {
                // Not in the window: the contract must refuse it.
                sourceUnitId: 'part-999999-unit-0001',
                kind: 'statement-occurrence',
                actorReference: null,
                temporalBound: null,
              },
            ],
          }
        : {
            schemaVersion: 'evidence-v2-observe-output/1',
            observations: [
              {
                sourceUnitId: unitId,
                kind: 'statement-occurrence',
                actorReference: null,
                temporalBound: null,
              },
            ],
          };
      return {
        provider: 'stub',
        model: 'stub-1',
        receivedAt: '2026-08-16T00:00:00.000Z',
        finishReason: 'stop',
        text: JSON.stringify(body),
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        metadata: {},
      };
    },
  };
}

/** Only the repository surface the extractor touches. */
function memoryRepository(parts: readonly EvidenceV2SourcePart[]) {
  const occurrences = new Map<string, EvidenceV2Occurrence>();
  const windows = new Map<string, EvidenceV2ExtractionWindowState>();
  const page = <T>(
    items: readonly T[],
    request: EvidenceV2PageRequest,
  ): EvidenceV2Page<T> => ({
    items: items.slice(request.offset, request.offset + request.limit),
    total: items.length,
    offset: request.offset,
    limit: request.limit,
  });

  const repository = {
    async readPart(_artifactId: string, partId: string) {
      return parts.find((part) => part.partId === partId);
    },
    async putOccurrences(
      _artifactId: string,
      _instanceKey: string,
      values: readonly EvidenceV2Occurrence[],
    ) {
      for (const value of values) occurrences.set(value.occurrenceId, value);
    },
    async listOccurrences(
      _artifactId: string,
      _instanceKey: string,
      request: EvidenceV2PageRequest,
    ) {
      return page([...occurrences.values()], request);
    },
    async putExtractionWindow(state: EvidenceV2ExtractionWindowState) {
      windows.set(state.windowId, state);
    },
    async readExtractionWindows() {
      return [...windows.values()];
    },
  } as unknown as EvidenceV2Repository;

  return { repository, occurrences, windows };
}

function part(partId: string, unitCount: number): EvidenceV2SourcePart {
  return {
    partId,
    startLine: 1,
    endLine: unitCount,
    contentCharacter: 'substantive',
    title: { text: `Förhör i ${partId}`, sourceLine: 1 },
    units: Array.from({ length: unitCount }, (_, index) => ({
      unitId: `${partId}-unit-${String(index + 1).padStart(4, '0')}`,
      startLine: index + 1,
      endLine: index + 1,
      exactQuote: `Berättelsen fortsätter i stycke ${String(index + 1)}.`,
    })),
  };
}

const ARTIFACT = 'artifact-extract-test';
const INSTANCE = 'instance-1';

function extractor(
  parts: readonly EvidenceV2SourcePart[],
  gateway: ModelGateway,
  shared?: ReturnType<typeof memoryRepository>,
) {
  const store = shared ?? memoryRepository(parts);
  let counter = 0;
  const ids = {
    next: (kind: string) => {
      counter += 1;
      return `${kind}-${String(counter)}`;
    },
  };
  const ledger = createInMemoryExecutionRepository({
    ids,
    // The contract retains its payload encrypted, so the ledger needs a key.
    payloadEncryptor: createAes256GcmPayloadEncryptor({
      key: Buffer.alloc(32, 3),
      keyId: 'extract-test',
    }),
  });
  return {
    store,
    ledger,
    run: createEvidenceV2Extractor({
      repository: store.repository,
      ledger,
      gateway,
      clock: { now: () => '2026-08-16T00:00:00.000Z' },
      ids,
      selection: { profile: 'evidence-v2-observe', modelHint: 'stub-1' },
    }),
  };
}

const INPUT = {
  caseId: 'case-1',
  artifactId: ARTIFACT,
  chainId: 'chain-1',
  instanceKey: INSTANCE,
  sourcePartIds: ['part-000001'],
};

describe('evidence v2 instance extraction', () => {
  it('states the planned call count before spending anything', async () => {
    const gateway = stubGateway({});
    const { run } = extractor([part('part-000001', 50)], gateway);

    const plan = await run.plan(INPUT);
    expect(plan.windows.length).toBeGreaterThan(1);
    expect(plan.plannedModelCalls).toBe(plan.windows.length);
    expect(plan.committedWindowIds).toEqual([]);
    expect(gateway.calls).toEqual([]);
  });

  it('commits every window and projects its occurrences', async () => {
    const gateway = stubGateway({});
    const { run, store } = extractor([part('part-000001', 50)], gateway);

    const outcome = await run.run(INPUT);

    expect([outcome.failedWindowId, outcome.failureCode]).toEqual([null, null]);
    expect(outcome.complete).toBe(true);
    expect(outcome.actualModelCalls).toBe(outcome.plannedModelCalls);
    expect(outcome.committedWindowIds).toHaveLength(outcome.plannedModelCalls);
    expect(outcome.occurrenceCount).toBeGreaterThan(0);
    expect(store.occurrences.size).toBe(outcome.occurrenceCount);
  });

  it('builds each occurrence from its unit, never from the response', async () => {
    const gateway = stubGateway({});
    const parts = [part('part-000001', 24)];
    const { run, store } = extractor(parts, gateway);

    await run.run(INPUT);

    const unitsById = new Map(
      parts.flatMap((item) => item.units.map((unit) => [unit.unitId, unit])),
    );
    expect(store.occurrences.size).toBeGreaterThan(0);
    for (const occurrence of store.occurrences.values()) {
      const unit = unitsById.get(occurrence.unitId);
      expect(occurrence.exactQuote).toBe(unit?.exactQuote);
      expect(occurrence.startLine).toBe(unit?.startLine);
      expect(occurrence.actorReference).toBeNull();
      expect(occurrence.executionId.length).toBeGreaterThan(0);
    }
  });

  /**
   * R-05. The frozen extractor committed six windows to the engine and showed
   * the reviewer nothing, because projection waited for the whole job.
   */
  it('keeps earlier windows when a later one fails, and reports the failure', async () => {
    const parts = [part('part-000001', 72)];
    const clean = stubGateway({});
    const first = extractor(parts, clean);
    const plan = await first.run.plan(INPUT);
    const secondWindowId = plan.windows[1]?.windowId ?? '';
    expect(plan.windows.length).toBeGreaterThan(2);

    const failing = stubGateway({ failWindowsContaining: [secondWindowId] });
    const { run, store } = extractor(parts, failing);

    const outcome = await run.run(INPUT);

    expect(outcome.complete).toBe(false);
    expect(outcome.failedWindowId).toBe(secondWindowId);
    expect(outcome.failureCode).not.toBeNull();
    // Window 1 committed and stayed committed.
    expect(outcome.committedWindowIds).toEqual([
      plan.windows[0]?.windowId ?? '',
    ]);
    expect(store.occurrences.size).toBeGreaterThan(0);
    const states = await store.repository.readExtractionWindows(
      ARTIFACT,
      INSTANCE,
    );
    expect(
      states.find((state) => state.windowId === secondWindowId)?.status,
    ).toBe('failed');
    // The run stopped at the failure rather than burning the rest.
    expect(failing.calls).toHaveLength(2);
  });

  it('re-runs only the outstanding windows, re-sending nothing paid for', async () => {
    const parts = [part('part-000001', 72)];
    const probe = extractor(parts, stubGateway({}));
    const plan = await probe.run.plan(INPUT);
    const secondWindowId = plan.windows[1]?.windowId ?? '';

    const shared = memoryRepository(parts);
    const failing = stubGateway({ failWindowsContaining: [secondWindowId] });
    const firstAttempt = extractor(parts, failing, shared);
    const failed = await firstAttempt.run.run(INPUT);
    expect(failed.committedWindowIds).toHaveLength(1);
    const occurrencesAfterFirst = JSON.stringify([
      ...shared.occurrences.values(),
    ]);

    // Second attempt over the same product state, with a healthy provider.
    const healthy = stubGateway({});
    const secondAttempt = extractor(parts, healthy, shared);
    const resumePlan = await secondAttempt.run.plan(INPUT);

    expect(resumePlan.committedWindowIds).toEqual(failed.committedWindowIds);
    expect(resumePlan.plannedModelCalls).toBe(plan.windows.length - 1);
    expect(resumePlan.outstandingWindowIds).not.toContain(
      failed.committedWindowIds[0],
    );

    const resumed = await secondAttempt.run.run(INPUT);

    expect(resumed.complete).toBe(true);
    expect(healthy.calls).not.toContain(
      plan.windows[0]?.windowId.replace('part-000001-', '') ?? '',
    );
    expect(healthy.calls).toHaveLength(plan.windows.length - 1);
    // The already committed window's occurrences are untouched.
    expect(
      JSON.stringify(
        [...shared.occurrences.values()].filter(
          (occurrence) => occurrence.windowId === failed.committedWindowIds[0],
        ),
      ),
    ).toBe(
      JSON.stringify(
        (JSON.parse(occurrencesAfterFirst) as EvidenceV2Occurrence[]).filter(
          (occurrence) => occurrence.windowId === failed.committedWindowIds[0],
        ),
      ),
    );
  });

  it('fails a window closed when the response cites a unit outside it', async () => {
    const parts = [part('part-000001', 24)];
    const gateway = stubGateway({ invalid: ['window-0001'] });
    const { run, store } = extractor(parts, gateway);

    const outcome = await run.run(INPUT);

    expect(outcome.complete).toBe(false);
    expect(outcome.committedWindowIds).toEqual([]);
    expect(store.occurrences.size).toBe(0);
    // One primary call plus one bounded repair, then closed.
    expect(gateway.calls.length).toBeGreaterThanOrEqual(1);
  });
});

export type { EvidenceV2ArtifactRecord };
