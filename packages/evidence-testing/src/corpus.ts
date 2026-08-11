import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalizeEvidenceText,
  deriveEvidenceArtifactVersionId,
  deriveEvidenceContentHash,
  evidenceArtifactIdentityInput,
  evidenceLineCount,
  evidenceSourceArtifactInvariants,
  exactQuoteOccurrenceCount,
  SourceArtifactVersionSchema,
  type SourceArtifactVersion,
} from '@acme/module-evidence';

import {
  EVIDENCE_CORPUS_ID,
  EvidenceCorpusManifestSchema,
  EvidenceCorpusTruthSchema,
  EvidenceGoldenRunSchema,
  EvidenceIdentityVectorsSchema,
  type CorpusVersion,
  type EvidenceCorpusManifest,
  type EvidenceCorpusPartition,
  type EvidenceCorpusTruth,
  type EvidenceGoldenRun,
  type EvidenceIdentityVectors,
} from './schemas.js';

const CORPUS_ROOT = fileURLToPath(
  new URL('../fixtures/rillford-annex-review-1/', import.meta.url),
);

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function assertSorted(
  actual: readonly string[],
  label: string,
  issues: string[],
): void {
  const expected = [...actual].sort();
  if (actual.some((value, index) => value !== expected[index])) {
    issues.push(`${label} must be sorted.`);
  }
}

function sourcePath(version: CorpusVersion): string {
  if (
    path.isAbsolute(version.contentPath) ||
    version.contentPath.includes('\\') ||
    version.contentPath.split('/').includes('..')
  ) {
    throw new TypeError(`Unsafe corpus content path: ${version.contentPath}`);
  }
  const resolved = path.resolve(CORPUS_ROOT, version.contentPath);
  if (!resolved.startsWith(`${path.resolve(CORPUS_ROOT)}${path.sep}`)) {
    throw new TypeError(
      `Corpus content path escapes its root: ${version.contentPath}`,
    );
  }
  return resolved;
}

export function loadCorpusManifest(): EvidenceCorpusManifest {
  return EvidenceCorpusManifestSchema.parse(
    readJson(path.join(CORPUS_ROOT, 'manifest.json')),
  );
}

export function loadSourceArtifactVersion(
  logicalArtifactId: string,
  versionOrdinal: number,
  manifest = loadCorpusManifest(),
): SourceArtifactVersion {
  const version = manifest.versions.find(
    (candidate) =>
      candidate.logicalArtifactId === logicalArtifactId &&
      candidate.versionOrdinal === versionOrdinal,
  );
  if (version === undefined) {
    throw new RangeError(
      `Unknown corpus source version ${logicalArtifactId} v${String(versionOrdinal)}.`,
    );
  }
  const text = readFileSync(sourcePath(version), 'utf8');
  return SourceArtifactVersionSchema.parse({
    schemaVersion: 'evidence-source-artifact-version/1',
    corpusId: manifest.corpusId,
    logicalArtifactId: version.logicalArtifactId,
    artifactVersionId: version.artifactVersionId,
    versionOrdinal: version.versionOrdinal,
    kind: version.kind,
    title: version.title,
    contentHash: version.contentSha256,
    locatorScheme: version.locatorScheme,
    lineCount: version.lineCount,
    predecessorVersionId: version.predecessorVersionId,
    correctionReason: version.correctionReason,
    text,
  });
}

export function loadTruthForPartition(
  partition: EvidenceCorpusPartition,
): EvidenceCorpusTruth {
  return EvidenceCorpusTruthSchema.parse(
    readJson(path.join(CORPUS_ROOT, partition, 'truth.json')),
  );
}

export function loadGoldenForPartition(
  partition: EvidenceCorpusPartition,
): EvidenceGoldenRun {
  return EvidenceGoldenRunSchema.parse(
    readJson(path.join(CORPUS_ROOT, partition, 'golden.json')),
  );
}

export function loadIdentityVectors(): EvidenceIdentityVectors {
  return EvidenceIdentityVectorsSchema.parse(
    readJson(path.join(CORPUS_ROOT, 'identity-vectors.json')),
  );
}

