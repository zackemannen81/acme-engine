/**
 * V2 source structure: canonical text to source parts and citable units.
 *
 * This layer is deliberately pure and total. It reads no repository, no
 * artifact store and no clock, consults no model, and is a function of
 * canonical text plus the rule version alone.
 *
 * Three properties exist because the 2026-08-16 real-source run failed on
 * their absence:
 *
 * - unique binding is an emission precondition, not a later validation. A unit
 *   whose text does not occur exactly once inside its own line range is never
 *   emitted, so no consumer can spend a provider call on one (R-03);
 * - a part's title is a label with its own provenance. This type exposes no
 *   date and no subject identity, because in real material the header line
 *   that opens a part routinely belongs to the preceding document (R-02);
 * - parts carry a deterministic content character, so a binder's table of
 *   contents is distinguishable from its substance before anything is
 *   analysed (R-01).
 */

export const EVIDENCE_V2_SOURCE_STRUCTURE_SCHEMA_VERSION =
  'evidence-v2-source-structure/1';

export const EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION =
  'evidence-v2-source-structure-rules/1';

/** Upper bound on part size, so no surface has to render an unbounded part. */
const MAX_PART_LINES = 400;

/** How far back a size-driven split may look for a blank line. */
const SPLIT_LOOKBACK_LINES = 100;

/** Dot-leader density at or above which a part reads as index/front matter. */
const INDEX_LINE_RATIO = 0.3;

/** Below this many non-blank lines a part is too small to classify by density. */
const INDEX_MIN_LINES = 5;

/**
 * Document-type words that open a new part in the Stage A judicial class.
 *
 * This lexicon is class-specific, not case-specific, and it is pinned by the
 * rule version: changing it changes `EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION`
 * and therefore every derived identity.
 */
const HEADER_LEXICON = ['Förhör', 'Protokoll', 'PM', 'Bilaga', 'Anmälan'];

export type EvidenceV2ContentCharacter =
  'index-or-front-matter' | 'substantive';

export interface EvidenceV2SourcePartTitle {
  /** The label text, exactly as it appears in the source. */
  readonly text: string;
  /** The line the label was taken from. A label always carries its origin. */
  readonly sourceLine: number;
}

export interface EvidenceV2CitableUnit {
  readonly unitId: string;
  readonly startLine: number;
  readonly endLine: number;
  /** Verbatim source text. Occurs exactly once inside `startLine..endLine`. */
  readonly exactQuote: string;
}

export interface EvidenceV2SourcePart {
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  /**
   * A display label only. It is never an identity, never a subject and never
   * a clock: instance time belongs to `ChainInstance` and is derived from
   * document body metadata, not from this field.
   */
  readonly title: EvidenceV2SourcePartTitle | null;
  readonly contentCharacter: EvidenceV2ContentCharacter;
  readonly units: readonly EvidenceV2CitableUnit[];
}

export interface EvidenceV2SourceStructureDiagnostic {
  readonly code: string;
  readonly partId: string | null;
  readonly message: string;
}

