import { describe, expect, it } from 'vitest';

import {
  computeModelRequestHash,
  createContractRegistry,
  type StateProjectionInput,
} from '@acme/core';

import {
  NARRATIVE_DELTA_SCHEMA_VERSION,
  NARRATIVE_MEMORY_SCHEMA_VERSION,
  narrativeModule,
  narrativeObserveDocumentContract,
  narrativeObserveDocumentTask,
  narrativeSourceContentHash,
  type NarrativeContractOutput,
  type NarrativeDelta,
} from '../src/index.js';
import {
  fixtureEntityId,
  ionEntityKey,
  miraEntityKey,
  narrativeContext,
  narrativeInput,
  narrativeOutput,
  narrativeState,
  previousDocument,
} from './fixtures.js';

function requiredValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing required test fixture: ${label}`);
  }
  return value;
}

describe('narrative.observe-document@1.0.0', () => {
  it('projects stable bounded context with exact previous source provenance', async () => {
    const projected = await narrativeObserveDocumentTask.project(
      narrativeInput,
      narrativeContext,
    );

    expect(projected).toMatchObject({
      contractInputVersion: 'narrative-observe-input/1',
      stateSchemaVersion: 'narrative-state/1',
      windowPolicyVersion: 'narrative-window-1',
      document: narrativeInput,
      previousEnding: {
        algorithm: 'previous-document-tail-1',
        source: 'document-content',
        documentKey: previousDocument.key,
        sourceContentHash: previousDocument.contentHash,
        text: '“Stay close!” The door fell silent.',
        truncated: false,
      },
      scene: narrativeState.scene,
      narrativeWindow: narrativeState.narrativeWindow,
    });
    expect(projected.relevantMemories).toHaveLength(1);
    expect(Object.isFrozen(projected)).toBe(true);
  });

  it('builds a deterministic request and stable contract fingerprint', async () => {
    const input = await narrativeObserveDocumentTask.project(
      narrativeInput,
      narrativeContext,
    );
    const first = narrativeObserveDocumentContract.buildRequest(input, {
      executionId: 'execution-a',
      now: '2026-07-30T00:00:00.000Z',
    });
    const second = narrativeObserveDocumentContract.buildRequest(input, {
      executionId: 'execution-b',
      now: '2026-07-31T00:00:00.000Z',
    });

    expect(second).toEqual(first);
    expect(computeModelRequestHash(first)).toBe(
      '26fbe9bba122f8bdda9aef00a127054a1111e2561ca99305fd694d263d63782d',
    );
    expect(
      createContractRegistry([narrativeObserveDocumentContract]).fingerprint(
        narrativeObserveDocumentContract.ref,
      ),
    ).toBe('291987c02472e577b2accb7ad0dcee67c2112463c51e594a69562d9c55d71844');
    expect(first.temperature).toBeUndefined();
    expect(first.output.mode).toBe('json');
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('enforces duplicate, self-relationship, and correction semantics', async () => {
    const input = await narrativeObserveDocumentTask.project(
      narrativeInput,
      narrativeContext,
    );
    const issues = narrativeObserveDocumentContract.validateSemantics(
      {
        observations: [
          {
            type: 'relationship',
            subject: 'Mira',
            relation: 'trusts',
            object: 'Mira',
            confidence: 0.9,
          },
          {
            type: 'relationship',
            subject: ' Mira ',
            relation: 'trusts',
            object: 'Mira',
            confidence: 0.8,
          },
          {
            type: 'character-fact',
            subject: 'Mira',
            predicate: 'eye color',
            value: 'green',
            confidence: 0.9,
            correction: {
              targetIdentityKey: 'missing',
              supersedesValue: 'brown',
              evidenceQuote: 'not in source',
            },
          },
        ],
        scene: { summary: 'Mira reflects.' },
      },
      input,
    );
    const codes = issues.map(({ code }) => code);

    expect(codes).toContain('NARRATIVE_SELF_RELATIONSHIP');
    expect(codes).toContain('NARRATIVE_DUPLICATE_OBSERVATION');
    expect(codes).toContain('NARRATIVE_CORRECTION_QUOTE_NOT_FOUND');
    expect(codes).toContain('NARRATIVE_CORRECTION_TARGET_NOT_FOUND');
  });

  it('accepts an exact source-backed correction and rejects an unchanged value', async () => {
    const input = await narrativeObserveDocumentTask.project(
      narrativeInput,
      narrativeContext,
    );
    const relevantMemory = requiredValue(
      input.relevantMemories[0],
      'relevant memory',
    );
    const correction = {
      targetIdentityKey: relevantMemory.identityKey,
      supersedesValue: 'blue',
      evidenceQuote: 'eyes are green',
    };
    const valid = {
      observations: [
        {
          type: 'character-fact' as const,
          subject: 'Mira',
          predicate: 'eye color',
          value: 'green',
          confidence: 0.9,
          correction,
        },
      ],
      scene: { summary: 'Mira corrects the record.' },
    };
    const originalObservation = requiredValue(
      valid.observations[0],
      'valid correction observation',
    );

    expect(
      narrativeObserveDocumentContract.validateSemantics(valid, input),
    ).toEqual([]);
    expect(
      narrativeObserveDocumentContract
        .validateSemantics(
          {
            ...valid,
            observations: [{ ...originalObservation, value: 'blue' }],
          },
          input,
        )
        .map(({ code }) => code),
    ).toContain('NARRATIVE_CORRECTION_VALUE_UNCHANGED');
  });

  it('interprets source-backed documents, three memory kinds, and direct state intent', async () => {
    const result = await narrativeObserveDocumentTask.interpret(
      narrativeOutput,
      narrativeInput,
      narrativeContext,
    );

    expect(result.documents).toEqual([
      {
        key: narrativeInput.documentKey,
        kind: 'narrative.source',
        schemaVersion: 'narrative-source/1',
        value: narrativeInput,
        contentHash: narrativeSourceContentHash(narrativeInput),
      },
    ]);
    expect(result.memories.map(({ kind }) => kind)).toEqual([
      'narrative.character-fact',
      'narrative.relationship',
      'narrative.world-rule',
    ]);
    expect(
      result.memories.every(
        ({ schemaVersion }) =>
          schemaVersion === NARRATIVE_MEMORY_SCHEMA_VERSION,
      ),
    ).toBe(true);
    expect(result.stateIntent).toEqual({
      schemaVersion: NARRATIVE_DELTA_SCHEMA_VERSION,
      value: {
        entityAssignments: [],
        aliasAssignments: [],
        scene: narrativeOutput.scene,
        outlineProgress: narrativeOutput.outlineProgress,
        appendWindow: {
          documentKey: narrativeInput.documentKey,
          summary: narrativeOutput.scene.summary,
        },
      },
    });
    expect(result.events).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('treats an explicitly null value as the same claim as an omitted one', async () => {
    // A provider under strict structured output must emit every property, so
    // "unknown" arrives as null. State must not be able to tell the two apart,
    // because acme-cjson-1 distinguishes null from an absent key and one claim
    // must not have two canonical forms.
    const reportedWithNulls: NarrativeContractOutput = {
      observations: [
        {
          type: 'character-fact',
          subject: 'Mira',
          predicate: 'eye color',
          value: 'green',
          confidence: 0.9,
          correction: null,
        },
      ],
      scene: { location: null, time: null, summary: 'A quiet observatory.' },
      outlineProgress: null,
    };
    const reportedWithOmissions: NarrativeContractOutput = {
      observations: [
        {
          type: 'character-fact',
          subject: 'Mira',
          predicate: 'eye color',
          value: 'green',
          confidence: 0.9,
        },
      ],
      scene: { summary: 'A quiet observatory.' },
    };

    const fromNulls = await narrativeObserveDocumentTask.interpret(
      reportedWithNulls,
      narrativeInput,
      narrativeContext,
    );
    const fromOmissions = await narrativeObserveDocumentTask.interpret(
      reportedWithOmissions,
      narrativeInput,
      narrativeContext,
    );

    expect(fromNulls).toEqual(fromOmissions);
    expect(JSON.stringify(fromNulls)).not.toContain('null');
    expect(fromNulls.stateIntent?.value.scene).toEqual({
      summary: 'A quiet observatory.',
    });
    expect(fromNulls.stateIntent?.value).not.toHaveProperty('outlineProgress');
    expect(fromNulls.memories[0]?.value).not.toHaveProperty('correction');
  });

  it('projects entity and alias state only from applied memory decisions', async () => {
    const result = await narrativeObserveDocumentTask.interpret(
      narrativeOutput,
      narrativeInput,
      narrativeContext,
    );
    const stateIntent = result.stateIntent;
    expect(stateIntent).toBeDefined();
    const projection: StateProjectionInput<NarrativeDelta> = {
      stateIntent: requiredValue(stateIntent, 'state intent'),
      memory: result.memories.map((candidate, index) => ({
        candidate,
        identityKey: narrativeModule.memoryPolicy.identity(candidate),
        resolution: {
          candidateKey: candidate.key,
          action: 'create',
          value: candidate.value,
          strength: candidate.confidence ?? 0.5,
        },
        affectedMemoryIds: [`memory-created-${index}`],
      })),
    };
    const delta = narrativeObserveDocumentTask.projectState(
      projection,
      narrativeContext,
    );

    expect(delta?.value.entityAssignments).toEqual([
      { entityKey: miraEntityKey, displayName: 'Mira' },
      { entityKey: ionEntityKey, displayName: 'Ion' },
    ]);
    expect(delta?.value.aliasAssignments).toEqual([
      { normalizedAlias: 'mira', entityKey: miraEntityKey },
      { normalizedAlias: 'ion', entityKey: ionEntityKey },
    ]);
    expect(delta?.value).not.toHaveProperty('relationships');
    expect(delta?.value).not.toHaveProperty('worldRules');
    expect(Object.isFrozen(delta)).toBe(true);
  });

  it('does not turn contested evidence into entity or alias state', async () => {
    const result = await narrativeObserveDocumentTask.interpret(
      narrativeOutput,
      narrativeInput,
      narrativeContext,
    );
    const candidate = result.memories[0];
    const stateIntent = result.stateIntent;
    expect(candidate).toBeDefined();
    expect(stateIntent).toBeDefined();
    const requiredCandidate = requiredValue(candidate, 'memory candidate');
    const delta = narrativeObserveDocumentTask.projectState(
      {
        stateIntent: requiredValue(stateIntent, 'state intent'),
        memory: [
          {
            candidate: requiredCandidate,
            identityKey:
              narrativeModule.memoryPolicy.identity(requiredCandidate),
            resolution: {
              candidateKey: requiredCandidate.key,
              action: 'contradict',
              memoryIds: ['existing'],
              disposition: 'contest',
            },
            affectedMemoryIds: ['existing'],
          },
        ],
      },
      narrativeContext,
    );

    expect(delta?.value.entityAssignments).toEqual([]);
    expect(delta?.value.aliasAssignments).toEqual([]);
  });

  it('exports an assembled analyzer module with no core branch', () => {
    expect(narrativeModule.namespace).toBe('narrative');
    expect(narrativeModule.tasks['observe-document']).toBe(
      narrativeObserveDocumentTask,
    );
    expect(narrativeModule.stateSchemaVersion).toBe('narrative-state/1');
    expect(narrativeModule.deltaSchemaVersion).toBe('narrative-delta/1');
    expect(fixtureEntityId).toBe('story-1');
  });
});
