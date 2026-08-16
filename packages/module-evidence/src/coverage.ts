import { buildEvidenceSourceSegments } from './canonical-text.js';
import { immutableEvidence } from './immutable.js';
import {
  deriveEvidenceSourceStructure,
  evidenceStructuredSourceSegments,
} from './source-structure.js';

/**
 * One coverage window is sized to the active observation ceiling so a single
 * call can name every segment it was shown. Keep equal to
 * `EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ACTIVE`. ADR-0045 §6: coverage is
 * a workflow over these windows, not a larger batch constant.
 */
export const EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS = 64 as const;

/**
 * Structural windows are block-scale (150–350 words), not line-scale.
 * Three extractable segments stay inside a readable call; 64 would pack
 * most of a judicial extract into one window.
 */
export const EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_SEGMENTS =
  3 as const;

export interface EvidenceObservationCoverageWindow {
  readonly index: number;
  readonly sourceSegmentIds: readonly string[];
  readonly startLine: number;
  readonly endLine: number;
}

export function planEvidenceObservationCoverage(
  text: string,
  windowSegments: number = EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS,
): readonly EvidenceObservationCoverageWindow[] {
  if (!Number.isSafeInteger(windowSegments) || windowSegments < 1) {
    throw new RangeError(
      'Coverage window size must be a positive safe integer.',
    );
  }
  const segments = buildEvidenceSourceSegments(text);
  if (segments.length === 0) {
    throw new RangeError('Coverage requires at least one source segment.');
  }
  const windows: EvidenceObservationCoverageWindow[] = [];
  for (let offset = 0; offset < segments.length; offset += windowSegments) {
    const slice = segments.slice(offset, offset + windowSegments);
    const first = slice[0];
    const last = slice.at(-1);
    if (first === undefined || last === undefined) {
      throw new RangeError('Coverage window is empty.');
    }
    windows.push(
      immutableEvidence({
        index: windows.length,
        sourceSegmentIds: slice.map(({ sourceSegmentId }) => sourceSegmentId),
        startLine: first.startLine,
        endLine: last.endLine,
      }),
    );
  }
  return Object.freeze(windows);
}

export function evidenceCoverageWindowForSource(text: string): {
  readonly sourceSegmentIds: readonly string[];
} {
  const windows = planEvidenceObservationCoverage(text);
  if (windows.length !== 1 || windows[0] === undefined) {
    throw new RangeError(
      'Fixture coverage window requires a source that fits in one window.',
    );
  }
  return immutableEvidence({
    sourceSegmentIds: windows[0].sourceSegmentIds,
  });
}

export interface EvidenceStructuralObservationCoverageWindow extends EvidenceObservationCoverageWindow {
  readonly contextSegmentIds: readonly string[];
  readonly structureId: string;
}

export function planEvidenceStructuralObservationCoverage(
  text: string,
  windowSegments: number = EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_SEGMENTS,
): readonly EvidenceStructuralObservationCoverageWindow[] {
  if (!Number.isSafeInteger(windowSegments) || windowSegments < 1) {
    throw new RangeError(
      'Coverage window size must be a positive safe integer.',
    );
  }
  const structure = deriveEvidenceSourceStructure(text);
  const segments = evidenceStructuredSourceSegments(text);
  if (segments.length === 0) {
    throw new RangeError('Coverage requires at least one source segment.');
  }
  const windows: EvidenceStructuralObservationCoverageWindow[] = [];
  for (let offset = 0; offset < segments.length; offset += windowSegments) {
    const slice = segments.slice(offset, offset + windowSegments);
    const first = slice[0];
    const last = slice.at(-1);
    if (first === undefined || last === undefined) {
      throw new RangeError('Coverage window is empty.');
    }
    const extractable = new Set(
      slice.map(({ sourceSegmentId }) => sourceSegmentId),
    );
    const neighbours = [segments[offset - 1], segments[offset + slice.length]]
      .filter((item) => item !== undefined)
      .map(({ sourceSegmentId }) => sourceSegmentId)
      .filter((id) => !extractable.has(id));
    windows.push(
      immutableEvidence({
        index: windows.length,
        sourceSegmentIds: slice.map(({ sourceSegmentId }) => sourceSegmentId),
        contextSegmentIds: neighbours,
        structureId: structure.structureId,
        startLine: first.startLine,
        endLine: last.endLine,
      }),
    );
  }
  return Object.freeze(windows);
}
