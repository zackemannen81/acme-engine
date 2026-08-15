import { z } from 'zod';

import { sha256 } from '@acme/core';
import { EvidenceNonBlankStringSchema } from '@acme/module-evidence';

import { EvidenceRequestedLiveObservationBudgetSchema } from './live-observation.js';

export const EVIDENCE_CASE_LIVE_RELATION_COMMAND_SCHEMA_VERSION =
  'evidence-case-live-relation-command/1' as const;
export const EVIDENCE_LIVE_RELATION_COMMAND_SCHEMA_VERSION =
  'evidence-live-relation-command/1' as const;

const browserFields = {
  commandKey: EvidenceNonBlankStringSchema,
  requestedBudget: EvidenceRequestedLiveObservationBudgetSchema,
  confirmation: z.unknown(),
};

export const EvidenceCaseLiveRelationCommandSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_CASE_LIVE_RELATION_COMMAND_SCHEMA_VERSION,
    ),
    ...browserFields,
  })
  .strict();

export const EvidenceLiveRelationCommandSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_LIVE_RELATION_COMMAND_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    modelId: EvidenceNonBlankStringSchema,
    currency: EvidenceNonBlankStringSchema.nullable(),
    observationIds: z
      .array(EvidenceNonBlankStringSchema)
      .min(2)
      .refine(
        (values) =>
          new Set(values).size === values.length &&
          values.every((value, index) => {
            const previous = values[index - 1];
            return previous === undefined || previous < value;
          }),
        'Observation ids must be unique and sorted.',
      ),
    ...browserFields,
  })
  .strict();

export type EvidenceCaseLiveRelationCommand = z.infer<
  typeof EvidenceCaseLiveRelationCommandSchema
>;
export type EvidenceLiveRelationCommand = z.infer<
  typeof EvidenceLiveRelationCommandSchema
>;

export function deriveEvidenceLiveRelationJobId(input: {
  readonly workspaceId: string;
  readonly commandKey: string;
}): string {
  return `evidence-live-relation-job-${sha256(`${input.workspaceId}\u0000${input.commandKey}`)}`;
}
