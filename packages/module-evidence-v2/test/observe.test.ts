import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
  EVIDENCE_V2_WINDOW_MAX_UNITS,
  EvidenceV2ObserveOutputSchema,
  deriveEvidenceV2OccurrenceId,
  deriveEvidenceV2WindowRequestKey,
  evidenceV2Module,
  evidenceV2ObserveContract,
  planEvidenceV2ObserveWindows,
  type EvidenceV2ObserveInput,
  type EvidenceV2ObserveOutput,
  type EvidenceV2State,
  type EvidenceV2WindowUnit,
} from '../src/index.js';

function unit(index: number, quote: string): EvidenceV2WindowUnit {
  return {
    unitId: `part-000001-unit-${String(index).padStart(4, '0')}`,
    startLine: index,
    endLine: index,
    exactQuote: quote,
  };
}

const WINDOW: EvidenceV2ObserveInput = {
  schemaVersion: 'evidence-v2-observe-input/1',
  artifactId: 'artifact-1',
  partId: 'part-000001',
  windowId: 'part-000001-window-0001',
  units: [
    unit(1, 'Hussein berättar att han var 16 år vid bråket i byn Tofata.'),
    unit(2, 'Bråket inträffade i maj 1979, antingen den 7 eller den 11 maj.'),
  ],
};

describe('evidence v2 observe contract', () => {
  it('pins its identity', () => {
    expect(evidenceV2ObserveContract.ref).toEqual({
      id: 'evidence.v2.observe-window',
      version: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
    });
    expect(evidenceV2ObserveContract.retention).toBe('encrypted-payload');
  });

  it('shows the model the units and asks for ids, not text', () => {
    const request = evidenceV2ObserveContract.buildRequest(WINDOW, {
      executionId: 'execution-1',
      now: '2026-08-16T00:00:00.000Z',
    });
    const prompt = request.messages
      .flatMap((message) => message.content)
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('\n');

    expect(prompt).toContain(WINDOW.units[0]?.exactQuote ?? '');
    expect(prompt).toContain(WINDOW.units[0]?.unitId ?? '');
    expect(prompt).toContain('return unit ids only');
    expect(request.output.schemaName).toBe('evidence-v2-observe-output/1');
    expect(request.temperature).toBe(0);
  });

  it('accepts an empty answer, because a window may state nothing', () => {
    const output: EvidenceV2ObserveOutput = {
      schemaVersion: 'evidence-v2-observe-output/1',
      observations: [],
    };
    expect(EvidenceV2ObserveOutputSchema.parse(output)).toEqual(output);
    expect(evidenceV2ObserveContract.validateSemantics(output, WINDOW)).toEqual(
      [],
    );
  });

  it('never asks the model to enumerate the units it skipped', () => {
    // The frozen contract required one coverage entry per supplied segment and
    // died when the model missed one of 64. The output schema has no coverage
    // field at all (ADR-0048 §3).
    const shape = Object.keys(
      EvidenceV2ObserveOutputSchema.shape as Record<string, unknown>,
    );
    expect(shape.sort()).toEqual(['observations', 'schemaVersion']);
  });

  it('refuses a unit outside the window', () => {
    const issues = evidenceV2ObserveContract.validateSemantics(
      {
        schemaVersion: 'evidence-v2-observe-output/1',
        observations: [
          {
            sourceUnitId: 'part-000009-unit-0001',
            kind: 'statement-occurrence',
            actorReference: null,
            temporalBound: null,
          },
        ],
      },
      WINDOW,
    );
    expect(issues.map((issue) => issue.code)).toEqual([
      'EVIDENCE_V2_UNIT_OUTSIDE_WINDOW',
    ]);
  });

  it('refuses the same unit twice', () => {
    const observation = {
      sourceUnitId: WINDOW.units[0]?.unitId ?? '',
      kind: 'statement-occurrence' as const,
      actorReference: null,
      temporalBound: null,
    };
    const issues = evidenceV2ObserveContract.validateSemantics(
      {
        schemaVersion: 'evidence-v2-observe-output/1',
        observations: [observation, observation],
      },
      WINDOW,
    );
    expect(issues.map((issue) => issue.code)).toEqual([
      'EVIDENCE_V2_UNIT_CITED_TWICE',
    ]);
  });

  it('refuses an untyped temporal bound in both directions', () => {
    const build = (
      bound: EvidenceV2ObserveOutput['observations'][number]['temporalBound'],
    ) =>
      evidenceV2ObserveContract
        .validateSemantics(
          {
            schemaVersion: 'evidence-v2-observe-output/1',
            observations: [
              {
                sourceUnitId: WINDOW.units[0]?.unitId ?? '',
                kind: 'statement-occurrence',
                actorReference: null,
                temporalBound: bound,
              },
            ],
          },
          WINDOW,
        )
        .map((issue) => issue.code);

    expect(
      build({ kind: 'unknown', from: '1979-05-07', to: null, zone: null }),
    ).toEqual(['EVIDENCE_V2_TEMPORAL_BOUND_UNTYPED']);
    expect(build({ kind: 'exact', from: null, to: null, zone: null })).toEqual([
      'EVIDENCE_V2_TEMPORAL_BOUND_UNTYPED',
    ]);
    expect(
      build({
        kind: 'range',
        from: '1979-05-07',
        to: '1979-05-11',
        zone: null,
      }),
    ).toEqual([]);
  });

  it('restates only the refusals in a repair, never new material', () => {
    const repair = evidenceV2ObserveContract.buildRepairRequest?.(WINDOW, {
      executionId: 'execution-1',
      now: '2026-08-16T00:00:00.000Z',
      attempt: 1,
      issues: [
        {
          code: 'EVIDENCE_V2_UNIT_CITED_TWICE',
          path: [],
          message: 'A unit may carry at most one observation per window.',
          severity: 'error',
        },
      ],
    });
    const prompt = (repair?.messages ?? [])
      .flatMap((message) => message.content)
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('\n');

    expect(prompt).toContain('EVIDENCE_V2_UNIT_CITED_TWICE');
    expect(prompt).toContain(WINDOW.units[0]?.unitId ?? '');
  });
});

