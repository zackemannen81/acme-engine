import type {
  EvidenceActorReference,
  EvidenceObservation,
  SourceArtifactVersion,
} from './schemas.js';

export class EvidenceCorrectionPairingError extends Error {
  constructor(
    readonly code:
      | 'EVIDENCE_CORRECTION_LINEAGE_INVALID'
      | 'EVIDENCE_CORRECTION_PAIR_MISSING'
      | 'EVIDENCE_CORRECTION_PAIR_AMBIGUOUS'
      | 'EVIDENCE_CORRECTION_PAIR_INCOMPLETE',
    message: string,
  ) {
    super(message);
    this.name = 'EvidenceCorrectionPairingError';
  }
}

function sourceActor(
  value: EvidenceObservation,
): EvidenceActorReference | null {
  return value.kind === 'statement-occurrence'
    ? value.actorReference
    : value.sourceActorReference;
}

export function evidenceCorrectionOccurrenceKey(
  value: EvidenceObservation,
): string {
  const actor = sourceActor(value);
  const temporal = value.temporalBound;
  return [
    value.kind,
    value.locator.startLine,
    value.locator.endLine,
    actor?.sourceLabel ?? '',
    actor?.sourceRole ?? '',
    temporal?.kind ?? '',
    temporal?.role ?? '',
  ].join('\u0000');
}

export interface EvidenceCorrectionPair {
  readonly predecessor: EvidenceObservation;
  readonly successor: EvidenceObservation;
}

export function pairEvidenceCorrectionObservations(input: {
  readonly predecessorSource: SourceArtifactVersion;
  readonly successorSource: SourceArtifactVersion;
  readonly predecessorObservations: readonly EvidenceObservation[];
  readonly successorObservations: readonly EvidenceObservation[];
}): readonly EvidenceCorrectionPair[] {
  const {
    predecessorSource,
    successorSource,
    predecessorObservations,
    successorObservations,
  } = input;
  if (
    successorSource.predecessorVersionId !==
      predecessorSource.artifactVersionId ||
    successorSource.logicalArtifactId !== predecessorSource.logicalArtifactId ||
    successorSource.correctionReason !== 'transcription-correction' ||
    predecessorSource.versionOrdinal >= successorSource.versionOrdinal
  ) {
    throw new EvidenceCorrectionPairingError(
      'EVIDENCE_CORRECTION_LINEAGE_INVALID',
      'Correction pairing requires an explicit adjacent predecessor of the same logical artifact.',
    );
  }
  if (
    predecessorObservations.some(
      ({ artifactVersionId }) =>
        artifactVersionId !== predecessorSource.artifactVersionId,
    ) ||
    successorObservations.some(
      ({ artifactVersionId }) =>
        artifactVersionId !== successorSource.artifactVersionId,
    )
  ) {
    throw new EvidenceCorrectionPairingError(
      'EVIDENCE_CORRECTION_LINEAGE_INVALID',
      'Correction pairing received an observation from outside the declared source versions.',
    );
  }

  const used = new Set<string>();
  const pairs = successorObservations.map((successor) => {
    const key = evidenceCorrectionOccurrenceKey(successor);
    const matches = predecessorObservations.filter(
      (candidate) => evidenceCorrectionOccurrenceKey(candidate) === key,
    );
    if (matches.length !== 1) {
      throw new EvidenceCorrectionPairingError(
        matches.length === 0
          ? 'EVIDENCE_CORRECTION_PAIR_MISSING'
          : 'EVIDENCE_CORRECTION_PAIR_AMBIGUOUS',
        'Each corrected observation must match exactly one predecessor occurrence by kind, line range, actor role and temporal shape.',
      );
    }
    const predecessor = matches[0];
    if (predecessor === undefined || used.has(predecessor.observationId)) {
      throw new EvidenceCorrectionPairingError(
        'EVIDENCE_CORRECTION_PAIR_AMBIGUOUS',
        'A predecessor occurrence cannot be paired to multiple successors.',
      );
    }
    used.add(predecessor.observationId);
    return { predecessor, successor };
  });
  if (
    pairs.length !== predecessorObservations.length ||
    pairs.length !== successorObservations.length
  ) {
    throw new EvidenceCorrectionPairingError(
      'EVIDENCE_CORRECTION_PAIR_INCOMPLETE',
      'A corrected source version must pair every predecessor and successor occurrence exactly once.',
    );
  }
  return Object.freeze(
    pairs.sort((left, right) =>
      left.predecessor.observationId.localeCompare(
        right.predecessor.observationId,
      ),
    ),
  );
}
