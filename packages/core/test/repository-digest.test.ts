import { describe, expect, it } from 'vitest';

import {
  computeOperationDigest,
  type PreparedCommitContent,
} from '../src/index.js';

const fixture: PreparedCommitContent = {
  executionId: 'execution-1',
  expectedRevision: 4,
  documents: [
    {
      key: 'b',
      kind: 'fixture',
      schemaVersion: '1.0.0',
      value: { value: 2 },
      contentHash: 'hash-b',
    },
    {
      key: 'a',
      kind: 'fixture',
      schemaVersion: '1.0.0',
      value: { value: 1 },
      contentHash: 'hash-a',
    },
  ],
  memoryCandidates: [],
  memory: { decisions: [], mutations: [] },
  state: null,
  evaluatorRuns: [],
  events: [
    {
      key: 'b',
      type: 'fixture.b',
      schemaVersion: '1.0.0',
      payload: { value: 2 },
    },
    {
      key: 'a',
      type: 'fixture.a',
      schemaVersion: '1.0.0',
      payload: { value: 1 },
    },
  ],
  committedAt: '2026-07-29T12:00:00.000Z',
};

describe('acme-operation-digest-1', () => {
  it('matches its golden vector', () => {
    expect(computeOperationDigest(fixture)).toBe(
      'd231cefa260363216b85455388d07edb8b86d3aff6d4893a7c28a9e2ddd92f04',
    );
  });

  it('is stable across logically unordered collections', () => {
    expect(
      computeOperationDigest({
        ...fixture,
        documents: [...fixture.documents].reverse(),
        events: [...fixture.events].reverse(),
      }),
    ).toBe(computeOperationDigest(fixture));
  });

  it('changes when logical content changes', () => {
    expect(
      computeOperationDigest({
        ...fixture,
        expectedRevision: fixture.expectedRevision + 1,
      }),
    ).not.toBe(computeOperationDigest(fixture));
  });
});
