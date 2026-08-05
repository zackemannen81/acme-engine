import { createInMemoryQualityEvaluationStore } from '../../packages/adapter-memory/src/index.js';
import { qualityEvaluationStoreConformance } from '../../packages/testing/src/index.js';

qualityEvaluationStoreConformance('in-memory adapter', {
  createStore: (hashing) =>
    createInMemoryQualityEvaluationStore(
      hashing === undefined ? {} : { hashing },
    ),
});
