import { describe, expect, it } from 'vitest';

import type {
  AcmeErrorCode,
  ExecutionResult,
  JsonValue,
} from '../../packages/core/src/index.js';

import type {
  AcmeAdapterResult,
  AdapterJsonValue,
} from './aal-acme-adapter-2.js';
import {
  SEAM_GAP_INVENTORY,
  SEAM_REQUEST_GAP_FLOOR,
  type SeamGapCode,
  type SeamGapKind,
} from './seam-gaps.js';
import { inventoryRequestGaps } from './seam-translation.js';
import { neutralSelection, seamRequest } from './seam-fixtures.js';

type Extends<TLeft, TRight> = [TLeft] extends [TRight] ? true : false;

const NEVER_ACKNOWLEDGEABLE: readonly SeamGapKind[] = [
  'engine-requires-seam-absent',
  'seam-contradicts-engine',
  'absent-on-both-sides',
];

describe('seam gap inventory', () => {
  it('is complete, unique, and internally consistent', () => {
    expect(SEAM_GAP_INVENTORY).toHaveLength(21);
    const codes = SEAM_GAP_INVENTORY.map((gap) => gap.code);
    expect(new Set(codes).size).toBe(codes.length);

    for (const gap of SEAM_GAP_INVENTORY) {
      expect(gap.summary.length).toBeGreaterThan(0);
      expect(gap.consequence.length).toBeGreaterThan(0);
      expect(gap.acknowledgeable).toBe(
        !NEVER_ACKNOWLEDGEABLE.includes(gap.kind),
      );
      expect(Object.isFrozen(gap)).toBe(true);
    }
  });

  it('names exactly one gap that neither side has any shape for', () => {
    const bothNull = SEAM_GAP_INVENTORY.filter(
      (gap) => gap.seamPath === null && gap.enginePath === null,
    ).map((gap) => gap.code);
    expect(bothNull).toEqual(['SEAM_PRINCIPAL_ABSENT_ON_BOTH_SIDES']);
  });

  it('splits the inventory across all seven gap kinds', () => {
    const byKind = new Map<SeamGapKind, SeamGapCode[]>();
    for (const gap of SEAM_GAP_INVENTORY) {
      byKind.set(gap.kind, [...(byKind.get(gap.kind) ?? []), gap.code]);
    }
    expect([...byKind.keys()].sort()).toEqual([
      'absent-on-both-sides',
      'engine-defaults-seam-cannot-express',
      'engine-requires-seam-absent',
      'engine-returns-seam-drops',
      'seam-carries-engine-drops',
      'seam-contradicts-engine',
      'seam-requires-engine-never-produces',
    ]);
  });

  it('proves no aal-acme-adapter/2 request translates without loss', () => {
    // Best case: both entity ids agree, no source artifacts, and the caller
    // supplies every value the engine requires. Six losses remain, and there
    // is nothing a caller can pass to remove any of them.
    const best = inventoryRequestGaps(
      seamRequest({ expectedEngineRevision: 0 }),
      {
        model: neutralSelection,
        policy: { retention: 'hash-only' },
      },
    );
    expect(best.map((gap) => gap.code)).toEqual(SEAM_REQUEST_GAP_FLOOR);
    expect(best.every((gap) => gap.acknowledgeable)).toBe(true);
  });
});

describe('shapes that already line up', () => {
  it('carries JSON both ways without conversion', () => {
    // If either direction stops holding, this file stops compiling and the
    // typecheck gate fails.
    const bothWays: [
      Extends<AdapterJsonValue, JsonValue>,
      Extends<JsonValue, AdapterJsonValue>,
    ] = [true, true];
    expect(bothWays).toEqual([true, true]);
  });

  it('widens every engine error code into the seam string code', () => {
    const widens: Extends<AcmeErrorCode, string> = true;
    expect(widens).toBe(true);
  });

  it('maps every terminal engine status onto a seam status', () => {
    const terminal: Extends<
      ExecutionResult['status'],
      Exclude<AcmeAdapterResult['status'], 'unavailable'>
    > = true;
    expect(terminal).toBe(true);
  });

  it("has no engine origin for the seam's unavailable status", () => {
    const engineProducesUnavailable: Extends<
      ExecutionResult['status'],
      'unavailable'
    > = false;
    expect(engineProducesUnavailable).toBe(false);
  });
});
