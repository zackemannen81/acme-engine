export const EVIDENCE_TEXT_CANONICALIZATION_ALGORITHM =
  'evidence-text-canonicalization-1' as const;
export const EVIDENCE_SOURCE_SEGMENT_MAX_CODE_POINTS = 500;

export interface EvidenceSourceSegment {
  readonly sourceSegmentId: string;
  readonly exactQuote: string;
  readonly startLine: number;
  readonly endLine: number;
}

export function canonicalizeEvidenceText(value: string): string {
  if (value.startsWith('\uFEFF')) {
    throw new TypeError('Evidence source text must not contain a UTF-8 BOM.');
  }

  const canonical = value.replace(/\r\n?/gu, '\n').normalize('NFC');
  if (canonical.length === 0) {
    throw new TypeError('Evidence source text must not be empty.');
  }
  return canonical;
}

export function evidenceTextBytes(value: string): Uint8Array {
  return new TextEncoder().encode(canonicalizeEvidenceText(value));
}

export function evidenceLineCount(value: string): number {
  const canonical = canonicalizeEvidenceText(value);
  return canonical.endsWith('\n')
    ? canonical.split('\n').length - 1
    : canonical.split('\n').length;
}

export function evidenceLineRange(
  value: string,
  startLine: number,
  endLine: number,
): string {
  const lines = canonicalizeEvidenceText(value).split('\n');
  if (lines.at(-1) === '') {
    lines.pop();
  }
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine ||
    endLine > lines.length
  ) {
    throw new RangeError('Evidence locator is outside the canonical line set.');
  }
  return lines.slice(startLine - 1, endLine).join('\n');
}

export function buildEvidenceSourceSegments(
  value: string,
): readonly EvidenceSourceSegment[] {
  const lines = canonicalizeEvidenceText(value).split('\n');
  if (lines.at(-1) === '') lines.pop();
  const segments: EvidenceSourceSegment[] = [];
  lines.forEach((line, lineIndex) => {
    const codePoints = [...line];
    for (
      let offset = 0, segmentIndex = 0;
      offset < codePoints.length;
      offset += EVIDENCE_SOURCE_SEGMENT_MAX_CODE_POINTS, segmentIndex += 1
    ) {
      const exactQuote = codePoints
        .slice(offset, offset + EVIDENCE_SOURCE_SEGMENT_MAX_CODE_POINTS)
        .join('');
      if (exactQuote.trim().length === 0) continue;
      segments.push({
        sourceSegmentId: `line-${String(lineIndex + 1).padStart(6, '0')}-segment-${String(segmentIndex + 1).padStart(4, '0')}`,
        exactQuote,
        startLine: lineIndex + 1,
        endLine: lineIndex + 1,
      });
    }
  });
  return Object.freeze(
    segments.map((segment) => Object.freeze(segment)),
  ) as readonly EvidenceSourceSegment[];
}

export function resolveEvidenceSourceSegment(
  value: string,
  sourceSegmentId: string,
): EvidenceSourceSegment | undefined {
  return buildEvidenceSourceSegments(value).find(
    (segment) => segment.sourceSegmentId === sourceSegmentId,
  );
}

export type EvidenceUniqueQuoteLocation =
  | {
      readonly status: 'unique';
      readonly startLine: number;
      readonly endLine: number;
    }
  | { readonly status: 'absent' }
  | { readonly status: 'ambiguous'; readonly occurrenceCount: number };

export function locateUniqueEvidenceQuote(
  value: string,
  quote: string,
): EvidenceUniqueQuoteLocation {
  const canonical = canonicalizeEvidenceText(value);
  if (quote.length === 0) return { status: 'absent' };
  const offsets: number[] = [];
  let offset = 0;
  while (offset <= canonical.length - quote.length) {
    const found = canonical.indexOf(quote, offset);
    if (found === -1) break;
    offsets.push(found);
    offset = found + quote.length;
  }
  if (offsets.length === 0) return { status: 'absent' };
  if (offsets.length > 1) {
    return { status: 'ambiguous', occurrenceCount: offsets.length };
  }
  const found = offsets[0] as number;
  const startLine = 1 + canonical.slice(0, found).split('\n').length - 1;
  const endLine = startLine + quote.split('\n').length - 1;
  return { status: 'unique', startLine, endLine };
}

export function exactQuoteOccurrenceCount(
  value: string,
  startLine: number,
  endLine: number,
  quote: string,
): number {
  if (quote.length === 0) {
    return 0;
  }
  const range = evidenceLineRange(value, startLine, endLine);
  let count = 0;
  let offset = 0;
  while (offset <= range.length - quote.length) {
    const found = range.indexOf(quote, offset);
    if (found === -1) {
      break;
    }
    count += 1;
    offset = found + quote.length;
  }
  return count;
}
