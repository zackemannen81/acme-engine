/**
 * PDF text extraction for `stage-a-pdf-extracted-text/1`.
 *
 * `pdfjs-dist` is pinned and confined to this adapter. The contract layer
 * sees only canonical text, a page count, and a named refusal. Text
 * assembly is this file's rule (`pdfjs-text/1`): items on a page are
 * ordered by position, pages are joined with LF, and the result is NFC.
 * That is what makes the canonical SHA-256 a property of (bytes, rule)
 * rather than of a helper's merge heuristic.
 */

import {
  EVIDENCE_V2_CANONICAL_TEXT_MAX_BYTES,
  EVIDENCE_V2_PDF_EXTRACTOR_METHOD,
  EVIDENCE_V2_PDF_EXTRACTOR_RULE_VERSION,
  EVIDENCE_V2_PDF_MAX_BYTES,
  EVIDENCE_V2_PDF_MIN_CHARS_PER_PAGE,
  type EvidenceV2PdfExtractor,
} from '@acme/evidence-v2-contracts';

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

interface PdfJsTextItem {
  readonly str?: string;
  readonly transform?: readonly number[];
}

interface PdfJsTextContent {
  readonly items: readonly unknown[];
}

interface PdfJsPage {
  getTextContent(params: {
    readonly includeMarkedContent: boolean;
  }): Promise<PdfJsTextContent>;
}

interface PdfJsDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  destroy(): Promise<void>;
}

interface PdfJsModule {
  getDocument(params: {
    readonly data: Uint8Array;
    readonly password: string;
    readonly stopAtErrors: boolean;
    readonly isEvalSupported: boolean;
    readonly disableFontFace: boolean;
    readonly useSystemFonts: boolean;
    readonly verbosity: number;
  }): { readonly promise: Promise<PdfJsDocument> };
}

function isPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_MAGIC.byteLength) return false;
  for (let index = 0; index < PDF_MAGIC.byteLength; index += 1) {
    if (bytes[index] !== PDF_MAGIC[index]) return false;
  }
  return true;
}

function looksEncrypted(bytes: Uint8Array): boolean {
  // Fail closed on the trailer name, before the library is asked for a
  // password. A content stream that happens to contain the same bytes is
  // also refused: that is the conservative side of "encrypted or
  // password-protected".
  const haystack = Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).toString('latin1');
  return haystack.includes('/Encrypt');
}

function itemPosition(item: PdfJsTextItem): { x: number; y: number } {
  const transform = item.transform ?? [];
  return { x: transform[4] ?? 0, y: transform[5] ?? 0 };
}

function pageText(items: readonly PdfJsTextItem[]): string {
  const usable = items
    .map((item) => ({
      str: (item.str ?? '').replace(/\r\n?/gu, '\n'),
      ...itemPosition(item),
    }))
    .filter((item) => item.str.length > 0)
    .sort((left, right) =>
      right.y === left.y ? left.x - right.x : right.y - left.y,
    );
  const lines: string[] = [];
  let current = '';
  let lastY: number | undefined;
  for (const item of usable) {
    if (lastY !== undefined && Math.abs(lastY - item.y) > 2) {
      lines.push(current);
      current = item.str;
    } else if (current.length === 0) {
      current = item.str;
    } else if (
      current.endsWith(' ') ||
      current.endsWith('\n') ||
      item.str.startsWith(' ')
    ) {
      current += item.str;
    } else {
      current += ` ${item.str}`;
    }
    lastY = item.y;
  }
  if (current.length > 0) lines.push(current);
  return lines.join('\n');
}

function canonicalize(pages: readonly string[]): string {
  return pages.join('\n').replace(/\r\n?/gu, '\n').normalize('NFC');
}

function nonWhitespaceCount(value: string): number {
  return value.replace(/\s+/gu, '').length;
}

async function loadPdfjs(): Promise<PdfJsModule> {
  // The specifier is a value, not a literal, so TypeScript does not load
  // pdfjs-dist's DOM-heavy .d.ts into the workspace typecheck. The
  // runtime entry is still the Node legacy ESM build.
  const specifier: string = 'pdfjs-dist/legacy/build/pdf.mjs';
  const loaded: unknown = await import(specifier);
  const module = loaded as { getDocument?: PdfJsModule['getDocument'] } & {
    readonly default?: { getDocument?: PdfJsModule['getDocument'] };
  };
  const getDocument = module.getDocument ?? module.default?.getDocument;
  if (getDocument === undefined) {
    throw new Error('EVIDENCE_V2_PDF_EXTRACT_FAILED');
  }
  return { getDocument };
}

