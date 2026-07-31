import {
  AcmeError,
  canonicalJson,
  defineTask,
  type ExecutionReadContext,
  type JsonValue,
  type MemoryCandidate,
  type ModuleResult,
  type StateDelta,
  type StateProjectionInput,
} from '@acme/core';

import { NARRATIVE_OBSERVE_DOCUMENT_CONTRACT_REF } from '../contracts/observe-document.js';
import {
  narrativeMemoryIdentity,
  normalizeReferenceText,
  resolveNarrativeEntity,
} from '../identity.js';
import { immutableJson } from '../immutable.js';
import { narrowCorrection, narrowScene, omitAbsent } from '../observed.js';
import { buildPreviousDocumentTail } from '../previous-document-tail.js';
import {
  NARRATIVE_CONTRACT_INPUT_VERSION,
  NARRATIVE_DELTA_SCHEMA_VERSION,
  NARRATIVE_MEMORY_SCHEMA_VERSION,
  NARRATIVE_NAMESPACE,
  NARRATIVE_SOURCE_KIND,
  NARRATIVE_SOURCE_SCHEMA_VERSION,
  NARRATIVE_STATE_SCHEMA_VERSION,
  NARRATIVE_WINDOW_POLICY_VERSION,
  NarrativeContractOutputSchema,
  NarrativeDeltaSchema,
  NarrativeMemoryValueSchema,
  NarrativeObserveInputSchema,
  NarrativeSourceDocumentSchema,
  NarrativeStateSchema,
  type NarrativeContractInput,
  type NarrativeContractOutput,
  type NarrativeDelta,
  type NarrativeMemoryValue,
  type NarrativeObserveInput,
  type NarrativeState,
} from '../schemas.js';
import { initialNarrativeState } from '../state.js';
import { narrativeSourceContentHash } from '../previous-document-tail.js';

function sourceDocument(input: NarrativeObserveInput) {
  return NarrativeSourceDocumentSchema.parse({
    documentKey: input.documentKey,
    ...(input.title === undefined ? {} : { title: input.title }),
    text: input.text,
  });
}

function readState(
  context: ExecutionReadContext<NarrativeState>,
): NarrativeState {
  if (context.state === null) {
    return initialNarrativeState();
  }
  if (
    context.state.namespace !== NARRATIVE_NAMESPACE ||
    context.state.entityId !== context.entityId ||
    context.state.schemaVersion !== NARRATIVE_STATE_SCHEMA_VERSION
  ) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: 'Narrative read context contains a foreign state snapshot.',
      stage: 'loading',
      retryable: false,
    });
  }
  return NarrativeStateSchema.parse(context.state.value);
}

function projectedMemories(
  context: ExecutionReadContext<NarrativeState>,
): NarrativeContractInput['relevantMemories'] {
  return context.memories
    .filter(
      (record) =>
        record.namespace === NARRATIVE_NAMESPACE &&
        record.entityId === context.entityId &&
        (record.status === 'active' || record.status === 'contested') &&
        record.schemaVersion === NARRATIVE_MEMORY_SCHEMA_VERSION &&
        NarrativeMemoryValueSchema.safeParse(record.value).success,
    )
    .map((record) => ({
      identityKey: record.identityKey,
      kind: record.kind as
        | 'narrative.character-fact'
        | 'narrative.relationship'
        | 'narrative.world-rule',
      status: record.status as 'active' | 'contested',
      value: record.value,
    }))
    .sort(
      (left, right) =>
        left.identityKey.localeCompare(right.identityKey) ||
        left.kind.localeCompare(right.kind) ||
        canonicalJson(left.value).localeCompare(canonicalJson(right.value)),
    );
}

function candidate(
  key: string,
  value: NarrativeMemoryValue,
  confidence: number,
  input: NarrativeObserveInput,
  context: ExecutionReadContext<NarrativeState>,
): MemoryCandidate {
  return immutableJson({
    key,
    kind: value.kind,
    schemaVersion: NARRATIVE_MEMORY_SCHEMA_VERSION,
    value: value as unknown as JsonValue,
    confidence,
    source: {
      executionId: context.executionId,
      contract: NARRATIVE_OBSERVE_DOCUMENT_CONTRACT_REF,
      documentKeys: [input.documentKey],
    },
  });
}

