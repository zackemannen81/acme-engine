import { canonicalJson, sha256 } from '@acme/core';
import {
  canonicalizeEvidenceText,
  deriveEvidenceArtifactVersionId,
  deriveEvidenceContentHash,
  evidenceLineCount,
  EvidenceArtifactKindSchema,
  SourceArtifactVersionSchema,
  type SourceArtifactVersion,
} from '@acme/module-evidence';
import { z } from 'zod';

const NonBlank = z.string().trim().min(1);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const IsoTimestamp = z.iso.datetime({ offset: true });

export const EVIDENCE_SYNTHETIC_TEXT_DATA_CLASS =
  'synthetic-utf8-plain-text/1' as const;
export const EVIDENCE_SYNTHETIC_ATTESTATION_VERSION =
  'evidence-synthetic-attestation/1' as const;
export const EVIDENCE_TEXT_IMPORT_MAX_BYTES = 2_097_152;
export const EVIDENCE_TEXT_IMPORT_MAX_LINES = 20_000;
export const EVIDENCE_TEXT_IMPORT_MAX_LINE_SCALARS = 16_384;
export const EVIDENCE_REDACTION_REPLACEMENT_VERSION =
  'evidence-redaction-token/1' as const;
export const EVIDENCE_REDACTION_TRANSFORMATION_VERSION =
  'evidence-redaction-transform/1' as const;

export const EvidenceTextImportMetadataSchema = z
  .object({
    schemaVersion: z.literal('evidence-text-import-metadata/1'),
    commandKey: NonBlank,
    intent: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('create') }).strict(),
      z
        .object({
          kind: z.literal('new-version'),
          logicalArtifactId: NonBlank,
          predecessorVersionId: NonBlank,
          correctionReason: z.literal('transcription-correction'),
          expectedArtifactRevision: z.number().int().nonnegative(),
        })
        .strict(),
    ]),
    title: NonBlank.max(500),
    artifactKind: EvidenceArtifactKindSchema,
    declaredMediaType: z
      .string()
      .regex(/^text\/plain(?:\s*;\s*charset=utf-8)?$/iu),
    dataClass: z.literal(EVIDENCE_SYNTHETIC_TEXT_DATA_CLASS),
    attestationVersion: z.literal(EVIDENCE_SYNTHETIC_ATTESTATION_VERSION),
    syntheticAuthorityAttested: z.literal(true),
  })
  .strict();

export const EvidenceTextImportRecordSchema = z
  .object({
    schemaVersion: z.literal('evidence-text-import-record/1'),
    importId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    logicalArtifactId: NonBlank,
    artifactVersionId: NonBlank,
    commandKey: NonBlank,
    commandDigest: Sha256,
    dataClass: z.literal(EVIDENCE_SYNTHETIC_TEXT_DATA_CLASS),
    attestationVersion: z.literal(EVIDENCE_SYNTHETIC_ATTESTATION_VERSION),
    originalRepresentationId: NonBlank,
    canonicalRepresentationId: NonBlank,
    originalSha256: Sha256,
    canonicalSha256: Sha256,
    originalByteLength: z.number().int().positive(),
    canonicalByteLength: z.number().int().positive(),
    principalRef: NonBlank,
    policyVersion: NonBlank,
    state: z.enum([
      'queued',
      'validating',
      'staging',
      'activated',
      'cancelled',
      'refused',
    ]),
    reasonCode: NonBlank.nullable(),
    createdAt: IsoTimestamp,
    updatedAt: IsoTimestamp,
  })
  .strict();

export const EvidenceRedactionReasonSchema = z.enum([
  'personal-data',
  'sensitive-data',
  'privileged',
  'security',
  'other',
]);

export const EvidenceRedactionOperationSchema = z
  .object({
    schemaVersion: z.literal('evidence-redaction-operation/1'),
    operationId: NonBlank,
    ordinal: z.number().int().positive(),
    startByte: z.number().int().nonnegative(),
    endByte: z.number().int().positive(),
    removedBytesSha256: Sha256,
    reasonCode: EvidenceRedactionReasonSchema,
    rationale: NonBlank.nullable(),
    replacementVersion: z.literal(EVIDENCE_REDACTION_REPLACEMENT_VERSION),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endByte <= value.startByte) {
      context.addIssue({
        code: 'custom',
        path: ['endByte'],
        message: 'Redaction interval must be non-empty.',
      });
    }
    if ((value.reasonCode === 'other') !== (value.rationale !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['rationale'],
        message: 'Only reason other requires a rationale.',
      });
    }
  });

