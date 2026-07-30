import { describe, expect, it } from 'vitest';

import {
  NarrativeContractOutputSchema,
  NarrativeDeltaSchema,
  NarrativeObserveInputSchema,
  NarrativeStateSchema,
  NARRATIVE_WINDOW_POLICY_VERSION,
} from '../src/index.js';
import { narrativeOutput, narrativeState } from './fixtures.js';

describe('Narrative schemas', () => {
  it('accepts strict valid input, output, state, and delta values', () => {
    expect(
      NarrativeObserveInputSchema.safeParse({
        documentKey: 'chapter-1',
        text: 'Text.',
      }).success,
    ).toBe(true);
    expect(
      NarrativeContractOutputSchema.safeParse(narrativeOutput).success,
    ).toBe(true);
    expect(NarrativeStateSchema.safeParse(narrativeState).success).toBe(true);
    expect(
      NarrativeDeltaSchema.safeParse({
        entityAssignments: [],
        aliasAssignments: [],
        scene: { summary: 'A scene.' },
        appendWindow: { documentKey: 'chapter-1', summary: 'A scene.' },
      }).success,
    ).toBe(true);
  });

  it.each([
    { documentKey: '', text: 'Text.' },
    { documentKey: 'chapter-1', text: '   ' },
    { documentKey: 'chapter-1', text: 'Text.', extra: true },
    { documentKey: 'chapter-1', text: 'Text.', title: '' },
  ])('rejects invalid observe input %#', (value) => {
    expect(NarrativeObserveInputSchema.safeParse(value).success).toBe(false);
  });

  it('rejects unknown output fields, empty values, and non-finite confidence', () => {
    expect(
      NarrativeContractOutputSchema.safeParse({
        ...narrativeOutput,
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      NarrativeContractOutputSchema.safeParse({
        observations: [
          {
            type: 'character-fact',
            subject: 'Mira',
            predicate: 'eyes',
            value: 'green',
            confidence: Number.NaN,
          },
        ],
        scene: { summary: 'Scene.' },
      }).success,
    ).toBe(false);
    expect(
      NarrativeContractOutputSchema.safeParse({
        observations: [],
        scene: { summary: ' ' },
      }).success,
    ).toBe(false);
  });

  it('rejects competing state knowledge and an oversized window', () => {
    expect(
      NarrativeStateSchema.safeParse({
        ...narrativeState,
        relationships: [],
      }).success,
    ).toBe(false);
    expect(
      NarrativeStateSchema.safeParse({
        ...narrativeState,
        characters: {
          entity: { displayName: 'Mira', attributes: { eyes: 'green' } },
        },
      }).success,
    ).toBe(false);
    expect(
      NarrativeStateSchema.safeParse({
        ...narrativeState,
        windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
        narrativeWindow: [
          { documentKey: 'a', summary: 'A' },
          { documentKey: 'b', summary: 'B' },
          { documentKey: 'c', summary: 'C' },
        ],
      }).success,
    ).toBe(false);
  });
});