describe('evidence v2 observe windows', () => {
  it('bounds a window at the unit ceiling', () => {
    const units = Array.from({ length: 60 }, (_, index) =>
      unit(index + 1, `Rad ${String(index)}.`),
    );
    const windows = planEvidenceV2ObserveWindows([
      { partId: 'part-000001', units },
    ]);

    expect(windows.length).toBeGreaterThan(1);
    for (const window of windows) {
      expect(window.units.length).toBeLessThanOrEqual(
        EVIDENCE_V2_WINDOW_MAX_UNITS,
      );
    }
    expect(windows.flatMap((window) => window.units)).toHaveLength(60);
  });

  it('bounds a window by quoted words even when units are few', () => {
    const long = Array.from({ length: 6 }, (_, index) =>
      unit(index + 1, 'ord '.repeat(300)),
    );
    const windows = planEvidenceV2ObserveWindows([
      { partId: 'part-000001', units: long },
    ]);

    expect(windows.length).toBeGreaterThan(1);
  });

  it('covers every unit exactly once, in order', () => {
    const units = Array.from({ length: 30 }, (_, index) =>
      unit(index + 1, `Rad ${String(index)}.`),
    );
    const windows = planEvidenceV2ObserveWindows([
      { partId: 'part-000001', units },
    ]);
    const seen = windows.flatMap((window) =>
      window.units.map((item) => item.unitId),
    );

    expect(seen).toEqual(units.map((item) => item.unitId));
    expect(new Set(seen).size).toBe(units.length);
  });

  it('plans nothing for a part with no units', () => {
    expect(
      planEvidenceV2ObserveWindows([{ partId: 'part-000001', units: [] }]),
    ).toEqual([]);
  });

  it('derives a stable request key so a resume addresses the same execution', () => {
    const key = {
      artifactId: 'artifact-1',
      windowId: 'part-000001-window-0001',
      contractVersion: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
    };
    expect(deriveEvidenceV2WindowRequestKey(key)).toBe(
      deriveEvidenceV2WindowRequestKey(key),
    );
    expect(
      deriveEvidenceV2WindowRequestKey({
        ...key,
        windowId: 'part-000001-window-0002',
      }),
    ).not.toBe(deriveEvidenceV2WindowRequestKey(key));
  });
});