function interpretOutput(
  output: NarrativeContractOutput,
  input: NarrativeObserveInput,
  context: ExecutionReadContext<NarrativeState>,
): ModuleResult<NarrativeDelta> {
  const validatedInput = NarrativeObserveInputSchema.parse(input);
  const validatedOutput = NarrativeContractOutputSchema.parse(output);
  const state = readState(context);
  const document = sourceDocument(validatedInput);
  // An explicitly unknown outline progress is not worth recording, so it is
  // narrowed to the same absence the delta schema already expects.
  const outlineProgress = omitAbsent(validatedOutput.outlineProgress);

  const memories = validatedOutput.observations.map(
    (observation, index): MemoryCandidate => {
      const key = `narrative-memory-${String(index + 1).padStart(4, '0')}`;
      switch (observation.type) {
        case 'character-fact': {
          const subject = resolveNarrativeEntity(observation.subject, state);
          const reported = omitAbsent(observation.correction);
          const correction =
            reported === undefined ? undefined : narrowCorrection(reported);
          const value: NarrativeMemoryValue = {
            kind: 'narrative.character-fact',
            entityKey: subject.entityKey,
            observedLabels: [observation.subject],
            predicate: observation.predicate,
            normalizedPredicate: normalizeReferenceText(observation.predicate),
            value: observation.value,
            ...(correction === undefined ? {} : { correction }),
            ...(correction !== undefined &&
            validatedInput.text.includes(correction.evidenceQuote)
              ? {
                  validatedCorrection: {
                    ...correction,
                    documentKey: validatedInput.documentKey,
                    correctionEvidenceValidated: true as const,
                  },
                }
              : {}),
          };
          return candidate(
            key,
            value,
            observation.confidence,
            validatedInput,
            context,
          );
        }
        case 'relationship': {
          const subject = resolveNarrativeEntity(observation.subject, state);
          const object = resolveNarrativeEntity(observation.object, state);
          return candidate(
            key,
            {
              kind: 'narrative.relationship',
              subjectEntityKey: subject.entityKey,
              subjectLabels: [observation.subject],
              relation: observation.relation,
              normalizedRelation: normalizeReferenceText(observation.relation),
              objectEntityKey: object.entityKey,
              objectLabels: [observation.object],
            },
            observation.confidence,
            validatedInput,
            context,
          );
        }
        case 'world-rule':
          return candidate(
            key,
            {
              kind: 'narrative.world-rule',
              normalizedRule: normalizeReferenceText(observation.rule),
              observedRules: [observation.rule],
            },
            observation.confidence,
            validatedInput,
            context,
          );
      }
    },
  );

  return immutableJson({
    documents: [
      {
        key: validatedInput.documentKey,
        kind: NARRATIVE_SOURCE_KIND,
        schemaVersion: NARRATIVE_SOURCE_SCHEMA_VERSION,
        value: document as unknown as JsonValue,
        contentHash: narrativeSourceContentHash(document),
      },
    ],
    memories,
    stateIntent: {
      schemaVersion: NARRATIVE_DELTA_SCHEMA_VERSION,
      value: {
        entityAssignments: [],
        aliasAssignments: [],
        scene: narrowScene(validatedOutput.scene),
        ...(outlineProgress === undefined ? {} : { outlineProgress }),
        appendWindow: {
          documentKey: validatedInput.documentKey,
          summary: validatedOutput.scene.summary,
        },
      },
    },
    events: [],
    diagnostics: [
      {
        code: 'NARRATIVE_DOCUMENT_OBSERVED',
        severity: 'info',
        value: {
          documentKey: validatedInput.documentKey,
          observationCount: memories.length,
        },
      },
    ],
  });
}