export function createEvidenceV2PdfExtractor(options?: {
  readonly maxBytes?: number;
  readonly maxTextBytes?: number;
  readonly minCharsPerPage?: number;
}): EvidenceV2PdfExtractor {
  const maxBytes = options?.maxBytes ?? EVIDENCE_V2_PDF_MAX_BYTES;
  const maxTextBytes =
    options?.maxTextBytes ?? EVIDENCE_V2_CANONICAL_TEXT_MAX_BYTES;
  const minCharsPerPage =
    options?.minCharsPerPage ?? EVIDENCE_V2_PDF_MIN_CHARS_PER_PAGE;

  return {
    async extract(bytes) {
      if (bytes.byteLength > maxBytes) {
        return { ok: false, code: 'EVIDENCE_V2_PDF_OVERSIZE' };
      }
      if (!isPdf(bytes)) {
        return { ok: false, code: 'EVIDENCE_V2_PDF_NOT_PDF' };
      }
      if (looksEncrypted(bytes)) {
        return { ok: false, code: 'EVIDENCE_V2_PDF_ENCRYPTED' };
      }

      let document: PdfJsDocument | undefined;
      try {
        const pdfjs = await loadPdfjs();
        document = await pdfjs.getDocument({
          data: Uint8Array.from(bytes),
          password: '',
          stopAtErrors: true,
          isEvalSupported: false,
          disableFontFace: true,
          useSystemFonts: true,
          verbosity: 0,
        }).promise;

        const pages: string[] = [];
        for (let number = 1; number <= document.numPages; number += 1) {
          const page = await document.getPage(number);
          const content = await page.getTextContent({
            includeMarkedContent: false,
          });
          const items = content.items.filter(
            (item): item is PdfJsTextItem =>
              typeof item === 'object' && item !== null && 'str' in item,
          );
          pages.push(pageText(items));
        }

        const text = canonicalize(pages);
        const encoded = Buffer.byteLength(text, 'utf8');
        if (encoded > maxTextBytes) {
          return { ok: false, code: 'EVIDENCE_V2_PDF_TEXT_OVERSIZE' };
        }
        if (document.numPages === 0 || text.trim().length === 0) {
          return { ok: false, code: 'EVIDENCE_V2_PDF_EMPTY_TEXT' };
        }
        if (nonWhitespaceCount(text) < document.numPages * minCharsPerPage) {
          return { ok: false, code: 'EVIDENCE_V2_PDF_EMPTY_TEXT' };
        }

        return {
          ok: true,
          value: {
            text,
            pageCount: document.numPages,
            extractionMethod: EVIDENCE_V2_PDF_EXTRACTOR_METHOD,
            extractionRuleVersion: EVIDENCE_V2_PDF_EXTRACTOR_RULE_VERSION,
          },
        };
      } catch (error) {
        const name =
          error !== null && typeof error === 'object' && 'name' in error
            ? String(error.name)
            : '';
        const message = error instanceof Error ? error.message : '';
        if (
          name.includes('Password') ||
          message.includes('password') ||
          message.includes('encrypted')
        ) {
          return { ok: false, code: 'EVIDENCE_V2_PDF_ENCRYPTED' };
        }
        if (
          name.includes('InvalidPDF') ||
          name.includes('FormatError') ||
          message.includes('Invalid PDF')
        ) {
          return { ok: false, code: 'EVIDENCE_V2_PDF_NOT_PDF' };
        }
        return { ok: false, code: 'EVIDENCE_V2_PDF_EXTRACT_FAILED' };
      } finally {
        const closer = document as
          { cleanup?: () => void; destroy?: () => unknown } | undefined;
        try {
          closer?.cleanup?.();
        } catch {
          // Cleanup is best-effort; a refusal must not become a throw.
        }
        try {
          const destroyed = closer?.destroy?.();
          if (
            destroyed !== undefined &&
            typeof (destroyed as Promise<void>).then === 'function'
          )
            await (destroyed as Promise<void>);
        } catch {
          // Same: closing the document is not a refusal class.
        }
      }
    },
  };
}
