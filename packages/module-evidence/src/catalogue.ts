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
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V2 = '1.1.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V3 = '1.2.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V4 = '1.3.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V5 = '1.4.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V6 = '1.5.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V7 = '1.6.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V8 = '1.7.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V9 = '1.8.0' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION = '1.9.0' as const;
export const EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_VERSION = '1.1.0' as const;
export const EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_VERSION_V2 = '1.1.0' as const;
export const EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_VERSION = '1.2.0' as const;

export const EvidenceTaskCatalogueEntrySchema = z
  .object({
    id: z.enum([
      EVIDENCE_OBSERVE_ARTIFACT_TASK,
      EVIDENCE_RELATE_OBSERVATIONS_TASK,
      EVIDENCE_BUILD_TIMELINE_TASK,
      EVIDENCE_PROPOSE_ASSESSMENT_TASK,
    ]),
    version: z.enum([
      EVIDENCE_TASK_VERSION,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V2,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V3,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V4,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V5,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V6,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V7,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V8,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V9,
      EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION,
      EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_VERSION,
    ]),
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
        version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION,
        earliestSlice: 1,
        role: 'analyzer',
        modelBacked: true,
        implemented: true,
      },
      {
        id: EVIDENCE_RELATE_OBSERVATIONS_TASK,
        version: EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_VERSION,
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
        version: EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_VERSION,
        earliestSlice: 5,
        role: 'producer',
        modelBacked: true,
        implemented: true,
      },
    ]),
);

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V1 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_TASK_VERSION,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V2 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V2,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V3 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V3,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V4 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V4,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V5 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V5,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V6 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V6,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V7 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V7,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V8 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V8,
});

export const EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V9 = immutableEvidence({
  id: EVIDENCE_OBSERVE_ARTIFACT_TASK,
  version: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_VERSION_V9,
});

export const EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_RELATE_OBSERVATIONS_TASK,
  version: EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_VERSION,
});

export const EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF_V1 = immutableEvidence({
  id: EVIDENCE_RELATE_OBSERVATIONS_TASK,
  version: EVIDENCE_TASK_VERSION,
});

export const EVIDENCE_BUILD_TIMELINE_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_BUILD_TIMELINE_TASK,
  version: EVIDENCE_TASK_VERSION,
});

export const EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF = immutableEvidence({
  id: EVIDENCE_PROPOSE_ASSESSMENT_TASK,
  version: EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_VERSION,
});

export const EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF_V1 = immutableEvidence({
  id: EVIDENCE_PROPOSE_ASSESSMENT_TASK,
  version: EVIDENCE_TASK_VERSION,
});

export const EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF_V2 = immutableEvidence({
  id: EVIDENCE_PROPOSE_ASSESSMENT_TASK,
  version: EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_VERSION_V2,
});
