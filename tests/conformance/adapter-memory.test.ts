import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { executionRepositoryConformance } from '../../packages/testing/src/index.js';

executionRepositoryConformance('in-memory adapter', {
  createRepository: () =>
    createInMemoryExecutionRepository({
      ids: {
        next(kind) {
          return `${kind}-unused`;
        },
      },
    }),
});
