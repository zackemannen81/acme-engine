import {
  AcmeError,
  defineTask,
  type ExecutionReadContext,
  type ModuleResult,
  type StateDelta,
  type StateProjectionInput,
} from '@acme/core';

import { EVIDENCE_BUILD_TIMELINE_CONTRACT_REF } from '../catalogue.js';
import { immutableEvidence } from '../immutable.js';
import {
  EVIDENCE_NAMESPACE,
  EVIDENCE_STATE_SCHEMA_VERSION,
  EvidenceBuildTimelineInputSchema,
  EvidenceBuildTimelineOutputSchema,
  EvidenceStateSchema,
  type EvidenceBuildTimelineInput,
  type EvidenceBuildTimelineOutput,
  type EvidenceDelta,
  type EvidenceState,
} from '../schemas.js';
import { initialEvidenceState } from '../state.js';
import { buildEvidenceTimelineEntries } from '../temporal.js';

function readState(
  context: ExecutionReadContext<EvidenceState>,
): EvidenceState {
  if (context.state === null) return initialEvidenceState();
  if (
    context.state.namespace !== EVIDENCE_NAMESPACE ||
    context.state.entityId !== context.entityId ||
    context.state.schemaVersion !== EVIDENCE_STATE_SCHEMA_VERSION
  ) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: 'Evidence read context contains a foreign state snapshot.',
      stage: 'loading',
      retryable: false,
    });
  }
  return EvidenceStateSchema.parse(context.state.value);
}

function interpretOutput(
  _output: EvidenceBuildTimelineOutput,
  input: EvidenceBuildTimelineInput,
  context: ExecutionReadContext<EvidenceState>,
): ModuleResult<EvidenceDelta> {
  const validated = EvidenceBuildTimelineInputSchema.parse(input);
  readState(context);
  const entries = buildEvidenceTimelineEntries(
    validated.observations.map((observation) => ({
      observationId: observation.observationId,
      temporalBound: observation.temporalBound,
    })),
  );
  // Timeline is a pure transform: no memory/state mutation, only diagnostics.
  return immutableEvidence({
    documents: [],
    memories: [],
    events: [
      {
        key: `timeline-built:${context.executionId}`,
        type: 'evidence.timeline-built',
        schemaVersion: '1.0.0',
        payload: { entryCount: entries.length },
      },
    ],
    diagnostics: [
      {
        code: 'EVIDENCE_TIMELINE_BUILT',
        severity: 'info',
        value: { entryCount: entries.length },
      },
    ],
  });
}

function projectEvidenceState(
  input: StateProjectionInput<EvidenceDelta>,
  context: ExecutionReadContext<EvidenceState>,
): StateDelta<EvidenceDelta> | undefined {
  void input;
  void context;
  return undefined;
}

export const evidenceBuildTimelineTask = defineTask<
  EvidenceBuildTimelineInput,
  EvidenceBuildTimelineInput,
  EvidenceBuildTimelineOutput,
  EvidenceState,
  EvidenceDelta
>({
  role: 'transformer',
  inputSchema: EvidenceBuildTimelineInputSchema,
  contract: EVIDENCE_BUILD_TIMELINE_CONTRACT_REF,
  project(input, context) {
    readState(context);
    return immutableEvidence(EvidenceBuildTimelineInputSchema.parse(input));
  },
  interpret(output, input, context) {
    EvidenceBuildTimelineOutputSchema.parse(output);
    return interpretOutput(output, input, context);
  },
  projectState(input, context) {
    return projectEvidenceState(input, context);
  },
});
