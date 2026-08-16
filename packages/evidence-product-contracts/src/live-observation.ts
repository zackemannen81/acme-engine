import { z } from 'zod';

import { sha256 } from '@acme/core';
import {
  EvidenceActorRosterEntrySchema,
  EvidenceNonBlankStringSchema,
} from '@acme/module-evidence';

export const EVIDENCE_CASE_LIVE_OBSERVATION_COMMAND_SCHEMA_VERSION =
  'evidence-case-live-observation-command/1' as const;
export const EVIDENCE_LIVE_OBSERVATION_COMMAND_SCHEMA_VERSION =
  'evidence-live-observation-command/1' as const;

export const EvidenceRequestedLiveObservationBudgetSchema = z
  .object({
    maxModelCalls: z.literal(1),
    costCeilingMinor: z.number().int().nonnegative().nullable(),
  })
  .strict();

const browserFields = {
  commandKey: EvidenceNonBlankStringSchema,
  artifactVersionId: EvidenceNonBlankStringSchema,
  sourcePartId: z
    .string()
    .regex(/^part-[0-9]{6}$/u)
    .optional(),
  actorRoster: z.array(EvidenceActorRosterEntrySchema),
  requestedBudget: EvidenceRequestedLiveObservationBudgetSchema,
  confirmation: z.unknown(),
};

export const EvidenceCaseLiveObservationCommandSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_CASE_LIVE_OBSERVATION_COMMAND_SCHEMA_VERSION,
    ),
    ...browserFields,
  })
  .strict();

export const EvidenceLiveObservationCommandSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_LIVE_OBSERVATION_COMMAND_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    modelId: EvidenceNonBlankStringSchema,
    currency: EvidenceNonBlankStringSchema.nullable(),
    ...browserFields,
  })
  .strict();

export type EvidenceCaseLiveObservationCommand = z.infer<
  typeof EvidenceCaseLiveObservationCommandSchema
>;
export type EvidenceLiveObservationCommand = z.infer<
  typeof EvidenceLiveObservationCommandSchema
>;

export function deriveEvidenceLiveObservationJobId(input: {
  readonly workspaceId: string;
  readonly commandKey: string;
}): string {
  return `evidence-live-job-${sha256(`${input.workspaceId}\u0000${input.commandKey}`)}`;
}
