import { z } from 'zod';

import { sha256 } from '@acme/core';
import { EvidenceNonBlankStringSchema } from '@acme/module-evidence';

import { EvidenceRequestedLiveObservationBudgetSchema } from './live-observation.js';

export const EVIDENCE_CASE_LIVE_ASSESSMENT_COMMAND_SCHEMA_VERSION =
  'evidence-case-live-assessment-command/1' as const;
export const EVIDENCE_LIVE_ASSESSMENT_COMMAND_SCHEMA_VERSION =
  'evidence-live-assessment-command/1' as const;

const browserFields = {
  commandKey: EvidenceNonBlankStringSchema,
  requestedBudget: EvidenceRequestedLiveObservationBudgetSchema,
  confirmation: z.unknown(),
};

export const EvidenceCaseLiveAssessmentCommandSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_CASE_LIVE_ASSESSMENT_COMMAND_SCHEMA_VERSION,
    ),
    ...browserFields,
  })
  .strict();

const sortedUniqueIds = z.array(EvidenceNonBlankStringSchema).refine(
  (values) =>
    new Set(values).size === values.length &&
    values.every((value, index) => {
      const previous = values[index - 1];
      return previous === undefined || previous < value;
    }),
  'Evidence ids must be unique and sorted.',
);

export const EvidenceLiveAssessmentCommandSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_LIVE_ASSESSMENT_COMMAND_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    modelId: EvidenceNonBlankStringSchema,
    currency: EvidenceNonBlankStringSchema.nullable(),
    sequence: z.number().int().positive(),
    basisEvidenceRevision: z.number().int().nonnegative(),
    observationIds: sortedUniqueIds.min(1),
    relationIds: sortedUniqueIds,
    openQuestionIds: sortedUniqueIds,
    predecessorAssessmentVersionId: EvidenceNonBlankStringSchema.nullable(),
    ...browserFields,
  })
  .strict();

export type EvidenceCaseLiveAssessmentCommand = z.infer<
  typeof EvidenceCaseLiveAssessmentCommandSchema
>;
export type EvidenceLiveAssessmentCommand = z.infer<
  typeof EvidenceLiveAssessmentCommandSchema
>;

export function deriveEvidenceLiveAssessmentJobId(input: {
  readonly workspaceId: string;
  readonly commandKey: string;
}): string {
  return `evidence-live-assessment-job-${sha256(`${input.workspaceId}\u0000${input.commandKey}`)}`;
}
