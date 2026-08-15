import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
  EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
  buildEvidenceSourceSegments,
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactOutputSchema,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
} from '@acme/module-evidence';

import { loadSourceArtifactVersion } from './corpus.js';

export const EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH =
  '92998d1fd1c9463218320845fa27bce2f82af957b19ecbb6e1a0aa8053b3cf12' as const;

export function developmentObserveArtifactInput(): EvidenceObserveArtifactInput {
  return EvidenceObserveArtifactInputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
    artifactVersion: loadSourceArtifactVersion('DEV-T01', 1),
    actorRoster: [
      {
        actorKey: 'development-actor-nera-sol',
        allowedSourceLabels: ['Nera Sol'],
      },
    ],
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
  });
}

export const EVIDENCE_DEVELOPMENT_OBSERVE_METRIC_TARGETS = Object.freeze({
  exactQuoteBinding: { passed: 2, total: 2 },
  actorResolution: { passed: 2, total: 2 },
  temporalNormalization: { passed: 2, total: 2 },
});
