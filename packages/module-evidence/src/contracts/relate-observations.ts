import { z } from 'zod';

import {
  canonicalJson,
  type ContractRef,
  type JsonValue,
  type ModelRequest,
  type PromptContract,
  type SemanticIssue,
} from '@acme/core';

import {
  EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF,
  EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF_V1,
} from '../catalogue.js';
import { immutableEvidence } from '../immutable.js';
import {
  EvidenceRelateObservationsInputSchema,
  EvidenceRelateObservationsOutputSchema,
  type EvidenceRelateObservationsInput,
  type EvidenceRelateObservationsOutput,
} from '../schemas.js';

const PROHIBITED_CONCLUSION =
  /\b(?:credible|credibility|truthful|lying|guilty|innocent|liable|liability|admissible|inadmissible|privileged|culpable)\b/iu;

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): SemanticIssue {
  return immutableEvidence({ code, path, message, severity: 'error' });
}

function createContract(configuration: {
  readonly ref: ContractRef;
  readonly explicitSortedSets: boolean;
  readonly schemaName: string;
}): PromptContract<
  EvidenceRelateObservationsInput,
  EvidenceRelateObservationsOutput
> {
  return {
    ref: configuration.ref,
    inputSchema: EvidenceRelateObservationsInputSchema,
    outputSchema: EvidenceRelateObservationsOutputSchema,
    requiredCapabilities: Object.freeze({ structuredOutput: true }),
    retention: 'encrypted-payload',

    buildRequest(input) {
      const validated = EvidenceRelateObservationsInputSchema.parse(input);
      const request = {
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text:
                  'Propose only source-bound evidence relations and open questions over the supplied immutable observations. ' +
                  'Every relation must name exact endpoints already present in the input, an explicit comparable scope, a rationale code and a rationale that stays within the source material. ' +
                  'Use unresolved when actor identity is ambiguous; never merge actors. ' +
                  (configuration.explicitSortedSets
                    ? 'For every set-like array of string identifiers or rationale codes, remove duplicates and sort strings in ascending lexicographic order. For every relation endpoints array, use distinct endpoints sorted ascending by kind and then id. '
                    : '') +
                  'Do not assess credibility, guilt, legal sufficiency, admissibility or privilege. Return only the requested JSON.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: canonicalJson(validated as unknown as JsonValue),
              },
            ],
          },
        ],
        output: {
          mode: 'json',
          schemaName: configuration.schemaName,
          jsonSchema: z.toJSONSchema(
            EvidenceRelateObservationsOutputSchema,
          ) as JsonValue,
        },
        maxOutputTokens: 4096,
      } satisfies ModelRequest;
      return immutableEvidence(request);
    },

    validateSemantics(output, input) {
      const issues: SemanticIssue[] = [];
      const observationIds = new Set(
        input.observations.map(({ observationId }) => observationId),
      );
      const observationsById = new Map(
        input.observations.map((observation) => [
          observation.observationId,
          observation,
        ]),
      );
      const rationaleCodes = new Set<string>();

      output.propositions.forEach((proposition, index) => {
        proposition.observationIds.forEach(
          (observationId, observationIndex) => {
            if (!observationIds.has(observationId)) {
              issues.push(
                issue(
                  'EVIDENCE_RELATION_ENDPOINT_UNKNOWN',
                  ['propositions', index, 'observationIds', observationIndex],
                  'Proposition observation ids must exist in the relate input.',
                ),
              );
            }
          },
        );
        if (PROHIBITED_CONCLUSION.test(proposition.normalizedProposition)) {
          issues.push(
            issue(
              'EVIDENCE_PROHIBITED_CONCLUSION',
              ['propositions', index, 'normalizedProposition'],
              'Meaning candidates must not make credibility, guilt, legal-sufficiency or privilege conclusions.',
            ),
          );
        }
      });

      output.events.forEach((event, index) => {
        event.supportingObservationIds.forEach(
          (observationId, observationIndex) => {
            if (!observationIds.has(observationId)) {
              issues.push(
                issue(
                  'EVIDENCE_RELATION_ENDPOINT_UNKNOWN',
                  [
                    'events',
                    index,
                    'supportingObservationIds',
                    observationIndex,
                  ],
                  'Event supporting observation ids must exist in the relate input.',
                ),
              );
            }
          },
        );
        const temporal = observationsById.get(event.temporalObservationId);
        if (temporal === undefined || temporal.temporalBound === null) {
          issues.push(
            issue(
              'EVIDENCE_TEMPORAL_BOUND_REQUIRED',
              ['events', index, 'temporalObservationId'],
              'Event temporalObservationId must reference an input observation with a temporal bound.',
            ),
          );
        }
        if (PROHIBITED_CONCLUSION.test(event.description)) {
          issues.push(
            issue(
              'EVIDENCE_PROHIBITED_CONCLUSION',
              ['events', index, 'description'],
              'Event descriptions must not make credibility, guilt, legal-sufficiency or privilege conclusions.',
            ),
          );
        }
      });

      output.relations.forEach((relation, index) => {
        if (rationaleCodes.has(relation.rationaleCode)) {
          issues.push(
            issue(
              'EVIDENCE_RELATION_RATIONALE_CODE_DUPLICATE',
              ['relations', index, 'rationaleCode'],
              'Relation rationale codes must be unique within one relate output.',
            ),
          );
        }
        rationaleCodes.add(relation.rationaleCode);

        const endpointKeys = relation.endpoints.map(
          ({ kind, id }) => `${kind}:${id}`,
        );
        if (new Set(endpointKeys).size !== endpointKeys.length) {
          issues.push(
            issue(
              'EVIDENCE_RELATION_ENDPOINTS_NOT_DISTINCT',
              ['relations', index, 'endpoints'],
              'Relation endpoints must be distinct.',
            ),
          );
        }
        if (
          endpointKeys.some(
            (key, endpointIndex) =>
              endpointIndex > 0 &&
              (endpointKeys[endpointIndex - 1] as string) > key,
          )
        ) {
          issues.push(
            issue(
              'EVIDENCE_RELATION_ENDPOINTS_NOT_SORTED',
              ['relations', index, 'endpoints'],
              'Relation endpoints must be sorted by kind and id.',
            ),
          );
        }
        relation.endpoints.forEach((endpoint, endpointIndex) => {
          if (
            endpoint.kind === 'observation' &&
            !observationIds.has(endpoint.id)
          ) {
            issues.push(
              issue(
                'EVIDENCE_RELATION_ENDPOINT_UNKNOWN',
                ['relations', index, 'endpoints', endpointIndex, 'id'],
                'Observation relation endpoints must exist in the relate input.',
              ),
            );
          }
        });
        relation.comparableScope.temporalObservationIds.forEach(
          (observationId, temporalIndex) => {
            const observation = observationsById.get(observationId);
            if (
              observation === undefined ||
              observation.temporalBound === null
            ) {
              issues.push(
                issue(
                  'EVIDENCE_TEMPORAL_BOUND_REQUIRED',
                  [
                    'relations',
                    index,
                    'comparableScope',
                    'temporalObservationIds',
                    temporalIndex,
                  ],
                  'Comparable-scope temporalObservationIds must reference input observations with temporal bounds.',
                ),
              );
            }
          },
        );
        if (
          PROHIBITED_CONCLUSION.test(relation.rationale) ||
          PROHIBITED_CONCLUSION.test(relation.rationaleCode)
        ) {
          issues.push(
            issue(
              'EVIDENCE_PROHIBITED_CONCLUSION',
              ['relations', index, 'rationale'],
              'Relation rationale must not make credibility, guilt, legal-sufficiency or privilege conclusions.',
            ),
          );
        }
      });

      output.openQuestions.forEach((question, index) => {
        question.triggeringObservationIds.forEach(
          (observationId, triggerIndex) => {
            if (!observationIds.has(observationId)) {
              issues.push(
                issue(
                  'EVIDENCE_RELATION_ENDPOINT_UNKNOWN',
                  [
                    'openQuestions',
                    index,
                    'triggeringObservationIds',
                    triggerIndex,
                  ],
                  'Open-question observation triggers must exist in the relate input.',
                ),
              );
            }
          },
        );
        question.triggeringRelationRationaleCodes.forEach((code, codeIndex) => {
          if (!rationaleCodes.has(code)) {
            issues.push(
              issue(
                'EVIDENCE_OPEN_QUESTION_RELATION_UNKNOWN',
                [
                  'openQuestions',
                  index,
                  'triggeringRelationRationaleCodes',
                  codeIndex,
                ],
                'Open-question relation triggers must cite a rationale code present in this output.',
              ),
            );
          }
        });
        if (PROHIBITED_CONCLUSION.test(question.questionText)) {
          issues.push(
            issue(
              'EVIDENCE_PROHIBITED_CONCLUSION',
              ['openQuestions', index, 'questionText'],
              'Open questions must not make credibility, guilt, legal-sufficiency or privilege conclusions.',
            ),
          );
        }
      });

      return immutableEvidence(issues);
    },
  };
}

export const evidenceRelateObservationsContractV1 = Object.freeze(
  createContract({
    ref: EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF_V1,
    explicitSortedSets: false,
    schemaName: 'evidence_relate_observations_1_0_0',
  }),
);

export const evidenceRelateObservationsContract = Object.freeze(
  createContract({
    ref: EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF,
    explicitSortedSets: true,
    schemaName: 'evidence_relate_observations_1_1_0',
  }),
);
