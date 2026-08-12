import { canonicalJson, sha256 } from '@acme/core';
import type {
  EvidenceAssessment,
  EvidenceObservation,
  EvidenceLocator,
  SourceArtifactVersion,
} from '@acme/module-evidence';

import { effectiveReviewDecision, orderedReviewDecisions } from './review.js';
import type { EvidenceReviewDecision } from './schemas.js';

export const EVIDENCE_REVIEWED_ASSESSMENT_EXPORT_SCHEMA_VERSION =
  'evidence-reviewed-assessment-export/1' as const;

export interface EvidenceReviewedAssessmentExport {
  readonly schemaVersion: typeof EVIDENCE_REVIEWED_ASSESSMENT_EXPORT_SCHEMA_VERSION;
  readonly assessmentVersionId: string;
  readonly exportSha256: string;
  readonly bytes: Uint8Array;
  readonly paths: readonly string[];
}

interface ExportFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

const encoder = new TextEncoder();

function textBytes(value: string): Uint8Array {
  return encoder.encode(value.replaceAll('\r\n', '\n').normalize('NFC'));
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(filesValue: readonly ExportFile[]): Uint8Array {
  const files = [...filesValue].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = textBytes(file.path);
    const crc = crc32(file.bytes);
    const local = join([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0x0021),
      u32(crc),
      u32(file.bytes.length),
      u32(file.bytes.length),
      u16(name.length),
      u16(0),
      name,
      file.bytes,
    ]);
    localParts.push(local);
    centralParts.push(
      join([
        u32(0x02014b50),
        u16(0x0314),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0x0021),
        u32(crc),
        u32(file.bytes.length),
        u32(file.bytes.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0x81a40000),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const central = join(centralParts);
  return join([
    ...localParts,
    central,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
}

function sourceLineReference(
  assessment: EvidenceAssessment,
  evidenceId: string,
  sources: ReadonlyMap<string, SourceArtifactVersion>,
  locators: ReadonlyMap<string, EvidenceLocator>,
): string {
  const reference = assessment.citations.find(
    (value) => value.evidenceId === evidenceId,
  );
  if (reference === undefined)
    throw new RangeError(`Missing citation ${evidenceId}.`);
  const source = sources.get(reference.artifactVersionId);
  if (source === undefined)
    throw new RangeError(`Missing source ${reference.artifactVersionId}.`);
  const locator = locators.get(
    `${reference.artifactVersionId}:${reference.locatorId}`,
  );
  if (locator === undefined)
    throw new RangeError(`Missing locator ${reference.locatorId}.`);
  return `[${source.logicalArtifactId}@v${String(source.versionOrdinal)}:L${String(locator.startLine)}-L${String(locator.endLine)}](sources/${source.artifactVersionId}.txt#L${String(locator.startLine)}-L${String(locator.endLine)})`;
}

function assessmentMarkdown(
  assessment: EvidenceAssessment,
  sources: ReadonlyMap<string, SourceArtifactVersion>,
  locators: ReadonlyMap<string, EvidenceLocator>,
): string {
  const lines = [
    '# Reviewed evidence assessment',
    '',
    `Assessment version: ${String(assessment.sequence)}`,
    `Basis evidence revision: ${String(assessment.basisEvidenceRevision)}`,
    '',
  ];
  for (const claim of assessment.claims) {
    lines.push(`## ${claim.claimKey}`, '', claim.text, '');
    lines.push(
      `Uncertainty: ${claim.uncertainty} — ${claim.uncertaintyRationale}`,
      '',
    );
    if (claim.supportUnresolved) lines.push('Support remains unresolved.', '');
    const groups: Array<[string, readonly string[]]> = [
      ['Support', claim.supportObservationIds],
      ['Conflicts', claim.conflictRelationIds],
      ['Qualifications', claim.qualificationRelationIds],
    ];
    for (const [label, ids] of groups) {
      if (ids.length === 0) continue;
      lines.push(`${label}:`);
      for (const id of ids)
        lines.push(
          `- ${sourceLineReference(assessment, id, sources, locators)}`,
        );
      lines.push('');
    }
  }
  if (assessment.openQuestionIds.length > 0) {
    lines.push('## Open questions', '');
    for (const id of assessment.openQuestionIds) lines.push(`- ${id}`);
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n{3,}/gu, '\n\n')}\n`;
}

export function buildEvidenceReviewedAssessmentExport(input: {
  readonly dataPolicy: string;
  readonly assessment: EvidenceAssessment;
  readonly sources: readonly SourceArtifactVersion[];
  readonly observations: readonly EvidenceObservation[];
  readonly reviewDecisions: readonly EvidenceReviewDecision[];
  readonly effectiveBasisEvidenceRevision: number;
  readonly newerEvidenceNotice: unknown | null;
}): EvidenceReviewedAssessmentExport {
  if (input.dataPolicy !== 'synthetic-only')
    throw new RangeError(
      'Reviewed assessment export refuses non-synthetic data policies.',
    );
  const decisions = orderedReviewDecisions(
    input.reviewDecisions.filter(
      (decision) =>
        decision.targetVersionId === input.assessment.assessmentVersionId,
    ),
  );
  const effective = effectiveReviewDecision(
    decisions,
    input.assessment.assessmentVersionId,
  );
  if (effective === null || !['accept', 'reaffirm'].includes(effective.action))
    throw new RangeError(
      'Only a reviewed shareable assessment may be exported.',
    );
  const requiredSourceIds = new Set(
    input.assessment.citations.map(
      ({ artifactVersionId }) => artifactVersionId,
    ),
  );
  const sources = [...input.sources]
    .filter(({ artifactVersionId }) => requiredSourceIds.has(artifactVersionId))
    .sort((left, right) =>
      left.artifactVersionId.localeCompare(right.artifactVersionId),
    );
  if (sources.length !== requiredSourceIds.size)
    throw new RangeError(
      'Every assessment citation must resolve to a source version.',
    );
  const sourceMap = new Map(
    sources.map((source) => [source.artifactVersionId, source]),
  );
  const locators = new Map(
    input.observations.map((observation) => [
      `${observation.artifactVersionId}:${observation.locator.locatorId}`,
      observation.locator,
    ]),
  );
  for (const reference of input.assessment.citations) {
    const source = sourceMap.get(reference.artifactVersionId);
    if (
      source === undefined ||
      !locators.has(`${reference.artifactVersionId}:${reference.locatorId}`)
    )
      throw new RangeError(
        `Assessment citation ${reference.evidenceId} cannot be resolved.`,
      );
  }
  const contentFiles: ExportFile[] = [
    {
      path: 'assessment.json',
      bytes: textBytes(`${canonicalJson(input.assessment as never)}\n`),
    },
    {
      path: 'assessment.md',
      bytes: textBytes(
        assessmentMarkdown(input.assessment, sourceMap, locators),
      ),
    },
    {
      path: 'review-history.json',
      bytes: textBytes(`${canonicalJson(decisions as never)}\n`),
    },
    ...sources.map((source) => ({
      path: `sources/${source.artifactVersionId}.txt`,
      bytes: textBytes(source.text),
    })),
  ];
  const manifest = {
    schemaVersion: EVIDENCE_REVIEWED_ASSESSMENT_EXPORT_SCHEMA_VERSION,
    dataPolicy: 'synthetic-only',
    assessmentVersionId: input.assessment.assessmentVersionId,
    contentHash: input.assessment.contentHash,
    basisEvidenceRevision: input.assessment.basisEvidenceRevision,
    effectiveBasisEvidenceRevision: input.effectiveBasisEvidenceRevision,
    newerEvidenceNotice: input.newerEvidenceNotice,
    citations: input.assessment.citations,
    files: contentFiles.map((file) => ({
      path: file.path,
      sha256: sha256(file.bytes),
    })),
  };
  const files = [
    ...contentFiles,
    {
      path: 'manifest.json',
      bytes: textBytes(`${canonicalJson(manifest as never)}\n`),
    },
  ].sort((left, right) => left.path.localeCompare(right.path));
  const bytes = zipStore(files);
  return Object.freeze({
    schemaVersion: EVIDENCE_REVIEWED_ASSESSMENT_EXPORT_SCHEMA_VERSION,
    assessmentVersionId: input.assessment.assessmentVersionId,
    exportSha256: sha256(bytes),
    bytes,
    paths: Object.freeze(files.map(({ path }) => path)),
  });
}
