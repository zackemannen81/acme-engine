import { defineModule } from '@acme/core';

import { evidenceMemoryPolicy } from './memory-policy.js';
import {
  EVIDENCE_DELTA_SCHEMA_VERSION,
  EVIDENCE_NAMESPACE,
  EVIDENCE_STATE_SCHEMA_VERSION,
  EvidenceDeltaSchema,
  EvidenceStateSchema,
  type EvidenceDelta,
  type EvidenceState,
} from './schemas.js';
import {
  evidenceStateInvariants,
  initialEvidenceState,
  reduceEvidenceState,
} from './state.js';
import { evidenceBuildTimelineTask } from './tasks/build-timeline.js';
import { evidenceObserveArtifactTask } from './tasks/observe-artifact.js';
import { evidenceRelateObservationsTask } from './tasks/relate-observations.js';

export const evidenceTasks = Object.freeze({
  'observe-artifact': evidenceObserveArtifactTask,
  'relate-observations': evidenceRelateObservationsTask,
  'build-timeline': evidenceBuildTimelineTask,
});

export const evidenceModule = defineModule<
  EvidenceState,
  EvidenceDelta,
  typeof evidenceTasks
>({
  namespace: EVIDENCE_NAMESPACE,
  stateSchemaVersion: EVIDENCE_STATE_SCHEMA_VERSION,
  deltaSchemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
  stateSchema: EvidenceStateSchema,
  deltaSchema: EvidenceDeltaSchema,
  tasks: evidenceTasks,
  memoryPolicy: evidenceMemoryPolicy,
  initialState() {
    return initialEvidenceState();
  },
  reduce(state, delta) {
    return reduceEvidenceState(state, delta);
  },
  invariants(next, previous) {
    return evidenceStateInvariants(next, previous);
  },
});
