import type { DomainIssue } from '@acme/core';

import { normalizeReferenceText } from './identity.js';
import { immutableJson } from './immutable.js';
import {
  NARRATIVE_WINDOW_POLICY_VERSION,
  type NarrativeDelta,
  type NarrativeOutlineStatus,
  type NarrativeState,
} from './schemas.js';

const outlineRank: Readonly<Record<NarrativeOutlineStatus, number>> =
  Object.freeze({
    introduced: 0,
    advanced: 1,
    resolved: 2,
  });

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): DomainIssue {
  return immutableJson({ code, path, message });
}

export function initialNarrativeState(): NarrativeState {
  return immutableJson({
    windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
    characters: {},
    entityAliases: {},
    scene: null,
    narrativeWindow: [],
    outlineProgress: {},
  });
}

export function reduceNarrativeState(
  state: NarrativeState,
  delta: NarrativeDelta,
): NarrativeState {
  const characters = { ...state.characters };
  for (const assignment of delta.entityAssignments) {
    characters[assignment.entityKey] ??= {
      displayName: assignment.displayName,
    };
  }

  const entityAliases = { ...state.entityAliases };
  for (const assignment of delta.aliasAssignments) {
    entityAliases[assignment.normalizedAlias] = assignment.entityKey;
  }

  const outlineProgress = { ...state.outlineProgress };
  if (delta.outlineProgress !== undefined) {
    outlineProgress[delta.outlineProgress.beatId] =
      delta.outlineProgress.status;
  }

  return immutableJson({
    windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
    characters,
    entityAliases,
    scene: delta.scene,
    narrativeWindow: [...state.narrativeWindow, delta.appendWindow].slice(-2),
    outlineProgress,
  });
}

export function narrativeStateInvariants(
  next: NarrativeState,
  previous: NarrativeState | null,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];

  if (next.windowPolicyVersion !== NARRATIVE_WINDOW_POLICY_VERSION) {
    issues.push(
      issue(
        'NARRATIVE_WINDOW_POLICY',
        ['windowPolicyVersion'],
        'Narrative state must use narrative-window-1.',
      ),
    );
  }
  if (next.narrativeWindow.length > 2) {
    issues.push(
      issue(
        'NARRATIVE_WINDOW_LIMIT',
        ['narrativeWindow'],
        'Narrative window may contain at most two entries.',
      ),
    );
  }
  if (next.scene !== null && next.scene.summary.trim().length === 0) {
    issues.push(
      issue(
        'NARRATIVE_EMPTY_SCENE',
        ['scene', 'summary'],
        'Narrative scene summary must be non-blank.',
      ),
    );
  }

  const windowKeys = next.narrativeWindow.map(({ documentKey }) => documentKey);
  if (new Set(windowKeys).size !== windowKeys.length) {
    issues.push(
      issue(
        'NARRATIVE_DUPLICATE_WINDOW_DOCUMENT',
        ['narrativeWindow'],
        'Narrative window document keys must be unique.',
      ),
    );
  }

  for (const [alias, target] of Object.entries(next.entityAliases)) {
    let normalizedAlias: string;
    try {
      normalizedAlias = normalizeReferenceText(alias);
    } catch {
      normalizedAlias = '';
    }
    if (normalizedAlias !== alias) {
      issues.push(
        issue(
          'NARRATIVE_ALIAS_NOT_NORMALIZED',
          ['entityAliases', alias],
          'Narrative alias keys must use reference-text-normalization-1.',
        ),
      );
    }
    if (next.characters[target] === undefined) {
      issues.push(
        issue(
          'NARRATIVE_ALIAS_UNKNOWN_ENTITY',
          ['entityAliases', alias],
          `Narrative alias targets unknown entity ${target}.`,
        ),
      );
    }
  }

  for (const [entityKey, character] of Object.entries(next.characters)) {
    const displayAlias = normalizeReferenceText(character.displayName);
    if (next.entityAliases[displayAlias] !== entityKey) {
      issues.push(
        issue(
          'NARRATIVE_DISPLAY_ALIAS_MISSING',
          ['characters', entityKey, 'displayName'],
          'Every display name must resolve to its own entity key.',
        ),
      );
    }
  }

  if (previous !== null) {
    for (const [alias, target] of Object.entries(previous.entityAliases)) {
      if (next.entityAliases[alias] !== target) {
        issues.push(
          issue(
            'NARRATIVE_ALIAS_REASSIGNMENT',
            ['entityAliases', alias],
            'Existing aliases cannot be removed or reassigned.',
          ),
        );
      }
    }
    for (const [entityKey, character] of Object.entries(previous.characters)) {
      if (next.characters[entityKey]?.displayName !== character.displayName) {
        issues.push(
          issue(
            'NARRATIVE_ENTITY_REASSIGNMENT',
            ['characters', entityKey],
            'Existing entity display names cannot be removed or changed.',
          ),
        );
      }
    }
    for (const [beatId, oldStatus] of Object.entries(
      previous.outlineProgress,
    )) {
      const newStatus = next.outlineProgress[beatId];
      if (
        newStatus === undefined ||
        outlineRank[newStatus] < outlineRank[oldStatus]
      ) {
        issues.push(
          issue(
            'NARRATIVE_OUTLINE_REGRESSION',
            ['outlineProgress', beatId],
            'Outline progress cannot be removed or regress.',
          ),
        );
      }
    }
  }

  return immutableJson(issues);
}