export interface EvidenceV2SourceStructure {
  readonly schemaVersion: typeof EVIDENCE_V2_SOURCE_STRUCTURE_SCHEMA_VERSION;
  readonly ruleVersion: typeof EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION;
  readonly lineCount: number;
  readonly parts: readonly EvidenceV2SourcePart[];
  readonly diagnostics: readonly EvidenceV2SourceStructureDiagnostic[];
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function isIndexLine(line: string): boolean {
  return /\.{5,}\s*\d*\s*$/u.test(line) || /\.{10,}/u.test(line);
}

function isDocumentHeader(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return false;
  // An index row *references* a document; it does not open one. Without this
  // the binder's contents pages produce one phantom part per row, which is
  // precisely the R-01 failure in a new shape: 23 parts titled "Förhör med …"
  // that contain no interview.
  if (isIndexLine(trimmed)) return false;
  // A numbered section title.
  if (/^\d+(?:\.\d+)*\s+\S/u.test(trimmed)) return true;
  // The Stage A header shape: "<title>; 2004-11-29 12:15  diarienr: ...".
  if (/;\s*\d{4}-\d{2}-\d{2}/u.test(trimmed)) return true;
  // A document-type word alone is not a header. "Förhör påbörjat" and
  // "Förhör avslutat" are field labels inside a header block, and treating
  // them as documents is how the frozen slicer produced chains named after
  // metadata. A real document header in this class carries a date or a case
  // file reference on the same line.
  if (!/\d{4}-\d{2}-\d{2}/u.test(trimmed) && !/diarienr/iu.test(trimmed))
    return false;
  return HEADER_LEXICON.some((word) => trimmed.startsWith(`${word} `));
}

/**
 * Part boundaries.
 *
 * Every line lands in exactly one part: a boundary opens a part and the
 * previous one closes on the line before it. Size-driven splits keep a part
 * renderable; they prefer a blank line so a split rarely lands mid-paragraph.
 */
function partBoundaries(lines: readonly string[]): readonly number[] {
  const starts: number[] = [0];
  // The header of the document currently open. In real material the same
  // header is reprinted at the top of every page of a long interview, and
  // treating each reprint as a new document cuts one interview into a part
  // per page — often mid-sentence.
  const firstLine = lines[0] ?? '';
  let openHeader = isDocumentHeader(firstLine) ? firstLine.trim() : '';

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const previousStart = starts.at(-1) ?? 0;

    if (isDocumentHeader(line) && index > previousStart) {
      const header = line.trim();
      if (header === openHeader) continue;
      openHeader = header;
      starts.push(index);
      continue;
    }

    if (index - previousStart < MAX_PART_LINES) continue;

    // Oversized. Prefer the last blank line inside the lookback window.
    let split = index;
    const floor = Math.max(previousStart + 1, index - SPLIT_LOOKBACK_LINES);
    for (let candidate = index; candidate >= floor; candidate -= 1) {
      if (isBlank(lines[candidate] ?? '')) {
        split = candidate;
        break;
      }
    }
    starts.push(split);
  }

  return starts;
}

function classifyContentCharacter(
  lines: readonly string[],
): EvidenceV2ContentCharacter {
  const nonBlank = lines.filter((line) => !isBlank(line));
  if (nonBlank.length < INDEX_MIN_LINES) return 'substantive';
  const indexLines = nonBlank.filter((line) => isIndexLine(line)).length;
  return indexLines / nonBlank.length >= INDEX_LINE_RATIO
    ? 'index-or-front-matter'
    : 'substantive';
}

/**
 * Sentence spans over one part's text.
 *
 * A terminator ends a sentence only when whitespace follows it and the next
 * visible character can open one, so `07.52` and `0500-K39890-04` stay intact.
 * A blank line always ends a sentence: a paragraph break is structural rather
 * than linguistic.
 */
function sentenceSpans(text: string): readonly (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);

    if (char === '\n' && text.charAt(index + 1) === '\n') {
      spans.push([start, index]);
      start = index + 1;
      continue;
    }

    if (char !== '.' && char !== '!' && char !== '?') continue;

    let ahead = index + 1;
    while (ahead < text.length && /\s/u.test(text.charAt(ahead))) ahead += 1;

    if (ahead === text.length) {
      spans.push([start, text.length]);
      start = text.length;
      break;
    }

    // No whitespace at all after the terminator: an ordinal or a decimal.
    if (ahead === index + 1) continue;
    if (!/[\p{Lu}\p{Nd}"'«([]/u.test(text.charAt(ahead))) continue;

    spans.push([start, index + 1]);
    start = ahead;
    index = ahead - 1;
  }

  if (start < text.length) spans.push([start, text.length]);
  return spans;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return count;
    count += 1;
    from = at + 1;
  }
}

interface WorkingUnit {
  start: number;
  end: number;
  startLineIndex: number;
  endLineIndex: number;
}

