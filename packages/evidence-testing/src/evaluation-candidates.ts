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
        '5665e813f3d44fba64f3222101443da1e77eaa482f448165ba0a48af1799ae4c',
      input: input('EVAL-T01', 1),
      output: output([
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
        'dd6f7a97c02abc5f968b3f4440651d9fed7a95b0cceb2a431a1c272e456d0f63',
      input: input('EVAL-T01', 2),
      output: output([
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
        '79350e64821d10779483a2995833393b72f8aeea21031bd304296d9cd71462a4',
      input: input('EVAL-T02', 1),
      output: output([
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
        '2afbd5a07abc6342ca21709e220e34b455c04a6b855030c2689f74555c23fcc1',
      input: input('EVAL-T03', 1),
      output: output([
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
        'fc0e6aa8b5bed148b49c7308c25d589be07ba3ed214981d1118637e1ca954fd9',
      input: input('EVAL-E01', 1),
      output: output([
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
