import { canonicalJson, sha256 } from '@acme/core';
import type {
  EvidenceAssessment,
  EvidenceObservation,
  SourceArtifactVersion,
} from '@acme/module-evidence';
import { z } from 'zod';

import {
  EvidenceAssessmentOutputFormatSchema,
  type EvidenceAssessmentOutputFormat,
} from './export-operation-schemas.js';
import { effectiveReviewDecision, orderedReviewDecisions } from './review.js';
import type { EvidenceReviewDecision } from './schemas.js';
import {
  evidenceTextBytes,
  evidenceZipStore,
  type EvidenceZipEntry,
} from './zip.js';

export const EVIDENCE_ASSESSMENT_OUTPUT_SCHEMA_VERSION =
  'evidence-assessment-output/1' as const;

const NonBlank = z.string().trim().min(1);

const ReferenceSchema = z
  .object({
    evidenceId: NonBlank,
    artifactVersionId: NonBlank,
    logicalArtifactId: NonBlank,
    versionOrdinal: z.number().int().positive(),
    locatorId: NonBlank,
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    exactQuote: NonBlank,
    display: NonBlank,
  })
  .strict();

export const EvidenceAssessmentOutputDocumentSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ASSESSMENT_OUTPUT_SCHEMA_VERSION),
    dataPolicy: z.literal('synthetic-only'),
    assessmentVersionId: NonBlank,
    sequence: z.number().int().positive(),
    contentHash: NonBlank,
    basisEvidenceRevision: z.number().int().nonnegative(),
    effectiveBasisEvidenceRevision: z.number().int().nonnegative(),
    reviewStanding: z.enum(['accepted', 'reaffirmed']),
    newerEvidenceNotice: NonBlank.nullable(),
    claims: z
      .array(
        z
          .object({
            claimKey: NonBlank,
            text: NonBlank,
            uncertainty: NonBlank,
            uncertaintyRationale: NonBlank,
            supportUnresolved: z.boolean(),
            support: z.array(ReferenceSchema),
            conflicts: z.array(ReferenceSchema),
            qualifications: z.array(ReferenceSchema),
          })
          .strict(),
      )
      .min(1),
    openQuestionIds: z.array(NonBlank),
    reviewHistory: z
      .array(
        z
          .object({
            action: NonBlank,
            reviewerRef: NonBlank,
            principalAssurance: NonBlank,
            decidedAt: NonBlank,
            rationale: NonBlank,
          })
          .strict(),
      )
      .min(1),
    citations: z.array(ReferenceSchema).min(1),
  })
  .strict();

export type EvidenceAssessmentOutputDocument = z.infer<
  typeof EvidenceAssessmentOutputDocumentSchema
>;

export interface EvidenceAssessmentOutput {
  readonly schemaVersion: typeof EVIDENCE_ASSESSMENT_OUTPUT_SCHEMA_VERSION;
  readonly format: EvidenceAssessmentOutputFormat;
  readonly mediaType: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly outputSha256: string;
}

/**
 * Resolves one reviewed assessment into a citation-complete document.
 *
 * Every claim reference — support, conflict and qualification alike — must
 * resolve through the assessment's own citation list to exactly one observation
 * at that artifact version and locator. Anything that cannot be resolved that
 * way refuses the whole document rather than rendering an uncited claim.
 */
