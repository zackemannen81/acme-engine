import { createHash } from 'node:crypto';

import { createEvidenceV2PdfExtractor } from '../src/index.ts';

const text = 'Hello from the source document';
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
let xref = 'xref\n0 6\n0000000000 65535 f \n';
for (let index = 1; index <= 5; index += 1) {
  xref += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
}
body += `${xref}trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;
const result = await createEvidenceV2PdfExtractor().extract(
  Buffer.from(body, 'latin1'),
);
if (!result.ok) {
  process.stderr.write(result.code);
  process.exit(1);
}
process.stdout.write(
  createHash('sha256').update(result.value.text, 'utf8').digest('hex'),
);
