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
 * Structural windows pack sentence-scale segments toward a readable
 * word budget. The 64-segment ceiling is the observe coverage schema
 * maximum, not a target.
 */
export const EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_WORDS =
  800 as const;

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

function segmentWordCount(exactQuote: string): number {
  return exactQuote
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 0).length;
}

export function planEvidenceStructuralObservationCoverage(
  text: string,
  windowWordsOrOptions:
    | number
    | {
        readonly windowWords?: number;
        readonly partId?: string;
      } = EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_WORDS,
): readonly EvidenceStructuralObservationCoverageWindow[] {
  const options =
    typeof windowWordsOrOptions === 'number'
      ? { windowWords: windowWordsOrOptions }
      : windowWordsOrOptions;
  const windowWords =
    options.windowWords ??
    EVIDENCE_STRUCTURAL_OBSERVATION_COVERAGE_WINDOW_WORDS;
  if (!Number.isSafeInteger(windowWords) || windowWords < 1) {
    throw new RangeError(
      'Coverage window word budget must be a positive safe integer.',
    );
  }
  const structure = deriveEvidenceSourceStructure(text);
  const part =
    options.partId === undefined
      ? undefined
      : structure.parts.find((item) => item.partId === options.partId);
  if (options.partId !== undefined && part === undefined) {
    throw new RangeError(`Unknown source part ${options.partId}.`);
  }
  const allowed = part === undefined ? undefined : new Set(part.blockIds);
  const segments = evidenceStructuredSourceSegments(text).filter(
    (segment) => allowed === undefined || allowed.has(segment.blockId),
  );
  if (segments.length === 0) {
    throw new RangeError('Coverage requires at least one source segment.');
  }
  const windows: EvidenceStructuralObservationCoverageWindow[] = [];
  let offset = 0;
  while (offset < segments.length) {
    let words = 0;
    let count = 0;
    while (offset + count < segments.length) {
      const next = segments[offset + count];
      if (next === undefined) break;
      const nextWords = segmentWordCount(next.exactQuote);
      if (
        count > 0 &&
        (count >= EVIDENCE_OBSERVATION_COVERAGE_WINDOW_SEGMENTS ||
          words + nextWords > windowWords)
      ) {
        break;
      }
      words += nextWords;
      count += 1;
    }
    const slice = segments.slice(offset, offset + count);
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
    offset += count;
  }
  return Object.freeze(windows);
}
