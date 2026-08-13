import { describe, expect, it } from 'vitest';

import {
  createMemoryEngine,
  type IdGenerator,
  type JsonValue,
  type MemoryCandidate,
  type MemoryRecord,
  type ProvenanceRef,
} from '@acme/core';
import { encodeOrigin } from '@acme/provenance-states';

import {
  believedPersonalClaims,
  derivePersonalAssertionKey,
  derivePersonalSlotKey,
  normalizePersonalText,
  personalMemoryPolicy,
  personalStanding,
  PERSONAL_MEMORY_SCHEMA_VERSION,
  PERSONAL_NAMESPACE,
  type PersonalAuthority,
} from '../src/index.js';

const ENTITY_ID = 'felix';
let tick = 0;
/** Each statement gets a later timestamp, so "afterwards" has a meaning. */
function nextInstant(): string {
  tick += 1;
  return `2026-08-13T00:${String(tick).padStart(2, '0')}:00.000Z`;
}

function ids(): IdGenerator {
  let n = 0;
  return { next: (kind) => `${kind}-${String((n += 1)).padStart(4, '0')}` };
}

const scenario = { ids: ids() };
function start(): readonly MemoryRecord[] {
  scenario.ids = ids();
  tick = 0;
  return [];
}

/**
 * A spoken statement has no document behind it, so its provenance is an
 * `asserted` origin rather than an invented document key. That is the whole
 * point of using the origin encoding here.
 */
function spokenSource(evidenceKey: string, who: string): ProvenanceRef {
  return {
    executionId: `exec-${evidenceKey}`,
    contract: { id: 'personal.observe', version: '1.0.0' },
    documentKeys: [encodeOrigin({ state: 'asserted', principalRef: who })],
  };
}

function claim(
  subject: string,
  attribute: string,
  value: string,
  evidenceKey: string,
  authority: PersonalAuthority,
): MemoryCandidate {
  const claimKind = 'personal.fact';
  const normalizedSubject = normalizePersonalText(subject);
  const normalizedAttribute = normalizePersonalText(attribute);
  const normalizedValue = normalizePersonalText(value);
  const slotKey = derivePersonalSlotKey(
    claimKind,
    normalizedSubject,
    normalizedAttribute,
  );
  return {
    key: `${evidenceKey}:${normalizedValue}`,
    kind: 'personal.claim',
    schemaVersion: PERSONAL_MEMORY_SCHEMA_VERSION,
    value: {
      kind: 'personal.claim',
      claimKind,
      slotKey,
      assertionKey: derivePersonalAssertionKey(slotKey, normalizedValue),
      subject,
      normalizedSubject,
      attribute,
      normalizedAttribute,
      value,
      normalizedValue,
      statedAt: nextInstant(),
      authority,
      evidenceKeys: [evidenceKey],
    } as unknown as JsonValue,
    source: spokenSource(
      evidenceKey,
      authority === 'human' ? 'person:felix' : 'model:assistant',
    ),
  };
}

const said = (s: string, a: string, v: string, e: string) =>
  claim(s, a, v, e, 'human');
const guessed = (s: string, a: string, v: string, e: string) =>
  claim(s, a, v, e, 'model');

function forget(
  subject: string,
  attribute: string,
  evidenceKey: string,
): MemoryCandidate {
  const slotKey = derivePersonalSlotKey(
    'personal.fact',
    normalizePersonalText(subject),
    normalizePersonalText(attribute),
  );
  return {
    key: `${evidenceKey}:forget`,
    kind: 'personal.revocation',
    schemaVersion: PERSONAL_MEMORY_SCHEMA_VERSION,
    value: {
      kind: 'personal.revocation',
      slotKey,
      revokedAt: nextInstant(),
      authority: 'human',
    } as unknown as JsonValue,
    source: spokenSource(evidenceKey, 'person:felix'),
  };
}

function run(
  records: readonly MemoryRecord[],
  candidates: readonly MemoryCandidate[],
): readonly MemoryRecord[] {
  const engine = createMemoryEngine({ ids: scenario.ids });
  const prepared = engine.prepare(personalMemoryPolicy, candidates, records, {
    namespace: PERSONAL_NAMESPACE,
    entityId: ENTITY_ID,
    executionId: candidates[0]?.source.executionId ?? 'exec-0',
    now: '2026-08-13T23:59:00.000Z',
  });
  const byId = new Map(records.map((record) => [record.memoryId, record]));
  for (const mutation of prepared.mutations) {
    byId.set(mutation.record.memoryId, mutation.record);
  }
  return [...byId.values()];
}

const believed = (records: readonly MemoryRecord[]) =>
  Object.fromEntries(believedPersonalClaims(records));

describe('what the slot experiment got right, preserved', () => {
  it('remembers something a person said', () => {
    const records = run(start(), [said('me', 'home city', 'Malmö', 'e1')]);
    expect(believed(records)).toEqual({ 'me home city': ['Malmö'] });
  });

  it('treats the same thing twice as one memory', () => {
    let records = run(start(), [said('me', 'home city', 'Malmö', 'e1')]);
    records = run(records, [said('Me', '  Home  City ', 'Malmö', 'e2')]);
    expect(records).toHaveLength(1);
  });

  it('forgets without recording what was forgotten', () => {
    let records = run(start(), [said('me', 'home city', 'Malmö', 'e1')]);
    records = run(records, [forget('me', 'home city', 'e2')]);

    expect(believed(records)).toEqual({});
    const revocation = records.find(
      (r) => (r.value as { kind?: string }).kind === 'personal.revocation',
    );
    const serialized = JSON.stringify(revocation?.value);
    expect(serialized).not.toContain('Malmö');
    expect(serialized).not.toContain('home city');
  });
});

