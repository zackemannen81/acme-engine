import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_ASSESSMENT_OUTPUT_FORMATS,
  EvidenceAssessmentOutputDocumentSchema,
  buildEvidenceAssessmentOutputDocument,
  renderEvidenceAssessmentOutput,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceAssessmentOutputDocument,
  EvidenceReviewDecision,
} from '@acme/evidence-product-contracts';

import { evaluationObserveCases } from '../src/evaluation-candidates.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';

const WORKSPACE_ID = 'workspace-evaluation';

function acceptance(
  assessmentVersionId: string,
  overrides: Partial<EvidenceReviewDecision> = {},
): EvidenceReviewDecision {
  return {
    schemaVersion: 'evidence-review-decision/1',
    reviewDecisionId: 'review-accept',
    workspaceId: WORKSPACE_ID,
    targetKind: 'assessment',
    targetVersionId: assessmentVersionId,
    action: 'accept',
    reviewerRef: 'local-reviewer',
    principalAssurance: 'unauthenticated-local',
    rationale: 'Every material claim was checked against exact sources.',
    decidedAt: '2026-08-12T00:30:00.000Z',
    commandKey: 'review-accept',
    basisEvidenceRevision: null,
    ...overrides,
  } as EvidenceReviewDecision;
}

function document(
  overrides: {
    readonly newerEvidenceNotice?: string | null;
    readonly reviewDecisions?: readonly EvidenceReviewDecision[];
  } = {},
): EvidenceAssessmentOutputDocument {
  const material = buildGoldenMaterial(loadSealedEvaluationTruth());
  const assessment = material.assessments.get('E-A01');
  if (assessment === undefined) throw new Error('Missing E-A01.');
  return buildEvidenceAssessmentOutputDocument({
    dataPolicy: 'synthetic-only',
    assessment,
    sources: evaluationObserveCases().map(({ input }) => input.artifactVersion),
    observations: [...material.observations.values()],
    reviewDecisions: overrides.reviewDecisions ?? [
      acceptance(assessment.assessmentVersionId),
    ],
    effectiveBasisEvidenceRevision: assessment.basisEvidenceRevision,
    newerEvidenceNotice: overrides.newerEvidenceNotice ?? null,
  });
}

/**
 * A PDF is only readable if every cross-reference offset lands on its object.
 * Asserting the header alone would let a broken xref table pass, so the table
 * is walked here the way a reader walks it.
 */
function assertPdfCrossReferenceTable(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1');
  const startxref = /startxref\s+(\d+)/u.exec(text);
  expect(startxref).not.toBeNull();
  const start = Number(startxref?.[1]);
  expect(text.slice(start, start + 4)).toBe('xref');
  const offsets = [...text.slice(start).matchAll(/^(\d{10}) 00000 n /gmu)].map(
    (match) => Number(match[1]),
  );
  expect(offsets.length).toBeGreaterThan(0);
  for (const [index, offset] of offsets.entries())
    expect(text.slice(offset, offset + 20)).toContain(
      `${String(index + 1)} 0 obj`,
    );
  expect(/\/Size (\d+)/u.exec(text)?.[1]).toBe(String(offsets.length + 1));
  return offsets.length;
}

