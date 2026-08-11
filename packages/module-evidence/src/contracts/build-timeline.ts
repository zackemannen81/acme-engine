import { z } from 'zod';

import {
  canonicalJson,
  type JsonValue,
  type ModelRequest,
  type PromptContract,
} from '@acme/core';

import { EVIDENCE_BUILD_TIMELINE_CONTRACT_REF } from '../catalogue.js';
import { immutableEvidence } from '../immutable.js';
import {
  EvidenceBuildTimelineInputSchema,
  EvidenceBuildTimelineOutputSchema,
  type EvidenceBuildTimelineInput,
  type EvidenceBuildTimelineOutput,
} from '../schemas.js';
import { buildEvidenceTimelineEntries } from '../temporal.js';

/**
 * Deterministic timeline task. The model is not consulted for ordering; the
 * contract still satisfies ExecutionEngine's single-call shape with a fixed
 * empty structured output. Interpretation rebuilds the timeline purely from
 * input observations.
 */
const contract: PromptContract<
  EvidenceBuildTimelineInput,
  EvidenceBuildTimelineOutput
> = {
  ref: EVIDENCE_BUILD_TIMELINE_CONTRACT_REF,
  inputSchema: EvidenceBuildTimelineInputSchema,
  outputSchema: EvidenceBuildTimelineOutputSchema,
  requiredCapabilities: Object.freeze({ structuredOutput: true }),
  retention: 'encrypted-payload',

  buildRequest(input) {
    const validated = EvidenceBuildTimelineInputSchema.parse(input);
    // Force pure derivation in the request body so request hashes stay stable
    // when the observation set is identical.
    const derived = buildEvidenceTimelineEntries(
      validated.observations.map((observation) => ({
        observationId: observation.observationId,
        temporalBound: observation.temporalBound,
      })),
    );
    const request = {
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'This is a deterministic timeline transform. Return the empty JSON object only. ' +
                'Do not invent temporal precision.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: canonicalJson({
                schemaVersion: validated.schemaVersion,
                observationCount: validated.observations.length,
                derivedEntryCount: derived.length,
              } as unknown as JsonValue),
            },
          ],
        },
      ],
      output: {
        mode: 'json',
        schemaName: 'evidence_build_timeline_1_0_0',
        jsonSchema: z.toJSONSchema(
          EvidenceBuildTimelineOutputSchema,
        ) as JsonValue,
      },
      maxOutputTokens: 64,
    } satisfies ModelRequest;
    return immutableEvidence(request);
  },

  validateSemantics() {
    return immutableEvidence([]);
  },
};

export const evidenceBuildTimelineContract = Object.freeze(contract);
