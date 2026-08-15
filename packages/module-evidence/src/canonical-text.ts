export const EVIDENCE_TEXT_CANONICALIZATION_ALGORITHM =
  'evidence-text-canonicalization-1' as const;

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
