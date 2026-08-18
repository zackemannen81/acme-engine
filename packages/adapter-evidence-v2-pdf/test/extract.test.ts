import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createEvidenceV2PdfExtractor } from '../src/index.js';

/**
 * A one-page PDF whose only visible text is `Hello`.
 *
 * Hand-built so the adapter test does not depend on a second PDF writer.
 * The stream is a single Tj of a Type1 Helvetica string.
 */
function helloPdf(text = 'Hello'): Uint8Array {
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET\n`;
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n',
    `4 0 obj<< /Length ${String(stream.length)} >>stream\n${stream}endstream\nendobj\n`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
  ];
  let body = '%PDF-1.1\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += object;
  }
  const xrefStart = Buffer.byteLength(body, 'latin1');
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let index = 1; index <= 5; index += 1) {
    xref += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  body += xref;
  body += `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function emptyPagePdf(): Uint8Array {
  const stream = 'BT ET\n';
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>endobj\n',
    `4 0 obj<< /Length ${String(stream.length)} >>stream\n${stream}endstream\nendobj\n`,
  ];
  let body = '%PDF-1.1\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += object;
  }
  const xrefStart = Buffer.byteLength(body, 'latin1');
  let xref = `xref\n0 5\n0000000000 65535 f \n`;
  for (let index = 1; index <= 4; index += 1) {
    xref += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  body += xref;
  body += `trailer<< /Size 5 /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function encryptedPdf(): Uint8Array {
  const hello = helloPdf();
  // Inject a trailer /Encrypt name. The adapter refuses before asking the
  // library for a password, which is the fail-closed reading of ADR-0050 §5.
  const source = Buffer.from(hello).toString('latin1');
  const patched = source.replace(
    'trailer<< /Size 6 /Root 1 0 R >>',
    'trailer<< /Size 6 /Root 1 0 R /Encrypt 6 0 R >>',
  );
  return Buffer.from(patched, 'latin1');
}

describe('evidence v2 pdf extractor', () => {
  const extractor = createEvidenceV2PdfExtractor();

  it('extracts the same canonical text twice', async () => {
    const bytes = helloPdf('Hello from the source document');
    const first = await extractor.extract(bytes);
    const second = await extractor.extract(bytes);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.text).toContain('Hello');
    expect(first.value.text).toBe(second.value.text);
    expect(first.value.pageCount).toBe(1);
    expect(first.value.extractionMethod).toBe('pdfjs-dist/6.2.108');
    expect(first.value.extractionRuleVersion).toBe('pdfjs-text/1');
    expect(first.value.text.includes('\r')).toBe(false);
    expect(first.value.text).toBe(first.value.text.normalize('NFC'));
  });

  it('refuses bytes that are not a PDF', async () => {
    const result = await extractor.extract(Buffer.from('not a pdf'));
    expect(result).toEqual({ ok: false, code: 'EVIDENCE_V2_PDF_NOT_PDF' });
  });

  it('refuses an encrypted PDF', async () => {
    const result = await extractor.extract(encryptedPdf());
    expect(result).toEqual({ ok: false, code: 'EVIDENCE_V2_PDF_ENCRYPTED' });
  });

  it('refuses an image-only page as empty text', async () => {
    const result = await extractor.extract(emptyPagePdf());
    expect(result).toEqual({ ok: false, code: 'EVIDENCE_V2_PDF_EMPTY_TEXT' });
  });

  it('yields the same canonical SHA-256 in two separate processes', () => {
    const child = fileURLToPath(
      new URL('./hash-canonical.mjs', import.meta.url),
    );
    const run = () =>
      spawnSync(process.execPath, ['--experimental-strip-types', child], {
        encoding: 'utf8',
      });
    const first = run();
    const second = run();
    expect(first.stderr).toBe('');
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout.trim()).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.stdout).toBe(second.stdout);
  });

  it('refuses an oversized file before opening it', async () => {
    const bounded = createEvidenceV2PdfExtractor({ maxBytes: 32 });
    const huge = Buffer.alloc(33, 0x20);
    Buffer.from('%PDF-').copy(huge);
    const result = await bounded.extract(huge);
    expect(result).toEqual({ ok: false, code: 'EVIDENCE_V2_PDF_OVERSIZE' });
  });
});
