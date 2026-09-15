import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
  EVIDENCE_V2_COMPARE_MAX_CURRENT,
  EVIDENCE_V2_COMPARE_MAX_PRIOR,
  EVIDENCE_V2_COMPARE_OUTPUT_SCHEMA_NAME,
  EvidenceV2CompareOutputSchema,
  deriveEvidenceV2CompareRequestKey,
  evidenceV2CompareContract,
  evidenceV2CompareModule,
  planEvidenceV2CompareWindows,
  type EvidenceV2CompareInput,
  type EvidenceV2CompareOccurrence,
  type EvidenceV2CompareOutput,
} from '../src/index.js';

function occurrence(
  id: string,
  instanceKey: string,
  instanceOrdinal: number,
  quote: string,
): EvidenceV2CompareOccurrence {
  return {
    occurrenceId: id,
    instanceKey,
    instanceOrdinal,
    partId: 'part-000001',
    startLine: 10,
    endLine: 10,
    exactQuote: quote,
  };
}

const WINDOW: EvidenceV2CompareInput = {
  schemaVersion: 'evidence-v2-compare-input/1',
  artifactId: 'artifact-1',
  chainId: 'chain-1',
  windowId: 'compare-window-1',
  currentInstanceKey: 'instance-2',
  priorInstanceKey: 'instance-1',
  current: [
    occurrence('occ-c1', 'instance-2', 2, 'Han säger att bilen var grön.'),
  ],
  prior: [
    occurrence('occ-p1', 'instance-1', 1, 'Han beskriver bilen som blå.'),
  ],
};

const COMPARABLE = {
  actor: 'comparable' as const,
  time: 'comparable' as const,
  location: 'unknown' as const,
  entity: 'comparable' as const,
};

