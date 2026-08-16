import { canonicalJson, sha256, type JsonValue } from '@acme/core';

import {
  buildEvidenceSourceSegments,
  canonicalizeEvidenceText,
  type EvidenceSourceSegment,
} from './canonical-text.js';
import { immutableEvidence } from './immutable.js';

export const EVIDENCE_SOURCE_STRUCTURE_SCHEMA_VERSION =
  'evidence-source-structure/1' as const;
export const EVIDENCE_SOURCE_STRUCTURE_RULE_VERSION =
  'evidence-source-structure-rules/1' as const;

const TARGET_MIN_WORDS = 150;
const TARGET_MAX_WORDS = 350;
const SOFT_MAX_WORDS = 600;
const QUESTION_PREFIX =
  /^(?:Q|Question|Fråga|Interviewer|Utredare|Åklagare|Police|Officer)\s*[:-]/iu;

export type EvidenceSourceBlockKind = 'qa-pair' | 'paragraph' | 'heading';

export interface EvidenceStructuredSourceSegment extends EvidenceSourceSegment {
  readonly blockId: string;
}

export interface EvidenceSourceBlock {
  readonly blockId: string;
  readonly kind: EvidenceSourceBlockKind;
  readonly heading: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly segments: readonly EvidenceStructuredSourceSegment[];
}

export interface EvidenceSourceStructure {
  readonly schemaVersion: typeof EVIDENCE_SOURCE_STRUCTURE_SCHEMA_VERSION;
  readonly ruleVersion: typeof EVIDENCE_SOURCE_STRUCTURE_RULE_VERSION;
  readonly structureId: string;
  readonly blocks: readonly EvidenceSourceBlock[];
}

interface LineUnit {
  readonly lineNumber: number;
  readonly text: string;
}

interface AtomicUnit {
  readonly kind: EvidenceSourceBlockKind;
  readonly lines: readonly LineUnit[];
  readonly questionLines?: readonly LineUnit[];
  readonly answerLines?: readonly LineUnit[];
}

function wordCount(value: string): number {
  return value
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 0).length;
}

function isQuestionLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return trimmed.endsWith('?') || QUESTION_PREFIX.test(trimmed);
}

function headingFrom(lines: readonly LineUnit[]): string {
  const first = lines[0]?.text.trim() ?? 'Source block';
  return first.length > 80 ? `${first.slice(0, 77)}...` : first;
}

function joinLines(lines: readonly LineUnit[]): string {
  return lines.map((line) => line.text).join('\n');
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function sourceLines(text: string): readonly LineUnit[] {
  const lines = canonicalizeEvidenceText(text).split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.map((line, index) => ({
    lineNumber: index + 1,
    text: line,
  }));
}

function takeParagraph(
  lines: readonly LineUnit[],
  start: number,
): { readonly unit: AtomicUnit; readonly next: number } {
  const collected: LineUnit[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) break;
    if (line.text.trim().length === 0) {
      if (collected.length > 0) break;
      index += 1;
      continue;
    }
    if (isQuestionLine(line.text) && collected.length > 0) break;
    collected.push(line);
    index += 1;
  }
  const words = wordCount(joinLines(collected));
  return {
    unit: {
      kind:
        words > 0 && words <= 8 && collected.length === 1
          ? 'heading'
          : 'paragraph',
      lines: collected,
    },
    next: index,
  };
}

function takeQuestionAnswer(
  lines: readonly LineUnit[],
  start: number,
): { readonly unit: AtomicUnit; readonly next: number } {
  const question = lines[start];
  if (question === undefined) {
    throw new RangeError('Question block is missing its first line.');
  }
  const questionLines = [question];
  const answerLines: LineUnit[] = [];
  let index = start + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) break;
    if (line.text.trim().length === 0) {
      const following = lines
        .slice(index + 1)
        .find((item) => item.text.trim().length > 0);
      if (following !== undefined && isQuestionLine(following.text)) break;
      if (answerLines.length === 0) {
        index += 1;
        continue;
      }
      break;
    }
    if (isQuestionLine(line.text)) break;
    answerLines.push(line);
    index += 1;
  }
  return {
    unit: {
      kind: 'qa-pair',
      lines: [...questionLines, ...answerLines],
      questionLines,
      answerLines,
    },
    next: index,
  };
}

function atomicUnits(lines: readonly LineUnit[]): AtomicUnit[] {
  const units: AtomicUnit[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) break;
    if (line.text.trim().length === 0) {
      index += 1;
      continue;
    }
    const taken = isQuestionLine(line.text)
      ? takeQuestionAnswer(lines, index)
      : takeParagraph(lines, index);
    if (taken.unit.lines.length > 0) units.push(taken.unit);
    index = taken.next;
  }
  return units;
}

