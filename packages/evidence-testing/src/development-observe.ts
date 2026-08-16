import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V2,
  EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
  buildEvidenceSourceSegments,
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactOutputSchema,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
} from '@acme/module-evidence';

import { loadSourceArtifactVersion } from './corpus.js';

export const EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH =
  '83a0ae0b8bdb3e674a1fa40fc28b07376875a1f95e59d15f766cd2f60e19de6f' as const;

export function developmentObserveArtifactInput(): EvidenceObserveArtifactInput {
  const artifactVersion = loadSourceArtifactVersion('DEV-T01', 1);
  const produced = developmentObserveArtifactOutput();
  return EvidenceObserveArtifactInputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V2,
    artifactVersion,
    actorRoster: [
      {
        actorKey: 'development-actor-nera-sol',
        allowedSourceLabels: ['Nera Sol'],
      },
    ],
    coverageWindow: {
      sourceSegmentIds: produced.observations.map(
        (observation) => observation.sourceSegmentId,
      ),
    },
  });
}

export function developmentObserveArtifactOutput(): EvidenceObserveArtifactOutput {
  const source = loadSourceArtifactVersion('DEV-T01', 1);
  const segmentId = (exactQuote: string): string => {
    const segment = buildEvidenceSourceSegments(source.text).find(
      (item) => item.exactQuote === exactQuote,
    );
    if (segment === undefined)
      throw new Error('Development quote is not one complete source segment.');
    return segment.sourceSegmentId;
  };
  return EvidenceObserveArtifactOutputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
    observations: [
      {
        kind: 'statement-occurrence',
        sourceSegmentId: segmentId(
          'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.',
        ),
        actorReference: {
          status: 'resolved',
          sourceLabel: 'Nera Sol',
          sourceRole: 'speaker',
          actorKey: 'development-actor-nera-sol',
        },
        temporalBound: {
          kind: 'range',
          role: 'claimed-event-time',
          from: '2026-03-12T14:00:00Z',
          to: '2026-03-12T14:10:00Z',
        },
      },
      {
        kind: 'statement-occurrence',
        sourceSegmentId: segmentId(
          'Nera Sol: The indicator showed amber while the hatch was open.',
        ),
        actorReference: {
          status: 'resolved',
          sourceLabel: 'Nera Sol',
          sourceRole: 'speaker',
          actorKey: 'development-actor-nera-sol',
        },
        temporalBound: {
          kind: 'unknown',
          role: 'claimed-event-time',
          reason:
            'The statement gives no exact time for the simultaneous indicator and hatch state.',
        },
      },
    ],
    segmentCoverage: [
      {
        sourceSegmentId: segmentId(
          'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.',
        ),
        status: 'observations_extracted',
      },
      {
        sourceSegmentId: segmentId(
          'Nera Sol: The indicator showed amber while the hatch was open.',
        ),
        status: 'observations_extracted',
      },
    ],
  });
}

export const EVIDENCE_DEVELOPMENT_OBSERVE_METRIC_TARGETS = Object.freeze({
  exactQuoteBinding: { passed: 2, total: 2 },
  actorResolution: { passed: 2, total: 2 },
  temporalNormalization: { passed: 2, total: 2 },
});