export function buildEvidenceAssessmentOutputDocument(input: {
  readonly dataPolicy: string;
  readonly assessment: EvidenceAssessment;
  readonly sources: readonly SourceArtifactVersion[];
  readonly observations: readonly EvidenceObservation[];
  readonly reviewDecisions: readonly EvidenceReviewDecision[];
  readonly effectiveBasisEvidenceRevision: number;
  readonly newerEvidenceNotice: string | null;
}): EvidenceAssessmentOutputDocument {
  if (input.dataPolicy !== 'synthetic-only')
    throw new RangeError(
      'Assessment output refuses non-synthetic data policies.',
    );
  const decisions = orderedReviewDecisions(
    input.reviewDecisions.filter(
      (decision) =>
        decision.targetKind === 'assessment' &&
        decision.targetVersionId === input.assessment.assessmentVersionId,
    ),
  );
  const effective = effectiveReviewDecision(
    decisions,
    input.assessment.assessmentVersionId,
  );
  if (effective === null || !['accept', 'reaffirm'].includes(effective.action))
    throw new RangeError('Only a reviewed shareable assessment may be output.');
  const sources = new Map(
    input.sources.map((source) => [source.artifactVersionId, source]),
  );
  const observations = [...input.observations].sort((left, right) =>
    left.observationId.localeCompare(right.observationId),
  );
  const reference = (evidenceId: string) => {
    const citation = input.assessment.citations.find(
      (item) => item.evidenceId === evidenceId,
    );
    if (citation === undefined)
      throw new RangeError(`Missing citation ${evidenceId}.`);
    const source = sources.get(citation.artifactVersionId);
    if (source === undefined)
      throw new RangeError(`Missing source ${citation.artifactVersionId}.`);
    const matches = observations.filter(
      (item) =>
        item.artifactVersionId === citation.artifactVersionId &&
        item.locator.locatorId === citation.locatorId,
    );
    const observation = matches[0];
    if (observation === undefined)
      throw new RangeError(
        `Citation ${evidenceId} resolves to no source-bound observation.`,
      );
    const { startLine, endLine } = observation.locator;
    return ReferenceSchema.parse({
      evidenceId,
      artifactVersionId: citation.artifactVersionId,
      logicalArtifactId: source.logicalArtifactId,
      versionOrdinal: source.versionOrdinal,
      locatorId: citation.locatorId,
      startLine,
      endLine,
      exactQuote: observation.exactQuote,
      display: `${source.logicalArtifactId}@v${String(source.versionOrdinal)}:L${String(startLine)}-L${String(endLine)}`,
    });
  };
  return EvidenceAssessmentOutputDocumentSchema.parse({
    schemaVersion: EVIDENCE_ASSESSMENT_OUTPUT_SCHEMA_VERSION,
    dataPolicy: 'synthetic-only',
    assessmentVersionId: input.assessment.assessmentVersionId,
    sequence: input.assessment.sequence,
    contentHash: input.assessment.contentHash,
    basisEvidenceRevision: input.assessment.basisEvidenceRevision,
    effectiveBasisEvidenceRevision: input.effectiveBasisEvidenceRevision,
    reviewStanding: effective.action === 'accept' ? 'accepted' : 'reaffirmed',
    newerEvidenceNotice: input.newerEvidenceNotice,
    claims: input.assessment.claims.map((claim) => ({
      claimKey: claim.claimKey,
      text: claim.text,
      uncertainty: claim.uncertainty,
      uncertaintyRationale: claim.uncertaintyRationale,
      supportUnresolved: claim.supportUnresolved,
      support: claim.supportObservationIds.map(reference),
      conflicts: claim.conflictRelationIds.map(reference),
      qualifications: claim.qualificationRelationIds.map(reference),
    })),
    openQuestionIds: [...input.assessment.openQuestionIds],
    reviewHistory: decisions.map((decision) => ({
      action: decision.action,
      reviewerRef:
        decision.schemaVersion === 'evidence-review-decision/1'
          ? decision.reviewerRef
          : decision.principalRef,
      principalAssurance: decision.principalAssurance,
      decidedAt: decision.decidedAt,
      rationale: decision.rationale,
    })),
    citations: [...input.assessment.citations]
      .map(({ evidenceId }) => reference(evidenceId))
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  });
}

/**
 * One plain-text projection shared by the paged formats.
 *
 * Markdown, DOCX and PDF all describe the same reviewed assessment, so they are
 * generated from this single block list. Only the encoding differs, which keeps
 * the formats from drifting apart as the document model grows.
 */
type Block =
  | { readonly kind: 'title'; readonly text: string }
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'label'; readonly text: string }
  | { readonly kind: 'bullet'; readonly text: string };

function blocks(document: EvidenceAssessmentOutputDocument): readonly Block[] {
  const result: Block[] = [
    { kind: 'title', text: 'Reviewed evidence assessment' },
    {
      kind: 'paragraph',
      text: `Assessment version: ${String(document.sequence)}`,
    },
    {
      kind: 'paragraph',
      text: `Basis evidence revision: ${String(document.basisEvidenceRevision)}`,
    },
    {
      kind: 'paragraph',
      text: `Effective basis evidence revision: ${String(document.effectiveBasisEvidenceRevision)}`,
    },
    { kind: 'paragraph', text: `Review standing: ${document.reviewStanding}` },
    { kind: 'paragraph', text: `Data policy: ${document.dataPolicy}` },
  ];
  if (document.newerEvidenceNotice !== null)
    result.push({
      kind: 'paragraph',
      text: `Newer evidence notice: ${document.newerEvidenceNotice}`,
    });
  for (const claim of document.claims) {
    result.push({ kind: 'heading', text: claim.claimKey });
    result.push({ kind: 'paragraph', text: claim.text });
    result.push({
      kind: 'paragraph',
      text: `Uncertainty: ${claim.uncertainty} — ${claim.uncertaintyRationale}`,
    });
    if (claim.supportUnresolved)
      result.push({ kind: 'paragraph', text: 'Support remains unresolved.' });
    const groups: Array<[string, typeof claim.support]> = [
      ['Support', claim.support],
      ['Conflicts', claim.conflicts],
      ['Qualifications', claim.qualifications],
    ];
    for (const [label, references] of groups) {
      if (references.length === 0) continue;
      result.push({ kind: 'label', text: `${label}:` });
      for (const item of references)
        result.push({
          kind: 'bullet',
          text: `${item.display} — "${item.exactQuote}"`,
        });
    }
  }
  if (document.openQuestionIds.length > 0) {
    result.push({ kind: 'heading', text: 'Open questions' });
    for (const id of document.openQuestionIds)
      result.push({ kind: 'bullet', text: id });
  }
  result.push({ kind: 'heading', text: 'Review history' });
  for (const decision of document.reviewHistory)
    result.push({
      kind: 'bullet',
      text: `${decision.action} · ${decision.reviewerRef} · ${decision.decidedAt} — ${decision.rationale}`,
    });
  return result;
}