describe('evidence v2 compare windows', () => {
  it('plans nothing when either side is empty', () => {
    expect(
      planEvidenceV2CompareWindows({
        currentInstanceKey: 'instance-2',
        current: [],
        priors: [
          {
            instanceKey: 'instance-1',
            instanceOrdinal: 1,
            occurrences: [occurrence('occ-p1', 'instance-1', 1, 'prior')],
          },
        ],
      }),
    ).toEqual([]);
    expect(
      planEvidenceV2CompareWindows({
        currentInstanceKey: 'instance-2',
        current: [occurrence('occ-c1', 'instance-2', 2, 'current')],
        priors: [
          {
            instanceKey: 'instance-1',
            instanceOrdinal: 1,
            occurrences: [],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('visits prior instances in ordinal order and is deterministic', () => {
    const current = [occurrence('occ-c1', 'instance-3', 3, 'current')];
    const priors = [
      {
        instanceKey: 'instance-2',
        instanceOrdinal: 2,
        occurrences: [occurrence('occ-p2', 'instance-2', 2, 'second')],
      },
      {
        instanceKey: 'instance-1',
        instanceOrdinal: 1,
        occurrences: [occurrence('occ-p1', 'instance-1', 1, 'first')],
      },
    ];
    const first = planEvidenceV2CompareWindows({
      currentInstanceKey: 'instance-3',
      current,
      priors,
    });
    const second = planEvidenceV2CompareWindows({
      currentInstanceKey: 'instance-3',
      current,
      priors: [...priors].reverse(),
    });
    expect(first.map((item) => item.priorInstanceKey)).toEqual([
      'instance-1',
      'instance-2',
    ]);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('batches each side rather than emitting one unbounded window', () => {
    const current = Array.from(
      { length: EVIDENCE_V2_COMPARE_MAX_CURRENT + 1 },
      (_, i) =>
        occurrence(
          `c-${String(i).padStart(3, '0')}`,
          'instance-2',
          2,
          `current ${String(i)}`,
        ),
    );
    const prior = Array.from(
      { length: EVIDENCE_V2_COMPARE_MAX_PRIOR + 1 },
      (_, i) =>
        occurrence(
          `p-${String(i).padStart(3, '0')}`,
          'instance-1',
          1,
          `prior ${String(i)}`,
        ),
    );
    const windows = planEvidenceV2CompareWindows({
      currentInstanceKey: 'instance-2',
      current,
      priors: [
        {
          instanceKey: 'instance-1',
          instanceOrdinal: 1,
          occurrences: prior,
        },
      ],
    });
    expect(windows.length).toBeGreaterThan(1);
    for (const window of windows) {
      expect(window.current.length).toBeLessThanOrEqual(
        EVIDENCE_V2_COMPARE_MAX_CURRENT,
      );
      expect(window.prior.length).toBeLessThanOrEqual(
        EVIDENCE_V2_COMPARE_MAX_PRIOR,
      );
    }
    const currentIds = new Set(
      windows.flatMap((item) => item.current.map((occ) => occ.occurrenceId)),
    );
    const priorIds = new Set(
      windows.flatMap((item) => item.prior.map((occ) => occ.occurrenceId)),
    );
    expect(currentIds.size).toBe(current.length);
    expect(priorIds.size).toBe(prior.length);
  });

  it('derives a stable request key from the window, not the clock', () => {
    const first = deriveEvidenceV2CompareRequestKey({
      artifactId: 'artifact-1',
      windowId: 'compare-window-1',
      contractVersion: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
    });
    const second = deriveEvidenceV2CompareRequestKey({
      artifactId: 'artifact-1',
      windowId: 'compare-window-1',
      contractVersion: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
    });
    expect(first).toBe(second);
    expect(first.startsWith('evidence-v2-compare:')).toBe(true);
  });
});

describe('evidence v2 compare contract', () => {
  it('pins its identity and does not share observe', () => {
    expect(evidenceV2CompareContract.ref).toEqual({
      id: 'evidence.v2.compare-window',
      version: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
    });
    expect(evidenceV2CompareContract.retention).toBe('encrypted-payload');
    expect(evidenceV2CompareModule.namespace).toBe('evidence-v2-compare');
    expect(evidenceV2CompareModule.namespace).not.toBe('evidence-v2');
  });

  it('shows both sides and asks for ids, not text', () => {
    const request = evidenceV2CompareContract.buildRequest(WINDOW, {
      executionId: 'execution-1',
      now: '2026-08-18T00:00:00.000Z',
    });
    const prompt = request.messages
      .flatMap((message) => message.content)
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('\n');
    expect(prompt).toContain('occ-c1');
    expect(prompt).toContain('occ-p1');
    expect(prompt).toContain('Han säger att bilen var grön.');
    expect(prompt).toContain('Cite occurrence ids only');
    expect(request.output.schemaName).toBe(
      EVIDENCE_V2_COMPARE_OUTPUT_SCHEMA_NAME,
    );
    expect(request.output.schemaName).toMatch(/^[a-zA-Z0-9_-]+$/u);
    expect(request.temperature).toBeUndefined();
  });

  it('accepts an empty answer, because silence is not a contradiction', () => {
    const output: EvidenceV2CompareOutput = {
      schemaVersion: 'evidence-v2-compare-output/1',
      relations: [],
    };
    expect(EvidenceV2CompareOutputSchema.parse(output)).toEqual(output);
    expect(evidenceV2CompareContract.validateSemantics(output, WINDOW)).toEqual(
      [],
    );
  });

  it('refuses a from id that is not in CURRENT', () => {
    const output: EvidenceV2CompareOutput = {
      schemaVersion: 'evidence-v2-compare-output/1',
      relations: [
        {
          fromOccurrenceId: 'occ-p1',
          toOccurrenceId: 'occ-p1',
          type: 'supports',
          comparableScope: COMPARABLE,
          rationale: 'Same words.',
        },
      ],
    };
    const issues = evidenceV2CompareContract.validateSemantics(output, WINDOW);
    expect(issues.map((item) => item.code)).toContain(
      'EVIDENCE_V2_COMPARE_FROM_OUTSIDE_CURRENT',
    );
  });

  it('refuses a to id that is not in PRIOR', () => {
    const output: EvidenceV2CompareOutput = {
      schemaVersion: 'evidence-v2-compare-output/1',
      relations: [
        {
          fromOccurrenceId: 'occ-c1',
          toOccurrenceId: 'occ-c1',
          type: 'supports',
          comparableScope: COMPARABLE,
          rationale: 'Same words.',
        },
      ],
    };
    const issues = evidenceV2CompareContract.validateSemantics(output, WINDOW);
    expect(issues.map((item) => item.code)).toContain(
      'EVIDENCE_V2_COMPARE_TO_OUTSIDE_PRIOR',
    );
  });

  it('refuses a contradiction whose actor is not comparable', () => {
    const output: EvidenceV2CompareOutput = {
      schemaVersion: 'evidence-v2-compare-output/1',
      relations: [
        {
          fromOccurrenceId: 'occ-c1',
          toOccurrenceId: 'occ-p1',
          type: 'contradicts',
          comparableScope: { ...COMPARABLE, actor: 'incomparable' },
          rationale: 'Different colour.',
        },
      ],
    };
    const issues = evidenceV2CompareContract.validateSemantics(output, WINDOW);
    expect(issues.map((item) => item.code)).toContain(
      'EVIDENCE_V2_CONTRADICTION_ACTOR_NOT_COMPARABLE',
    );
  });

  it('accepts a scoped contradiction and a qualifies when scopes differ', () => {
    const output: EvidenceV2CompareOutput = {
      schemaVersion: 'evidence-v2-compare-output/1',
      relations: [
        {
          fromOccurrenceId: 'occ-c1',
          toOccurrenceId: 'occ-p1',
          type: 'contradicts',
          comparableScope: COMPARABLE,
          rationale: 'Green versus blue, same actor, same evening.',
        },
      ],
    };
    expect(evidenceV2CompareContract.validateSemantics(output, WINDOW)).toEqual(
      [],
    );
  });

  it('refuses the same typed pair twice', () => {
    const one = {
      fromOccurrenceId: 'occ-c1',
      toOccurrenceId: 'occ-p1',
      type: 'adds' as const,
      comparableScope: COMPARABLE,
      rationale: 'New detail.',
    };
    const output: EvidenceV2CompareOutput = {
      schemaVersion: 'evidence-v2-compare-output/1',
      relations: [one, one],
    };
    const issues = evidenceV2CompareContract.validateSemantics(output, WINDOW);
    expect(issues.map((item) => item.code)).toContain(
      'EVIDENCE_V2_COMPARE_PAIR_CITED_TWICE',
    );
  });
});
