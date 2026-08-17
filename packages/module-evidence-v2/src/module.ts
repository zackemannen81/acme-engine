/**
 * The V2 domain module.
 *
 * Deliberately small. ADR-0048 §8 uses the engine unchanged, so this supplies
 * only what `@acme/core` requires to execute one task: a namespace, a state, a
 * delta, a reducer, invariants, a memory policy and one task definition.
 *
 * State here is the engine's bookkeeping, not the product's. Occurrences are
 * projected into the V2 repository per committed window (ADR-0048 §6); this
 * state records only that a window's occurrences were committed, which is what
 * makes a resumed extraction able to tell what it already paid for.
 */

import type {
  AnyDomainModule,
  DomainIssue,
  DomainModule,
  JsonValue,
  MemoryCandidate,
  ModuleResult,
  TaskDefinition,
} from '@acme/core';
import { z } from 'zod';

import {
  EVIDENCE_V2_OBSERVE_CONTRACT_ID,
  EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
  EvidenceV2ObserveInputSchema,
  type EvidenceV2ObserveInput,
  type EvidenceV2ObserveOutput,
} from './observe-contract.js';
import {
  EVIDENCE_V2_OCCURRENCE_SCHEMA_VERSION,
  EvidenceV2OccurrenceSchema,
  deriveEvidenceV2OccurrenceId,
  type EvidenceV2Occurrence,
} from './occurrence.js';

export const EVIDENCE_V2_NAMESPACE = 'evidence-v2';
export const EVIDENCE_V2_STATE_SCHEMA_VERSION = 'evidence-v2-state/1';
export const EVIDENCE_V2_DELTA_SCHEMA_VERSION = 'evidence-v2-delta/1';
export const EVIDENCE_V2_OCCURRENCE_MEMORY_TYPE = 'evidence-v2-occurrence';

export const EvidenceV2StateSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_STATE_SCHEMA_VERSION),
    entityId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    committedWindowIds: z.array(z.string().min(1)),
    occurrenceIds: z.array(z.string().min(1)),
  })
  .strict();

export type EvidenceV2State = z.infer<typeof EvidenceV2StateSchema>;

export const EvidenceV2DeltaSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_DELTA_SCHEMA_VERSION),
    windowId: z.string().min(1),
    addOccurrenceIds: z.array(z.string().min(1)),
    nextRevision: z.number().int().positive(),
  })
  .strict();

export type EvidenceV2Delta = z.infer<typeof EvidenceV2DeltaSchema>;

/** The task's own input: one window, plus who is asking. */
export const EvidenceV2ObserveTaskInputSchema = z
  .object({
    schemaVersion: z.literal('evidence-v2-observe-task/1'),
    caseId: z.string().min(1),
    chainId: z.string().min(1),
    instanceKey: z.string().min(1),
    window: EvidenceV2ObserveInputSchema,
  })
  .strict();

export type EvidenceV2ObserveTaskInput = z.infer<
  typeof EvidenceV2ObserveTaskInputSchema
>;

function occurrenceOf(
  observation: EvidenceV2ObserveOutput['observations'][number],
  input: EvidenceV2ObserveTaskInput,
  executionId: string,
): EvidenceV2Occurrence {
  const unit = input.window.units.find(
    (item) => item.unitId === observation.sourceUnitId,
  );
  if (unit === undefined) {
    // Unreachable: the contract refuses a unit outside the window before
    // interpretation runs. Kept explicit so a future contract change cannot
    // silently fabricate an occurrence without a source.
    throw new RangeError('EVIDENCE_V2_UNIT_OUTSIDE_WINDOW');
  }
  return EvidenceV2OccurrenceSchema.parse({
    schemaVersion: EVIDENCE_V2_OCCURRENCE_SCHEMA_VERSION,
    occurrenceId: deriveEvidenceV2OccurrenceId({
      artifactId: input.window.artifactId,
      unitId: unit.unitId,
      contractVersion: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
    }),
    artifactId: input.window.artifactId,
    partId: input.window.partId,
    unitId: unit.unitId,
    // Locator and quote come from the unit, never from the response.
    startLine: unit.startLine,
    endLine: unit.endLine,
    exactQuote: unit.exactQuote,
    kind: observation.kind,
    actorReference: null,
    temporalBound: observation.temporalBound,
    executionId,
    contractVersion: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
    windowId: input.window.windowId,
  });
}

const observeWindowTask: TaskDefinition<
  EvidenceV2ObserveTaskInput,
  EvidenceV2ObserveInput,
  EvidenceV2ObserveOutput,
  EvidenceV2State,
  EvidenceV2Delta
