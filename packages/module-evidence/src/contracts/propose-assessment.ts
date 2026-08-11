import { z } from 'zod';

import {
  canonicalJson,
  type JsonValue,
  type ModelRequest,
  type PromptContract,
  type SemanticIssue,
} from '@acme/core';

import { EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF } from '../catalogue.js';
import { immutableEvidence } from '../immutable.js';
import {
  EvidenceProposeAssessmentInputSchema,
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

const contract: PromptContract<
  EvidenceProposeAssessmentInput,
  EvidenceProposeAssessmentOutput
> = {
  ref: EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF,
  inputSchema: EvidenceProposeAssessmentInputSchema,
  outputSchema: EvidenceProposeAssessmentOutputSchema,
  requiredCapabilities: Object.freeze({ structuredOutput: true }),
  retention: 'encrypted-payload',

  buildRequest(input) {
    const validated = EvidenceProposeAssessmentInputSchema.parse(input);
    const request = {
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'Propose one synthetic-only assessment that cites only the accepted evidence ids supplied in the input. ' +
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
        schemaName: 'evidence_propose_assessment_1_0_0',
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
    const accepted = new Set([
      ...input.acceptedObservationIds,
      ...input.acceptedRelationIds,
      ...input.acceptedOpenQuestionIds,
    ]);
    output.claims.forEach((claim, index) => {
      claim.supportObservationIds.forEach((id, idIndex) => {
        if (!input.acceptedObservationIds.includes(id)) {
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
        if (!input.acceptedRelationIds.includes(id)) {
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
        if (!input.acceptedRelationIds.includes(id)) {
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
      if (!input.acceptedOpenQuestionIds.includes(id)) {
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

export const evidenceProposeAssessmentContract = Object.freeze(contract);
