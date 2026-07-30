import { describe, expect, it } from 'vitest';

import { AcmeError } from '@acme/core';

import {
  buildPreviousDocumentTail,
  derivePreviousDocumentTailText,
  initialNarrativeState,
  splitPreviousDocumentSentences,
} from '../src/index.js';
import {
  fixtureEntityId,
  narrativeState,
  previousDocument,
} from './fixtures.js';

describe('previous-document-tail-1', () => {
  it('returns the explicit initial shape without a previous document', () => {
    expect(
      buildPreviousDocumentTail(initialNarrativeState(), [], fixtureEntityId),
    ).toEqual({
      algorithm: 'previous-document-tail-1',
      source: 'initial',
      text: '',
    });
  });

  it('normalizes whitespace and selects the last two sentences with closers', () => {
    expect(
      splitPreviousDocumentSentences(
        'First.\n\nSecond!  “Third?”\tFinal fragment',
      ),
    ).toEqual(['First.', 'Second!', '“Third?”', 'Final fragment']);
    expect(
      derivePreviousDocumentTailText(
        'First.\n\nSecond!  “Third?”\tFinal fragment',
      ),
    ).toEqual({
      text: '“Third?” Final fragment',
      truncated: false,
    });
  });

  it('retains the last 320 Unicode code points', () => {
    const longEnding = `Start. ${'å'.repeat(400)}`;
    const tail = derivePreviousDocumentTailText(longEnding);

    expect(Array.from(tail.text)).toHaveLength(320);
    expect(tail.text).toBe('å'.repeat(320));
    expect(tail.truncated).toBe(true);
  });

  it('binds the tail to the exact document key and content hash', () => {
    expect(
      buildPreviousDocumentTail(
        narrativeState,
        [previousDocument],
        fixtureEntityId,
      ),
    ).toEqual({
      algorithm: 'previous-document-tail-1',
      source: 'document-content',
      documentKey: previousDocument.key,
      sourceContentHash: previousDocument.contentHash,
      text: '“Stay close!” The door fell silent.',
      truncated: false,
    });
  });

  it.each([
    { documents: [] },
    { documents: [{ ...previousDocument, kind: 'wrong-kind' }] },
    { documents: [{ ...previousDocument, contentHash: 'wrong-hash' }] },
    {
      documents: [
        previousDocument,
        { ...previousDocument, documentId: 'duplicate' },
      ],
    },
  ])(
    'fails deterministically for missing or mismatched evidence %#',
    ({ documents }) => {
      expect(() =>
        buildPreviousDocumentTail(narrativeState, documents, fixtureEntityId),
      ).toThrowError(AcmeError);
    },
  );
});
