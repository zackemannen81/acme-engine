import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
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

function input(
  logicalArtifactId: string,
  versionOrdinal: number,
): EvidenceObserveArtifactInput {
  return EvidenceObserveArtifactInputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
    artifactVersion: loadSourceArtifactVersion(
      logicalArtifactId,
      versionOrdinal,
    ),
    actorRoster,
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
  return Object.freeze([
    {
      caseId: 'evaluation-observe-eval-t01-v1',
      logicalArtifactId: 'EVAL-T01',
      versionOrdinal: 1,
      requestHash:
        '6d4ca3215b271e9ce047fa08967d5a90532bebb867d0c70bb1856d274ed29673',
      input: input('EVAL-T01', 1),
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
        '50edfa0ac8c4d786155b94ff25d14474387db3c18cb5bc85401fb3c9d6b7dec6',
      input: input('EVAL-T01', 2),
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
        'd24f3c64d81b4043bd8480b8d8480eb8bbc565d53a8c259cc4f7c599a5d790cb',
      input: input('EVAL-T02', 1),
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
        '979c6345318922f9ac762d7b7a679c94ed21f15e61f9506624dfda9c115562e6',
      input: input('EVAL-T03', 1),
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
            reason: 'The source supplies no time for the operator description.',
          },
        },
      ]),
    },
    {
      caseId: 'evaluation-observe-eval-e01-v1',
      logicalArtifactId: 'EVAL-E01',
      versionOrdinal: 1,
      requestHash:
        '7529b46882e5408d0b7f60f2ba356ebe4db267800fc1eb3cfe8d859b4b4f7cda',
      input: input('EVAL-E01', 1),
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
  ]);
}
