import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  AcmeError,
  buildStateProjectionInput,
  canonicalJson,
  createStateEngine,
  type DomainModule,
  type MemoryCandidate,
  type MemoryResolution,
  type ModuleResult,
  type PreparedMemory,
  type PreparedMemoryDecision,
  type StateProjectionInput,
  type TaskMap,
} from '../src/index.js';

const candidate = (key: string, value: string): MemoryCandidate => ({
  key,
  kind: 'fixture',
  schemaVersion: 'fixture-memory@1',
  value: { value },
  source: {
    executionId: 'execution-1',
    contract: { id: 'fixture.observe', version: '1.0.0' },
    documentKeys: ['source'],
  },
});

const decision = (
  candidateKey: string,
  resolution: MemoryResolution,
  affectedMemoryIds: readonly string[],
): PreparedMemoryDecision => ({
  candidateKey,
  identityKey: `identity:${candidateKey}`,
  resolution,
  affectedMemoryIds,
});

const result = (
  memories: readonly MemoryCandidate[],
): ModuleResult<{ readonly accepted: readonly string[] }> => ({
  documents: [],
  memories,
  stateIntent: {
    schemaVersion: 'fixture-delta@1',
    value: { accepted: ['direct'] },
  },
  events: [],
  diagnostics: [],
});

const prepared = (
  decisions: readonly PreparedMemoryDecision[],
): PreparedMemory => ({
  decisions,
  mutations: [],
});

function errorCode(callback: () => unknown): string | undefined {
  try {
    callback();
    return undefined;
  } catch (error: unknown) {
    return error instanceof AcmeError ? error.data.code : undefined;
  }
}

