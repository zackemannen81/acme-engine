import { z } from 'zod';

import type { JsonValue } from '@acme/core';

export const NARRATIVE_NAMESPACE = 'narrative' as const;
export const NARRATIVE_STATE_SCHEMA_VERSION = 'narrative-state/1' as const;
export const NARRATIVE_DELTA_SCHEMA_VERSION = 'narrative-delta/1' as const;
export const NARRATIVE_SOURCE_KIND = 'narrative.source' as const;
export const NARRATIVE_SOURCE_SCHEMA_VERSION = 'narrative-source/1' as const;
export const NARRATIVE_MEMORY_SCHEMA_VERSION = 'narrative-memory/1' as const;
export const NARRATIVE_WINDOW_POLICY_VERSION = 'narrative-window-1' as const;
export const PREVIOUS_DOCUMENT_TAIL_ALGORITHM =
  'previous-document-tail-1' as const;
export const NARRATIVE_CONTRACT_INPUT_VERSION =
  'narrative-observe-input/1' as const;

const nonBlankString = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: 'Expected a non-blank string.',
  });
const confidence = z.number().finite().min(0).max(1);
const entityKey = nonBlankString;
const jsonValueSchema = z.json() as z.ZodType<JsonValue>;

export const NarrativeObserveInputSchema = z
  .object({
    documentKey: nonBlankString,
    title: nonBlankString.optional(),
    text: nonBlankString,
  })
  .strict();

export const NarrativeSourceDocumentSchema = z
  .object({
    documentKey: nonBlankString,
    title: nonBlankString.optional(),
    text: nonBlankString,
  })
  .strict();

export const NarrativeSceneSchema = z
  .object({
    location: nonBlankString.optional(),
    time: nonBlankString.optional(),
    summary: nonBlankString,
  })
  .strict();

export const NarrativeOutlineStatusSchema = z.enum([
  'introduced',
  'advanced',
  'resolved',
]);

export const NarrativeOutlineProgressSchema = z
  .object({
    beatId: nonBlankString,
    status: NarrativeOutlineStatusSchema,
  })
  .strict();

export const NarrativeCorrectionEvidenceSchema = z
  .object({
    targetIdentityKey: nonBlankString,
    supersedesValue: nonBlankString,
    evidenceQuote: nonBlankString,
    sourceLocator: nonBlankString.optional(),
  })
  .strict();

export const NarrativeCharacterFactObservationSchema = z
  .object({
    type: z.literal('character-fact'),
    subject: nonBlankString,
    predicate: nonBlankString,
    value: nonBlankString,
    confidence,
    correction: NarrativeCorrectionEvidenceSchema.optional(),
  })
  .strict();

export const NarrativeRelationshipObservationSchema = z
  .object({
    type: z.literal('relationship'),
    subject: nonBlankString,
    relation: nonBlankString,
    object: nonBlankString,
    confidence,
  })
  .strict();

export const NarrativeWorldRuleObservationSchema = z
  .object({
    type: z.literal('world-rule'),
    rule: nonBlankString,
    confidence,
  })
  .strict();

export const NarrativeObservationSchema = z.discriminatedUnion('type', [
  NarrativeCharacterFactObservationSchema,
  NarrativeRelationshipObservationSchema,
  NarrativeWorldRuleObservationSchema,
]);

export const NarrativeContractOutputSchema = z
  .object({
    observations: z.array(NarrativeObservationSchema),
    scene: NarrativeSceneSchema,
    outlineProgress: NarrativeOutlineProgressSchema.optional(),
  })
  .strict();

export const PreviousDocumentTailSchema = z.discriminatedUnion('source', [
  z
    .object({
      algorithm: z.literal(PREVIOUS_DOCUMENT_TAIL_ALGORITHM),
      source: z.literal('initial'),
      text: z.literal(''),
    })
    .strict(),
  z
    .object({
      algorithm: z.literal(PREVIOUS_DOCUMENT_TAIL_ALGORITHM),
      source: z.literal('document-content'),
      documentKey: nonBlankString,
      sourceContentHash: nonBlankString,
      text: nonBlankString.refine(
        (value) => Array.from(value).length <= 320,
        'Previous document tail exceeds 320 Unicode code points.',
      ),
      truncated: z.boolean(),
    })
    .strict(),
]);

export const NarrativeWindowEntrySchema = z
  .object({
    documentKey: nonBlankString,
    summary: nonBlankString,
  })
  .strict();

export const NarrativeContractMemorySchema = z
  .object({
    identityKey: nonBlankString,
    kind: z.enum([
      'narrative.character-fact',
      'narrative.relationship',
      'narrative.world-rule',
    ]),
    status: z.enum(['active', 'contested']),
    value: jsonValueSchema,
  })
  .strict();

