import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
  EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactOutputSchema,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
} from '@acme/module-evidence';

import { loadSourceArtifactVersion } from './corpus.js';

export const EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH =
  '0fc52697f3344a4f894a42c987a83d8e4376631032be7da4cdcc137458a51067' as const;

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
  return EvidenceObserveArtifactOutputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
    observations: [
      {
        kind: 'statement-occurrence',
        startLine: 4,
        endLine: 4,
        exactQuote:
          'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.',
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
        startLine: 6,
        endLine: 6,
        exactQuote:
          'Nera Sol: The indicator showed amber while the hatch was open.',
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