export function loadScratchTruth(): EvidenceCorpusTruth {
  return loadTruthForPartition('scratch');
}

export function loadDevelopmentTruth(): EvidenceCorpusTruth {
  return loadTruthForPartition('development');
}

export function validateCorpusManifest(
  manifest = loadCorpusManifest(),
): readonly string[] {
  const issues: string[] = [];
  if (manifest.corpusId !== EVIDENCE_CORPUS_ID) {
    issues.push('Manifest corpus id is not the fixed V1 corpus id.');
  }

  const artifactKeys = manifest.artifacts.map(
    ({ logicalArtifactId }) => logicalArtifactId,
  );
  const versionKeys = manifest.versions.map(
    ({ logicalArtifactId, versionOrdinal }) =>
      `${logicalArtifactId}:${String(versionOrdinal).padStart(4, '0')}`,
  );
  assertSorted(artifactKeys, 'Manifest artifacts', issues);
  assertSorted(versionKeys, 'Manifest versions', issues);
  if (
    manifest.partitions.map(({ id }) => id).join(',') !==
    'scratch,development,evaluation'
  ) {
    issues.push(
      'Manifest partitions must be exactly scratch, development and evaluation.',
    );
  }
  if (
    artifactKeys.join(',') !==
    'DEV-E01,DEV-T01,EVAL-E01,EVAL-T01,EVAL-T02,EVAL-T03,SCR-T01'
  ) {
    issues.push(
      'Manifest logical artifact inventory differs from the frozen V1 set.',
    );
  }

  for (const field of ['actorNamespace', 'eventNamespace'] as const) {
    const values = manifest.partitions.map((partition) => partition[field]);
    if (new Set(values).size !== values.length) {
      issues.push(`Partition ${field} values must be pairwise disjoint.`);
    }
  }

  const artifacts = new Map(
    manifest.artifacts.map((artifact) => [
      artifact.logicalArtifactId,
      artifact,
    ]),
  );
  for (const artifact of manifest.artifacts) {
    const ordinals = manifest.versions
      .filter(
        (version) => version.logicalArtifactId === artifact.logicalArtifactId,
      )
      .map(({ versionOrdinal }) => versionOrdinal);
    if (JSON.stringify(ordinals) !== JSON.stringify(artifact.versionOrdinals)) {
      issues.push(
        `${artifact.logicalArtifactId} version inventory differs from its artifact entry.`,
      );
    }
  }

  for (const version of manifest.versions) {
    const artifact = artifacts.get(version.logicalArtifactId);
    if (
      artifact === undefined ||
      artifact.partition !== version.partition ||
      artifact.kind !== version.kind
    ) {
      issues.push(
        `${version.logicalArtifactId} v${String(version.versionOrdinal)} has inconsistent artifact metadata.`,
      );
    }
    let text: string;
    try {
      text = readFileSync(sourcePath(version), 'utf8');
    } catch (error) {
      issues.push(
        `${version.logicalArtifactId} v${String(version.versionOrdinal)} source cannot be loaded: ${String(error)}`,
      );
      continue;
    }
    try {
      if (canonicalizeEvidenceText(text) !== text) {
        issues.push(`${version.contentPath} is not already canonical text.`);
      }
    } catch (error) {
      issues.push(
        `${version.contentPath} is invalid canonical text: ${String(error)}`,
      );
      continue;
    }
    const source = loadSourceArtifactVersion(
      version.logicalArtifactId,
      version.versionOrdinal,
      manifest,
    );
    for (const domainIssue of evidenceSourceArtifactInvariants(source)) {
      issues.push(`${version.contentPath}: ${domainIssue.code}`);
    }
    if (deriveEvidenceContentHash(text) !== version.contentSha256) {
      issues.push(
        `${version.contentPath} content hash differs from its manifest entry.`,
      );
    }
    if (evidenceLineCount(text) !== version.lineCount) {
      issues.push(
        `${version.contentPath} line count differs from its manifest entry.`,
      );
    }
    if (
      deriveEvidenceArtifactVersionId(evidenceArtifactIdentityInput(source)) !==
      version.artifactVersionId
    ) {
      issues.push(`${version.contentPath} artifact version id is invalid.`);
    }
  }

  const corrected = manifest.versions.filter(
    ({ predecessorVersionId }) => predecessorVersionId !== null,
  );
  if (
    corrected.length !== 1 ||
    corrected[0]?.logicalArtifactId !== 'EVAL-T01' ||
    corrected[0].versionOrdinal !== 2 ||
    corrected[0].correctionReason !== 'transcription-correction'
  ) {
    issues.push('Only EVAL-T01 v2 may declare correction lineage.');
  }
  const predecessor = manifest.versions.find(
    ({ artifactVersionId }) =>
      artifactVersionId === corrected[0]?.predecessorVersionId,
  );
  if (
    predecessor?.logicalArtifactId !== 'EVAL-T01' ||
    predecessor.versionOrdinal !== 1
  ) {
    issues.push('EVAL-T01 v2 must point directly to EVAL-T01 v1.');
  }
  return Object.freeze(issues);
}