describe('Evidence Stage 8 assessment output', () => {
  it('resolves every claim reference to an exact source-bound quote', () => {
    const value = document();
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const observations = [...material.observations.values()];

    expect(value.claims.length).toBeGreaterThan(0);
    for (const claim of value.claims) {
      const references = [
        ...claim.support,
        ...claim.conflicts,
        ...claim.qualifications,
      ];
      expect(references.length).toBeGreaterThan(0);
      for (const reference of references) {
        const observation = observations.find(
          (item) =>
            item.artifactVersionId === reference.artifactVersionId &&
            item.locator.locatorId === reference.locatorId,
        );
        expect(observation).toBeDefined();
        expect(reference.exactQuote).toBe(observation?.exactQuote);
        expect(reference.startLine).toBe(observation?.locator.startLine);
        expect(reference.display).toBe(
          `${reference.logicalArtifactId}@v${String(reference.versionOrdinal)}:L${String(reference.startLine)}-L${String(reference.endLine)}`,
        );
      }
    }
    expect(value.reviewStanding).toBe('accepted');
    expect(value.reviewHistory).toHaveLength(1);
  });

  it('refuses an unreviewed assessment and a non-synthetic policy', () => {
    expect(() => document({ reviewDecisions: [] })).toThrow(
      'Only a reviewed shareable assessment may be output.',
    );
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const assessment = material.assessments.get('E-A01');
    if (assessment === undefined) throw new Error('Missing E-A01.');
    expect(() =>
      buildEvidenceAssessmentOutputDocument({
        dataPolicy: 'real-case-data',
        assessment,
        sources: evaluationObserveCases().map(
          ({ input }) => input.artifactVersion,
        ),
        observations: [...material.observations.values()],
        reviewDecisions: [acceptance(assessment.assessmentVersionId)],
        effectiveBasisEvidenceRevision: assessment.basisEvidenceRevision,
        newerEvidenceNotice: null,
      }),
    ).toThrow('refuses non-synthetic data policies');
  });

  it('refuses a citation that resolves to no source-bound observation', () => {
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const assessment = material.assessments.get('E-A01');
    if (assessment === undefined) throw new Error('Missing E-A01.');
    expect(() =>
      buildEvidenceAssessmentOutputDocument({
        dataPolicy: 'synthetic-only',
        assessment,
        sources: evaluationObserveCases().map(
          ({ input }) => input.artifactVersion,
        ),
        observations: [],
        reviewDecisions: [acceptance(assessment.assessmentVersionId)],
        effectiveBasisEvidenceRevision: assessment.basisEvidenceRevision,
        newerEvidenceNotice: null,
      }),
    ).toThrow('resolves to no source-bound observation');
  });

  it('renders every format byte-identically from identical input', () => {
    for (const format of EVIDENCE_ASSESSMENT_OUTPUT_FORMATS) {
      const first = renderEvidenceAssessmentOutput(document(), format);
      const second = renderEvidenceAssessmentOutput(document(), format);
      expect(second.bytes).toEqual(first.bytes);
      expect(second.outputSha256).toBe(first.outputSha256);
      expect(first.bytes.length).toBeGreaterThan(0);
      expect(first.fileName).toBe(
        `assessment-1.${format === 'markdown' ? 'md' : format}`,
      );
    }
  });

  it('gives each format a distinct digest and a well-formed container', () => {
    const outputs = EVIDENCE_ASSESSMENT_OUTPUT_FORMATS.map((format) =>
      renderEvidenceAssessmentOutput(document(), format),
    );
    expect(new Set(outputs.map(({ outputSha256 }) => outputSha256)).size).toBe(
      outputs.length,
    );
    const decode = (format: string) => {
      const output = outputs.find((item) => item.format === format);
      if (output === undefined) throw new Error(`Missing ${format}.`);
      return { output, text: new TextDecoder().decode(output.bytes) };
    };

    const pdf = decode('pdf');
    expect(pdf.text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf.text).toContain('/BaseFont /Courier');
    // No creation date may reach the bytes, or exports stop being comparable.
    expect(pdf.text).not.toContain('/CreationDate');
    expect(pdf.text).not.toContain('/ModDate');
    assertPdfCrossReferenceTable(pdf.output.bytes);

    const docx = decode('docx');
    expect(docx.output.bytes[0]).toBe(0x50);
    expect(docx.output.bytes[1]).toBe(0x4b);
    expect(docx.text).toContain('word/document.xml');
    expect(docx.text).toContain('[Content_Types].xml');

    const markdown = decode('markdown');
    expect(markdown.text).toContain('# Reviewed evidence assessment');
    expect(markdown.text.endsWith('\n')).toBe(true);

    const json = decode('json');
    const parsed = JSON.parse(json.text) as EvidenceAssessmentOutputDocument;
    expect(parsed.schemaVersion).toBe('evidence-assessment-output/1');
    expect(parsed.dataPolicy).toBe('synthetic-only');
  });

  it('carries the same citations into every rendered format', () => {
    const value = document();
    const displays = value.citations.map(({ display }) => display);
    expect(displays.length).toBeGreaterThan(0);
    for (const format of ['markdown', 'docx', 'pdf', 'json'] as const) {
      const text = new TextDecoder().decode(
        renderEvidenceAssessmentOutput(value, format).bytes,
      );
      for (const display of displays) expect(text).toContain(display);
    }
  });

  it('paginates a long document and keeps its cross-reference table valid', () => {
    const base = document();
    const claim = base.claims[0];
    if (claim === undefined) throw new Error('Missing claim.');
    const long = EvidenceAssessmentOutputDocumentSchema.parse({
      ...base,
      claims: Array.from({ length: 40 }, (_, index) => ({
        ...claim,
        claimKey: `${claim.claimKey}-${String(index)}`,
      })),
    });
    const single = renderEvidenceAssessmentOutput(base, 'pdf');
    const paged = renderEvidenceAssessmentOutput(long, 'pdf');
    const singleObjects = assertPdfCrossReferenceTable(single.bytes);
    const pagedObjects = assertPdfCrossReferenceTable(paged.bytes);
    // Three fixed objects, two fonts and two objects per page.
    expect((singleObjects - 5) / 2).toBe(1);
    expect((pagedObjects - 5) / 2).toBeGreaterThan(1);
    expect(renderEvidenceAssessmentOutput(long, 'pdf').bytes).toEqual(
      paged.bytes,
    );
  });

  it('changes output bytes when the reported document changes', () => {
    const base = renderEvidenceAssessmentOutput(document(), 'pdf');
    const noticed = renderEvidenceAssessmentOutput(
      document({ newerEvidenceNotice: 'Later evidence arrived after review.' }),
      'pdf',
    );
    expect(noticed.outputSha256).not.toBe(base.outputSha256);
  });
});
