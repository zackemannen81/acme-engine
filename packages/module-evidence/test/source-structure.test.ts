import { describe, expect, it } from 'vitest';

import { buildEvidenceSourceSegments } from '../src/canonical-text.js';
import {
  deriveEvidenceSourceStructure,
  planEvidenceStructuralObservationCoverage,
} from '../src/index.js';

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
    expect(structure.ruleVersion).toBe('evidence-source-structure-rules/1');
    expect(structure.structureId).toMatch(/^[0-9a-f]{64}$/u);
    expect(structure.blocks.map((block) => block.kind)).toEqual([
      'heading',
      'qa-pair',
      'qa-pair',
    ]);
    const qa = structure.blocks.filter((block) => block.kind === 'qa-pair');
    expect(qa).toHaveLength(2);
    expect(qa[0]?.segments).toHaveLength(2);
    expect(qa[0]?.segments[1]?.exactQuote).toContain(
      'I checked the hatch twice.',
    );
    expect(qa[0]?.segments[1]?.startLine).toBeLessThan(
      qa[0]?.segments[1]?.endLine ?? 0,
    );
    const structuredCount = structure.blocks.flatMap(
      (block) => block.segments,
    ).length;
    expect(structuredCount).toBeLessThan(lineSegments.length);
    expect(deriveEvidenceSourceStructure(INTERVIEW).structureId).toBe(
      structure.structureId,
    );
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
});