function deriveUnits(
  partId: string,
  partLines: readonly string[],
  partStartLine: number,
): readonly EvidenceV2CitableUnit[] {
  const text = partLines.join('\n');

  const lineStart: number[] = [];
  const lineEnd: number[] = [];
  let offset = 0;
  for (const line of partLines) {
    lineStart.push(offset);
    lineEnd.push(offset + line.length);
    offset += line.length + 1;
  }

  const lineIndexOf = (position: number): number => {
    let low = 0;
    let high = lineStart.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((lineStart[middle] ?? 0) <= position) low = middle;
      else high = middle - 1;
    }
    return low;
  };

  const rangeTextOf = (unit: WorkingUnit): string =>
    text.slice(
      lineStart[unit.startLineIndex] ?? 0,
      lineEnd[unit.endLineIndex] ?? text.length,
    );

  const emitted: WorkingUnit[] = [];

  for (const [rawStart, rawEnd] of sentenceSpans(text)) {
    let start = rawStart;
    let end = rawEnd;
    while (start < end && /\s/u.test(text.charAt(start))) start += 1;
    while (end > start && /\s/u.test(text.charAt(end - 1))) end -= 1;
    if (start >= end) continue;

    let unit: WorkingUnit = {
      start,
      end,
      startLineIndex: lineIndexOf(start),
      endLineIndex: lineIndexOf(end - 1),
    };

    // Unique binding is an emission precondition. A quote that repeats inside
    // its own range absorbs the previous unit until it is unique; with no
    // previous unit left it widens to its whole line range, where the quote is
    // the range and so occurs exactly once by construction.
    for (;;) {
      if (
        countOccurrences(
          rangeTextOf(unit),
          text.slice(unit.start, unit.end),
        ) === 1
      )
        break;

      const previous = emitted.pop();
      if (previous === undefined) {
        unit = {
          start: lineStart[unit.startLineIndex] ?? 0,
          end: lineEnd[unit.endLineIndex] ?? text.length,
          startLineIndex: unit.startLineIndex,
          endLineIndex: unit.endLineIndex,
        };
        break;
      }

      unit = {
        start: previous.start,
        end: unit.end,
        startLineIndex: previous.startLineIndex,
        endLineIndex: unit.endLineIndex,
      };
    }

    emitted.push(unit);
  }

  return emitted.map((unit, ordinal) => ({
    unitId: `${partId}-unit-${pad(ordinal + 1, 4)}`,
    startLine: partStartLine + unit.startLineIndex,
    endLine: partStartLine + unit.endLineIndex,
    exactQuote: text.slice(unit.start, unit.end),
  }));
}

/**
 * Derive the complete structure of one artifact version's canonical text.
 *
 * Total: every line belongs to exactly one part. Deterministic: the same text
 * and rule version always yield identical parts, unit identities and
 * classifications.
 */
export function deriveEvidenceV2SourceStructure(
  text: string,
): EvidenceV2SourceStructure {
  const diagnostics: EvidenceV2SourceStructureDiagnostic[] = [];

  if (text.length === 0) {
    return {
      schemaVersion: EVIDENCE_V2_SOURCE_STRUCTURE_SCHEMA_VERSION,
      ruleVersion: EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION,
      lineCount: 0,
      parts: [],
      diagnostics: [
        {
          code: 'EVIDENCE_V2_SOURCE_EMPTY',
          partId: null,
          message: 'Canonical text is empty; no part can be derived.',
        },
      ],
    };
  }

  const lines = text.split('\n');
  const starts = partBoundaries(lines);
  const parts: EvidenceV2SourcePart[] = [];

  for (let index = 0; index < starts.length; index += 1) {
    const startIndex = starts[index] ?? 0;
    const endIndex = (starts[index + 1] ?? lines.length) - 1;
    const partLines = lines.slice(startIndex, endIndex + 1);
    const partId = `part-${pad(index + 1, 6)}`;

    const titleIndex = partLines.findIndex((line) => !isBlank(line));
    const titleLine = titleIndex < 0 ? undefined : partLines[titleIndex];

    const part: EvidenceV2SourcePart = {
      partId,
      startLine: startIndex + 1,
      endLine: endIndex + 1,
      title:
        titleLine === undefined
          ? null
          : {
              text: titleLine.trim(),
              sourceLine: startIndex + titleIndex + 1,
            },
      contentCharacter: classifyContentCharacter(partLines),
      units: deriveUnits(partId, partLines, startIndex + 1),
    };

    if (part.units.length === 0) {
      diagnostics.push({
        code: 'EVIDENCE_V2_PART_HAS_NO_CITABLE_UNIT',
        partId,
        message: `Part ${partId} contains no citable text.`,
      });
    }

    parts.push(part);
  }

  return {
    schemaVersion: EVIDENCE_V2_SOURCE_STRUCTURE_SCHEMA_VERSION,
    ruleVersion: EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION,
    lineCount: lines.length,
    parts,
    diagnostics,
  };
}

