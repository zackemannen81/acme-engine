import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_TASK_CATALOGUE,
  EvidenceLocatorSchema,
  EvidenceObserveArtifactInputSchema,
  canonicalizeEvidenceText,
  deriveEvidenceArtifactVersionId,
  deriveEvidenceContentHash,
  deriveEvidenceLocatorId,
} from '../src/index.js';

describe('Evidence schemas and identities', () => {
  it('canonicalizes LF and NFC without trimming source text', () => {
    expect(canonicalizeEvidenceText('A\r\nCafe\u0301 \r\n')).toBe('A\nCafé \n');
    expect(() => canonicalizeEvidenceText('\uFEFFsource')).toThrow(/BOM/u);
  });

  it('derives stable source and locator identities', () => {
    const contentHash = deriveEvidenceContentHash('line one\nline two\n');
    const artifactVersionId = deriveEvidenceArtifactVersionId({
      corpusId: 'rillford-annex-review-1',
      logicalArtifactId: 'SCR-T01',
      versionOrdinal: 1,
      kind: 'interview-transcript',
      contentHash,
      locatorScheme: 'line-range-1',
      predecessorVersionId: null,
    });
    expect(artifactVersionId).toMatch(/^evidence_artifact_[0-9a-f]{64}$/u);
    expect(
      deriveEvidenceLocatorId({
        artifactVersionId,
        startLine: 1,
        endLine: 2,
      }),
    ).toMatch(/^evidence_locator_[0-9a-f]{64}$/u);
  });

  it('keeps public contracts strict and catalogue entries non-executable', () => {
    expect(
      EvidenceLocatorSchema.safeParse({
        schemaVersion: 'evidence-locator/1',
        locatorId: `evidence_locator_${'a'.repeat(64)}`,
        artifactVersionId: `evidence_artifact_${'b'.repeat(64)}`,
        startLine: 2,
        endLine: 1,
      }).success,
    ).toBe(false);
    expect(
      EvidenceObserveArtifactInputSchema.safeParse({
        schemaVersion: 'evidence-observe-artifact-input/1',
        extra: true,
      }).success,
    ).toBe(false);
    expect(EVIDENCE_TASK_CATALOGUE).toHaveLength(4);
    expect(
      EVIDENCE_TASK_CATALOGUE.map(({ id, implemented }) => ({
        id,
        implemented,
      })),
    ).toEqual([
      { id: 'evidence.observe-artifact', implemented: true },
      { id: 'evidence.relate-observations', implemented: true },
      { id: 'evidence.build-timeline', implemented: false },
      { id: 'evidence.propose-assessment', implemented: false },
    ]);
  });
});