export function renderEvidenceAssessmentOutputJson(
  document: EvidenceAssessmentOutputDocument,
): Uint8Array {
  return evidenceTextBytes(`${canonicalJson(document as never)}\n`);
}

export function renderEvidenceAssessmentOutputMarkdown(
  document: EvidenceAssessmentOutputDocument,
): Uint8Array {
  const lines: string[] = [];
  for (const block of blocks(document)) {
    switch (block.kind) {
      case 'title':
        lines.push(`# ${block.text}`, '');
        break;
      case 'heading':
        lines.push(`## ${block.text}`, '');
        break;
      case 'paragraph':
        lines.push(block.text, '');
        break;
      case 'label':
        lines.push(block.text);
        break;
      case 'bullet':
        lines.push(`- ${block.text}`);
        break;
    }
    if (block.kind === 'bullet') lines.push('');
  }
  return evidenceTextBytes(
    `${lines
      .join('\n')
      .replace(/\n{3,}/gu, '\n\n')
      .trimEnd()}\n`,
  );
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * DOCX is OOXML inside the same deterministic ZIP container used by the
 * reviewed bundle. No document properties part is written, which is what keeps
 * a creation timestamp out of the bytes.
 */
export function renderEvidenceAssessmentOutputDocx(
  document: EvidenceAssessmentOutputDocument,
): Uint8Array {
  const paragraph = (block: Block): string => {
    const bold = block.kind === 'title' || block.kind === 'heading';
    const size =
      block.kind === 'title' ? 32 : block.kind === 'heading' ? 26 : 20;
    const indent =
      block.kind === 'bullet' ? '<w:ind w:left="360" w:hanging="180"/>' : '';
    const text = block.kind === 'bullet' ? `• ${block.text}` : block.text;
    return `<w:p><w:pPr>${indent}<w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${String(size)}"/><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
  };
  const body = blocks(document).map(paragraph).join('');
  const entries: EvidenceZipEntry[] = [
    {
      path: '[Content_Types].xml',
      bytes: evidenceTextBytes(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
    },
    {
      path: '_rels/.rels',
      bytes: evidenceTextBytes(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
    },
    {
      path: 'word/_rels/document.xml.rels',
      bytes: evidenceTextBytes(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
      ),
    },
    {
      path: 'word/document.xml',
      bytes: evidenceTextBytes(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,
      ),
    },
  ];
  return evidenceZipStore(entries);
}

const WIN_ANSI_EXTRA = new Map<string, number>([
  ['—', 0x97],
  ['–', 0x96],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['…', 0x85],
  ['·', 0xb7],
  ['•', 0x95],
]);

/** Courier is a base-14 face, so nothing is embedded and widths are exact. */
const PDF_COLUMNS = 92;

function pdfEncode(value: string): string {
  let result = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0x3f;
    const byte =
      code <= 0x7e && code >= 0x20
        ? code
        : (WIN_ANSI_EXTRA.get(character) ?? (code <= 0xff ? code : 0x3f));
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c)
      result += `\\${String.fromCharCode(byte)}`;
    else if (byte < 0x20 || byte > 0x7e)
      result += `\\${byte.toString(8).padStart(3, '0')}`;
    else result += String.fromCharCode(byte);
  }
  return result;
}

function wrap(text: string, columns: number): readonly string[] {
  const words = text.split(/\s+/u).filter((word) => word.length > 0);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) current = word;
    else if (current.length + 1 + word.length <= columns)
      current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
    while (current.length > columns) {
      lines.push(current.slice(0, columns));
      current = current.slice(columns);
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * A minimal deterministic PDF 1.4 writer.
 *
 * There is no `/Info` dictionary, no creation date and no embedded font, so the
 * only inputs to the bytes are the document itself and this layout. Text is
 * Courier at a fixed size, which makes line breaking exact integer arithmetic
 * rather than a font-metric lookup.
 */
export function renderEvidenceAssessmentOutputPdf(
  document: EvidenceAssessmentOutputDocument,
): Uint8Array {
  const lines: Array<{ text: string; bold: boolean }> = [];
  for (const block of blocks(document)) {
    const prefix = block.kind === 'bullet' ? '  - ' : '';
    const bold = block.kind === 'title' || block.kind === 'heading';
    for (const [index, line] of wrap(
      block.text,
      PDF_COLUMNS - prefix.length,
    ).entries())
      lines.push({
        text: `${index === 0 ? prefix : ' '.repeat(prefix.length)}${line}`,
        bold,
      });
    if (block.kind !== 'bullet' && block.kind !== 'label')
      lines.push({ text: '', bold: false });
  }
  const perPage = 60;
  const pages: Array<Array<{ text: string; bold: boolean }>> = [];
  for (let index = 0; index < lines.length; index += perPage)
    pages.push(lines.slice(index, index + perPage));
  if (pages.length === 0) pages.push([]);

  const contents = pages.map((page) => {
    const parts = ['BT', '/F1 9 Tf', '12 TL', '54 738 Td'];
    for (const line of page) {
      parts.push(line.bold ? '/F2 9 Tf' : '/F1 9 Tf');
      parts.push(`(${pdfEncode(line.text)}) Tj`);
      parts.push('T*');
    }
    parts.push('ET');
    return `${parts.join('\n')}\n`;
  });

  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(
    `<< /Type /Pages /Count ${String(pages.length)} /Kids [${pageIds
      .map((id) => `${String(id)} 0 R`)
      .join(' ')}] >>`,
  );
  objects.push(
    `<< /Font << /F1 ${String(4 + pages.length * 2)} 0 R /F2 ${String(5 + pages.length * 2)} 0 R >> >>`,
  );
  for (const [index, content] of contents.entries()) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /Resources 3 0 R /MediaBox [0 0 612 792] /Contents ${String(pageIds[index] === undefined ? 0 : (pageIds[index] as number) + 1)} 0 R >>`,
    );
    objects.push(
      `<< /Length ${String(evidenceTextBytes(content).length)} >>\nstream\n${content}endstream`,
    );
  }
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
  );
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
  );

  const header = '%PDF-1.4\n';
  const parts: string[] = [header];
  const offsets: number[] = [];
  let offset = evidenceTextBytes(header).length;
  for (const [index, body] of objects.entries()) {
    const serialized = `${String(index + 1)} 0 obj\n${body}\nendobj\n`;
    offsets.push(offset);
    parts.push(serialized);
    offset += evidenceTextBytes(serialized).length;
  }
  const xref = [
    `xref\n0 ${String(objects.length + 1)}\n`,
    '0000000000 65535 f \n',
    ...offsets.map(
      (value) => `${value.toString().padStart(10, '0')} 00000 n \n`,
    ),
  ].join('');
  parts.push(xref);
  parts.push(
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(offset)}\n%%EOF\n`,
  );
  return evidenceTextBytes(parts.join(''));
}

const RENDERERS: Record<
  EvidenceAssessmentOutputFormat,
  {
    readonly mediaType: string;
    readonly extension: string;
    readonly render: (document: EvidenceAssessmentOutputDocument) => Uint8Array;
  }
> = {
  json: {
    mediaType: 'application/json',
    extension: 'json',
    render: renderEvidenceAssessmentOutputJson,
  },
  markdown: {
    mediaType: 'text/markdown; charset=utf-8',
    extension: 'md',
    render: renderEvidenceAssessmentOutputMarkdown,
  },
  docx: {
    mediaType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    render: renderEvidenceAssessmentOutputDocx,
  },
  pdf: {
    mediaType: 'application/pdf',
    extension: 'pdf',
    render: renderEvidenceAssessmentOutputPdf,
  },
};

export function renderEvidenceAssessmentOutput(
  document: EvidenceAssessmentOutputDocument,
  format: EvidenceAssessmentOutputFormat,
): EvidenceAssessmentOutput {
  const renderer =
    RENDERERS[EvidenceAssessmentOutputFormatSchema.parse(format)];
  const bytes = renderer.render(
    EvidenceAssessmentOutputDocumentSchema.parse(document),
  );
  return Object.freeze({
    schemaVersion: EVIDENCE_ASSESSMENT_OUTPUT_SCHEMA_VERSION,
    format,
    mediaType: renderer.mediaType,
    fileName: `assessment-${String(document.sequence)}.${renderer.extension}`,
    bytes,
    outputSha256: sha256(bytes),
  });
}