function addEntity(
  entities: Map<string, string>,
  aliases: Map<string, string>,
  entityKey: string,
  labels: readonly string[],
): void {
  const displayName = labels[0];
  if (displayName === undefined) {
    return;
  }
  if (!entities.has(entityKey)) {
    entities.set(entityKey, displayName);
  }
  for (const label of labels) {
    aliases.set(normalizeReferenceText(label), entityKey);
  }
}

function projectNarrativeState(
  input: StateProjectionInput<NarrativeDelta>,
): StateDelta<NarrativeDelta> | undefined {
  if (input.stateIntent === undefined) {
    return undefined;
  }
  const direct = NarrativeDeltaSchema.parse(input.stateIntent.value);
  const entities = new Map(
    direct.entityAssignments.map(
      ({ entityKey, displayName }) => [entityKey, displayName] as const,
    ),
  );
  const aliases = new Map(
    direct.aliasAssignments.map(
      ({ normalizedAlias, entityKey }) => [normalizedAlias, entityKey] as const,
    ),
  );

  for (const decision of input.memory) {
    if (
      decision.resolution.action !== 'create' &&
      decision.resolution.action !== 'reinforce' &&
      decision.resolution.action !== 'merge'
    ) {
      continue;
    }
    if (decision.candidate.schemaVersion !== NARRATIVE_MEMORY_SCHEMA_VERSION) {
      throw new AcmeError({
        code: 'DOMAIN_INVALID_RESULT',
        message: 'Narrative state projection received an invalid candidate.',
        stage: 'preparing-commit',
        retryable: false,
      });
    }
    const value = NarrativeMemoryValueSchema.parse(decision.candidate.value);
    if (
      decision.candidate.kind !== value.kind ||
      decision.identityKey !== narrativeMemoryIdentity(value)
    ) {
      throw new AcmeError({
        code: 'DOMAIN_INVALID_RESULT',
        message:
          'Narrative state projection candidate identity does not match its prepared decision.',
        stage: 'preparing-commit',
        retryable: false,
      });
    }
    switch (value.kind) {
      case 'narrative.character-fact':
        addEntity(entities, aliases, value.entityKey, value.observedLabels);
        break;
      case 'narrative.relationship':
        addEntity(
          entities,
          aliases,
          value.subjectEntityKey,
          value.subjectLabels,
        );
        addEntity(entities, aliases, value.objectEntityKey, value.objectLabels);
        break;
      case 'narrative.world-rule':
        break;
    }
  }

  return immutableJson({
    schemaVersion: NARRATIVE_DELTA_SCHEMA_VERSION,
    value: {
      ...direct,
      entityAssignments: [...entities].map(([entityKey, displayName]) => ({
        entityKey,
        displayName,
      })),
      aliasAssignments: [...aliases].map(([normalizedAlias, entityKey]) => ({
        normalizedAlias,
        entityKey,
      })),
    },
  });
}

export const narrativeObserveDocumentTask = defineTask<
  NarrativeObserveInput,
  NarrativeContractInput,
  NarrativeContractOutput,
  NarrativeState,
  NarrativeDelta
>({
  role: 'analyzer',
  inputSchema: NarrativeObserveInputSchema,
  contract: NARRATIVE_OBSERVE_DOCUMENT_CONTRACT_REF,

  project(input, context) {
    const validated = NarrativeObserveInputSchema.parse(input);
    const state = readState(context);
    return immutableJson({
      contractInputVersion: NARRATIVE_CONTRACT_INPUT_VERSION,
      stateSchemaVersion: NARRATIVE_STATE_SCHEMA_VERSION,
      windowPolicyVersion: NARRATIVE_WINDOW_POLICY_VERSION,
      document: sourceDocument(validated),
      previousEnding: buildPreviousDocumentTail(
        state,
        context.documents,
        context.entityId,
      ),
      scene: state.scene,
      narrativeWindow: state.narrativeWindow,
      outlineProgress: state.outlineProgress,
      entityAliases: state.entityAliases,
      relevantMemories: projectedMemories(context),
    });
  },

  interpret(output, input, context) {
    return interpretOutput(output, input, context);
  },

  projectState(input) {
    return projectNarrativeState(input);
  },
});
