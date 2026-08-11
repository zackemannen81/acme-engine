import { canonicalJson } from '@acme/core';

import {
  loadCorpusManifest,
  loadGoldenForPartition,
  loadTruthForPartition,
  validateCorpusManifest,
  validateCorpusTruth,
} from './corpus.js';
import { buildGoldenMaterial, buildGoldenRun } from './golden.js';
import type { EvidenceCorpusTruth, EvidenceGoldenRun } from './schemas.js';

export function loadSealedEvaluationTruth(): EvidenceCorpusTruth {
  return loadTruthForPartition('evaluation');
}

export function loadSealedEvaluationGolden(): EvidenceGoldenRun {
  return loadGoldenForPartition('evaluation');
}

export function buildSealedEvaluationGolden(): EvidenceGoldenRun {
  return buildGoldenRun(loadSealedEvaluationTruth());
}

export function validateSealedEvaluationCorpus(): readonly string[] {
  const manifest = loadCorpusManifest();
  const truth = loadSealedEvaluationTruth();
  const rebuilt = buildGoldenRun(truth);
  const committed = loadSealedEvaluationGolden();
  return Object.freeze([
    ...validateCorpusManifest(manifest),
    ...validateCorpusTruth(truth, manifest),
    ...(canonicalJson(rebuilt) === canonicalJson(committed)
      ? []
      : [
          'Sealed evaluation golden output differs from its deterministic rebuild.',
        ]),
  ]);
}

export { buildGoldenMaterial };
