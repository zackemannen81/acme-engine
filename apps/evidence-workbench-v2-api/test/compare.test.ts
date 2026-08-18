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
  EvidenceV2ComparisonWindowState,
  EvidenceV2ExtractionWindowState,
  EvidenceV2Occurrence,
  EvidenceV2Page,
  EvidenceV2PageRequest,
  EvidenceV2Relation,
  EvidenceV2Repository,
  EvidenceV2ReviewDecision,
} from '@acme/evidence-v2-contracts';

import { createEvidenceV2Comparer } from '../src/compare.js';

function stubGateway(options: {
  readonly fail?: boolean;
  readonly invalid?: boolean;
}): ModelGateway & { readonly calls: number } {
  const capabilities: ModelCapabilities = {
    structuredOutput: true,
    tools: false,
    vision: false,
    maxInputTokens: 32_000,
    maxOutputTokens: 4_096,
  };
  const gateway = {
    calls: 0,
    async capabilities() {
      return capabilities;
    },
    async generate(request: ModelRequest): Promise<NormalizedModelResponse> {
      gateway.calls += 1;
      void request;
      if (options.fail) throw new Error('provider refused this window');
      const body = options.invalid
        ? {
            schemaVersion: 'evidence-v2-compare-output/1',
            relations: [
              {
                fromOccurrenceId: 'missing',
                toOccurrenceId: 'missing',
                type: 'supports',
                comparableScope: {
                  actor: 'comparable',
                  time: 'comparable',
                  location: 'unknown',
                  entity: 'unknown',
                },
                rationale: 'Invented.',
              },
            ],
          }
        : {
            schemaVersion: 'evidence-v2-compare-output/1',
            relations: [
              {
                fromOccurrenceId: 'occ-current',
                toOccurrenceId: 'occ-prior',
                type: 'contradicts',
                comparableScope: {
                  actor: 'comparable',
                  time: 'comparable',
                  location: 'unknown',
                  entity: 'comparable',
                },
                rationale: 'Green versus blue, same actor, same evening.',
              },
            ],
          };
      return {
        provider: 'stub',
        model: 'stub-1',
        receivedAt: '2026-08-18T00:00:00.000Z',
        finishReason: 'stop',
        text: JSON.stringify(body),
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        metadata: {},
      };
    },
  };
  return gateway;
}

function occurrence(occurrenceId: string, quote: string): EvidenceV2Occurrence {
  return {
    schemaVersion: 'evidence-v2-occurrence/1',
    occurrenceId,
    artifactId: 'artifact-1',
    partId: 'part-000001',
    unitId: `${occurrenceId}-unit`,
    startLine: 10,
    endLine: 10,
    exactQuote: quote,
    kind: 'statement-occurrence',
    actorReference: null,
    temporalBound: null,
    executionId: 'exec-1',
    contractVersion: '1.0.0',
    windowId: 'part-000001-window-0001',
    authoredBy: 'model',
  };
}

function review(
  occurrenceId: string,
  instanceKey: string,
): EvidenceV2ReviewDecision {
  return {
    schemaVersion: 'evidence-v2-review/1',
    decisionId: `review-${occurrenceId}`,
    artifactId: 'artifact-1',
    instanceKey,
    occurrenceId,
    action: 'accept',
    supersedes: null,
    principal: 'principal-a',
    decidedAt: '2026-08-18T00:00:00.000Z',
    rationale: 'Accepted.',
  };
}

