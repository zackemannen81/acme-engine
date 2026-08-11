import { describe, expect, it } from 'vitest';

import {
  buildGoldenRun,
  loadCorpusManifest,
  loadDevelopmentTruth,
  loadScratchTruth,
  validateOpenCorpus,
} from '../src/index.js';
import {
  loadSealedEvaluationGolden,
  loadSealedEvaluationTruth,
  validateSealedEvaluationCorpus,
} from '../src/evaluation.js';
import { loadGoldenForPartition } from '../src/corpus.js';

describe('Rillford Annex corpus', () => {
  it('validates exact source inventory, hashes, lineage and open truth', () => {
    const manifest = loadCorpusManifest();
    expect(manifest.artifacts).toHaveLength(7);
    expect(manifest.versions).toHaveLength(8);
    expect(validateOpenCorpus()).toEqual([]);
    expect(loadScratchTruth().observations).toHaveLength(2);
    expect(loadDevelopmentTruth().observations).toHaveLength(4);
  });

  it('validates the sealed evaluation cardinalities only through its entry point', () => {
    const truth = loadSealedEvaluationTruth();
    expect(truth.annotation.status).toBe('sealed');
    expect(truth.observations).toHaveLength(10);
    expect(truth.relations).toHaveLength(8);
    expect(truth.openQuestions).toHaveLength(3);
    expect(truth.assessments).toHaveLength(2);
    expect(validateSealedEvaluationCorpus()).toEqual([]);
  });

  it('rebuilds every committed golden output byte-for-byte by value', () => {
    expect(buildGoldenRun(loadScratchTruth())).toEqual(
      loadGoldenForPartition('scratch'),
    );
    expect(buildGoldenRun(loadDevelopmentTruth())).toEqual(
      loadGoldenForPartition('development'),
    );
    expect(buildGoldenRun(loadSealedEvaluationTruth())).toEqual(
      loadSealedEvaluationGolden(),
    );
  });
});