export const EvidenceRedactionDraftSchema = z
  .object({
    schemaVersion: z.literal('evidence-redaction-draft/1'),
    draftId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    predecessorRepresentationId: NonBlank,
    expectedRepresentationRevision: z.number().int().nonnegative(),
    policyReference: NonBlank,
    operations: z.array(EvidenceRedactionOperationSchema).min(1),
    authorPrincipalRef: NonBlank,
    state: z.enum(['draft', 'applied', 'expired']),
    revision: z.number().int().nonnegative(),
    createdAt: IsoTimestamp,
    updatedAt: IsoTimestamp,
  })
  .strict();

export const EvidenceRedactionLogSchema = z
  .object({
    schemaVersion: z.literal('evidence-redaction-log/1'),
    redactionLogId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    draftId: NonBlank,
    commandKey: NonBlank,
    predecessorRepresentationId: NonBlank,
    derivedRepresentationId: NonBlank,
    predecessorArtifactVersionId: NonBlank,
    derivedArtifactVersionId: NonBlank,
    predecessorSha256: Sha256,
    resultSha256: Sha256,
    operations: z.array(EvidenceRedactionOperationSchema).min(1),
    transformationVersion: z.literal(EVIDENCE_REDACTION_TRANSFORMATION_VERSION),
    principalRef: NonBlank,
    policyVersion: NonBlank,
    appliedAt: IsoTimestamp,
  })
  .strict();

export class EvidenceTextImportRefusal extends Error {
  constructor(readonly reasonCode: string) {
    super(reasonCode);
    this.name = 'EvidenceTextImportRefusal';
  }
}

function refuse(reasonCode: string): never {
  throw new EvidenceTextImportRefusal(reasonCode);
}

function hasBinarySignature(bytes: Uint8Array): boolean {
  const signatures = [
    [0x25, 0x50, 0x44, 0x46],
    [0x50, 0x4b, 0x03, 0x04],
    [0x1f, 0x8b],
    [0x89, 0x50, 0x4e, 0x47],
    [0x7f, 0x45, 0x4c, 0x46],
    [0x4d, 0x5a],
  ];
  return signatures.some((signature) =>
    signature.every((value, index) => bytes[index] === value),
  );
}

function assertControls(text: string): void {
  for (const scalar of text) {
    const code = scalar.codePointAt(0) as number;
    if (
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0x7f && code <= 0x9f)
    ) {
      refuse('TEXT_CONTROL_REFUSED');
    }
  }
}

export interface ValidatedEvidenceTextImport {
  readonly originalBytes: Uint8Array;
  readonly originalSha256: string;
  readonly canonicalText: string;
  readonly canonicalBytes: Uint8Array;
  readonly canonicalSha256: string;
  readonly lineCount: number;
}

export function validateEvidenceTextImport(
  input: Uint8Array,
  declaredMediaType: string,
): ValidatedEvidenceTextImport {
  if (!/^text\/plain(?:\s*;\s*charset=utf-8)?$/iu.test(declaredMediaType))
    refuse('MEDIA_TYPE_REFUSED');
  if (input.byteLength < 1) refuse('TEXT_EMPTY');
  if (input.byteLength > EVIDENCE_TEXT_IMPORT_MAX_BYTES)
    refuse('TEXT_TOO_LARGE');
  if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf)
    refuse('UTF8_BOM_REFUSED');
  if (hasBinarySignature(input)) refuse('BINARY_SIGNATURE_REFUSED');
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    refuse('UTF8_INVALID');
  }
  assertControls(decoded);
  const canonicalText = canonicalizeEvidenceText(decoded);
  const lines = canonicalText.endsWith('\n')
    ? canonicalText.slice(0, -1).split('\n')
    : canonicalText.split('\n');
  if (lines.length > EVIDENCE_TEXT_IMPORT_MAX_LINES)
    refuse('TEXT_TOO_MANY_LINES');
  if (
    lines.some(
      (line) => [...line].length > EVIDENCE_TEXT_IMPORT_MAX_LINE_SCALARS,
    )
  )
    refuse('TEXT_LINE_TOO_LONG');
  const canonicalBytes = new TextEncoder().encode(canonicalText);
  if (canonicalBytes.byteLength > EVIDENCE_TEXT_IMPORT_MAX_BYTES)
    refuse('CANONICAL_TEXT_TOO_LARGE');
  return Object.freeze({
    originalBytes: new Uint8Array(input),
    originalSha256: sha256(input),
    canonicalText,
    canonicalBytes,
    canonicalSha256: sha256(canonicalBytes),
    lineCount: evidenceLineCount(canonicalText),
  });
}

function utf8Boundaries(bytes: Uint8Array): Set<number> {
  const boundaries = new Set<number>([0, bytes.byteLength]);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index] ?? 0;
    if ((byte & 0xc0) !== 0x80) boundaries.add(index);
  }
  return boundaries;
}