function memoryRepository() {
  const occurrences = new Map<string, EvidenceV2Occurrence[]>();
  const reviews: EvidenceV2ReviewDecision[] = [];
  const windows = new Map<string, EvidenceV2ExtractionWindowState[]>();
  const relations: EvidenceV2Relation[] = [];
  const comparisons = new Map<string, EvidenceV2ComparisonWindowState[]>();
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
    async readChain() {
      return {
        chain: {
          chainId: 'chain-1',
          subjectLabel: 'Ammouri, Hussein',
          caseFileRef: null,
          instances: [
            {
              instanceKey: 'instance-1',
              instanceOrdinal: 1,
              ordered: true,
              instanceSourceTime: {
                kind: 'range',
                from: '2007-04-24',
                to: '2007-04-24',
                provenance: 'document-metadata',
                sourceLine: 1,
              },
              sourcePartIds: ['part-000001'],
            },
            {
              instanceKey: 'instance-2',
              instanceOrdinal: 2,
              ordered: true,
              instanceSourceTime: {
                kind: 'range',
                from: '2007-05-01',
                to: '2007-05-01',
                provenance: 'document-metadata',
                sourceLine: 1,
              },
              sourcePartIds: ['part-000002'],
            },
          ],
        },
        memberships: [],
      };
    },
    async listOccurrences(
      artifactId: string,
      instanceKey: string,
      request: EvidenceV2PageRequest,
    ) {
      return page(
        occurrences.get(`${artifactId}/${instanceKey}`) ?? [],
        request,
      );
    },
    async listReviewDecisions(artifactId: string, instanceKey: string) {
      return reviews.filter(
        (item) =>
          item.artifactId === artifactId && item.instanceKey === instanceKey,
      );
    },
    async readExtractionWindows(artifactId: string, instanceKey: string) {
      return windows.get(`${artifactId}/${instanceKey}`) ?? [];
    },
    async createRelation(relation: EvidenceV2Relation) {
      relations.push(relation);
    },
    async putComparisonWindow(state: EvidenceV2ComparisonWindowState) {
      const key = `${state.artifactId}/${state.instanceKey}`;
      const held = (comparisons.get(key) ?? []).filter(
        (item) => item.windowId !== state.windowId,
      );
      comparisons.set(key, [...held, state]);
    },
    async readComparisonWindows(artifactId: string, instanceKey: string) {
      return comparisons.get(`${artifactId}/${instanceKey}`) ?? [];
    },
  } as unknown as EvidenceV2Repository;

  return { repository, occurrences, reviews, windows, relations, comparisons };
}

function seedReviewed(
  store: ReturnType<typeof memoryRepository>,
  instanceKey: string,
  item: EvidenceV2Occurrence,
): void {
  const key = `artifact-1/${instanceKey}`;
  store.occurrences.set(key, [...(store.occurrences.get(key) ?? []), item]);
  store.reviews.push(review(item.occurrenceId, instanceKey));
  store.windows.set(key, [
    {
      artifactId: 'artifact-1',
      instanceKey,
      windowId: `${instanceKey}-window-0001`,
      partId: item.partId,
      status: 'committed',
      unitCount: 1,
      occurrenceCount: 1,
      executionId: 'exec-1',
      failureCode: null,
      decidedAt: '2026-08-18T00:00:00.000Z',
    },
  ]);
}

function comparer(gateway: ModelGateway, store = memoryRepository()) {
  let counter = 0;
  const ids = {
    next: (kind: string) => {
      counter += 1;
      return `${kind}-${String(counter)}`;
    },
  };
  const ledger = createInMemoryExecutionRepository({
    ids,
    payloadEncryptor: createAes256GcmPayloadEncryptor({
      key: Buffer.alloc(32, 5),
      keyId: 'compare-test',
    }),
  });
  return {
    store,
    ledger,
    run: createEvidenceV2Comparer({
      repository: store.repository,
      ledger,
      gateway,
      clock: { now: () => '2026-08-18T00:00:00.000Z' },
      ids,
      selection: { profile: 'evidence-v2-compare', modelHint: 'stub-1' },
    }),
  };
}

const INPUT = {
  caseId: 'case-1',
  artifactId: 'artifact-1',
  chainId: 'chain-1',
  instanceKey: 'instance-2',
};

