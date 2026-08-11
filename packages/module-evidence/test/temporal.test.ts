import { describe, expect, it } from 'vitest';

import {
  buildEvidenceTimelineEntries,
  evidenceTemporalOverlap,
  type EvidenceTemporalBound,
} from '../src/index.js';

const base = {
  schemaVersion: 'evidence-temporal-bound/1' as const,
  role: 'claimed-event-time' as const,
  artifactVersionId:
    'evidence_artifact_6d28c72d67b3be603fc266f25216bf4a4e4c4d058a6e4877724c4116dd10f913',
  locatorId:
    'evidence_locator_30cf44f91b4f68dd94eed3edf22b97ab762f1494820b495bf709732902423284',
};

function exact(at: string): EvidenceTemporalBound {
  return { ...base, kind: 'exact', at };
}
function range(from: string, to: string): EvidenceTemporalBound {
  return { ...base, kind: 'range', from, to };
}
function approximate(
  center: string,
  toleranceMinutes: number,
): EvidenceTemporalBound {
  return { ...base, kind: 'approximate', center, toleranceMinutes };
}
function unknown(reason: string): EvidenceTemporalBound {
  return { ...base, kind: 'unknown', reason };
}

describe('evidence temporal helpers', () => {
  it('never overlaps unknown bounds and treats exact as a closed singleton', () => {
    expect(
      evidenceTemporalOverlap(
        exact('2026-04-18T09:16:00Z'),
        exact('2026-04-18T09:16:00Z'),
      ),
    ).toBe(true);
    expect(
      evidenceTemporalOverlap(
        exact('2026-04-18T09:16:00Z'),
        range('2026-04-18T09:10:00Z', '2026-04-18T09:20:00Z'),
      ),
    ).toBe(true);
    expect(
      evidenceTemporalOverlap(
        unknown('no clock'),
        exact('2026-04-18T09:16:00Z'),
      ),
    ).toBe(false);
  });

  it('orders exact before non-overlapping range/approx before unknown and is permutation-stable', () => {
    const inputs = [
      {
        observationId: 'obs-unknown',
        temporalBound: unknown('unplaced'),
      },
      {
        observationId: 'obs-range',
        temporalBound: range('2026-04-18T10:00:00Z', '2026-04-18T10:10:00Z'),
      },
      {
        observationId: 'obs-exact',
        temporalBound: exact('2026-04-18T09:16:00Z'),
      },
      {
        observationId: 'obs-approx',
        temporalBound: approximate('2026-04-18T11:00:00Z', 5),
      },
    ];
    const forward = buildEvidenceTimelineEntries(inputs);
    const reverse = buildEvidenceTimelineEntries([...inputs].reverse());
    expect(
      forward.map(({ bandKind, observationIds }) => [
        bandKind,
        ...observationIds,
      ]),
    ).toEqual([
      ['exact', 'obs-exact'],
      ['range', 'obs-range'],
      ['approximate', 'obs-approx'],
      ['unknown', 'obs-unknown'],
    ]);
    expect(reverse.map(({ entryId }) => entryId)).toEqual(
      forward.map(({ entryId }) => entryId),
    );
  });

  it('forms an ambiguity band for overlapping non-exact bounds', () => {
    const entries = buildEvidenceTimelineEntries([
      {
        observationId: 'obs-a',
        temporalBound: range('2026-04-18T09:10:00Z', '2026-04-18T09:20:00Z'),
      },
      {
        observationId: 'obs-b',
        temporalBound: approximate('2026-04-18T09:15:00Z', 10),
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.bandKind).toBe('ambiguity');
    expect(entries[0]?.observationIds).toEqual(['obs-a', 'obs-b']);
  });
});
