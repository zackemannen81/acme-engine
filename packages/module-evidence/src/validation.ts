import type { DomainIssue } from '@acme/core';

import {
  evidenceLineCount,
  exactQuoteOccurrenceCount,
} from './canonical-text.js';
import {
  deriveEvidenceActorReferenceKey,
  deriveEvidenceArtifactVersionId,
  deriveEvidenceContentHash,
  deriveEvidenceLocatorId,
  deriveEvidenceObservationId,
  evidenceArtifactIdentityInput,
} from './identity.js';
import { immutableEvidence } from './immutable.js';
import {
  EvidenceObservationSchema,
  SourceArtifactVersionSchema,
  type EvidenceActorReference,
  type EvidenceObservation,
  type SourceArtifactVersion,
} from './schemas.js';

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): DomainIssue {
  return immutableEvidence({ code, path, message });
}

function actorReferenceOf(
  observation: EvidenceObservation,
): EvidenceActorReference | null {
  return observation.kind === 'statement-occurrence'
    ? observation.actorReference
    : observation.sourceActorReference;
}

export function evidenceSourceArtifactInvariants(
  source: SourceArtifactVersion,
): readonly DomainIssue[] {
  const parsed = SourceArtifactVersionSchema.safeParse(source);
  if (!parsed.success) {
    return immutableEvidence([
      issue(
        'EVIDENCE_SOURCE_SCHEMA',
        [],
        'Source artifact version schema validation failed.',
      ),
    ]);
  }
  const issues: DomainIssue[] = [];
  if (source.contentHash !== deriveEvidenceContentHash(source.text)) {
    issues.push(
      issue(
        'EVIDENCE_SOURCE_CONTENT_HASH',
        ['contentHash'],
        'Source content hash does not match canonical bytes.',
      ),
    );
  }
  if (
    source.artifactVersionId !==
    deriveEvidenceArtifactVersionId(evidenceArtifactIdentityInput(source))
  ) {
    issues.push(
      issue(
        'EVIDENCE_ARTIFACT_VERSION_ID',
        ['artifactVersionId'],
        'Source identity does not match evidence-artifact-version-id-1.',
      ),
    );
  }
  if (source.lineCount !== evidenceLineCount(source.text)) {
    issues.push(
      issue(
        'EVIDENCE_SOURCE_LINE_COUNT',
        ['lineCount'],
        'Source line count does not match canonical text.',
      ),
    );
  }
  return immutableEvidence(issues);
}

export function evidenceObservationInvariants(
  observation: EvidenceObservation,
  source: SourceArtifactVersion,
): readonly DomainIssue[] {
  const parsedObservation = EvidenceObservationSchema.safeParse(observation);
  const sourceIssues = evidenceSourceArtifactInvariants(source);
  if (!parsedObservation.success) {
    return immutableEvidence([
      ...sourceIssues,
      issue(
        'EVIDENCE_OBSERVATION_SCHEMA',
        [],
        'Evidence observation schema validation failed.',
      ),
    ]);
  }
  const value = parsedObservation.data;
  const issues: DomainIssue[] = [...sourceIssues];
  if (value.artifactVersionId !== source.artifactVersionId) {
    issues.push(
      issue(
        'EVIDENCE_OBSERVATION_SOURCE_VERSION',
        ['artifactVersionId'],
        'Observation must bind to the supplied artifact version.',
      ),
    );
  }
  if (
    value.locator.artifactVersionId !== source.artifactVersionId ||
    value.locator.endLine > source.lineCount
  ) {
    issues.push(
      issue(
        'EVIDENCE_LOCATOR_BOUNDS',
        ['locator'],
        'Observation locator must address the supplied source version.',
      ),
    );
  }
  const expectedLocatorId = deriveEvidenceLocatorId({
    artifactVersionId: value.locator.artifactVersionId,
    startLine: value.locator.startLine,
    endLine: value.locator.endLine,
  });
  if (value.locator.locatorId !== expectedLocatorId) {
    issues.push(
      issue(
        'EVIDENCE_LOCATOR_ID',
        ['locator', 'locatorId'],
        'Locator identity does not match evidence-locator-id-1.',
      ),
    );
  }
  if (
    exactQuoteOccurrenceCount(
      source.text,
      value.locator.startLine,
      value.locator.endLine,
      value.exactQuote,
    ) !== 1
  ) {
    issues.push(
      issue(
        'EVIDENCE_QUOTE_BINDING_FAILED',
        ['exactQuote'],
        'Exact quote must occur exactly once inside the addressed line range.',
      ),
    );
  }

  const actor = actorReferenceOf(value);
  if (actor !== null) {
    if (
      actor.artifactVersionId !== source.artifactVersionId ||
      actor.locatorId !== value.locator.locatorId
    ) {
      issues.push(
        issue(
          'EVIDENCE_ACTOR_REFERENCE_PROVENANCE',
          ['actorReference'],
          'Actor reference must share observation source provenance.',
        ),
      );
    }
    const expectedActorKey = deriveEvidenceActorReferenceKey(actor);
    if (actor.actorReferenceKey !== expectedActorKey) {
      issues.push(
        issue(
          'EVIDENCE_ACTOR_REFERENCE_KEY',
          ['actorReference', 'actorReferenceKey'],
          'Actor reference identity does not match evidence-actor-reference-key-1.',
        ),
      );
    }
  }

  if (
    value.temporalBound !== null &&
    (value.temporalBound.artifactVersionId !== source.artifactVersionId ||
      value.temporalBound.locatorId !== value.locator.locatorId)
  ) {
    issues.push(
      issue(
        'EVIDENCE_TEMPORAL_PROVENANCE',
        ['temporalBound'],
        'Temporal bound must share observation source provenance.',
      ),
    );
  }

  const expectedObservationId = deriveEvidenceObservationId({
    kind: value.kind,
    artifactVersionId: value.artifactVersionId,
    locatorId: value.locator.locatorId,
    exactQuote: value.exactQuote,
    sourceActorReference: actor,
    temporalBound: value.temporalBound,
  });
  if (value.observationId !== expectedObservationId) {
    issues.push(
      issue(
        'EVIDENCE_OBSERVATION_ID',
        ['observationId'],
        'Observation identity does not match evidence-observation-id-1.',
      ),
    );
  }

  return immutableEvidence(issues);
}