function validateEvaluationCounts(
  truth: EvidenceCorpusTruth,
  issues: string[],
): void {
  if (truth.observations.length !== 10)
    issues.push('Evaluation requires 10 observations.');
  if (truth.relations.length !== 8)
    issues.push('Evaluation requires 8 relations.');
  if (truth.openQuestions.length !== 3)
    issues.push('Evaluation requires 3 open questions.');
  if (truth.assessments.length !== 2)
    issues.push('Evaluation requires 2 assessments.');
  const expectedTemporal = { exact: 2, range: 3, approximate: 3, unknown: 2 };
  for (const [kind, count] of Object.entries(expectedTemporal)) {
    if (
      truth.observations.filter((item) => item.temporalBound.kind === kind)
        .length !== count
    ) {
      issues.push(
        `Evaluation requires ${String(count)} ${kind} temporal expectations.`,
      );
    }
  }
  if (
    truth.observations.filter(({ kind }) => kind === 'statement-occurrence')
      .length !== 8
  ) {
    issues.push('Evaluation requires 8 statement occurrences.');
  }
  if (
    truth.observations.filter(({ kind }) => kind === 'exhibit-assertion')
      .length !== 2
  ) {
    issues.push('Evaluation requires 2 exhibit assertions.');
  }
  if (
    truth.observations.filter(
      ({ finalStanding }) => finalStanding === 'superseded',
    ).length !== 2
  ) {
    issues.push('Evaluation requires exactly 2 superseded observations.');
  }
  const resolved = truth.actorResolutions.filter(
    ({ resolution }) => resolution.status === 'resolved',
  ).length;
  const unresolved = truth.actorResolutions.filter(
    ({ resolution }) => resolution.status === 'unresolved',
  ).length;
  if (resolved !== 8 || unresolved !== 1) {
    issues.push(
      'Evaluation requires 8 resolved source actors and 1 unresolved actor label.',
    );
  }
  const relationCounts = new Map<string, number>();
  for (const relation of truth.relations) {
    relationCounts.set(
      relation.relationKind,
      (relationCounts.get(relation.relationKind) ?? 0) + 1,
    );
  }
  for (const [kind, count] of [
    ['correction', 2],
    ['contradicts', 3],
    ['qualifies', 1],
    ['scope-mismatch', 1],
    ['unresolved', 1],
  ] as const) {
    if (relationCounts.get(kind) !== count) {
      issues.push(`Evaluation requires ${String(count)} ${kind} relations.`);
    }
  }
}