describe('buildStateProjectionInput', () => {
  it('retains every applied resolution in prepared decision order', () => {
    const candidates = [
      candidate('create', 'one'),
      candidate('reinforce', 'two'),
      candidate('merge', 'three'),
      candidate('contest', 'four'),
      candidate('supersede', 'five'),
    ];
    const decisions = [
      decision(
        'merge',
        {
          candidateKey: 'merge',
          action: 'merge',
          memoryId: 'memory-2',
          value: { merged: true },
          strength: 3,
        },
        ['memory-2'],
      ),
      decision(
        'create',
        {
          candidateKey: 'create',
          action: 'create',
          value: { created: true },
          strength: 1,
        },
        ['memory-1'],
      ),
      decision(
        'reinforce',
        {
          candidateKey: 'reinforce',
          action: 'reinforce',
          memoryId: 'memory-1',
          strength: 2,
        },
        ['memory-1'],
      ),
      decision(
        'contest',
        {
          candidateKey: 'contest',
          action: 'contradict',
          memoryIds: ['memory-1'],
          disposition: 'contest',
        },
        ['memory-1'],
      ),
      decision(
        'supersede',
        {
          candidateKey: 'supersede',
          action: 'contradict',
          memoryIds: ['memory-2'],
          disposition: 'supersede-existing',
          replacement: { value: { replacement: true }, strength: 4 },
        },
        ['memory-2', 'memory-3'],
      ),
    ];

    const input = buildStateProjectionInput(
      result(candidates),
      prepared(decisions),
    );

    expect(input.memory.map(({ candidate }) => candidate.key)).toEqual([
      'merge',
      'create',
      'reinforce',
      'contest',
      'supersede',
    ]);
    expect(input.memory.map(({ resolution }) => resolution.action)).toEqual([
      'merge',
      'create',
      'reinforce',
      'contradict',
      'contradict',
    ]);
    expect(input.stateIntent?.value).toEqual({ accepted: ['direct'] });
  });

  it('excludes ignore and reject-candidate from memory-derived state input', () => {
    const ignored = candidate('ignored', 'ignored');
    const rejected = candidate('rejected', 'rejected');
    const input = buildStateProjectionInput(
      result([ignored, rejected]),
      prepared([
        decision(
          'ignored',
          {
            candidateKey: 'ignored',
            action: 'ignore',
            reason: 'not relevant',
          },
          [],
        ),
        decision(
          'rejected',
          {
            candidateKey: 'rejected',
            action: 'contradict',
            memoryIds: ['memory-1'],
            disposition: 'reject-candidate',
          },
          [],
        ),
      ]),
    );

    expect(input.memory).toEqual([]);
    expect(input.stateIntent?.value).toEqual({ accepted: ['direct'] });
  });

  it('rejects missing, foreign and duplicate correspondence keys', () => {
    const one = candidate('one', 'one');
    const create = decision(
      'one',
      {
        candidateKey: 'one',
        action: 'create',
        value: { value: 'one' },
        strength: 1,
      },
      ['memory-1'],
    );

    expect(
      errorCode(() => buildStateProjectionInput(result([one]), prepared([]))),
    ).toBe('DOMAIN_INVALID_RESULT');
    expect(
      errorCode(() =>
        buildStateProjectionInput(
          result([]),
          prepared([{ ...create, candidateKey: 'foreign' }]),
        ),
      ),
    ).toBe('DOMAIN_INVALID_RESULT');
    expect(
      errorCode(() =>
        buildStateProjectionInput(result([one, one]), prepared([create])),
      ),
    ).toBe('DOMAIN_INVALID_RESULT');
    expect(
      errorCode(() =>
        buildStateProjectionInput(result([one]), prepared([create, create])),
      ),
    ).toBe('DOMAIN_INVALID_RESULT');
  });

  it('returns detached, deeply frozen and replay-stable JSON input', () => {
    const sourceCandidate = candidate('one', 'one');
    const sourceDecision = decision(
      'one',
      {
        candidateKey: 'one',
        action: 'create',
        value: { value: 'one' },
        strength: 1,
      },
      ['memory-1'],
    );
    const first = buildStateProjectionInput(
      result([sourceCandidate]),
      prepared([sourceDecision]),
    );
    const second = buildStateProjectionInput(
      result([sourceCandidate]),
      prepared([sourceDecision]),
    );

    expect(canonicalJson(first as never)).toBe(canonicalJson(second as never));
    expect(first).not.toBe(second);
    expect(first.memory[0]?.candidate).not.toBe(sourceCandidate);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.memory)).toBe(true);
    expect(Object.isFrozen(first.memory[0]?.candidate.value)).toBe(true);
    expect(Object.isFrozen(first.stateIntent?.value)).toBe(true);
  });

  it('supports a pure domain projection using only intent and applied decisions', () => {
    const project = (
      input: StateProjectionInput<{ readonly accepted: readonly string[] }>,
    ) => ({
      schemaVersion: 'fixture-delta@1',
      value: {
        accepted: [
          ...(input.stateIntent?.value.accepted ?? []),
          ...input.memory.map(({ candidate: item }) => item.key),
        ],
      },
    });
    const accepted = candidate('accepted', 'accepted');
    const ignored = candidate('ignored', 'ignored');
    const projectionInput = buildStateProjectionInput(
      result([accepted, ignored]),
      prepared([
        decision(
          'accepted',
          {
            candidateKey: 'accepted',
            action: 'create',
            value: { value: 'accepted' },
            strength: 1,
          },
          ['memory-1'],
        ),
        decision(
          'ignored',
          {
            candidateKey: 'ignored',
            action: 'ignore',
            reason: 'not relevant',
          },
          [],
        ),
      ]),
    );

    expect(project(projectionInput)).toEqual({
      schemaVersion: 'fixture-delta@1',
      value: { accepted: ['direct', 'accepted'] },
    });
  });

  it('keeps the projected delta non-canonical until StateEngine validates it', () => {
    type FixtureState = { readonly accepted: readonly string[] };
    type FixtureDelta = { readonly accepted: readonly string[] };
    const module: DomainModule<
      FixtureState,
      FixtureDelta,
      TaskMap<FixtureState, FixtureDelta>
    > = {
      namespace: 'fixture',
      stateSchemaVersion: 'fixture-state@1',
      deltaSchemaVersion: 'fixture-delta@1',
      stateSchema: z.strictObject({ accepted: z.array(z.string()) }),
      deltaSchema: z.strictObject({ accepted: z.array(z.string()) }),
      tasks: {},
      memoryPolicy: {
        validate: () => [],
        identity: (item) => item.key,
        retrieve: () => [],
        resolve: (item) => ({
          candidateKey: item.key,
          action: 'ignore',
          reason: 'unused',
        }),
        lifecycle: () => ({ action: 'retain' }),
      },
      initialState: () => ({ accepted: [] }),
      reduce: (_state, delta) => ({ accepted: delta.accepted }),
      invariants: () => [],
    };
    const projectionInput = buildStateProjectionInput(
      result([candidate('accepted', 'accepted')]),
      prepared([
        decision(
          'accepted',
          {
            candidateKey: 'accepted',
            action: 'create',
            value: { value: 'accepted' },
            strength: 1,
          },
          ['memory-1'],
        ),
      ]),
    );
    const projected = {
      schemaVersion: 'fixture-delta@1',
      value: {
        accepted: [
          ...(projectionInput.stateIntent?.value.accepted ?? []),
          ...projectionInput.memory.map(({ candidate: item }) => item.key),
        ],
      },
    };

    const preparedState = createStateEngine().prepare(
      module,
      null,
      0,
      projected,
      {
        entityId: 'entity-1',
        executionId: 'execution-1',
        operationKey: 'operation-1',
        now: '2026-07-30T08:00:00.000Z',
      },
    );

    expect(preparedState?.snapshot.value).toEqual({
      accepted: ['direct', 'accepted'],
    });
    expect(Object.isFrozen(preparedState?.snapshot.value)).toBe(true);
  });
});
