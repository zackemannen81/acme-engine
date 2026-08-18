/**
 * The V2 compare module.
 *
 * A separate namespace from observe on purpose. J4 must not share
 * `evidence-v2-state/1` with J3: a compare window is not an extraction
 * window, and mixing their bookkeeping would let one job's resume pointer
 * speak for the other. State here records only that a compare window's
 * relations were committed. The product persists the relations themselves.
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
  EVIDENCE_V2_COMPARE_CONTRACT_ID,
  EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
  EvidenceV2CompareInputSchema,
  type EvidenceV2CompareInput,
  type EvidenceV2CompareOutput,
} from './compare-contract.js';
import {
  EVIDENCE_V2_RELATION_SCHEMA_VERSION,
  EvidenceV2RelationSchema,
  deriveEvidenceV2RelationId,
  type EvidenceV2Relation,
} from './relation.js';

export const EVIDENCE_V2_COMPARE_NAMESPACE = 'evidence-v2-compare';
export const EVIDENCE_V2_COMPARE_STATE_SCHEMA_VERSION =
  'evidence-v2-compare-state/1';
export const EVIDENCE_V2_COMPARE_DELTA_SCHEMA_VERSION =
  'evidence-v2-compare-delta/1';
export const EVIDENCE_V2_RELATION_MEMORY_TYPE = 'evidence-v2-relation';

export const EvidenceV2CompareStateSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_COMPARE_STATE_SCHEMA_VERSION),
    entityId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    committedWindowIds: z.array(z.string().min(1)),
    relationIds: z.array(z.string().min(1)),
  })
  .strict();

export type EvidenceV2CompareState = z.infer<
  typeof EvidenceV2CompareStateSchema
>;

export const EvidenceV2CompareDeltaSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_COMPARE_DELTA_SCHEMA_VERSION),
    windowId: z.string().min(1),
    addRelationIds: z.array(z.string().min(1)),
    nextRevision: z.number().int().positive(),
  })
  .strict();

export type EvidenceV2CompareDelta = z.infer<
  typeof EvidenceV2CompareDeltaSchema
>;

export const EvidenceV2CompareTaskInputSchema = z
  .object({
    schemaVersion: z.literal('evidence-v2-compare-task/1'),
    caseId: z.string().min(1),
    chainId: z.string().min(1),
    instanceKey: z.string().min(1),
    window: EvidenceV2CompareInputSchema,
  })
  .strict();

export type EvidenceV2CompareTaskInput = z.infer<
  typeof EvidenceV2CompareTaskInputSchema
>;

function relationOf(
  candidate: EvidenceV2CompareOutput['relations'][number],
  input: EvidenceV2CompareTaskInput,
  executionId: string,
  createdAt: string,
): EvidenceV2Relation {
  const from = input.window.current.find(
    (item) => item.occurrenceId === candidate.fromOccurrenceId,
  );
  const to = input.window.prior.find(
    (item) => item.occurrenceId === candidate.toOccurrenceId,
  );
  if (from === undefined || to === undefined) {
    throw new RangeError('EVIDENCE_V2_COMPARE_ENDPOINT_OUTSIDE_WINDOW');
  }
  return EvidenceV2RelationSchema.parse({
    schemaVersion: EVIDENCE_V2_RELATION_SCHEMA_VERSION,
    relationId: deriveEvidenceV2RelationId({
      caseId: input.caseId,
      fromKind: 'occurrence',
      fromId: from.occurrenceId,
      toKind: 'occurrence',
      toId: to.occurrenceId,
      type: candidate.type,
      createdAt,
    }),
    caseId: input.caseId,
    artifactId: input.window.artifactId,
    chainId: input.chainId,
    from: { kind: 'occurrence', id: from.occurrenceId },
    to: { kind: 'occurrence', id: to.occurrenceId },
    type: candidate.type,
    comparableScope: candidate.comparableScope,
    rationale: candidate.rationale,
    provenance: 'model-proposed',
    createdBy: executionId,
    createdAt,
    executionId,
    contractVersion: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
    windowId: input.window.windowId,
  });
}

const compareWindowTask: TaskDefinition<
  EvidenceV2CompareTaskInput,
  EvidenceV2CompareInput,
  EvidenceV2CompareOutput,
  EvidenceV2CompareState,
  EvidenceV2CompareDelta
> = {
  role: 'producer',
  inputSchema: EvidenceV2CompareTaskInputSchema,
  contract: {
    id: EVIDENCE_V2_COMPARE_CONTRACT_ID,
    version: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
  },

  project(input) {
    return input.window;
  },

  interpret(output, input, context) {
    const relations = output.relations.map((candidate) =>
      relationOf(candidate, input, context.executionId, context.now),
    );
    const memories: MemoryCandidate[] = relations.map((relation) => ({
      key: relation.relationId,
      kind: EVIDENCE_V2_RELATION_MEMORY_TYPE,
      schemaVersion: EVIDENCE_V2_RELATION_SCHEMA_VERSION,
      value: relation as unknown as JsonValue,
      source: {
        executionId: context.executionId,
        contract: {
          id: EVIDENCE_V2_COMPARE_CONTRACT_ID,
          version: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
        },
        documentKeys: [],
      },
    }));
    return {
      documents: [],
      memories,
      stateIntent: {
        schemaVersion: EVIDENCE_V2_COMPARE_DELTA_SCHEMA_VERSION,
        value: {
          schemaVersion: EVIDENCE_V2_COMPARE_DELTA_SCHEMA_VERSION,
          windowId: input.window.windowId,
          addRelationIds: relations.map((item) => item.relationId),
          nextRevision: (context.state?.revision ?? 0) + 1,
        },
      },
      events: [],
      diagnostics: [],
    } satisfies ModuleResult<EvidenceV2CompareDelta>;
  },

  projectState(input) {
    return input.stateIntent;
  },
};

export const evidenceV2CompareModule: DomainModule<
  EvidenceV2CompareState,
  EvidenceV2CompareDelta,
  { readonly 'compare-window': typeof compareWindowTask }
> = {
  namespace: EVIDENCE_V2_COMPARE_NAMESPACE,
  stateSchemaVersion: EVIDENCE_V2_COMPARE_STATE_SCHEMA_VERSION,
  deltaSchemaVersion: EVIDENCE_V2_COMPARE_DELTA_SCHEMA_VERSION,
  stateSchema: EvidenceV2CompareStateSchema,
  deltaSchema: EvidenceV2CompareDeltaSchema,
  tasks: { 'compare-window': compareWindowTask },

  memoryPolicy: {
    validate(candidate) {
      const parsed = EvidenceV2RelationSchema.safeParse(candidate.value);
      return parsed.success
        ? []
        : [
            {
              code: 'EVIDENCE_V2_RELATION_INVALID',
              message: 'A memory candidate must be a valid relation.',
              path: ['payload'],
            } satisfies DomainIssue,
          ];
    },
    identity(candidate) {
      return candidate.key;
    },
    retrieve() {
      // Comparison input is in the prompt. Memory is not a second source of
      // prior occurrences, which is what keeps extraction's retrieve-nothing
      // rule from being quietly reversed here.
      return [];
    },
    resolve(candidate, existing) {
      return existing.some((record) => record.identityKey === candidate.key)
        ? {
            candidateKey: candidate.key,
            action: 'ignore',
            reason: 'duplicate-relation',
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
      schemaVersion: EVIDENCE_V2_COMPARE_STATE_SCHEMA_VERSION,
      entityId: context.entityId,
      revision: 0,
      committedWindowIds: [],
      relationIds: [],
    };
  },

  reduce(state, delta) {
    return {
      ...state,
      revision: delta.nextRevision,
      committedWindowIds: state.committedWindowIds.includes(delta.windowId)
        ? state.committedWindowIds
        : [...state.committedWindowIds, delta.windowId],
      relationIds: [
        ...state.relationIds,
        ...delta.addRelationIds.filter((id) => !state.relationIds.includes(id)),
      ],
    };
  },

  invariants(next, previous) {
    const issues: DomainIssue[] = [];
    if (previous !== null && next.revision !== previous.revision + 1) {
      issues.push({
        code: 'EVIDENCE_V2_COMPARE_REVISION_STEP',
        message: 'Compare state advances exactly one revision per window.',
        path: ['revision'],
      });
    }
    if (new Set(next.relationIds).size !== next.relationIds.length) {
      issues.push({
        code: 'EVIDENCE_V2_RELATION_DUPLICATED',
        message: 'A relation may appear once in compare state.',
        path: ['relationIds'],
      });
    }
    if (previous !== null) {
      for (const id of previous.relationIds) {
        if (!next.relationIds.includes(id)) {
          issues.push({
            code: 'EVIDENCE_V2_RELATION_REMOVED',
            message: 'A relation is never removed from compare state.',
            path: ['relationIds'],
          });
          break;
        }
      }
    }
    return issues;
  },
};

export const evidenceV2CompareModuleForRegistry: AnyDomainModule =
  evidenceV2CompareModule;