export function applyEvidenceRedactions(
  predecessor: Uint8Array,
  operationsInput: readonly EvidenceRedactionOperation[],
): Uint8Array {
  let predecessorText: string;
  try {
    predecessorText = new TextDecoder('utf-8', { fatal: true }).decode(
      predecessor,
    );
  } catch {
    throw new TypeError('Redaction predecessor must be valid UTF-8.');
  }
  if (canonicalizeEvidenceText(predecessorText) !== predecessorText)
    throw new TypeError('Redaction predecessor must be canonical text.');
  const operations = operationsInput.map((operation) =>
    EvidenceRedactionOperationSchema.parse(operation),
  );
  const boundaries = utf8Boundaries(predecessor);
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index] as EvidenceRedactionOperation;
    if (operation.ordinal !== index + 1)
      throw new TypeError('Redaction ordinals must be contiguous and sorted.');
    if (
      index > 0 &&
      operation.startByte <
        (operations[index - 1] as EvidenceRedactionOperation).endByte
    )
      throw new TypeError('Redaction intervals overlap or are unsorted.');
    if (
      operation.endByte > predecessor.byteLength ||
      !boundaries.has(operation.startByte) ||
      !boundaries.has(operation.endByte)
    )
      throw new TypeError(
        'Redaction interval is outside UTF-8 scalar boundaries.',
      );
    const removed = predecessor.slice(operation.startByte, operation.endByte);
    if (removed.includes(0x0a))
      throw new TypeError('Redaction intervals cannot contain LF.');
    if (sha256(removed) !== operation.removedBytesSha256)
      throw new TypeError('Redaction removed-byte digest mismatch.');
  }
  let output = new Uint8Array(predecessor);
  for (const operation of [...operations].reverse()) {
    const replacement = new TextEncoder().encode(
      `[REDACTED:${operation.reasonCode}]`,
    );
    const next = new Uint8Array(
      operation.startByte +
        replacement.byteLength +
        output.byteLength -
        operation.endByte,
    );
    next.set(output.slice(0, operation.startByte), 0);
    next.set(replacement, operation.startByte);
    next.set(
      output.slice(operation.endByte),
      operation.startByte + replacement.byteLength,
    );
    output = next;
  }
  validateEvidenceTextImport(output, 'text/plain; charset=utf-8');
  return output;
}

export function deriveEvidenceRepresentationId(input: {
  readonly caseId: string;
  readonly artifactVersionId: string;
  readonly kind: 'original' | 'canonical-text' | 'redacted-text';
  readonly plaintextSha256: string;
}): string {
  return `evidence_representation_${sha256(canonicalJson({ algorithm: 'evidence-representation-id/1', ...input }))}`;
}

export function buildImportedSourceArtifactVersion(input: {
  readonly workspaceId: string;
  readonly logicalArtifactId: string;
  readonly versionOrdinal: number;
  readonly kind: z.infer<typeof EvidenceArtifactKindSchema>;
  readonly title: string;
  readonly canonicalText: string;
  readonly predecessorVersionId: string | null;
  readonly correctionReason:
    'transcription-correction' | 'redaction-derivative' | null;
}): SourceArtifactVersion {
  const contentHash = deriveEvidenceContentHash(input.canonicalText);
  return SourceArtifactVersionSchema.parse({
    schemaVersion: 'evidence-source-artifact-version/1',
    corpusId: input.workspaceId,
    logicalArtifactId: input.logicalArtifactId,
    artifactVersionId: deriveEvidenceArtifactVersionId({
      corpusId: input.workspaceId,
      logicalArtifactId: input.logicalArtifactId,
      versionOrdinal: input.versionOrdinal,
      kind: input.kind,
      contentHash,
      locatorScheme: 'line-range-1',
      predecessorVersionId: input.predecessorVersionId,
    }),
    versionOrdinal: input.versionOrdinal,
    kind: input.kind,
    title: input.title,
    contentHash,
    locatorScheme: 'line-range-1',
    lineCount: evidenceLineCount(input.canonicalText),
    predecessorVersionId: input.predecessorVersionId,
    correctionReason: input.correctionReason,
    text: input.canonicalText,
  });
}

export type EvidenceTextImportMetadata = z.infer<
  typeof EvidenceTextImportMetadataSchema
>;
export type EvidenceTextImportRecord = z.infer<
  typeof EvidenceTextImportRecordSchema
>;
export type EvidenceRedactionReason = z.infer<
  typeof EvidenceRedactionReasonSchema
>;
export type EvidenceRedactionOperation = z.infer<
  typeof EvidenceRedactionOperationSchema
>;
export type EvidenceRedactionDraft = z.infer<
  typeof EvidenceRedactionDraftSchema
>;
export type EvidenceRedactionLog = z.infer<typeof EvidenceRedactionLogSchema>;
