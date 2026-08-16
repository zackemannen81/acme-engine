import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V2,
  EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
  buildEvidenceSourceSegments,
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactOutputSchema,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
  type EvidenceObserveArtifactOutputV3,
} from '@acme/module-evidence';

import { loadSourceArtifactVersion } from './corpus.js';

const actorRoster = Object.freeze([
  {
    actorKey: 'evaluation-actor-iva-marn',
    allowedSourceLabels: ['I. Mar', 'Iva Marn'],
  },
  {
    actorKey: 'evaluation-actor-iven-marr',
    allowedSourceLabels: ['I. Mar', 'Iven Marr'],
  },
]);

function inputFromOutput(
  logicalArtifactId: string,
  versionOrdinal: number,
  produced: EvidenceObserveArtifactOutput,
): EvidenceObserveArtifactInput {
  const artifactVersion = loadSourceArtifactVersion(
    logicalArtifactId,
    versionOrdinal,
  );
  return EvidenceObserveArtifactInputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V2,
    artifactVersion,
    actorRoster,
    coverageWindow: {
      sourceSegmentIds: [
        ...new Set(
          produced.observations.map(
            (observation) => observation.sourceSegmentId,
          ),
        ),
      ],
    },
  });
}

function output(
  logicalArtifactId: string,
  versionOrdinal: number,
  observations: EvidenceObserveArtifactOutputV3['observations'],
): EvidenceObserveArtifactOutput {
  const segments = buildEvidenceSourceSegments(
    loadSourceArtifactVersion(logicalArtifactId, versionOrdinal).text,
  );
  return EvidenceObserveArtifactOutputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
    observations: observations.map(({ exactQuote, ...observation }) => {
      const segment = segments.find((item) => item.exactQuote === exactQuote);
      if (segment === undefined)
        throw new Error('Evaluation quote is not one complete source segment.');
      return { ...observation, sourceSegmentId: segment.sourceSegmentId };
    }),
    segmentCoverage: [
      ...new Set(
        observations.map(({ exactQuote }) => {
          const segment = segments.find(
            (item) => item.exactQuote === exactQuote,
          );
          if (segment === undefined)
            throw new Error(
              'Evaluation quote is not one complete source segment.',
            );
          return segment.sourceSegmentId;
        }),
      ),
    ].map((sourceSegmentId) => ({
      sourceSegmentId,
      status: 'observations_extracted' as const,
    })),
  });
}

export interface EvidenceEvaluationObserveCase {
  readonly caseId: string;
  readonly logicalArtifactId: string;
  readonly versionOrdinal: number;
  readonly requestHash: string;
  readonly input: EvidenceObserveArtifactInput;
  readonly output: EvidenceObserveArtifactOutput;
}

