import { sha256 } from '@acme/core';
import {
  EVIDENCE_REDACTION_REPLACEMENT_VERSION,
  applyEvidenceRedactions,
  buildImportedSourceArtifactVersion,
  deriveEvidenceRepresentationId,
  validateEvidenceTextImport,
  type EvidenceRedactionOperation,
} from '@acme/evidence-product-contracts';
import { describe, expect, it } from 'vitest';

const encoder = new TextEncoder();

function operation(
  predecessor: Uint8Array,
  startByte: number,
  endByte: number,
  reasonCode: EvidenceRedactionOperation['reasonCode'] = 'personal-data',
): EvidenceRedactionOperation {
  return {
    schemaVersion: 'evidence-redaction-operation/1',
    operationId: `op-${String(startByte)}`,
    ordinal: 1,
    startByte,
    endByte,
    removedBytesSha256: sha256(predecessor.slice(startByte, endByte)),
    reasonCode,
    rationale: null,
    replacementVersion: EVIDENCE_REDACTION_REPLACEMENT_VERSION,
  };
}

describe('bounded evidence text ingestion', () => {
  it('preserves exact original bytes and pins canonical identity', () => {
    const original = encoder.encode('A\r\ne\u0301\rB\n');
    const result = validateEvidenceTextImport(
      original,
      'text/plain; charset=utf-8',
    );

    expect([...result.originalBytes]).toEqual([...original]);
    expect(result.canonicalText).toBe('A\né\nB\n');
    expect(result.lineCount).toBe(3);
    expect(result.originalSha256).not.toBe(result.canonicalSha256);

    const source = buildImportedSourceArtifactVersion({
      workspaceId: 'workspace-1',
      logicalArtifactId: 'ART-001',
      versionOrdinal: 1,
      kind: 'interview-transcript',
      title: 'Synthetic transcript',
      canonicalText: result.canonicalText,
      predecessorVersionId: null,
      correctionReason: null,
    });
    expect(source.artifactVersionId).toBe(
      'evidence_artifact_412d2fb39753e13e1650efa8e70a9732c71f9e24aa89728c521baf81a3f0ec55',
    );
    expect(
      deriveEvidenceRepresentationId({
        caseId: 'case-1',
        artifactVersionId: source.artifactVersionId,
        kind: 'canonical-text',
        plaintextSha256: result.canonicalSha256,
      }),
    ).toBe(
      'evidence_representation_01eb0abb743252d410575752c9a9ee04b123d6852bb9f4bd9dd085a85790a59e',
    );
  });

  it.each([
    ['UTF8_BOM_REFUSED', new Uint8Array([0xef, 0xbb, 0xbf, 0x61])],
    ['UTF8_INVALID', new Uint8Array([0xc3, 0x28])],
    ['BINARY_SIGNATURE_REFUSED', encoder.encode('%PDF-1.7')],
    ['TEXT_CONTROL_REFUSED', new Uint8Array([0x61, 0, 0x62])],
  ])('refuses %s without echoing content', (reasonCode, bytes) => {
    expect(() => validateEvidenceTextImport(bytes, 'text/plain')).toThrowError(
      expect.objectContaining({ reasonCode }),
    );
  });

  it('enforces exact byte and line boundaries', () => {
    expect(() =>
      validateEvidenceTextImport(
        new Uint8Array(2_097_153).fill(0x61),
        'text/plain',
      ),
    ).toThrowError(expect.objectContaining({ reasonCode: 'TEXT_TOO_LARGE' }));
    expect(() =>
      validateEvidenceTextImport(
        encoder.encode(`${'a'.repeat(16_385)}\n`),
        'text/plain',
      ),
    ).toThrowError(
      expect.objectContaining({ reasonCode: 'TEXT_LINE_TOO_LONG' }),
    );
  });
});

describe('immutable evidence redaction', () => {
  it('applies a pinned UTF-8 byte transform without changing line count', () => {
    const predecessor = encoder.encode('Name: Åsa\nPlace: Rillford\n');
    const start = encoder.encode('Name: ').byteLength;
    const end = encoder.encode('Name: Åsa').byteLength;
    const output = applyEvidenceRedactions(predecessor, [
      operation(predecessor, start, end),
    ]);
    expect(new TextDecoder().decode(output)).toBe(
      'Name: [REDACTED:personal-data]\nPlace: Rillford\n',
    );
  });

  it('refuses scalar splits, newline spans, overlaps, digest mismatch and other without rationale', () => {
    const predecessor = encoder.encode('Åsa\nBertil');
    expect(() =>
      applyEvidenceRedactions(predecessor, [operation(predecessor, 1, 2)]),
    ).toThrow(/scalar boundaries/u);
    expect(() =>
      applyEvidenceRedactions(predecessor, [operation(predecessor, 0, 5)]),
    ).toThrow(/cannot contain LF/u);
    const first = operation(predecessor, 0, 2);
    const second = { ...operation(predecessor, 1, 3), ordinal: 2 };
    expect(() => applyEvidenceRedactions(predecessor, [first, second])).toThrow(
      /overlap/u,
    );
    expect(() =>
      applyEvidenceRedactions(predecessor, [
        { ...first, removedBytesSha256: '0'.repeat(64) },
      ]),
    ).toThrow(/digest mismatch/u);
    expect(() =>
      applyEvidenceRedactions(predecessor, [{ ...first, reasonCode: 'other' }]),
    ).toThrow(/rationale/u);
  });
});