function mergeParagraphs(units: readonly AtomicUnit[]): AtomicUnit[] {
  const merged: AtomicUnit[] = [];
  for (const unit of units) {
    const previous = merged.at(-1);
    if (
      unit.kind !== 'paragraph' ||
      previous === undefined ||
      previous.kind !== 'paragraph'
    ) {
      merged.push(unit);
      continue;
    }
    const combined = `${joinLines(previous.lines)}\n${joinLines(unit.lines)}`;
    const words = wordCount(combined);
    if (words > SOFT_MAX_WORDS) {
      merged.push(unit);
      continue;
    }
    if (
      wordCount(joinLines(previous.lines)) >= TARGET_MIN_WORDS &&
      wordCount(joinLines(unit.lines)) >= TARGET_MIN_WORDS
    ) {
      merged.push(unit);
      continue;
    }
    if (
      words > TARGET_MAX_WORDS &&
      wordCount(joinLines(previous.lines)) >= TARGET_MIN_WORDS
    ) {
      merged.push(unit);
      continue;
    }
    merged[merged.length - 1] = {
      kind: 'paragraph',
      lines: [...previous.lines, ...unit.lines],
    };
  }
  return merged;
}

function segmentsFor(
  blockId: string,
  unit: AtomicUnit,
): EvidenceStructuredSourceSegment[] {
  const push = (
    ordinal: number,
    lines: readonly LineUnit[],
  ): EvidenceStructuredSourceSegment | undefined => {
    if (lines.length === 0) return undefined;
    const first = lines[0];
    const last = lines.at(-1);
    if (first === undefined || last === undefined) return undefined;
    const exactQuote = joinLines(lines);
    if (exactQuote.trim().length === 0) return undefined;
    return immutableEvidence({
      sourceSegmentId: `${blockId}-segment-${pad(ordinal, 4)}`,
      exactQuote,
      startLine: first.lineNumber,
      endLine: last.lineNumber,
      blockId,
    });
  };
  if (unit.kind === 'qa-pair') {
    return [
      push(1, unit.questionLines ?? []),
      push(2, unit.answerLines ?? []),
    ].filter(
      (item): item is EvidenceStructuredSourceSegment => item !== undefined,
    );
  }
  const single = push(1, unit.lines);
  return single === undefined ? [] : [single];
}

export function deriveEvidenceSourceStructure(
  text: string,
): EvidenceSourceStructure {
  const lines = sourceLines(text);
  if (lines.length === 0) {
    throw new RangeError('Source structure requires at least one line.');
  }
  const units = mergeParagraphs(atomicUnits(lines));
  const blocks = units.map((unit, index) => {
    const blockId = `block-${pad(index + 1, 6)}`;
    const first = unit.lines[0];
    const last = unit.lines.at(-1);
    if (first === undefined || last === undefined) {
      throw new RangeError('Source block is missing line bounds.');
    }
    return immutableEvidence({
      blockId,
      kind: unit.kind,
      heading: headingFrom(unit.lines),
      startLine: first.lineNumber,
      endLine: last.lineNumber,
      segments: segmentsFor(blockId, unit),
    });
  });
  const structureId = sha256(
    canonicalJson({
      ruleVersion: EVIDENCE_SOURCE_STRUCTURE_RULE_VERSION,
      text: canonicalizeEvidenceText(text),
    } as JsonValue),
  );
  return immutableEvidence({
    schemaVersion: EVIDENCE_SOURCE_STRUCTURE_SCHEMA_VERSION,
    ruleVersion: EVIDENCE_SOURCE_STRUCTURE_RULE_VERSION,
    structureId,
    blocks,
  });
}

export function evidenceStructuredSourceSegments(
  text: string,
): readonly EvidenceStructuredSourceSegment[] {
  return deriveEvidenceSourceStructure(text).blocks.flatMap(
    (block) => block.segments,
  );
}

export function resolveEvidenceStructuredSourceSegment(
  text: string,
  sourceSegmentId: string,
): EvidenceSourceSegment | undefined {
  if (sourceSegmentId.startsWith('line-')) {
    return buildEvidenceSourceSegments(text).find(
      (segment) => segment.sourceSegmentId === sourceSegmentId,
    );
  }
  return evidenceStructuredSourceSegments(text).find(
    (segment) => segment.sourceSegmentId === sourceSegmentId,
  );
}