describe('evidence v2 module', () => {
  const initial = evidenceV2Module.initialState({
    entityId: 'instance-1',
    now: '2026-08-16T00:00:00.000Z',
  });

  it('builds an occurrence from the unit, not from the response', () => {
    const result = evidenceV2Module.tasks['observe-window'].interpret(
      {
        schemaVersion: 'evidence-v2-observe-output/1',
        observations: [
          {
            sourceUnitId: WINDOW.units[0]?.unitId ?? '',
            kind: 'statement-occurrence',
            actorReference: null,
            temporalBound: null,
          },
        ],
      },
      {
        schemaVersion: 'evidence-v2-observe-task/1',
        caseId: 'case-1',
        chainId: 'chain-1',
        instanceKey: 'instance-1',
        window: WINDOW,
      },
      {
        executionId: 'execution-1',
        now: '2026-08-16T00:00:00.000Z',
        state: initial,
      } as never,
    );

    if (result instanceof Promise) throw new Error('expected a sync result');
    const occurrence = result.memories[0]?.value as {
      readonly exactQuote: string;
      readonly startLine: number;
      readonly occurrenceId: string;
      readonly executionId: string;
    };
    expect(occurrence.exactQuote).toBe(WINDOW.units[0]?.exactQuote);
    expect(occurrence.startLine).toBe(WINDOW.units[0]?.startLine);
    expect(occurrence.executionId).toBe('execution-1');
    expect(occurrence.occurrenceId).toBe(
      deriveEvidenceV2OccurrenceId({
        artifactId: WINDOW.artifactId,
        unitId: WINDOW.units[0]?.unitId ?? '',
        contractVersion: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
      }),
    );
  });

  it('records a committed window and advances one revision', () => {
    const next = evidenceV2Module.reduce(initial, {
      schemaVersion: 'evidence-v2-delta/1',
      windowId: WINDOW.windowId,
      addOccurrenceIds: ['occurrence-a'],
      nextRevision: 1,
    });

    expect(next.committedWindowIds).toEqual([WINDOW.windowId]);
    expect(next.occurrenceIds).toEqual(['occurrence-a']);
    expect(evidenceV2Module.invariants(next, initial)).toEqual([]);
  });

  it('refuses a revision jump and a removed occurrence', () => {
    const first = evidenceV2Module.reduce(initial, {
      schemaVersion: 'evidence-v2-delta/1',
      windowId: WINDOW.windowId,
      addOccurrenceIds: ['occurrence-a'],
      nextRevision: 1,
    });

    const jumped: EvidenceV2State = { ...first, revision: 5 };
    expect(
      evidenceV2Module.invariants(jumped, first).map((i) => i.code),
    ).toContain('EVIDENCE_V2_REVISION_STEP');

    const stripped: EvidenceV2State = {
      ...first,
      revision: 2,
      occurrenceIds: [],
    };
    expect(
      evidenceV2Module.invariants(stripped, first).map((i) => i.code),
    ).toContain('EVIDENCE_V2_OCCURRENCE_REMOVED');
  });

  it('ignores an occurrence it has already seen', () => {
    const candidate = {
      key: 'occurrence-a',
      kind: 'evidence-v2-occurrence',
      schemaVersion: 'evidence-v2-occurrence/1',
      value: {},
      source: {
        executionId: 'execution-1',
        contract: { id: 'evidence.v2.observe-window', version: '1.0.0' },
        documentKeys: [],
      },
    };
    const resolution = evidenceV2Module.memoryPolicy.resolve(
      candidate,
      [{ identityKey: 'occurrence-a' }] as never,
      { now: '2026-08-16T00:00:00.000Z' },
    );
    expect(resolution.action).toBe('ignore');
  });
});