export function evaluationObserveCases(): readonly EvidenceEvaluationObserveCase[] {
  return Object.freeze(
    [
      {
        caseId: 'evaluation-observe-eval-t01-v1',
        logicalArtifactId: 'EVAL-T01',
        versionOrdinal: 1,
        requestHash:
          'd76a81d2b72b2221b6cc58607f8daa2e20774a8f35f478669811e23ad48d3d3f',
        output: output('EVAL-T01', 1, [
          {
            kind: 'statement-occurrence',
            exactQuote: 'Iven Marr: I arrived at about 09:18.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iven Marr',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iven-marr',
            },
            temporalBound: {
              kind: 'approximate',
              role: 'claimed-event-time',
              center: '2026-04-18T09:18:00Z',
              toleranceMinutes: 5,
            },
          },
          {
            kind: 'statement-occurrence',
            exactQuote: 'Iven Marr: The panel was open from 09:10 to 09:20.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iven Marr',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iven-marr',
            },
            temporalBound: {
              kind: 'range',
              role: 'claimed-event-time',
              from: '2026-04-18T09:10:00Z',
              to: '2026-04-18T09:20:00Z',
            },
          },
        ]),
      },
      {
        caseId: 'evaluation-observe-eval-t01-v2',
        logicalArtifactId: 'EVAL-T01',
        versionOrdinal: 2,
        requestHash:
          '0c5107e888362a5cefdebe6e9e7f574cb5bfac3e5b0527bf657a86e0fefb1ddc',
        output: output('EVAL-T01', 2, [
          {
            kind: 'statement-occurrence',
            exactQuote: 'Iven Marr: I arrived at about 09:08.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iven Marr',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iven-marr',
            },
            temporalBound: {
              kind: 'approximate',
              role: 'claimed-event-time',
              center: '2026-04-18T09:08:00Z',
              toleranceMinutes: 5,
            },
          },
          {
            kind: 'statement-occurrence',
            exactQuote: 'Iven Marr: The panel was closed from 09:10 to 09:20.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iven Marr',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iven-marr',
            },
            temporalBound: {
              kind: 'range',
              role: 'claimed-event-time',
              from: '2026-04-18T09:10:00Z',
              to: '2026-04-18T09:20:00Z',
            },
          },
        ]),
      },
      {
        caseId: 'evaluation-observe-eval-t02-v1',
        logicalArtifactId: 'EVAL-T02',
        versionOrdinal: 1,
        requestHash:
          'ebf3dda22d7a68e5412916476c008fdbe226b493b389f0366a1598b868041e76',
        output: output('EVAL-T02', 1, [
          {
            kind: 'statement-occurrence',
            exactQuote:
              'Iven Marr: I arrived between 09:20 and 09:30, before the panel changed.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iven Marr',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iven-marr',
            },
            temporalBound: {
              kind: 'range',
              role: 'claimed-event-time',
              from: '2026-04-18T09:20:00Z',
              to: '2026-04-18T09:30:00Z',
            },
          },
          {
            kind: 'statement-occurrence',
            exactQuote:
              'Iven Marr: The panel had been open before I arrived, but I cannot place when.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iven Marr',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iven-marr',
            },
            temporalBound: {
              kind: 'unknown',
              role: 'claimed-event-time',
              reason:
                'The source expressly says the actor cannot place when the panel was open.',
            },
          },
        ]),
      },
      {
        caseId: 'evaluation-observe-eval-t03-v1',
        logicalArtifactId: 'EVAL-T03',
        versionOrdinal: 1,
        requestHash:
          '1254262ec2fe9534facbdebd4ba0e987bbf4aaf32dd4be726dd755315c82a0ee',
        output: output('EVAL-T03', 1, [
          {
            kind: 'statement-occurrence',
            exactQuote:
              'Iva Marn: I saw the panel open at about 09:18, before it changed.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iva Marn',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iva-marn',
            },
            temporalBound: {
              kind: 'approximate',
              role: 'claimed-event-time',
              center: '2026-04-18T09:18:00Z',
              toleranceMinutes: 5,
            },
          },
          {
            kind: 'statement-occurrence',
            exactQuote:
              'Iva Marn: The operator at the control wore a blue service badge.',
            actorReference: {
              status: 'resolved',
              sourceLabel: 'Iva Marn',
              sourceRole: 'speaker',
              actorKey: 'evaluation-actor-iva-marn',
            },
            temporalBound: {
              kind: 'unknown',
              role: 'claimed-event-time',
              reason:
                'The source supplies no time for the operator description.',
            },
          },
        ]),
      },
      {
        caseId: 'evaluation-observe-eval-e01-v1',
        logicalArtifactId: 'EVAL-E01',
        versionOrdinal: 1,
        requestHash:
          '67a7910d866214ea0818a27e7821b6a6ee5c428c6ca84b93c4f6bf66a004e949',
        output: output('EVAL-E01', 1, [
          {
            kind: 'exhibit-assertion',
            exactQuote: '09:16:00 | SC-4 | panel_changed_to_closed | I. Mar',
            sourceActorReference: null,
            temporalBound: {
              kind: 'exact',
              role: 'document-time',
              at: '2026-04-18T09:16:00Z',
            },
          },
          {
            kind: 'exhibit-assertion',
            exactQuote: '09:16:00 | SC-4 | panel_changed_to_closed | I. Mar',
            sourceActorReference: {
              status: 'unresolved',
              sourceLabel: 'I. Mar',
              sourceRole: 'operator-label',
              candidateActorKeys: [
                'evaluation-actor-iva-marn',
                'evaluation-actor-iven-marr',
              ],
            },
            temporalBound: {
              kind: 'exact',
              role: 'document-time',
              at: '2026-04-18T09:16:00Z',
            },
          },
        ]),
      },
    ].map((item) => ({
      ...item,
      input: inputFromOutput(
        item.logicalArtifactId,
        item.versionOrdinal,
        item.output,
      ),
    })),
  );
}
