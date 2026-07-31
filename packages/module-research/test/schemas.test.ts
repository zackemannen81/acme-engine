import { describe, expect, it } from 'vitest';

import {
  ResearchContractOutputSchema,
  ResearchDeltaSchema,
  ResearchEvidenceInputSchema,
  ResearchStateSchema,
} from '../src/schemas.js';
import { emptyResearchState, sourceA, supportingOutput } from './fixtures.js';

describe('research schemas', () => {
  it('accepts the minimal and the full evidence input', () => {
    expect(ResearchEvidenceInputSchema.safeParse(sourceA).success).toBe(true);
    expect(
      ResearchEvidenceInputSchema.safeParse({
        documentKey: 'doc',
        source: {
          uri: 'http://example.com/a',
          retrievedAt: '2026-01-01T00:00:00Z',
          independence: { authority: 'Example', basis: 'fixture' },
        },
        text: 'evidence',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['relative URI', 'evidence.html'],
    ['unsupported scheme', 'ftp://example.com/a'],
    ['credentials in URI', 'https://user:secret@example.com/a'],
  ])('rejects an invalid source URI: %s', (_label, uri) => {
    expect(
      ResearchEvidenceInputSchema.safeParse({
        ...sourceA,
        source: { ...sourceA.source, uri },
      }).success,
    ).toBe(false);
  });

  it.each([
    ['non-UTC offset', '2026-07-30T08:00:00+02:00'],
    ['date only', '2026-07-30'],
    ['not a timestamp', 'yesterday'],
  ])('rejects an invalid retrieval timestamp: %s', (_label, retrievedAt) => {
    expect(
      ResearchEvidenceInputSchema.safeParse({
        ...sourceA,
        source: { ...sourceA.source, retrievedAt },
      }).success,
    ).toBe(false);
  });

  it('rejects a blank authority, an unknown basis and extra keys', () => {
    expect(
      ResearchEvidenceInputSchema.safeParse({
        ...sourceA,
        source: {
          ...sourceA.source,
          independence: { authority: '   ', basis: 'publisher' },
        },
      }).success,
    ).toBe(false);
    expect(
      ResearchEvidenceInputSchema.safeParse({
        ...sourceA,
        source: {
          ...sourceA.source,
          independence: { authority: 'Alpha', basis: 'guessed' },
        },
      }).success,
    ).toBe(false);
    expect(
      ResearchEvidenceInputSchema.safeParse({ ...sourceA, extra: true })
        .success,
    ).toBe(false);
  });

  it('rejects blank evidence text and blank document keys', () => {
    expect(
      ResearchEvidenceInputSchema.safeParse({ ...sourceA, text: '   ' })
        .success,
    ).toBe(false);
    expect(
      ResearchEvidenceInputSchema.safeParse({ ...sourceA, documentKey: '' })
        .success,
    ).toBe(false);
  });

  it('accepts valid contract output and rejects blank or out-of-range fields', () => {
    expect(
      ResearchContractOutputSchema.safeParse(supportingOutput).success,
    ).toBe(true);
    const claim = supportingOutput.claims[0];
    expect(claim).toBeDefined();
    for (const invalid of [
      { ...claim, proposition: '  ' },
      { ...claim, statement: '' },
      { ...claim, position: 'maybe' },
      { ...claim, confidence: 1.5 },
      { ...claim, confidence: Number.POSITIVE_INFINITY },
      { ...claim, unexpected: 1 },
    ]) {
      expect(
        ResearchContractOutputSchema.safeParse({
          claims: [invalid],
          openQuestions: [],
        }).success,
      ).toBe(false);
    }
    expect(
      ResearchContractOutputSchema.safeParse({
        claims: [],
        openQuestions: ['  '],
      }).success,
    ).toBe(false);
  });

  it('accepts the initial state and rejects structurally invalid state', () => {
    expect(ResearchStateSchema.safeParse(emptyResearchState).success).toBe(
      true,
    );
    expect(
      ResearchStateSchema.safeParse({
        ...emptyResearchState,
        verificationThreshold: 1,
      }).success,
    ).toBe(false);
    expect(
      ResearchStateSchema.safeParse({
        ...emptyResearchState,
        verifiedClaims: [
          { identityKey: 'k', statement: 's', independentSourceCount: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      ResearchStateSchema.safeParse({
        ...emptyResearchState,
        contestedClaims: [
          { identityKey: 'k', variants: ['one'], memoryIds: ['m'] },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts every claim decision and rejects malformed deltas', () => {
    expect(
      ResearchDeltaSchema.safeParse({
        claimDecisions: [
          {
            action: 'verify',
            identityKey: 'k',
            statement: 's',
            independentSourceCount: 2,
            memoryIds: ['m'],
          },
          {
            action: 'contest',
            identityKey: 'k2',
            variants: ['a', 'b'],
            memoryIds: ['m'],
          },
          { action: 'defer', identityKey: 'k3' },
        ],
        questions: [],
      }).success,
    ).toBe(true);
    expect(
      ResearchDeltaSchema.safeParse({
        claimDecisions: [{ action: 'promote', identityKey: 'k' }],
        questions: [],
      }).success,
    ).toBe(false);
    expect(ResearchDeltaSchema.safeParse({ claimDecisions: [] }).success).toBe(
      false,
    );
  });
});
