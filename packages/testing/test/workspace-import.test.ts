import { describe, expect, it } from 'vitest';

import { TESTING_CORE_PACKAGE } from '../src/index.js';

describe('workspace package import', () => {
  it('imports @acme/core through @acme/testing', () => {
    expect(TESTING_CORE_PACKAGE).toBe('@acme/core');
  });
});
