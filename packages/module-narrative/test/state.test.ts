import { describe, expect, it } from 'vitest';

import {
  NARRATIVE_WINDOW_POLICY_VERSION,
  initialNarrativeState,
  narrativeStateInvariants,
  reduceNarrativeState,
} from '../src/index.js';
import { ionEntityKey, miraEntityKey, narrativeState } from './fixtures.js';

describe('Narrative state', () => {
  it('initializes the fixed v1 working position', () => {
    expect(initialNarrativeState()).toEqual({
      windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
      characters: {},
      entityAliases: {},
      scene: null,
      narrativeWindow: [],
      outlineProgress: {},
    });
  });

  it('applies entity/alias intent, trims the window, and advances outline', () => {
    const state = {
      ...narrativeState,
      narrativeWindow: [
        { documentKey: 'chapter-0', summary: 'Before.' },
        ...narrativeState.narrativeWindow,
      ],
    };
    const reduced = reduceNarrativeState(state, {
      entityAssignments: [{ entityKey: ionEntityKey, displayName: 'Ion' }],
      aliasAssignments: [{ normalizedAlias: 'ion', entityKey: ionEntityKey }],
      scene: { location: 'Observatory', summary: 'Ion enters.' },
      outlineProgress: { beatId: 'arrival', status: 'advanced' },
      appendWindow: { documentKey: 'chapter-beta', summary: 'Ion enters.' },
    });

    expect(reduced.characters[ionEntityKey]).toEqual({ displayName: 'Ion' });
    expect(reduced.entityAliases.ion).toBe(ionEntityKey);
    expect(
      reduced.narrativeWindow.map(({ documentKey }) => documentKey),
    ).toEqual(['chapter-alpha', 'chapter-beta']);
    expect(reduced.outlineProgress.arrival).toBe('advanced');
    expect(Object.isFrozen(reduced)).toBe(true);
    expect(state.entityAliases).not.toHaveProperty('ion');
  });

  it('reports alias authority and outline regressions', () => {
    const next = {
      ...narrativeState,
      characters: {
        ...narrativeState.characters,
        [ionEntityKey]: { displayName: 'Ion' },
      },
      entityAliases: {
        Mira: ionEntityKey,
        mira: ionEntityKey,
      },
      outlineProgress: { arrival: 'introduced' as const },
    };
    const codes = narrativeStateInvariants(next, {
      ...narrativeState,
      outlineProgress: { arrival: 'resolved' },
    }).map(({ code }) => code);

    expect(codes).toContain('NARRATIVE_ALIAS_NOT_NORMALIZED');
    expect(codes).toContain('NARRATIVE_DISPLAY_ALIAS_MISSING');
    expect(codes).toContain('NARRATIVE_ALIAS_REASSIGNMENT');
    expect(codes).toContain('NARRATIVE_OUTLINE_REGRESSION');
  });

  it('accepts a valid reducer result', () => {
    expect(
      narrativeStateInvariants(narrativeState, {
        ...narrativeState,
        characters: { [miraEntityKey]: { displayName: 'Dr. Mira Vale' } },
      }),
    ).toEqual([]);
  });
});