export const NarrativeContractInputSchema = z
  .object({
    contractInputVersion: z.literal(NARRATIVE_CONTRACT_INPUT_VERSION),
    stateSchemaVersion: z.literal(NARRATIVE_STATE_SCHEMA_VERSION),
    windowPolicyVersion: z.literal(NARRATIVE_WINDOW_POLICY_VERSION),
    document: NarrativeSourceDocumentSchema,
    previousEnding: PreviousDocumentTailSchema,
    scene: NarrativeSceneSchema.nullable(),
    narrativeWindow: z.array(NarrativeWindowEntrySchema).max(2),
    outlineProgress: z.record(nonBlankString, NarrativeOutlineStatusSchema),
    entityAliases: z.record(nonBlankString, entityKey),
    relevantMemories: z.array(NarrativeContractMemorySchema),
  })
  .strict();

export const NarrativeCharacterSchema = z
  .object({
    displayName: nonBlankString,
  })
  .strict();

export const NarrativeStateSchema = z
  .object({
    windowPolicyVersion: z.literal(NARRATIVE_WINDOW_POLICY_VERSION),
    characters: z.record(entityKey, NarrativeCharacterSchema),
    entityAliases: z.record(nonBlankString, entityKey),
    scene: NarrativeSceneSchema.nullable(),
    narrativeWindow: z.array(NarrativeWindowEntrySchema).max(2),
    outlineProgress: z.record(nonBlankString, NarrativeOutlineStatusSchema),
  })
  .strict();

export const NarrativeEntityAssignmentSchema = z
  .object({
    entityKey,
    displayName: nonBlankString,
  })
  .strict();

export const NarrativeAliasAssignmentSchema = z
  .object({
    normalizedAlias: nonBlankString,
    entityKey,
  })
  .strict();

export const NarrativeDeltaSchema = z
  .object({
    entityAssignments: z.array(NarrativeEntityAssignmentSchema),
    aliasAssignments: z.array(NarrativeAliasAssignmentSchema),
    scene: NarrativeSceneSchema,
    outlineProgress: NarrativeOutlineProgressSchema.optional(),
    appendWindow: NarrativeWindowEntrySchema,
  })
  .strict();

export const NarrativeValidatedCorrectionEvidenceSchema =
  NarrativeCorrectionEvidenceSchema.extend({
    documentKey: nonBlankString,
    correctionEvidenceValidated: z.literal(true),
  }).strict();

export const NarrativeCharacterFactMemoryValueSchema = z
  .object({
    kind: z.literal('narrative.character-fact'),
    entityKey,
    observedLabels: z.array(nonBlankString).min(1),
    predicate: nonBlankString,
    normalizedPredicate: nonBlankString,
    value: nonBlankString,
    correction: NarrativeCorrectionEvidenceSchema.optional(),
    validatedCorrection: NarrativeValidatedCorrectionEvidenceSchema.optional(),
  })
  .strict();

export const NarrativeRelationshipMemoryValueSchema = z
  .object({
    kind: z.literal('narrative.relationship'),
    subjectEntityKey: entityKey,
    subjectLabels: z.array(nonBlankString).min(1),
    relation: nonBlankString,
    normalizedRelation: nonBlankString,
    objectEntityKey: entityKey,
    objectLabels: z.array(nonBlankString).min(1),
  })
  .strict();

export const NarrativeWorldRuleMemoryValueSchema = z
  .object({
    kind: z.literal('narrative.world-rule'),
    normalizedRule: nonBlankString,
    observedRules: z.array(nonBlankString).min(1),
  })
  .strict();

export const NarrativeMemoryValueSchema = z.discriminatedUnion('kind', [
  NarrativeCharacterFactMemoryValueSchema,
  NarrativeRelationshipMemoryValueSchema,
  NarrativeWorldRuleMemoryValueSchema,
]);

export type NarrativeObserveInput = z.infer<typeof NarrativeObserveInputSchema>;
export type NarrativeSourceDocument = z.infer<
  typeof NarrativeSourceDocumentSchema
>;
export type NarrativeScene = z.infer<typeof NarrativeSceneSchema>;
export type NarrativeOutlineStatus = z.infer<
  typeof NarrativeOutlineStatusSchema
>;
export type NarrativeOutlineProgress = z.infer<
  typeof NarrativeOutlineProgressSchema
>;
export type NarrativeCorrectionEvidence = z.infer<
  typeof NarrativeCorrectionEvidenceSchema
>;
export type NarrativeObservation = z.infer<typeof NarrativeObservationSchema>;
export type NarrativeContractOutput = z.infer<
  typeof NarrativeContractOutputSchema
>;
export type PreviousDocumentTail = z.infer<typeof PreviousDocumentTailSchema>;
export type NarrativeContractInput = z.infer<
  typeof NarrativeContractInputSchema
>;
export type NarrativeState = z.infer<typeof NarrativeStateSchema>;
export type NarrativeDelta = z.infer<typeof NarrativeDeltaSchema>;
export type NarrativeCharacterFactMemoryValue = z.infer<
  typeof NarrativeCharacterFactMemoryValueSchema
>;
export type NarrativeRelationshipMemoryValue = z.infer<
  typeof NarrativeRelationshipMemoryValueSchema
>;
export type NarrativeWorldRuleMemoryValue = z.infer<
  typeof NarrativeWorldRuleMemoryValueSchema
>;
export type NarrativeMemoryValue = z.infer<typeof NarrativeMemoryValueSchema>;
