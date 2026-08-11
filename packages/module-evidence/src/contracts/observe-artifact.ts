import { z } from 'zod';

import {
  canonicalJson,
  type JsonValue,
  type ModelRequest,
  type PromptContract,
  type SemanticIssue,
} from '@acme/core';

import { exactQuoteOccurrenceCount } from '../canonical-text.js';
import { EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF } from '../catalogue.js';
import { immutableEvidence } from '../immutable.js';
import {
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactOutputSchema,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
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

function matchingActorKeys(
  input: EvidenceObserveArtifactInput,
  sourceLabel: string,
): readonly string[] {
  return input.actorRoster
    .filter(({ allowedSourceLabels }) =>
      allowedSourceLabels.includes(sourceLabel),
    )
    .map(({ actorKey }) => actorKey)
    .sort();
}

function timeTokens(value: string): readonly string[] {
  const match = /T(\d{2}:\d{2}):\d{2}(?:\.\d+)?Z$/u.exec(value);
  return match?.[1] === undefined ? [] : [match[1]];
}

function validateTemporal(
  temporal: EvidenceObserveArtifactOutput['observations'][number]['temporalBound'],
  quote: string,
  index: number,
): readonly SemanticIssue[] {
  if (temporal === null || temporal.kind === 'unknown') {
    if (
      temporal?.kind === 'unknown' &&
      PROHIBITED_CONCLUSION.test(temporal.reason)
    ) {
      return [
        issue(
          'EVIDENCE_PROHIBITED_CONCLUSION',
          ['observations', index, 'temporalBound', 'reason'],
          'Observation candidates must not make credibility, guilt, legal-sufficiency or privilege conclusions.',
        ),
      ];
    }
    return [];
  }

  const tokens =
    temporal.kind === 'exact'
      ? timeTokens(temporal.at)
      : temporal.kind === 'range'
        ? [...timeTokens(temporal.from), ...timeTokens(temporal.to)]
        : timeTokens(temporal.center);
  if (tokens.length === 0 || tokens.some((token) => !quote.includes(token))) {
    return [
      issue(
        'EVIDENCE_TEMPORAL_VALUE_NOT_SOURCE_BOUND',
        ['observations', index, 'temporalBound'],
        'Every normalized exact, range or approximate clock value must be visible in the exact source quote.',
      ),
    ];
  }
  return [];
}

const contract: PromptContract<
  EvidenceObserveArtifactInput,
  EvidenceObserveArtifactOutput
> = {
  ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF,
  inputSchema: EvidenceObserveArtifactInputSchema,
  outputSchema: EvidenceObserveArtifactOutputSchema,
  requiredCapabilities: Object.freeze({ structuredOutput: true }),
  retention: 'encrypted-payload',

  buildRequest(input) {
    const validated = EvidenceObserveArtifactInputSchema.parse(input);
    const request = {
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'Extract only source-bound observations from the supplied synthetic artifact. ' +
                'Copy every exactQuote verbatim and use its exact one-based line range. ' +
                'A transcript yields statement occurrences; a structured exhibit yields exhibit assertions. ' +
                'Resolve an actor only through the supplied roster; preserve ambiguity as unresolved. ' +
                'Normalize time only when the clock value is visible in the quote, otherwise use unknown. ' +
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
        schemaName: 'evidence_observe_artifact_1_0_0',
        jsonSchema: z.toJSONSchema(
          EvidenceObserveArtifactOutputSchema,
        ) as JsonValue,
      },
      maxOutputTokens: 2048,
    } satisfies ModelRequest;
    return immutableEvidence(request);
  },

  validateSemantics(output, input) {
    const issues: SemanticIssue[] = [];
    const seen = new Map<string, number>();
    output.observations.forEach((observation, index) => {
      const path = ['observations', index] as const;
      if (
        (input.artifactVersion.kind === 'interview-transcript') !==
        (observation.kind === 'statement-occurrence')
      ) {
        issues.push(
          issue(
            'EVIDENCE_OBSERVATION_KIND_MISMATCH',
            [...path, 'kind'],
            'Observation kind must match the supplied artifact kind.',
          ),
        );
      }

      const key = canonicalJson(observation as unknown as JsonValue);
      const previous = seen.get(key);
      if (previous !== undefined) {
        issues.push(
          issue(
            'EVIDENCE_DUPLICATE_OBSERVATION',
            path,
            `Observation duplicates observations[${String(previous)}].`,
          ),
        );
      } else {
        seen.set(key, index);
      }

      try {
        if (
          exactQuoteOccurrenceCount(
            input.artifactVersion.text,
            observation.startLine,
            observation.endLine,
            observation.exactQuote,
          ) !== 1
        ) {
          issues.push(
            issue(
              'EVIDENCE_QUOTE_BINDING_FAILED',
              [...path, 'exactQuote'],
              'Exact quote must occur exactly once inside the addressed source lines.',
            ),
          );
        }
      } catch {
        issues.push(
          issue(
            'EVIDENCE_LOCATOR_OUT_OF_BOUNDS',
            [...path, 'startLine'],
            'Observation line range must be inside the supplied source.',
          ),
        );
      }

      const actor =
        observation.kind === 'statement-occurrence'
          ? observation.actorReference
          : observation.sourceActorReference;
      if (actor !== null) {
        const matching = matchingActorKeys(input, actor.sourceLabel);
        if (!observation.exactQuote.includes(actor.sourceLabel)) {
          issues.push(
            issue(
              'EVIDENCE_ACTOR_LABEL_NOT_SOURCE_BOUND',
              [...path, 'actorReference', 'sourceLabel'],
              'Actor source label must occur verbatim in the exact quote.',
            ),
          );
        }
        if (actor.status === 'resolved') {
          if (matching.length !== 1 || matching[0] !== actor.actorKey) {
            issues.push(
              issue(
                matching.length > 1
                  ? 'EVIDENCE_ACTOR_AMBIGUITY_MUST_REMAIN_UNRESOLVED'
                  : 'EVIDENCE_ACTOR_RESOLUTION_NOT_ALLOWED',
                [...path, 'actorReference', 'actorKey'],
                'A resolved actor requires exactly one matching roster identity.',
              ),
            );
          }
        } else if (
          matching.length === 0 ||
          matching.join('\u0000') !== actor.candidateActorKeys.join('\u0000')
        ) {
          issues.push(
            issue(
              'EVIDENCE_ACTOR_CANDIDATES_MISMATCH',
              [...path, 'actorReference', 'candidateActorKeys'],
              'Unresolved actor candidates must equal the sorted matching roster identities.',
            ),
          );
        }
      }
      issues.push(
        ...validateTemporal(
          observation.temporalBound,
          observation.exactQuote,
          index,
        ),
      );
    });
    return immutableEvidence(issues);
  },
};

export const evidenceObserveArtifactContract = Object.freeze(contract);