export function validateCorpusTruth(
  truth: EvidenceCorpusTruth,
  manifest = loadCorpusManifest(),
): readonly string[] {
  const issues: string[] = [];
  assertSorted(
    truth.observations.map(({ truthId }) => truthId),
    'Truth observations',
    issues,
  );
  assertSorted(
    truth.correctionLineage.map(({ truthId }) => truthId),
    'Truth correctionLineage',
    issues,
  );
  assertSorted(
    truth.actorResolutions.map(({ truthId }) => truthId),
    'Truth actorResolutions',
    issues,
  );
  assertSorted(
    truth.relations.map(({ truthId }) => truthId),
    'Truth relations',
    issues,
  );
  assertSorted(
    truth.openQuestions.map(({ truthId }) => truthId),
    'Truth openQuestions',
    issues,
  );
  assertSorted(
    truth.assessments.map(({ truthId }) => truthId),
    'Truth assessments',
    issues,
  );
  assertSorted(
    truth.couplingGroups.map(({ groupId }) => groupId),
    'Truth couplingGroups',
    issues,
  );

  const observationIds = new Set(
    truth.observations.map(({ truthId }) => truthId),
  );
  const relationIds = new Set(truth.relations.map(({ truthId }) => truthId));
  const questionIds = new Set(
    truth.openQuestions.map(({ truthId }) => truthId),
  );
  const assessmentIds = new Set(
    truth.assessments.map(({ truthId }) => truthId),
  );
  const actorResolutionIds = new Set(
    truth.actorResolutions.map(({ truthId }) => truthId),
  );
  const knownTruthIds = new Set([
    ...observationIds,
    ...relationIds,
    ...questionIds,
    ...assessmentIds,
    ...actorResolutionIds,
    ...truth.correctionLineage.map(({ truthId }) => truthId),
  ]);
  const actorKeys = new Set(
    truth.actorResolutions.flatMap(({ resolution }) =>
      resolution.status === 'resolved'
        ? [resolution.actorKey]
        : resolution.candidateActorKeys,
    ),
  );

  for (const observation of truth.observations) {
    const version = manifest.versions.find(
      (candidate) =>
        candidate.logicalArtifactId === observation.logicalArtifactId &&
        candidate.versionOrdinal === observation.versionOrdinal,
    );
    if (version === undefined || version.partition !== truth.partition) {
      issues.push(
        `${observation.truthId} references a source outside its partition.`,
      );
      continue;
    }
    const source = loadSourceArtifactVersion(
      observation.logicalArtifactId,
      observation.versionOrdinal,
      manifest,
    );
    if (
      exactQuoteOccurrenceCount(
        source.text,
        observation.startLine,
        observation.endLine,
        observation.exactQuote,
      ) !== 1
    ) {
      issues.push(
        `${observation.truthId} exact quote does not resolve exactly once.`,
      );
    }
  }

  for (const lineage of truth.correctionLineage) {
    if (
      !observationIds.has(lineage.predecessorObservationTruthId) ||
      !observationIds.has(lineage.successorObservationTruthId)
    ) {
      issues.push(`${lineage.truthId} has a missing correction endpoint.`);
      continue;
    }
    const predecessor = truth.observations.find(
      ({ truthId }) => truthId === lineage.predecessorObservationTruthId,
    );
    const successor = truth.observations.find(
      ({ truthId }) => truthId === lineage.successorObservationTruthId,
    );
    const predecessorVersion = manifest.versions.find(
      (candidate) =>
        candidate.logicalArtifactId === predecessor?.logicalArtifactId &&
        candidate.versionOrdinal === predecessor.versionOrdinal,
    );
    const successorVersion = manifest.versions.find(
      (candidate) =>
        candidate.logicalArtifactId === successor?.logicalArtifactId &&
        candidate.versionOrdinal === successor.versionOrdinal,
    );
    if (
      predecessor?.logicalArtifactId !== successor?.logicalArtifactId ||
      successorVersion?.predecessorVersionId !==
        predecessorVersion?.artifactVersionId
    ) {
      issues.push(
        `${lineage.truthId} is not backed by adjacent source correction lineage.`,
      );
    }
  }
  for (const actor of truth.actorResolutions) {
    if (!observationIds.has(actor.observationTruthId)) {
      issues.push(`${actor.truthId} has a missing observation reference.`);
      continue;
    }
    const observation = truth.observations.find(
      ({ truthId }) => truthId === actor.observationTruthId,
    );
    if (
      observation?.sourceActor === null ||
      observation?.sourceActor.sourceLabel !== actor.sourceLabel ||
      JSON.stringify(observation?.sourceActor.resolution) !==
        JSON.stringify(actor.resolution)
    ) {
      issues.push(
        `${actor.truthId} differs from its source-bound actor expectation.`,
      );
    }
  }
  for (const relation of truth.relations) {
    for (const endpoint of relation.endpoints) {
      if (
        endpoint.kind === 'observation' &&
        !observationIds.has(endpoint.ref)
      ) {
        issues.push(`${relation.truthId} has a missing observation endpoint.`);
      }
      if (endpoint.kind === 'actor' && !actorKeys.has(endpoint.ref)) {
        issues.push(`${relation.truthId} has a missing actor endpoint.`);
      }
    }
    for (const truthId of relation.comparableScope.actorReferenceTruthIds) {
      if (!actorResolutionIds.has(truthId)) {
        issues.push(`${relation.truthId} has a missing actor-scope reference.`);
      }
    }
    for (const truthId of relation.comparableScope
      .temporalObservationTruthIds) {
      if (!observationIds.has(truthId)) {
        issues.push(
          `${relation.truthId} has a missing temporal-scope reference.`,
        );
      }
    }
  }
  for (const question of truth.openQuestions) {
    for (const truthId of question.triggeringTruthIds) {
      if (!observationIds.has(truthId) && !relationIds.has(truthId)) {
        issues.push(`${question.truthId} has a missing trigger ${truthId}.`);
      }
    }
  }
  for (const assessment of truth.assessments) {
    if (
      assessment.predecessorAssessmentTruthId !== null &&
      !assessmentIds.has(assessment.predecessorAssessmentTruthId)
    ) {
      issues.push(
        `${assessment.truthId} has a missing predecessor assessment.`,
      );
    }
    for (const truthId of [
      ...assessment.citationTruthIds,
      ...assessment.openQuestionTruthIds,
      ...assessment.claims.flatMap((claim) => [
        ...claim.supportObservationTruthIds,
        ...claim.conflictRelationTruthIds,
        ...claim.qualificationRelationTruthIds,
      ]),
    ]) {
      if (!knownTruthIds.has(truthId)) {
        issues.push(
          `${assessment.truthId} has a missing evidence reference ${truthId}.`,
        );
      }
    }
  }
  for (const group of truth.couplingGroups) {
    for (const truthId of group.truthIds) {
      if (!knownTruthIds.has(truthId)) {
        issues.push(
          `${group.groupId} has a missing coupled truth id ${truthId}.`,
        );
      }
    }
  }
  const allowedArtifactIds = new Set(
    manifest.versions
      .filter(({ partition }) => partition === truth.partition)
      .map(({ artifactVersionId }) => artifactVersionId),
  );
  for (const scenario of truth.scenarios) {
    for (const id of scenario.inputArtifactVersionIds) {
      if (!allowedArtifactIds.has(id)) {
        issues.push(
          `${scenario.scenarioId} has an input outside its partition.`,
        );
      }
    }
  }

  if (truth.partition === 'scratch' && truth.observations.length !== 2) {
    issues.push('Scratch requires exactly 2 observations.');
  }
  if (truth.partition === 'development') {
    if (
      truth.observations.length !== 4 ||
      truth.relations.length !== 1 ||
      truth.relations[0]?.relationKind !== 'supports' ||
      truth.openQuestions.length !== 1
    ) {
      issues.push(
        'Development requires 4 observations, 1 supports relation and 1 open question.',
      );
    }
  }
  if (truth.partition === 'evaluation') {
    validateEvaluationCounts(truth, issues);
    if (
      truth.observations.filter(
        ({ finalStanding }) => finalStanding !== 'superseded',
      ).length !== 8
    ) {
      issues.push(
        'Evaluation requires 8 non-superseded observations after correction.',
      );
    }
  }
  return Object.freeze(issues);
}

export function validateOpenCorpus(): readonly string[] {
  const manifest = loadCorpusManifest();
  return Object.freeze([
    ...validateCorpusManifest(manifest),
    ...validateCorpusTruth(loadScratchTruth(), manifest),
    ...validateCorpusTruth(loadDevelopmentTruth(), manifest),
  ]);
}

export function corpusRootForTesting(): string {
  return CORPUS_ROOT;
}