describe('what the autonomy experiment got right, preserved', () => {
  it('does not believe a model on one source', () => {
    const records = run(start(), [
      guessed('me', 'coffee', 'oat milk', 'chat-1'),
    ]);
    expect(believed(records)).toEqual({});
    // Recorded, not discarded.
    expect(personalStanding(records)[0]?.withheldFromBelief).toHaveLength(1);
  });

  it('believes it once a second independent source agrees', () => {
    let records = run(start(), [guessed('me', 'coffee', 'oat milk', 'chat-1')]);
    records = run(records, [guessed('me', 'coffee', 'oat milk', 'chat-2')]);
    expect(believed(records)).toEqual({ 'me coffee': ['oat milk'] });
  });

  it('refuses to let a model corroborate itself by repeating one source', () => {
    let records = run(start(), [guessed('me', 'coffee', 'oat milk', 'chat-1')]);
    records = run(records, [guessed('me', 'coffee', 'oat milk', 'chat-1')]);
    records = run(records, [guessed('me', 'coffee', 'oat milk', 'chat-1')]);
    expect(believed(records)).toEqual({});
  });

  it('believes a person immediately and seals the slot against models', () => {
    let records = run(start(), [said('me', 'coffee', 'whole milk', 'e1')]);
    expect(believed(records)).toEqual({ 'me coffee': ['whole milk'] });

    records = run(records, [guessed('me', 'coffee', 'oat milk', 'chat-1')]);
    records = run(records, [guessed('me', 'coffee', 'oat milk', 'chat-2')]);

    expect(believed(records)).toEqual({ 'me coffee': ['whole milk'] });
    expect(personalStanding(records)[0]?.sealedByHuman).toBe(true);
  });

  it('does not let a model resurrect what a person revoked', () => {
    let records = run(start(), [said('me', 'coffee', 'oat milk', 'e1')]);
    records = run(records, [forget('me', 'coffee', 'e2')]);
    records = run(records, [guessed('me', 'coffee', 'oat milk', 'chat-1')]);
    records = run(records, [guessed('me', 'coffee', 'oat milk', 'chat-2')]);
    expect(believed(records)).toEqual({});
  });
});

describe('what neither could do alone', () => {
  it('lets two answers from a person coexist instead of losing one', () => {
    // The slot policy discarded the second answer, because the engine's
    // write-time `contest` has nowhere to put it. Writing both and deciding
    // at read time expresses what actually happened: a person said two things.
    let records = run(start(), [said('me', 'home city', 'Malmö', 'e1')]);
    records = run(records, [said('me', 'home city', 'Göteborg', 'e2')]);

    expect(believed(records)).toEqual({
      'me home city': ['Göteborg', 'Malmö'],
    });
    const slot = personalStanding(records)[0];
    expect(slot?.contested).toBe(true);
    expect(slot?.standing).toHaveLength(2);
  });

  it('still lets a person settle it by forgetting the slot', () => {
    let records = run(start(), [said('me', 'home city', 'Malmö', 'e1')]);
    records = run(records, [said('me', 'home city', 'Göteborg', 'e2')]);
    records = run(records, [forget('me', 'home city', 'e3')]);
    expect(believed(records)).toEqual({});
  });

  it('cannot let a PERSON restate the same words after forgetting — a limitation', () => {
    // The other half of the rule above, and it is not what anyone wants.
    //
    // The engine builds its identity map over every record regardless of
    // status, and `merge` never restores a status, so a superseded identity is
    // permanently spent. "Forget my home city" followed by "actually, it is
    // Malmö after all" cannot be recorded — in those exact words. Saying it
    // differently produces a different assertion key and works fine, which
    // makes the limitation arbitrary rather than principled.
    //
    // Recorded here so the behaviour is visible, not so it is accepted.
    let records = run(start(), [said('me', 'home city', 'Malmö', 'e1')]);
    records = run(records, [forget('me', 'home city', 'e2')]);
    records = run(records, [said('me', 'home city', 'Malmö', 'e3')]);
    expect(believed(records)).toEqual({});

    // The same fact in different words is recordable, which is the proof that
    // the obstacle is identity reuse and not the revocation itself.
    records = run(records, [said('me', 'home city', 'Malmoe', 'e4')]);
    expect(believed(records)).toEqual({ 'me home city': ['Malmoe'] });
  });

  it('records a spoken fact as asserted, not as sourced from a document', () => {
    const records = run(start(), [said('me', 'home city', 'Malmö', 'e1')]);
    // The reason the two earlier experiments both had to invent a document
    // key. Here the origin says what it actually is.
    expect(personalStanding(records)[0]?.standing[0]?.originState).toBe(
      'asserted',
    );
  });
});
