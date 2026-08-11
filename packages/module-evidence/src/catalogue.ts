import { z } from 'zod';

import { immutableEvidence } from './immutable.js';

export const EVIDENCE_OBSERVE_ARTIFACT_TASK =
  'evidence.observe-artifact' as const;
export const EVIDENCE_RELATE_OBSERVATIONS_TASK =
  'evidence.relate-observations' as const;
export const EVIDENCE_BUILD_TIMELINE_TASK = 'evidence.build-timeline' as const;
export const EVIDENCE_PROPOSE_ASSESSMENT_TASK =
  'evidence.propose-assessment' as const;
export const EVIDENCE_TASK_VERSION = '1.0.0' as const;

export const EvidenceTaskCatalogueEntrySchema = z
  .object({
    id: z.enum([
      EVIDENCE_OBSERVE_ARTIFACT_TASK,
      EVIDENCE_RELATE_OBSERVATIONS_TASK,
      EVIDENCE_BUILD_TIMELINE_TASK,
      EVIDENCE_PROPOSE_ASSESSMENT_TASK,
    ]),
    version: z.literal(EVIDENCE_TASK_VERSION),
    earliestSlice: z.number().int().min(1).max(5),
    role: z.enum(['analyzer', 'transformer', 'producer']),
    modelBacked: z.boolean(),
    implemented: z.boolean(),
  })
  .strict();

export type EvidenceTaskCatalogueEntry = z.infer<
  typeof EvidenceTaskCatalogueEntrySchema
>;

export const EVIDENCE_TASK_CATALOGUE = immutableEvidence(
  z
    .array(EvidenceTaskCatalogueEntrySchema)
    .length(4)
    .parse([
      {
        id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
        version: EVIDENCE_TASK_VERSION,
        earliestSlice: 1,
        role: 'analyzer',
        modelBacked: true,
        implemented: true,
      },
      {
        id: EVIDENCE_RELATE_OBSERVATIONS_TASK,
        version: EVIDENCE_TASK_VERSION,
        earliestSlice: 3,
        role: 'analyzer',
        modelBacked: true,
        implemented: true,
      },
      {
        id: EVIDENCE_BUILD_TIMELINE_TASK,
        version: EVIDENCE_TASK_VERSION,
        earliestSlice: 4,
        role: 'transformer',
        modelBacked: false,
        implemented: true,
      },
      {
        id: EVIDENCE_PROPOSE_ASSESSMENT_TASK,
        version: EVIDENCE_TASK_VERSION,
        earliestSlice: 5,
        role: 'producer',
        modelBacked: true,
        implemented: true,
      },
    ]),
);

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_TASK_VERSION,
});

export const EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_RELATE_OBSERVATIONS_TASK,
  version: EVIDENCE_TASK_VERSION,
});

export const EVIDENCE_BUILD_TIMELINE_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_BUILD_TIMELINE_TASK,
  version: EVIDENCE_TASK_VERSION,
});

export const EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_PROPOSE_ASSESSMENT_TASK,
  version: EVIDENCE_TASK_VERSION,
});
