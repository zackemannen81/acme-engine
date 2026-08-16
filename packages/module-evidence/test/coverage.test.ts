import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ACTIVE,
  EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS,
  EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_SEGMENTS,
  planEvidenceObservationCoverage,
} from '../src/index.js';

describe('observation coverage planner', () => {
  it('sizes windows to the active candidate ceiling', () => {
    expect(EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS).toBe(
      EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ACTIVE,
    );
    expect(EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_SEGMENTS).toBe(3);
  });

  it('keeps a short source in one window and splits a longer one', () => {
    const short = ['alpha', 'beta', 'gamma'].join('\n');
    expect(planEvidenceObservationCoverage(short)).toEqual([
      expect.objectContaining({
        index: 0,
        startLine: 1,
        endLine: 3,
        sourceSegmentIds: [
          'line-000001-segment-0001',
          'line-000002-segment-0001',
          'line-000003-segment-0001',
        ],
      }),
    ]);

    const lines = Array.from(
      { length: EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS + 1 },
      (_, index) => `line-${String(index + 1)}`,
    );
    const windows = planEvidenceObservationCoverage(lines.join('\n'));
    expect(windows).toHaveLength(2);
    expect(windows[0]?.sourceSegmentIds).toHaveLength(
      EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS,
    );
    expect(windows[1]?.sourceSegmentIds).toEqual(['line-000065-segment-0001']);
    expect(windows[0]?.endLine).toBe(64);
    expect(windows[1]?.startLine).toBe(65);
  });
});
