import { defineModule } from '@acme/core';

import { narrativeMemoryPolicy } from './memory-policy.js';
import {
  NARRATIVE_DELTA_SCHEMA_VERSION,
  NARRATIVE_NAMESPACE,
  NARRATIVE_STATE_SCHEMA_VERSION,
  NarrativeDeltaSchema,
  NarrativeStateSchema,
  type NarrativeDelta,
  type NarrativeState,
} from './schemas.js';
import {
  initialNarrativeState,
  narrativeStateInvariants,
  reduceNarrativeState,
} from './state.js';
import { narrativeObserveDocumentTask } from './tasks/observe-document.js';

export const narrativeModule = defineModule<
  NarrativeState,
  NarrativeDelta,
  { readonly 'observe-document': typeof narrativeObserveDocumentTask }
>({
  namespace: NARRATIVE_NAMESPACE,
  stateSchemaVersion: NARRATIVE_STATE_SCHEMA_VERSION,
  deltaSchemaVersion: NARRATIVE_DELTA_SCHEMA_VERSION,
  stateSchema: NarrativeStateSchema,
  deltaSchema: NarrativeDeltaSchema,
  tasks: Object.freeze({
    'observe-document': narrativeObserveDocumentTask,
  }),
  memoryPolicy: narrativeMemoryPolicy,
  initialState() {
    return initialNarrativeState();
  },
  reduce(state, delta) {
    return reduceNarrativeState(state, delta);
  },
  invariants(next, previous) {
    return narrativeStateInvariants(next, previous);
  },
});
