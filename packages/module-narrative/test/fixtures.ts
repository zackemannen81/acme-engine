import type {
  ExecutionReadContext,
  MemoryCandidate,
  MemoryRecord,
  StoredDocument,
} from '@acme/core';

import {
  NARRATIVE_MEMORY_SCHEMA_VERSION,
  NARRATIVE_NAMESPACE,
  NARRATIVE_SOURCE_KIND,
  NARRATIVE_SOURCE_SCHEMA_VERSION,
  NARRATIVE_STATE_SCHEMA_VERSION,
  NARRATIVE_WINDOW_POLICY_VERSION,
  deriveNarrativeEntityKey,
  narrativeSourceContentHash,
  type NarrativeContractOutput,
  type NarrativeObserveInput,
  type NarrativeState,
} from '../src/index.js';

export function frozen<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    frozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

export const fixtureNow = '2026-07-30T12:00:00.000Z';
export const fixtureExecutionId = 'execution-narrative';
export const fixtureEntityId = 'story-1';
export const miraEntityKey = deriveNarrativeEntityKey('Dr. Mira Vale');
export const ionEntityKey = deriveNarrativeEntityKey('Ion');

export const previousSourceValue = frozen({
  documentKey: 'chapter-alpha',
  title: 'Arrival',
  text: 'Rain crossed the glass.  “Stay close!”\nThe door fell silent.',
});

export const previousDocument: StoredDocument = frozen({
  documentId: 'document-alpha',
  executionId: 'execution-alpha',
  namespace: NARRATIVE_NAMESPACE,
  entityId: fixtureEntityId,
  key: 'chapter-alpha',
  kind: NARRATIVE_SOURCE_KIND,
  schemaVersion: NARRATIVE_SOURCE_SCHEMA_VERSION,
  value: previousSourceValue,
  contentHash: narrativeSourceContentHash(previousSourceValue),
  createdAt: fixtureNow,
});

export const narrativeInput: NarrativeObserveInput = frozen({
  documentKey: 'chapter-beta',
  title: 'Signal',
  text: 'Mira tells Ion that her eyes are green. “Trust the northern light.”',
});

export const narrativeState: NarrativeState = frozen({
  windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
  characters: {
    [miraEntityKey]: { displayName: 'Dr. Mira Vale' },
  },
  entityAliases: {
    'dr. mira vale': miraEntityKey,
    mira: miraEntityKey,
  },
  scene: {
    location: 'Observatory',
    summary: 'Mira waits at the observatory.',
  },
  narrativeWindow: [
    {
      documentKey: 'chapter-alpha',
      summary: 'Mira arrives during the storm.',
    },
  ],
  outlineProgress: { arrival: 'introduced' },
});

export const provenance = frozen({
  executionId: 'execution-alpha',
  contract: {
    id: 'narrative.observe-document',
    version: '1.0.0',
  },
  modelCallId: 'call-alpha',
  documentKeys: ['chapter-alpha'],
});

export const existingCharacterValue = frozen({
  kind: 'narrative.character-fact' as const,
  entityKey: miraEntityKey,
  observedLabels: ['Mira'],
  predicate: 'eye color',
  normalizedPredicate: 'eye color',
  value: 'blue',
});

export const existingCharacterRecord: MemoryRecord = frozen({
  memoryId: 'memory-mira-eyes',
  namespace: NARRATIVE_NAMESPACE,
  entityId: fixtureEntityId,
  identityKey: `character:${miraEntityKey}:eye color`,
  kind: 'narrative.character-fact',
  schemaVersion: NARRATIVE_MEMORY_SCHEMA_VERSION,
  value: existingCharacterValue,
  strength: 0.6,
  status: 'active',
  firstSeenAt: fixtureNow,
  lastSeenAt: fixtureNow,
  lastReinforcedAt: fixtureNow,
  provenance: [provenance],
  recordVersion: 1,
});

export const narrativeOutput: NarrativeContractOutput = frozen({
  observations: [
    {
      type: 'character-fact',
      subject: 'Mira',
      predicate: 'eye color',
      value: 'green',
      confidence: 0.9,
    },
    {
      type: 'relationship',
      subject: 'Mira',
      relation: 'mentors',
      object: 'Ion',
      confidence: 0.8,
    },
    {
      type: 'world-rule',
      rule: 'The northern light reveals hidden paths.',
      confidence: 0.75,
    },
  ],
  scene: {
    location: 'Observatory',
    time: 'Night',
    summary: 'Mira shares the rule of the northern light with Ion.',
  },
  outlineProgress: {
    beatId: 'arrival',
    status: 'advanced',
  },
});

export const narrativeContext: ExecutionReadContext<NarrativeState> = frozen({
  executionId: fixtureExecutionId,
  entityId: fixtureEntityId,
  now: fixtureNow,
  state: {
    entityId: fixtureEntityId,
    namespace: NARRATIVE_NAMESPACE,
    schemaVersion: NARRATIVE_STATE_SCHEMA_VERSION,
    revision: 1,
    value: narrativeState,
    valueHash: 'state-hash',
    createdAt: fixtureNow,
    executionId: 'execution-alpha',
  },
  memories: [existingCharacterRecord],
  documents: [previousDocument],
});

export function characterCandidate(
  overrides: Partial<MemoryCandidate> = {},
): MemoryCandidate {
  return frozen({
    key: 'candidate-character',
    kind: 'narrative.character-fact',
    schemaVersion: NARRATIVE_MEMORY_SCHEMA_VERSION,
    value: {
      kind: 'narrative.character-fact',
      entityKey: miraEntityKey,
      observedLabels: ['Mira'],
      predicate: 'eye color',
      normalizedPredicate: 'eye color',
      value: 'green',
    },
    confidence: 0.9,
    source: {
      executionId: fixtureExecutionId,
      contract: {
        id: 'narrative.observe-document',
        version: '1.0.0',
      },
      documentKeys: [narrativeInput.documentKey],
    },
    ...overrides,
  });
}
