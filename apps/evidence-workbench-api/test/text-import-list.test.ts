import { describe, expect, it } from 'vitest';

import { sortTextImportsBySourceTime } from '../src/text-import-list.js';

describe('sortTextImportsBySourceTime', () => {
  it('orders earlier acquiredAt before later createdAt fallbacks', () => {
    const laterCreated = {
      importId: 'import-later-created',
      createdAt: '2020-06-02T00:00:00.000Z',
    };
    const earlierAcquired = {
      importId: 'import-earlier-acquired',
      createdAt: '2020-06-03T00:00:00.000Z',
      sourceProvenance: { acquiredAt: '2020-06-01T00:00:00.000Z' },
    };
    const laterAcquired = {
      importId: 'import-later-acquired',
      createdAt: '2020-05-01T00:00:00.000Z',
      sourceProvenance: { acquiredAt: '2020-06-02T12:00:00.000Z' },
    };

    expect(
      sortTextImportsBySourceTime([
        laterAcquired,
        laterCreated,
        earlierAcquired,
      ]).map((item) => item.importId),
    ).toEqual([
      'import-earlier-acquired',
      'import-later-created',
      'import-later-acquired',
    ]);
  });

  it('breaks equal source times with importId', () => {
    const shared = '2020-06-01T00:00:00.000Z';
    expect(
      sortTextImportsBySourceTime([
        { importId: 'import-b', createdAt: shared },
        { importId: 'import-a', createdAt: shared },
      ]).map((item) => item.importId),
    ).toEqual(['import-a', 'import-b']);
  });
});