> = {
  role: 'producer',
  inputSchema: EvidenceV2ObserveTaskInputSchema,
  contract: {
    id: EVIDENCE_V2_OBSERVE_CONTRACT_ID,
    version: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
  },

  project(input) {
    return input.window;
  },

  interpret(output, input, context) {
    const occurrences = output.observations.map((observation) =>
      occurrenceOf(observation, input, context.executionId),
    );
    const memories: MemoryCandidate[] = occurrences.map((occurrence) => ({
      key: occurrence.occurrenceId,
      kind: EVIDENCE_V2_OCCURRENCE_MEMORY_TYPE,
      schemaVersion: EVIDENCE_V2_OCCURRENCE_SCHEMA_VERSION,
      value: occurrence as unknown as JsonValue,
      source: {
        executionId: context.executionId,
        contract: {
          id: EVIDENCE_V2_OBSERVE_CONTRACT_ID,
          version: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
        },
        documentKeys: [],
      },
    }));
    return {
      documents: [],
      memories,
      stateIntent: {
        schemaVersion: EVIDENCE_V2_DELTA_SCHEMA_VERSION,
        value: {
          schemaVersion: EVIDENCE_V2_DELTA_SCHEMA_VERSION,
          windowId: input.window.windowId,
          addOccurrenceIds: occurrences.map((item) => item.occurrenceId),
          nextRevision: (context.state?.revision ?? 0) + 1,
        },
      },
      events: [],
      diagnostics: [],
    } satisfies ModuleResult<EvidenceV2Delta>;
  },

  projectState(input) {
    return input.stateIntent;
  },
};

export const evidenceV2Module: DomainModule<
  EvidenceV2State,
  EvidenceV2Delta,
  { readonly 'observe-window': typeof observeWindowTask }
> = {
  namespace: EVIDENCE_V2_NAMESPACE,
  stateSchemaVersion: EVIDENCE_V2_STATE_SCHEMA_VERSION,
  deltaSchemaVersion: EVIDENCE_V2_DELTA_SCHEMA_VERSION,
  stateSchema: EvidenceV2StateSchema,
  deltaSchema: EvidenceV2DeltaSchema,
  tasks: { 'observe-window': observeWindowTask },

  memoryPolicy: {
    validate(candidate) {
      const parsed = EvidenceV2OccurrenceSchema.safeParse(candidate.value);
      return parsed.success
        ? []
        : [
            {
              code: 'EVIDENCE_V2_OCCURRENCE_INVALID',
              message: 'A memory candidate must be a valid occurrence.',
              path: ['payload'],
            } satisfies DomainIssue,
          ];
    },
    identity(candidate) {
      return candidate.key;
    },
    retrieve() {
      // Extraction is Pass 1 and retrieves nothing (ADR-0046 §4).
      return [];
    },
    resolve(candidate, existing) {
      // An occurrence is immutable and content-identified: seeing it again is
      // the same occurrence, never a revision of one.
      return existing.some((record) => record.identityKey === candidate.key)
        ? {
            candidateKey: candidate.key,
            action: 'ignore',
            reason: 'duplicate-occurrence',
          }
        : {
            candidateKey: candidate.key,
            action: 'create',
            value: candidate.value,
            strength: 1,
          };
    },
    lifecycle() {
      return { action: 'retain' };
    },
  },

  initialState(context) {
    return {
      schemaVersion: EVIDENCE_V2_STATE_SCHEMA_VERSION,
      entityId: context.entityId,
      revision: 0,
      committedWindowIds: [],
      occurrenceIds: [],
    };
  },

  reduce(state, delta) {
    return {
      ...state,
      revision: delta.nextRevision,
      committedWindowIds: state.committedWindowIds.includes(delta.windowId)
        ? state.committedWindowIds
        : [...state.committedWindowIds, delta.windowId],
      occurrenceIds: [
        ...state.occurrenceIds,
        ...delta.addOccurrenceIds.filter(
          (id) => !state.occurrenceIds.includes(id),
        ),
      ],
    };
  },

  invariants(next, previous) {
    const issues: DomainIssue[] = [];
    if (previous !== null && next.revision !== previous.revision + 1) {
      issues.push({
        code: 'EVIDENCE_V2_REVISION_STEP',
        message: 'Evidence V2 state advances exactly one revision per window.',
        path: ['revision'],
      });
    }
    if (new Set(next.occurrenceIds).size !== next.occurrenceIds.length) {
      issues.push({
        code: 'EVIDENCE_V2_OCCURRENCE_DUPLICATED',
        message: 'An occurrence may appear once in state.',
        path: ['occurrenceIds'],
      });
    }
    if (previous !== null) {
      for (const id of previous.occurrenceIds) {
        if (!next.occurrenceIds.includes(id)) {
          issues.push({
            code: 'EVIDENCE_V2_OCCURRENCE_REMOVED',
            message: 'An occurrence is immutable and is never removed.',
            path: ['occurrenceIds'],
          });
          break;
        }
      }
    }
    return issues;
  },
};

/** Erased registry boundary, as the frozen module does it. */
export const evidenceV2ModuleForRegistry: AnyDomainModule = evidenceV2Module;