describe('evidence v2 instance comparison', () => {
  it('plans nothing when the current instance is not reviewed', async () => {
    const gateway = stubGateway({});
    const store = memoryRepository();
    seedReviewed(
      store,
      'instance-1',
      occurrence('occ-prior', 'Han beskriver bilen som blå.'),
    );
    const { run } = comparer(gateway, store);
    const plan = await run.plan(INPUT);
    expect(plan.reason).toBe('instance-not-reviewed');
    expect(plan.plannedModelCalls).toBe(0);
    expect(gateway.calls).toBe(0);
  });

  it('plans nothing when no earlier instance has accepted material', async () => {
    const gateway = stubGateway({});
    const store = memoryRepository();
    seedReviewed(
      store,
      'instance-2',
      occurrence('occ-current', 'Han säger att bilen var grön.'),
    );
    const { run } = comparer(gateway, store);
    const plan = await run.plan(INPUT);
    expect(plan.reason).toBe('no-prior-accepted');
    expect(plan.plannedModelCalls).toBe(0);
  });

  it('states the planned call count before spending anything', async () => {
    const gateway = stubGateway({});
    const store = memoryRepository();
    seedReviewed(
      store,
      'instance-1',
      occurrence('occ-prior', 'Han beskriver bilen som blå.'),
    );
    seedReviewed(
      store,
      'instance-2',
      occurrence('occ-current', 'Han säger att bilen var grön.'),
    );
    const { run } = comparer(gateway, store);
    const plan = await run.plan(INPUT);
    expect(plan.reason).toBe('ready');
    expect(plan.plannedModelCalls).toBe(1);
    expect(plan.windows).toHaveLength(1);
    expect(gateway.calls).toBe(0);
  });

  it('commits the window and projects the relation from cited ids', async () => {
    const gateway = stubGateway({});
    const store = memoryRepository();
    seedReviewed(
      store,
      'instance-1',
      occurrence('occ-prior', 'Han beskriver bilen som blå.'),
    );
    seedReviewed(
      store,
      'instance-2',
      occurrence('occ-current', 'Han säger att bilen var grön.'),
    );
    const { run } = comparer(gateway, store);
    const outcome = await run.run(INPUT);
    expect(outcome.complete).toBe(true);
    expect(outcome.actualModelCalls).toBe(1);
    expect(outcome.relationCount).toBe(1);
    expect(store.relations).toHaveLength(1);
    expect(store.relations[0]?.from.id).toBe('occ-current');
    expect(store.relations[0]?.to.id).toBe('occ-prior');
    expect(store.relations[0]?.type).toBe('contradicts');
    expect(store.relations[0]?.provenance).toBe('model-proposed');
  });

  it('replays a committed window and spends nothing', async () => {
    const gateway = stubGateway({});
    const store = memoryRepository();
    seedReviewed(
      store,
      'instance-1',
      occurrence('occ-prior', 'Han beskriver bilen som blå.'),
    );
    seedReviewed(
      store,
      'instance-2',
      occurrence('occ-current', 'Han säger att bilen var grön.'),
    );
    const first = comparer(gateway, store);
    await first.run.run(INPUT);
    expect(gateway.calls).toBe(1);

    const resumed = createEvidenceV2Comparer({
      repository: store.repository,
      ledger: first.ledger,
      gateway,
      clock: { now: () => '2026-08-18T01:00:00.000Z' },
      ids: { next: (kind) => `${kind}-resume` },
      selection: { profile: 'evidence-v2-compare', modelHint: 'stub-1' },
    });
    const outcome = await resumed.run(INPUT);
    expect(outcome.actualModelCalls).toBe(0);
    expect(outcome.complete).toBe(true);
    expect(gateway.calls).toBe(1);
  });

  it('refuses an invented endpoint and fails only that window', async () => {
    const gateway = stubGateway({ invalid: true });
    const store = memoryRepository();
    seedReviewed(
      store,
      'instance-1',
      occurrence('occ-prior', 'Han beskriver bilen som blå.'),
    );
    seedReviewed(
      store,
      'instance-2',
      occurrence('occ-current', 'Han säger att bilen var grön.'),
    );
    const { run } = comparer(gateway, store);
    const outcome = await run.run(INPUT);
    expect(outcome.complete).toBe(false);
    expect(outcome.failedWindowId).not.toBeNull();
    expect(store.relations).toHaveLength(0);
  });
});
