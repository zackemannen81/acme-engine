import { describe, expect, it } from 'vitest';

import { computeModelRequestHash } from '@acme/core';
import {
  evidenceObserveArtifactContract,
  planEvidenceObservationCoverage,
} from '../../../packages/module-evidence/src/index.js';

import { deriveEvidenceObservationWindowRequestKey } from '../src/live-observation.js';

describe('live observation coverage windows', () => {
  it('gives each window its own request key and a filtered provider payload', () => {
    const text = Array.from(
      { length: 65 },
      (_, index) => `line ${index + 1}`,
    ).join('\n');
    const windows = planEvidenceObservationCoverage(text);
    expect(windows).toHaveLength(2);
    expect(
      deriveEvidenceObservationWindowRequestKey(
        'cmd-1',
        windows[0]?.index ?? 0,
      ),
    ).toBe('live-observe:cmd-1:w00000');
    expect(
      deriveEvidenceObservationWindowRequestKey(
        'cmd-1',
        windows[1]?.index ?? 1,
      ),
    ).toBe('live-observe:cmd-1:w00001');

    const artifact = {
      schemaVersion: 'evidence-source-artifact-version/1' as const,
      artifactVersionId: `evidence_artifact_${'a'.repeat(64)}`,
      corpusId: 'coverage-fixture',
      logicalArtifactId: 'DEV-T01',
      versionOrdinal: 1,
      kind: 'structured-exhibit-text' as const,
      title: 'coverage',
      contentHash: 'b'.repeat(64),
      locatorScheme: 'line-range-1' as const,
      predecessorVersionId: null,
      lineCount: 65,
      correctionReason: null,
      text,
    };
    const first = evidenceObserveArtifactContract.buildRequest(
      {
        schemaVersion: 'evidence-observe-artifact-input/3',
        artifactVersion: artifact,
        actorRoster: [],
        coverageWindow: {
          sourceSegmentIds: [...(windows[0]?.sourceSegmentIds ?? [])],
        },
        sourceStructureId: 'a'.repeat(64),
      },
      { executionId: 'e', now: '2026-08-16T00:00:00.000Z' },
    );
    const second = evidenceObserveArtifactContract.buildRequest(
      {
        schemaVersion: 'evidence-observe-artifact-input/3',
        artifactVersion: artifact,
        actorRoster: [],
        coverageWindow: {
          sourceSegmentIds: [...(windows[1]?.sourceSegmentIds ?? [])],
        },
        sourceStructureId: 'a'.repeat(64),
      },
      { executionId: 'e', now: '2026-08-16T00:00:00.000Z' },
    );
    expect(JSON.stringify(first)).toContain('line-000001-segment-0001');
    expect(JSON.stringify(first)).not.toContain('line-000065-segment-0001');
    expect(JSON.stringify(second)).toContain('line-000065-segment-0001');
    expect(JSON.stringify(second)).not.toContain('line-000001-segment-0001');
    expect(computeModelRequestHash(first)).not.toBe(
      computeModelRequestHash(second),
    );
  });
});
