import {
  EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION,
  EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactOutputSchema,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
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
  observations: EvidenceObserveArtifactOutput['observations'],
): EvidenceObserveArtifactOutput {
  return EvidenceObserveArtifactOutputSchema.parse({
    schemaVersion: EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION,
    observations,
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
        'e4d7941218c3a163fd22a6a961ecc2091113a29fc70435f599cf4885a88742e2',
      input: input('EVAL-T01', 1),
      output: output([
        {
          kind: 'statement-occurrence',
          startLine: 4,
          endLine: 4,
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
          startLine: 6,
          endLine: 6,
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
        'c073757c4cf9261e162cf8015b993441423a7b99727d82b733dd3f06a0a43225',
      input: input('EVAL-T01', 2),
      output: output([
        {
          kind: 'statement-occurrence',
          startLine: 4,
          endLine: 4,
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
          startLine: 6,
          endLine: 6,
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
        '6b356958e99e82d2b91183d3f875891722fc222e0722425b9986ee8661468457',
      input: input('EVAL-T02', 1),
      output: output([
        {
          kind: 'statement-occurrence',
          startLine: 4,
          endLine: 4,
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
          startLine: 6,
          endLine: 6,
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
        '05f576912eb64bea1880e2c75d25288e6d8b90812763a1688d6dcdc4ce2ea220',
      input: input('EVAL-T03', 1),
      output: output([
        {
          kind: 'statement-occurrence',
          startLine: 4,
          endLine: 4,
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
          startLine: 6,
          endLine: 6,
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
        '9c1ba21f27784f7389e3e29add884bd214be82d9c662c848d54164325f3b9773',
      input: input('EVAL-E01', 1),
      output: output([
        {
          kind: 'exhibit-assertion',
          startLine: 3,
          endLine: 3,
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
          startLine: 3,
          endLine: 3,
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
