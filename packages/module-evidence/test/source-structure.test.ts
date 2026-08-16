import { describe, expect, it } from 'vitest';

import { buildEvidenceSourceSegments } from '../src/canonical-text.js';
import {
  EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS,
  EVIDENCE_SOURCE_STRUCTURE_SOFT_MAX_WORDS,
  EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_WORDS,
  deriveEvidenceSourceStructure,
  planEvidenceStructuralObservationCoverage,
} from '../src/index.js';

function words(count: number, seed: string): string {
  return Array.from(
    { length: count },
    (_, index) => `${seed}${String(index + 1)}.`,
  ).join(' ');
}

const INTERVIEW = [
  'Interview of Nera Sol — Rillford Annex',
  '',
  'Interviewer: Where were you on Tuesday evening?',
  'Nera Sol: I stayed inside the greenhouse.',
  'I checked the hatch twice.',
  'The indicator stayed amber the whole time.',
  '',
  'Interviewer: What colour was the car you saw?',
  'Nera Sol: I do not know the colour.',
].join('\n');

describe('deriveEvidenceSourceStructure', () => {
  it('groups a synthetic interview into Q+A blocks instead of one line per segment', () => {
    const structure = deriveEvidenceSourceStructure(INTERVIEW);
    const lineSegments = buildEvidenceSourceSegments(INTERVIEW);
    expect(structure.ruleVersion).toBe('evidence-source-structure-rules/3');
    expect(structure.structureId).toMatch(/^[0-9a-f]{64}$/u);
    expect(structure.blocks.map((block) => block.kind)).toEqual([
      'heading',
      'qa-pair',
      'qa-pair',
    ]);
    const qa = structure.blocks.filter((block) => block.kind === 'qa-pair');
    expect(qa).toHaveLength(2);
    expect(qa[0]?.segments.map((segment) => segment.exactQuote)).toEqual([
      'Interviewer: Where were you on Tuesday evening?',
      'Nera Sol: I stayed inside the greenhouse.',
      'I checked the hatch twice.',
      'The indicator stayed amber the whole time.',
    ]);
    expect(qa[0]?.segments[2]?.startLine).toBe(qa[0]?.segments[2]?.endLine);
    expect(lineSegments.length).toBeGreaterThan(0);
    expect(deriveEvidenceSourceStructure(INTERVIEW).structureId).toBe(
      structure.structureId,
    );
  });

  it('splits a long no-blank-line exhibit at sentence bounds toward the soft maximum', () => {
    const text = Array.from({ length: 80 }, (_, index) =>
      words(20, `fact${String(index + 1)}-`),
    ).join(' ');
    expect(text.split(/\s+/u).length).toBe(1600);
    expect(text.includes('\n')).toBe(false);
    const structure = deriveEvidenceSourceStructure(text);
    const paragraphs = structure.blocks.filter(
      (block) => block.kind === 'paragraph',
    );
    expect(paragraphs.length).toBeGreaterThan(1);
    for (const block of paragraphs) {
      const count = block.segments
        .map((segment) => segment.exactQuote.trim().split(/\s+/u).length)
        .reduce((sum, value) => sum + value, 0);
      expect(count).toBeLessThanOrEqual(
        EVIDENCE_SOURCE_STRUCTURE_SOFT_MAX_WORDS,
      );
    }
  });

  it('does not split a Q+A pair when the answer exceeds the soft maximum', () => {
    const answer = words(700, 'answer-');
    const text = [
      'Interviewer: What happened in the annex?',
      `Nera Sol: ${answer}`,
    ].join('\n');
    const structure = deriveEvidenceSourceStructure(text);
    expect(structure.blocks.map((block) => block.kind)).toEqual(['qa-pair']);
    expect(structure.blocks[0]?.segments[0]?.exactQuote).toContain(
      'What happened in the annex?',
    );
    expect(structure.blocks[0]?.segments.length).toBeGreaterThan(600);
  });

  it('emits one segment per sentence inside an in-bounds paragraph', () => {
    const text =
      'The hatch stayed amber. The operator signed the log at the annex.';
    const structure = deriveEvidenceSourceStructure(text);
    expect(structure.blocks).toHaveLength(1);
    expect(structure.blocks[0]?.kind).toBe('paragraph');
    expect(
      structure.blocks[0]?.segments.map((item) => item.exactQuote),
    ).toEqual([
      'The hatch stayed amber.',
      'The operator signed the log at the annex.',
    ]);
  });
});

describe('planEvidenceStructuralObservationCoverage', () => {
  it('windows extractable segments and attaches neighbour context only', () => {
    const windows = planEvidenceStructuralObservationCoverage(INTERVIEW, 1);
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0]?.sourceSegmentIds).toHaveLength(1);
    expect(windows[0]?.contextSegmentIds.length).toBeGreaterThan(0);
    expect(
      windows[0]?.sourceSegmentIds.some((id) =>
        windows[0]?.contextSegmentIds.includes(id),
      ),
    ).toBe(false);
    expect(windows[1]?.contextSegmentIds).toContain(
      windows[0]?.sourceSegmentIds[0],
    );
  });

  it('packs structural windows by word budget under the coverage ceiling', () => {
    expect(EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_WORDS).toBe(800);
    const text = Array.from({ length: 12 }, (_, index) =>
      words(160, `block${String(index + 1)}-`),
    ).join('\n\n');
    const windows = planEvidenceStructuralObservationCoverage(text);
    expect(windows.length).toBeGreaterThan(1);
    expect(
      windows.every(
        (window) =>
          window.sourceSegmentIds.length <=
          EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS,
      ),
    ).toBe(true);
  });
});
