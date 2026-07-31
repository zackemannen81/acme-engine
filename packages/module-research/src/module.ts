import { defineModule } from '@acme/core';

import { researchMemoryPolicy } from './memory-policy.js';
import {
  RESEARCH_DELTA_SCHEMA_VERSION,
  RESEARCH_NAMESPACE,
  RESEARCH_STATE_SCHEMA_VERSION,
  ResearchDeltaSchema,
  ResearchStateSchema,
  type ResearchDelta,
  type ResearchState,
} from './schemas.js';
import {
  initialResearchState,
  reduceResearchState,
  researchStateInvariants,
} from './state.js';
import { researchObserveEvidenceTask } from './tasks/observe-evidence.js';

export const researchModule = defineModule<
  ResearchState,
  ResearchDelta,
  { readonly 'observe-evidence': typeof researchObserveEvidenceTask }
>({
  namespace: RESEARCH_NAMESPACE,
  stateSchemaVersion: RESEARCH_STATE_SCHEMA_VERSION,
  deltaSchemaVersion: RESEARCH_DELTA_SCHEMA_VERSION,
  stateSchema: ResearchStateSchema,
  deltaSchema: ResearchDeltaSchema,
  tasks: Object.freeze({
    'observe-evidence': researchObserveEvidenceTask,
  }),
  memoryPolicy: researchMemoryPolicy,
  initialState() {
    return initialResearchState();
  },
  reduce(state, delta) {
    return reduceResearchState(state, delta);
  },
  invariants(next, previous) {
    return researchStateInvariants(next, previous);
  },
});
