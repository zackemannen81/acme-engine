import { z } from 'zod';

import {
  canonicalJson,
  type JsonValue,
  type ModelRequest,
  type PromptContract,
  type SemanticIssue,
  type ContractRef,
} from '@acme/core';

import {
  EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF,
  EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF_V1,
} from '../catalogue.js';
import { immutableEvidence } from '../immutable.js';
import {
  EvidenceProposeAssessmentInputSchema,
  EvidenceProposeAssessmentInputV1Schema,
  EvidenceProposeAssessmentOutputSchema,
  type EvidenceProposeAssessmentInput,
  type EvidenceProposeAssessmentOutput,
} from '../schemas.js';

const PROHIBITED =
  /\b(?:credible|credibility|truthful|lying|guilty|innocent|liable|liability|admissible|inadmissible|privileged|culpable)\b/iu;

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): SemanticIssue {
  return immutableEvidence({ code, path, message, severity: 'error' });
}

function acceptedIds(input: EvidenceProposeAssessmentInput): {
  readonly observations: readonly string[];
  readonly relations: readonly string[];
  readonly questions: readonly string[];
} {
  return input.schemaVersion === 'evidence-propose-assessment-input/1'
    ? {
        observations: input.acceptedObservationIds,
        relations: input.acceptedRelationIds,
        questions: input.acceptedOpenQuestionIds,
      }
    : {
        observations: input.acceptedObservations.map(
          (item) => item.observationId,
        ),
        relations: input.acceptedRelations.map((item) => item.relationId),
        questions: input.acceptedOpenQuestions.map(
          (item) => item.openQuestionId,
        ),
      };
}

function createContract(configuration: {
  readonly ref: ContractRef;
  readonly inputSchema:
    | typeof EvidenceProposeAssessmentInputSchema
    | typeof EvidenceProposeAssessmentInputV1Schema;
  readonly sourceDescription: string;
  readonly schemaName: string;
}): PromptContract<
  EvidenceProposeAssessmentInput,
  EvidenceProposeAssessmentOutput
> {
  return {
    ref: configuration.ref,
    inputSchema: configuration.inputSchema,
    outputSchema: EvidenceProposeAssessmentOutputSchema,
    requiredCapabilities: Object.freeze({ structuredOutput: true }),
    retention: 'encrypted-payload',

    buildRequest(input) {
      const validated = configuration.inputSchema.parse(input);
      const request = {
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text:
                  `Propose one assessment that cites only the accepted ${configuration.sourceDescription} supplied in the input. ` +
                  'Every claim needs support or an explicit unresolved marker and an uncertainty rationale. ' +
                  'Do not assess credibility, guilt, legal sufficiency, admissibility or privilege.',
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
            EvidenceProposeAssessmentOutputSchema,
          ) as JsonValue,
        },
        maxOutputTokens: 4096,
      } satisfies ModelRequest;
      return immutableEvidence(request);
    },

    validateSemantics(output, input) {
      const issues: SemanticIssue[] = [];
      const ids = acceptedIds(input);
      const accepted = new Set([
        ...ids.observations,
        ...ids.relations,
        ...ids.questions,
      ]);
      output.claims.forEach((claim, index) => {
        claim.supportObservationIds.forEach((id, idIndex) => {
          if (!ids.observations.includes(id)) {
            issues.push(
              issue(
                'EVIDENCE_ASSESSMENT_CITATION_UNKNOWN',
                ['claims', index, 'supportObservationIds', idIndex],
                'Support observations must be accepted input ids.',
              ),
            );
          }
        });
        claim.conflictRelationIds.forEach((id, idIndex) => {
          if (!ids.relations.includes(id)) {
            issues.push(
              issue(
                'EVIDENCE_ASSESSMENT_CITATION_UNKNOWN',
                ['claims', index, 'conflictRelationIds', idIndex],
                'Conflict relations must be accepted input ids.',
              ),
            );
          }
        });
        claim.qualificationRelationIds.forEach((id, idIndex) => {
          if (!ids.relations.includes(id)) {
            issues.push(
              issue(
                'EVIDENCE_ASSESSMENT_CITATION_UNKNOWN',
                ['claims', index, 'qualificationRelationIds', idIndex],
                'Qualification relations must be accepted input ids.',
              ),
            );
          }
        });
        if (
          PROHIBITED.test(claim.text) ||
          PROHIBITED.test(claim.uncertaintyRationale)
        ) {
          issues.push(
            issue(
              'EVIDENCE_PROHIBITED_CONCLUSION',
              ['claims', index],
              'Assessment claims must not make prohibited conclusions.',
            ),
          );
        }
      });
      output.openQuestionIds.forEach((id, index) => {
        if (!ids.questions.includes(id)) {
          issues.push(
            issue(
              'EVIDENCE_ASSESSMENT_CITATION_UNKNOWN',
              ['openQuestionIds', index],
              'Open questions must be accepted input ids.',
            ),
          );
        }
      });
      output.citations.forEach((citation, index) => {
        if (!accepted.has(citation.evidenceId)) {
          issues.push(
            issue(
              'EVIDENCE_ASSESSMENT_CITATION_UNKNOWN',
              ['citations', index, 'evidenceId'],
              'Citations must resolve to accepted input evidence.',
            ),
          );
        }
      });
      return immutableEvidence(issues);
    },
  };
}

export const evidenceProposeAssessmentContractV1 = Object.freeze(
  createContract({
    ref: EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF_V1,
    inputSchema: EvidenceProposeAssessmentInputV1Schema,
    sourceDescription: 'synthetic evidence ids',
    schemaName: 'evidence_propose_assessment_1_0_0',
  }),
);

export const evidenceProposeAssessmentContract = Object.freeze(
  createContract({
    ref: EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF,
    inputSchema: EvidenceProposeAssessmentInputSchema,
    sourceDescription: 'typed evidence',
    schemaName: 'evidence_propose_assessment_1_1_0',
  }),
);
