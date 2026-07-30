import type {
  JsonValue,
  MemoryCandidate,
  ModuleResult,
  StateDelta,
  StateProjectionInput,
} from '../../packages/core/src/index.js';
import { domainModuleConformance } from '../../packages/testing/src/index.js';
import {
  NARRATIVE_DELTA_SCHEMA_VERSION,
  NARRATIVE_MEMORY_SCHEMA_VERSION,
  NARRATIVE_STATE_SCHEMA_VERSION,
  NARRATIVE_WINDOW_POLICY_VERSION,
  narrativeModule,
  narrativeSourceContentHash,
  type NarrativeContractInput,
  type NarrativeDelta,
  type NarrativeState,
} from '../../packages/module-narrative/src/index.js';
import {
  characterCandidate,
  existingCharacterRecord,
  fixtureEntityId,
  fixtureNow,
  ionEntityKey,
  miraEntityKey,
  narrativeContext,
  narrativeInput,
  narrativeOutput,
  narrativeState,
  previousDocument,
} from '../../packages/module-narrative/test/fixtures.js';

function requiredValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing required conformance fixture: ${label}`);
  }
  return value;
}

const expectedContractInput: NarrativeContractInput = {
  contractInputVersion: 'narrative-observe-input/1' as const,
  stateSchemaVersion: NARRATIVE_STATE_SCHEMA_VERSION,
  windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
  document: narrativeInput,
  previousEnding: {
    algorithm: 'previous-document-tail-1' as const,
    source: 'document-content' as const,
    documentKey: previousDocument.key,
    sourceContentHash: previousDocument.contentHash,
    text: '“Stay close!” The door fell silent.',
    truncated: false,
  },
  scene: narrativeState.scene,
  narrativeWindow: narrativeState.narrativeWindow,
  outlineProgress: narrativeState.outlineProgress,
  entityAliases: narrativeState.entityAliases,
  relevantMemories: [
    {
      identityKey: existingCharacterRecord.identityKey,
      kind: 'narrative.character-fact' as const,
      status: 'active' as const,
      value: existingCharacterRecord.value,
    },
  ],
};

const expectedMemoryValues = [
  {
    kind: 'narrative.character-fact' as const,
    entityKey: miraEntityKey,
    observedLabels: ['Mira'],
    predicate: 'eye color',
    normalizedPredicate: 'eye color',
    value: 'green',
  },
  {
    kind: 'narrative.relationship' as const,
    subjectEntityKey: miraEntityKey,
    subjectLabels: ['Mira'],
    relation: 'mentors',
    normalizedRelation: 'mentors',
    objectEntityKey: ionEntityKey,
    objectLabels: ['Ion'],
  },
  {
    kind: 'narrative.world-rule' as const,
    normalizedRule: 'the northern light reveals hidden paths.',
    observedRules: ['The northern light reveals hidden paths.'],
  },
];

const expectedMemories: MemoryCandidate[] = expectedMemoryValues.map(
  (value, index) => ({
    key: `narrative-memory-${String(index + 1).padStart(4, '0')}`,
    kind: value.kind,
    schemaVersion: NARRATIVE_MEMORY_SCHEMA_VERSION,
    value: value as unknown as JsonValue,
    confidence: requiredValue(
      narrativeOutput.observations[index],
      `observation ${index}`,
    ).confidence,
    source: {
      executionId: narrativeContext.executionId,
      contract: {
        id: 'narrative.observe-document',
        version: '1.0.0',
      },
      documentKeys: [narrativeInput.documentKey],
    },
  }),
);

const directDelta: NarrativeDelta = {
  entityAssignments: [],
  aliasAssignments: [],
  scene: narrativeOutput.scene,
  outlineProgress: narrativeOutput.outlineProgress,
  appendWindow: {
    documentKey: narrativeInput.documentKey,
    summary: narrativeOutput.scene.summary,
  },
};

const expectedStateIntent: StateDelta<NarrativeDelta> = {
  schemaVersion: NARRATIVE_DELTA_SCHEMA_VERSION,
  value: directDelta,
};

const expectedResult: ModuleResult<NarrativeDelta> = {
  documents: [
    {
      key: narrativeInput.documentKey,
      kind: 'narrative.source',
      schemaVersion: 'narrative-source/1',
      value: narrativeInput as unknown as JsonValue,
      contentHash: narrativeSourceContentHash(narrativeInput),
    },
  ],
  memories: expectedMemories,
  stateIntent: expectedStateIntent,
  events: [],
  diagnostics: [
    {
      code: 'NARRATIVE_DOCUMENT_OBSERVED',
      severity: 'info' as const,
      value: {
        documentKey: narrativeInput.documentKey,
        observationCount: 3,
      },
    },
  ],
};

const projectionInput: StateProjectionInput<NarrativeDelta> = {
  stateIntent: expectedStateIntent,
  memory: expectedMemories.map((candidate, index) => ({
    candidate,
    identityKey: narrativeModule.memoryPolicy.identity(candidate),
    resolution: {
      candidateKey: candidate.key,
      action: 'create' as const,
      value: candidate.value,
      strength: candidate.confidence ?? 0.5,
    },
    affectedMemoryIds: [`memory-created-${index}`],
  })),
};

const expectedStateDelta: StateDelta<NarrativeDelta> = {
  schemaVersion: NARRATIVE_DELTA_SCHEMA_VERSION,
  value: {
    ...directDelta,
    entityAssignments: [
      { entityKey: miraEntityKey, displayName: 'Mira' },
      { entityKey: ionEntityKey, displayName: 'Ion' },
    ],
    aliasAssignments: [
      { normalizedAlias: 'mira', entityKey: miraEntityKey },
      { normalizedAlias: 'ion', entityKey: ionEntityKey },
    ],
  },
};

const stateDelta: NarrativeDelta = {
  entityAssignments: [{ entityKey: ionEntityKey, displayName: 'Ion' }],
  aliasAssignments: [{ normalizedAlias: 'ion', entityKey: ionEntityKey }],
  scene: narrativeOutput.scene,
  outlineProgress: { beatId: 'arrival', status: 'advanced' },
  appendWindow: {
    documentKey: narrativeInput.documentKey,
    summary: narrativeOutput.scene.summary,
  },
};

const expectedReducedState: NarrativeState = {
  windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
  characters: {
    ...narrativeState.characters,
    [ionEntityKey]: { displayName: 'Ion' },
  },
  entityAliases: {
    ...narrativeState.entityAliases,
    ion: ionEntityKey,
  },
  scene: narrativeOutput.scene,
  narrativeWindow: [
    requiredValue(
      narrativeState.narrativeWindow[0],
      'existing narrative window entry',
    ),
    {
      documentKey: narrativeInput.documentKey,
      summary: narrativeOutput.scene.summary,
    },
  ],
  outlineProgress: { arrival: 'advanced' as const },
};

const rankedRecord = {
  record: existingCharacterRecord,
  score: 3.6,
  reasons: ['status:active', 'strength', 'task:observe-document'],
};

domainModuleConformance('NarrativeModule', {
  createSubject: () => ({
    module: narrativeModule,
    task: {
      taskName: 'observe-document',
      input: narrativeInput,
      invalidInput: { documentKey: 'chapter-beta', text: '' },
      contractOutput: narrativeOutput,
      context: narrativeContext,
      expectedContractInput,
      expectedResult,
      projectionInput,
      expectedStateDelta,
    },
    state: {
      initialContext: { entityId: fixtureEntityId, now: fixtureNow },
      expectedInitialState: {
        windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
        characters: {},
        entityAliases: {},
        scene: null,
        narrativeWindow: [],
        outlineProgress: {},
      },
      state: narrativeState,
      invalidState: {
        ...narrativeState,
        relationships: [],
      },
      delta: stateDelta,
      invalidDelta: { ...stateDelta, worldRules: [] },
      expectedReducedState,
      previousState: narrativeState,
      expectedInvariantIssues: [],
    },
    memory: {
      candidate: characterCandidate(),
      expectedValidationIssues: [],
      expectedIdentityKey: `character:${miraEntityKey}:eye color`,
      existing: [existingCharacterRecord],
      query: {
        namespace: 'narrative',
        entityId: fixtureEntityId,
        task: 'observe-document',
        limit: 5,
      },
      expectedRanked: [rankedRecord],
      now: fixtureNow,
      expectedResolution: {
        candidateKey: 'candidate-character',
        action: 'contradict',
        memoryIds: [existingCharacterRecord.memoryId],
        disposition: 'contest',
      },
      lifecycleRecord: existingCharacterRecord,
      lifecycleHook: 'execution-commit',
      expectedLifecycleDecision: { action: 'retain' },
    },
  }),
});
