import { describe, expect, it } from 'vitest';

import {
  createMemoryEngine,
  type DomainMemoryPolicy,
  type IdGenerator,
  type MemoryCandidate,
  type ProvenanceRef,
} from '@acme/core';

import {
  decodeOrigin,
  encodeOrigin,
  readProvenance,
  weakestState,
  type Origin,
} from '../src/index.js';

const NAMESPACE = 'mixed';
const ENTITY_ID = 'entity-1';
const NOW = '2026-08-13T00:00:00.000Z';

const sourced: Origin = {
  state: 'sourced',
  artifactVersionId: 'artifact-7@v2',
  locator: 'lines:14-18',
};
const asserted: Origin = { state: 'asserted', principalRef: 'person:felix' };
const derived: Origin = {
  state: 'derived',
  method: 'monthly-mean',
  inputsDigest: 'a'.repeat(64),
};
const withheld: Origin = {
  state: 'withheld',
  reasonClass: 'source-protection',
};
const unknown: Origin = { state: 'unknown' };

const ALL: readonly Origin[] = [sourced, asserted, derived, withheld, unknown];

function ids(): IdGenerator {
  let n = 0;
  return { next: (kind) => `${kind}-${String((n += 1)).padStart(4, '0')}` };
}

function ref(
  origins: readonly Origin[],
  extraKeys: readonly string[] = [],
): ProvenanceRef {
  return {
    executionId: 'exec-1',
    contract: { id: 'mixed.observe', version: '1.0.0' },
    documentKeys: [...origins.map(encodeOrigin), ...extraKeys],
  };
}

/** Minimal policy: everything is a new record, identity is the candidate key. */
const policy: DomainMemoryPolicy = {
  validate: () => [],
  identity: (candidate) => candidate.key,
  retrieve: () => [],
  resolve: (candidate) => ({
    candidateKey: candidate.key,
    action: 'create',
    value: candidate.value,
    strength: 0.5,
  }),
  lifecycle: () => ({ action: 'retain' }),
};

function candidate(key: string, origins: readonly Origin[]): MemoryCandidate {
  return {
    key,
    kind: 'mixed.fact',
    schemaVersion: 'mixed/1',
    value: { note: key },
    source: ref(origins),
  };
}

function commitOnce(candidates: readonly MemoryCandidate[]) {
  const engine = createMemoryEngine({ ids: ids() });
  return engine.prepare(policy, candidates, [], {
    namespace: NAMESPACE,
    entityId: ENTITY_ID,
    executionId: 'exec-1',
    now: NOW,
  });
}

describe('every origin round-trips', () => {
  for (const origin of ALL) {
    it(`${origin.state}`, () => {
      expect(decodeOrigin(encodeOrigin(origin))).toEqual(origin);
    });
  }

  it('encodes the same origin to the same key every time', () => {
    expect(encodeOrigin(sourced)).toBe(encodeOrigin({ ...sourced }));
  });

  it('reports a key that carries no origin as unstructured, not unknown', () => {
    const reading = readProvenance(ref([], ['note:note-1', 'legacy-doc']));
    expect(reading.origins).toEqual([]);
    expect(reading.unstructuredKeys).toEqual(['note:note-1', 'legacy-doc']);
    // "No origin was expressed" is a different answer from "the origin is
    // unknown", and collapsing them is exactly the loss being fixed.
    expect(weakestState(reading)).toBeNull();
  });
});

describe('three unlike data shapes survive the engine', () => {
  it('keeps each fact distinguishable after prepare', () => {
    const prepared = commitOnce([
      // A personal preference nobody wrote down.
      candidate('preference', [asserted]),
      // An observation quoted out of a document, with an exact place in it.
      candidate('observation', [sourced]),
      // A number computed from ten thousand rows.
      candidate('aggregate', [derived]),
    ]);

    const states = prepared.mutations.map((mutation) =>
      weakestState(
        readProvenance(mutation.record.provenance[0] as ProvenanceRef),
      ),
    );

    expect(new Set(states)).toEqual(
      new Set(['asserted', 'sourced', 'derived']),
    );
  });

  it('reports the weakest origin when a fact rests on several', () => {
    // A claim quoted from a document but partly resting on a protected
    // source is not as well-founded as the quote alone.
    const reading = readProvenance(ref([sourced, withheld]));
    expect(weakestState(reading)).toBe('withheld');
  });
});

describe('attacks the encoding has to survive', () => {
  it('cannot be defeated by a reader that only counts document keys', () => {
    // The naive reading, and the reason the states are needed at all:
    // both facts have exactly one document key, so length tells you nothing.
    const assertedRef = ref([asserted]);
    const sourcedRef = ref([sourced]);
    expect(assertedRef.documentKeys).toHaveLength(1);
    expect(sourcedRef.documentKeys).toHaveLength(1);

    // Reading the state does separate them.
    expect(weakestState(readProvenance(assertedRef))).toBe('asserted');
    expect(weakestState(readProvenance(sourcedRef))).toBe('sourced');
  });

  it('distinguishes withheld from unknown from never-expressed', () => {
    expect(weakestState(readProvenance(ref([withheld])))).toBe('withheld');
    expect(weakestState(readProvenance(ref([unknown])))).toBe('unknown');
    expect(weakestState(readProvenance(ref([], ['note:1'])))).toBeNull();
  });

  it('does not let a withheld origin carry its source', () => {
    // Source protection is only protection if the record cannot be read back
    // into the identity it protects.
    const key = encodeOrigin({
      state: 'withheld',
      reasonClass: 'source-protection',
    });
    const decoded = JSON.stringify(decodeOrigin(key));
    expect(decoded).not.toContain('artifact');
    expect(decoded).not.toContain('locator');
    expect(decoded).not.toContain('principal');
    expect(Object.keys(decodeOrigin(key) ?? {})).toEqual([
      'reasonClass',
      'state',
    ]);
  });

  it('refuses a malformed or truncated origin key instead of guessing', () => {
    expect(decodeOrigin('acme-origin/1:not-base64!!')).toBeNull();
    expect(decodeOrigin('acme-origin/1:')).toBeNull();
    expect(
      decodeOrigin(
        `acme-origin/1:${Buffer.from('{"state":"sourced"}').toString('base64url')}`,
      ),
    ).toBeNull();
  });
});

describe('what this convention still cannot do', () => {
  it('does not stop anyone writing a bare document key', () => {
    // Nothing in the engine requires an origin. A module that never adopts
    // this convention produces provenance no reader can classify, and the
    // convention has no way to demand otherwise. Enforcing it would mean
    // changing ProvenanceRef in core.
    const prepared = commitOnce([
      {
        key: 'unclassified',
        kind: 'mixed.fact',
        schemaVersion: 'mixed/1',
        value: { note: 'unclassified' },
        source: {
          executionId: 'exec-1',
          contract: { id: 'mixed.observe', version: '1.0.0' },
          documentKeys: ['just-a-key'],
        },
      },
    ]);

    const stored = prepared.mutations[0]?.record.provenance[0] as ProvenanceRef;
    expect(weakestState(readProvenance(stored))).toBeNull();
  });
});
