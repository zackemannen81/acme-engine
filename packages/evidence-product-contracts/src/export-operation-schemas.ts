import { z } from 'zod';

const NonBlank = z.string().trim().min(1);
const Timestamp = z.iso.datetime({ offset: true });

export const EvidenceAssessmentOutputFormatSchema = z.enum([
  'json',
  'markdown',
  'docx',
  'pdf',
]);

export type EvidenceAssessmentOutputFormat = z.infer<
  typeof EvidenceAssessmentOutputFormatSchema
>;

export const EVIDENCE_ASSESSMENT_OUTPUT_FORMATS: readonly EvidenceAssessmentOutputFormat[] =
  Object.freeze(['docx', 'json', 'markdown', 'pdf'] as const);

export const EvidenceExportPolicySchema = z
  .object({
    schemaVersion: z.literal('evidence-export-policy/1'),
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    enabled: z.boolean(),
    allowedFormats: z
      .array(EvidenceAssessmentOutputFormatSchema)
      .refine(
        (values) => new Set(values).size === values.length,
        'Allowed export formats must be unique.',
      ),
    revision: z.number().int().nonnegative(),
    updatedByPrincipalRef: NonBlank,
    updatedAt: Timestamp,
  })
  .strict();

export const EvidenceExportPolicyCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-export-policy-command/1'),
    commandKey: NonBlank.max(200),
    expectedRevision: z.number().int().nonnegative(),
    enabled: z.boolean(),
    allowedFormats: z.array(EvidenceAssessmentOutputFormatSchema),
  })
  .strict();

export const EvidenceExportAuditRecordSchema = z
  .object({
    schemaVersion: z.literal('evidence-export-audit-record/1'),
    exportAuditId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    assessmentVersionId: NonBlank,
    format: EvidenceAssessmentOutputFormatSchema,
    outcome: z.enum(['released', 'refused']),
    reasonCode: NonBlank,
    outputSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
    outputByteLength: z.number().int().nonnegative().nullable(),
    principalRef: NonBlank,
    occurredAt: Timestamp,
  })
  .strict();

export type EvidenceExportPolicy = z.infer<typeof EvidenceExportPolicySchema>;
export type EvidenceExportPolicyCommand = z.infer<
  typeof EvidenceExportPolicyCommandSchema
>;
export type EvidenceExportAuditRecord = z.infer<
  typeof EvidenceExportAuditRecordSchema
>;