export interface EvidenceV2SourceIndex {
  readonly part: (partId: string) => EvidenceV2SourcePart | undefined;
  readonly unit: (unitId: string) => EvidenceV2CitableUnit | undefined;
  readonly partOfLine: (line: number) => EvidenceV2SourcePart | undefined;
}

/**
 * Constant-time lookup over an already derived structure.
 *
 * The frozen application re-derived the whole document on every segment
 * lookup, which blocked its event loop for up to 64 seconds per analysis
 * window. Derivation happens once; lookup never repeats it (R-10).
 */
export function createEvidenceV2SourceIndex(
  structure: EvidenceV2SourceStructure,
): EvidenceV2SourceIndex {
  const parts = new Map<string, EvidenceV2SourcePart>();
  const units = new Map<string, EvidenceV2CitableUnit>();
  const partStarts: number[] = [];
  const partsByStart: EvidenceV2SourcePart[] = [];

  for (const part of structure.parts) {
    parts.set(part.partId, part);
    partStarts.push(part.startLine);
    partsByStart.push(part);
    for (const unit of part.units) units.set(unit.unitId, unit);
  }

  return {
    part: (partId) => parts.get(partId),
    unit: (unitId) => units.get(unitId),
    partOfLine: (line) => {
      let low = 0;
      let high = partStarts.length - 1;
      if (high < 0) return undefined;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if ((partStarts[middle] ?? 0) <= line) low = middle;
        else high = middle - 1;
      }
      const candidate = partsByStart[low];
      if (candidate === undefined) return undefined;
      return line >= candidate.startLine && line <= candidate.endLine
        ? candidate
        : undefined;
    },
  };
}

/**
 * Prove the invariants against the original text, independently of how the
 * structure was produced. Tests and acceptance runs use this rather than
 * trusting the derivation to check itself.
 */
export function verifyEvidenceV2SourceStructure(
  text: string,
  structure: EvidenceV2SourceStructure,
): readonly EvidenceV2SourceStructureDiagnostic[] {
  const findings: EvidenceV2SourceStructureDiagnostic[] = [];
  const lines = text.split('\n');

  let expectedLine = 1;
  for (const part of structure.parts) {
    if (part.startLine !== expectedLine) {
      findings.push({
        code: 'EVIDENCE_V2_COVERAGE_GAP',
        partId: part.partId,
        message: `Part ${part.partId} starts at ${String(part.startLine)}, expected ${String(expectedLine)}.`,
      });
    }
    expectedLine = part.endLine + 1;

    for (const unit of part.units) {
      if (unit.startLine < part.startLine || unit.endLine > part.endLine) {
        findings.push({
          code: 'EVIDENCE_V2_UNIT_OUTSIDE_PART',
          partId: part.partId,
          message: `Unit ${unit.unitId} addresses lines outside its part.`,
        });
        continue;
      }
      const range = lines.slice(unit.startLine - 1, unit.endLine).join('\n');
      const occurrences = countOccurrences(range, unit.exactQuote);
      if (occurrences !== 1) {
        findings.push({
          code: 'EVIDENCE_V2_UNIT_NOT_UNIQUELY_BINDABLE',
          partId: part.partId,
          message: `Unit ${unit.unitId} occurs ${String(occurrences)} times inside its own range.`,
        });
      }
    }
  }

  if (structure.parts.length > 0 && expectedLine !== structure.lineCount + 1) {
    findings.push({
      code: 'EVIDENCE_V2_COVERAGE_INCOMPLETE',
      partId: null,
      message: `Parts cover ${String(expectedLine - 1)} of ${String(structure.lineCount)} lines.`,
    });
  }

  return findings;
}
