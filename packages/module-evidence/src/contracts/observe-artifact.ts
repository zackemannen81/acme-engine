import { buildEvidenceRepairRequest } from './repair.js';
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
  buildEvidenceSourceSegments,
  exactQuoteOccurrenceCount,
  locateUniqueEvidenceQuote,
} from '../canonical-text.js';
import {
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V1,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V2,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V3,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V4,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V5,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V6,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V7,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V8,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V9,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V10,
  EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V11,
} from '../catalogue.js';
import { immutableEvidence } from '../immutable.js';
import {
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactInputV1Schema,
  EvidenceObserveArtifactInputV2Schema,
  EvidenceObserveArtifactOutputSchema,
  EvidenceObserveArtifactOutputV1Schema,
  EvidenceObserveArtifactOutputV2Schema,
  EvidenceObserveArtifactOutputV3Schema,
  EvidenceObserveArtifactOutputV4Schema,
  EvidenceObserveArtifactOutputV5Schema,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactInputV1,
  type EvidenceObserveArtifactInputV2,
  type EvidenceObserveArtifactOutput,
  type EvidenceObserveArtifactOutputV1,
  type EvidenceObserveArtifactOutputV2,
  type EvidenceObserveArtifactOutputV3,
  type EvidenceObserveArtifactOutputV4,
  type EvidenceObserveArtifactOutputV5,
} from '../schemas.js';
import {
  deriveEvidenceSourceStructure,
  evidenceStructuredSourceSegments,
  resolveEvidenceStructuredSourceSegment,
} from '../source-structure.js';

const PROHIBITED_CONCLUSION =
  /\b(?:credible|credibility|truthful|lying|guilty|innocent|liable|liability|admissible|inadmissible|privileged|culpable)\b/iu;

/**
 * Historical ceiling. ADR-0041 sized it for the synthetic corpus; every
 * contract version up to `1.6.0` is registered against it and must keep it
 * byte-exact for replay.
 */
export const EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX = 8 as const;

/**
 * Active ceiling, derived from the response budget rather than the fixture.
 *
 * ACME-0133 measured roughly 54 output tokens per candidate, so 64 candidates
 * cost about 3,500 of the 8,192-token budget. The ceiling stays explicit and
 * machine-checked because an unbounded array truncates against that budget,
 * and truncated JSON is a refusal rather than a result. Historical `@1.7.0`
 * and `@1.8.0` keep this ceiling. `@1.9.0` raises it so one window can hold
 * more than one atomic observation per segment.
 */
export const EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ACTIVE = 64 as const;

/**
 * Atomic-observation ceiling for `@1.9.0`. 128 × ~54 tokens stays inside
 * the 8,192-token response budget. Exhaustion is a refusal, not truncation.
 */
export const EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ATOMIC = 128 as const;

const EvidenceBoundedObserveArtifactOutputSchema =
  EvidenceObserveArtifactOutputV4Schema.extend({
    observations: EvidenceObserveArtifactOutputV4Schema.shape.observations
      .min(1)
      .max(EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX),
  });

const EvidenceBoundedActiveObserveArtifactOutputSchema =
  EvidenceObserveArtifactOutputV4Schema.extend({
    observations: EvidenceObserveArtifactOutputV4Schema.shape.observations
      .min(1)
      .max(EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ACTIVE),
  });

const EvidenceBoundedAtomicObserveArtifactOutputV5Schema =
  EvidenceObserveArtifactOutputV5Schema.extend({
    observations: EvidenceObserveArtifactOutputV5Schema.shape.observations
      .min(0)
      .max(EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ATOMIC),
  });

const EvidenceBoundedAtomicObserveArtifactOutputSchema =
  EvidenceObserveArtifactOutputSchema.extend({
    observations: EvidenceObserveArtifactOutputSchema.shape.observations
      .min(0)
      .max(EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ATOMIC),
  });

const EvidenceBoundedObserveArtifactOutputV1Schema =
  EvidenceObserveArtifactOutputV1Schema.extend({
    observations: EvidenceObserveArtifactOutputV1Schema.shape.observations
      .min(1)
      .max(EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX),
  });

const EvidenceBoundedObserveArtifactOutputV2Schema =
  EvidenceObserveArtifactOutputV2Schema.extend({
    observations: EvidenceObserveArtifactOutputV2Schema.shape.observations
      .min(1)
      .max(EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX),
  });

const EvidenceBoundedObserveArtifactOutputV3Schema =
  EvidenceObserveArtifactOutputV3Schema.extend({
    observations: EvidenceObserveArtifactOutputV3Schema.shape.observations
      .min(1)
      .max(EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX),
  });

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): SemanticIssue {
  return immutableEvidence({ code, path, message, severity: 'error' });
}

function matchingActorKeys(
  input: Pick<EvidenceObserveArtifactInputV1, 'actorRoster'>,
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

function createContract<
  TInput extends
    | EvidenceObserveArtifactInput
    | EvidenceObserveArtifactInputV2
    | EvidenceObserveArtifactInputV1,
  TOutput extends
    | EvidenceObserveArtifactOutput
    | EvidenceObserveArtifactOutputV1
    | EvidenceObserveArtifactOutputV2
    | EvidenceObserveArtifactOutputV3
    | EvidenceObserveArtifactOutputV4
    | EvidenceObserveArtifactOutputV5,
>(configuration: {
  readonly ref: ContractRef;
  readonly sourceDescription: string;
  readonly boundedCandidateBatch: boolean;
  readonly runtimeDerivedLocator: boolean;
  readonly singleLineCandidate: boolean;
  readonly runtimeDerivedSegmentQuote: boolean;
  readonly explicitCanonicalUtc: boolean;
  readonly coverageComplete: boolean;
  readonly atomicCoverage: boolean;
  readonly emptyRosterNullActor: boolean;
  readonly neighbourContext: boolean;
  readonly candidateBatchMax: number;
  readonly maxOutputTokens: number;
  readonly schemaName: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
}): PromptContract<TInput, TOutput> {
  return {
    ref: configuration.ref,
    inputSchema: configuration.inputSchema,
    outputSchema: configuration.outputSchema,
    requiredCapabilities: Object.freeze({ structuredOutput: true }),
    retention: 'encrypted-payload',

    buildRequest(input) {
      const validated = configuration.inputSchema.parse(input);
      const { text: _canonicalText, ...artifactMetadata } =
        validated.artifactVersion;
      void _canonicalText;
      const windowIds =
        configuration.coverageComplete && 'coverageWindow' in validated
          ? new Set(validated.coverageWindow.sourceSegmentIds)
          : undefined;
      const contextIds =
        configuration.neighbourContext &&
        'coverageWindow' in validated &&
        'contextSegmentIds' in validated.coverageWindow &&
        validated.coverageWindow.contextSegmentIds !== undefined
          ? new Set(validated.coverageWindow.contextSegmentIds)
          : new Set<string>();
      const wantedIds =
        windowIds === undefined
          ? undefined
          : new Set([...windowIds, ...contextIds]);
      const availableSegments = configuration.neighbourContext
        ? [
            ...buildEvidenceSourceSegments(validated.artifactVersion.text),
            ...evidenceStructuredSourceSegments(validated.artifactVersion.text),
          ]
        : buildEvidenceSourceSegments(validated.artifactVersion.text);
      const sourceSegments = availableSegments
        .filter(
          (segment) =>
            wantedIds === undefined || wantedIds.has(segment.sourceSegmentId),
        )
        .map(({ sourceSegmentId, exactQuote }) => ({
          sourceSegmentId,
          text: exactQuote,
          ...(configuration.neighbourContext
            ? {
                role: contextIds.has(sourceSegmentId)
                  ? ('context' as const)
                  : ('extractable' as const),
              }
            : {}),
        }));
      const providerInput = configuration.runtimeDerivedSegmentQuote
        ? {
            schemaVersion: validated.schemaVersion,
            artifactVersion: {
              ...artifactMetadata,
              sourceSegments,
            },
            actorRoster: validated.actorRoster,
          }
        : validated;
      const request = {
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text:
                  `Extract only source-bound observations from the supplied ${configuration.sourceDescription}. ` +
                  (configuration.runtimeDerivedLocator
                    ? configuration.runtimeDerivedSegmentQuote
                      ? 'Select one supplied sourceSegmentId per observation. Runtime derives the entire exact quote and canonical locator from that segment; never join segments and do not return quote text or line numbers. '
                      : 'Copy every exactQuote verbatim; do not estimate or return line numbers because runtime derives the canonical line range. '
                    : 'Copy every exactQuote verbatim and use its exact one-based line range. ') +
                  (configuration.singleLineCandidate
                    ? 'Each exactQuote must be a short contiguous substring copied exactly from one canonical source line, with no line break and at most 500 characters. '
                    : '') +
                  'A transcript yields statement occurrences; a structured exhibit yields exhibit assertions. ' +
                  (configuration.emptyRosterNullActor
                    ? 'Resolve an actor only through the supplied roster; preserve ambiguity as unresolved when the roster yields candidates. If the actor roster is empty, set actorReference and sourceActorReference to null. Do not invent unresolved candidate keys. '
                    : 'Resolve an actor only through the supplied roster; preserve ambiguity as unresolved. ') +
                  (configuration.singleLineCandidate ||
                  configuration.runtimeDerivedSegmentQuote
                    ? configuration.runtimeDerivedSegmentQuote
                      ? 'Use an exact, range or approximate temporal value only when every normalized value has its complete calendar date and clock visible in the selected source segment; if it shows only a clock time or lacks the complete date, use unknown. '
                      : 'Use an exact, range or approximate temporal value only when every normalized value has its complete calendar date and clock visible in exactQuote; if exactQuote shows only a clock time or lacks the complete date, use unknown. '
                    : 'Normalize time only when the clock value is visible in the quote, otherwise use unknown. ') +
                  (configuration.explicitCanonicalUtc
                    ? 'Every normalized timestamp must be canonical UTC exactly as YYYY-MM-DDTHH:MM:SSZ or YYYY-MM-DDTHH:MM:SS.sssZ. Never return local time, minute-only time, or a numeric offset; use temporal unknown instead. '
                    : '') +
                  'Do not assess credibility, guilt, legal sufficiency, admissibility or privilege. ' +
                  (configuration.neighbourContext
                    ? 'Context segments (role context) are supplied only for reference resolution. Never extract an observation whose sole support is a context segment. Do not name a context sourceSegmentId in observations or segmentCoverage. '
                    : '') +
                  (configuration.atomicCoverage
                    ? 'This request is one coverage window. Account for every supplied sourceSegmentId exactly once in segmentCoverage. ' +
                      'A supplied sourceSegmentId may yield zero, one, or multiple observations. ' +
                      'Return one observation for every independently useful source-bound proposition in that segment. ' +
                      'Do not merge propositions merely because they occur in the same segment. ' +
                      'Do not omit a proposition because another observation from the same segment already exists. ' +
                      'If a segment contains no source-bound proposition suitable for an observation, return no observation for that segment and mark its coverage status as no_observation. ' +
                      'Never invent an observation merely to satisfy segment coverage. ' +
                      'An observation is atomic when it can independently be accepted, rejected, corroborated, contradicted, related, or placed on a timeline. ' +
                      'If two parts of a statement could independently have different evidentiary standing, extract them as separate observations. ' +
                      'Preserve attribution, negation, uncertainty and reported-speech status. Do not promote a reported statement into an unqualified world fact. ' +
                      'Do not suppress an observation because the same or similar proposition appears elsewhere in this window, artifact, case or existing evidence state. Independent occurrences are independently source-bound evidence. Corroboration and duplicate resolution happen downstream. ' +
                      'Failure to normalize time must never remove temporal information from the observation. If the segment contains an incomplete, relative or otherwise non-normalizable time expression, preserve that expression in temporalBound.reason and return kind unknown. ' +
                      'The reviewer decides standing. Do not claim document-complete coverage. ' +
                      'Before returning, re-read each supplied segment clause by clause. For every source-bound proposition, ask whether it could independently matter for corroboration, contradiction, attribution, entity resolution or chronology. If yes, verify that an observation represents it. Do not output this review process. '
                    : configuration.coverageComplete
                      ? 'This request is one coverage window. Return exactly one observation for every supplied sourceSegmentId. Do not omit a supplied segment and do not add a segment that was not supplied. The reviewer decides standing. Do not claim document-complete coverage. '
                      : configuration.boundedCandidateBatch
                        ? `Return between one and ${String(configuration.candidateBatchMax)} materially distinct observations as a non-exhaustive reviewer candidate batch; do not claim full-source coverage. `
                        : '') +
                  'Return only the requested JSON.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: canonicalJson(providerInput as unknown as JsonValue),
              },
            ],
          },
        ],
        output: {
          mode: 'json',
          schemaName: configuration.schemaName,
          jsonSchema: z.toJSONSchema(configuration.outputSchema) as JsonValue,
        },
        maxOutputTokens: configuration.maxOutputTokens,
      } satisfies ModelRequest;
      return immutableEvidence(request);
    },

    buildRepairRequest(input, context) {
      return buildEvidenceRepairRequest({
        request: this.buildRequest(input, context),
        issues: context.issues,
      });
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

        const selectedSegment =
          configuration.runtimeDerivedSegmentQuote &&
          'sourceSegmentId' in observation
            ? resolveEvidenceStructuredSourceSegment(
                input.artifactVersion.text,
                observation.sourceSegmentId,
              )
            : undefined;
        const exactQuote =
          'exactQuote' in observation
            ? observation.exactQuote
            : selectedSegment?.exactQuote;
        if (
          configuration.runtimeDerivedSegmentQuote &&
          selectedSegment === undefined
        ) {
          issues.push(
            issue(
              'EVIDENCE_SOURCE_SEGMENT_NOT_FOUND',
              [...path, 'sourceSegmentId'],
              'Source segment must exist in the runtime-defined segment set.',
            ),
          );
        } else if (
          configuration.runtimeDerivedLocator &&
          !configuration.runtimeDerivedSegmentQuote &&
          exactQuote !== undefined
        ) {
          const location = locateUniqueEvidenceQuote(
            input.artifactVersion.text,
            exactQuote,
          );
          if (location.status === 'absent') {
            issues.push(
              issue(
                'EVIDENCE_QUOTE_NOT_FOUND',
                [...path, 'exactQuote'],
                'Exact quote must occur verbatim in the supplied source.',
              ),
            );
          } else if (location.status === 'ambiguous') {
            issues.push(
              issue(
                'EVIDENCE_QUOTE_AMBIGUOUS',
                [...path, 'exactQuote'],
                'Exact quote must occur exactly once in the supplied source.',
              ),
            );
          }
        } else if (
          'startLine' in observation &&
          typeof observation.startLine === 'number' &&
          'endLine' in observation &&
          typeof observation.endLine === 'number'
        ) {
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
        }

        const actor =
          observation.kind === 'statement-occurrence'
            ? observation.actorReference
            : observation.sourceActorReference;
        if (
          configuration.emptyRosterNullActor &&
          input.actorRoster.length === 0 &&
          actor !== null
        ) {
          issues.push(
            issue(
              'EVIDENCE_ACTOR_REQUIRES_ROSTER',
              [
                ...path,
                observation.kind === 'statement-occurrence'
                  ? 'actorReference'
                  : 'sourceActorReference',
              ],
              'An empty actor roster requires a null actor reference. Do not invent unresolved candidates.',
            ),
          );
        } else if (actor !== null) {
          const matching = matchingActorKeys(input, actor.sourceLabel);
          if (
            exactQuote === undefined ||
            !exactQuote.includes(actor.sourceLabel)
          ) {
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
        if (exactQuote !== undefined)
          issues.push(
            ...validateTemporal(observation.temporalBound, exactQuote, index),
          );
      });
      if (configuration.neighbourContext && 'sourceStructureId' in input) {
        const derived = deriveEvidenceSourceStructure(
          input.artifactVersion.text,
        );
        if (derived.structureId !== input.sourceStructureId) {
          issues.push(
            issue(
              'EVIDENCE_SOURCE_STRUCTURE_MISMATCH',
              ['sourceStructureId'],
              'The supplied source structure id must equal the hash of the active rule version and canonical text.',
            ),
          );
        }
      }
      if (
        configuration.neighbourContext &&
        'coverageWindow' in input &&
        'contextSegmentIds' in input.coverageWindow &&
        input.coverageWindow.contextSegmentIds !== undefined
      ) {
        const context = new Set(input.coverageWindow.contextSegmentIds);
        output.observations.forEach((observation, index) => {
          if (
            'sourceSegmentId' in observation &&
            context.has(observation.sourceSegmentId)
          ) {
            issues.push(
              issue(
                'EVIDENCE_CONTEXT_SEGMENT_NOT_EXTRACTABLE',
                ['observations', index, 'sourceSegmentId'],
                'An observation must not name a neighbour-context segment.',
              ),
            );
          }
        });
      }
      if (
        configuration.coverageComplete &&
        'coverageWindow' in input &&
        input.coverageWindow !== undefined
      ) {
        const expected = input.coverageWindow.sourceSegmentIds;
        const observed = output.observations.flatMap((observation) =>
          'sourceSegmentId' in observation ? [observation.sourceSegmentId] : [],
        );
        const expectedSet = new Set(expected);
        const observedSet = new Set(observed);
        if (configuration.atomicCoverage && 'segmentCoverage' in output) {
          const coverage = output.segmentCoverage;
          const coverageIds = coverage.map(
            ({ sourceSegmentId }) => sourceSegmentId,
          );
          const coverageSet = new Set(coverageIds);
          if (
            coverageIds.length !== expected.length ||
            expected.some((id) => !coverageSet.has(id)) ||
            coverageIds.some((id) => !expectedSet.has(id))
          ) {
            issues.push(
              issue(
                'EVIDENCE_COVERAGE_WINDOW_INCOMPLETE',
                ['segmentCoverage'],
                'A coverage window must account for every supplied source segment exactly once and must not name a segment outside the window.',
              ),
            );
          }
          if (observed.some((id) => !expectedSet.has(id))) {
            issues.push(
              issue(
                'EVIDENCE_COVERAGE_WINDOW_INCOMPLETE',
                ['observations'],
                'An observation must name a source segment supplied in the coverage window.',
              ),
            );
          }
          coverage.forEach((entry, index) => {
            const count = observed.filter(
              (id) => id === entry.sourceSegmentId,
            ).length;
            if (entry.status === 'observations_extracted' && count === 0) {
              issues.push(
                issue(
                  'EVIDENCE_COVERAGE_STATUS_MISMATCH',
                  ['segmentCoverage', index, 'status'],
                  'observations_extracted requires at least one observation for that segment.',
                ),
              );
            }
            if (entry.status === 'no_observation' && count > 0) {
              issues.push(
                issue(
                  'EVIDENCE_COVERAGE_STATUS_MISMATCH',
                  ['segmentCoverage', index, 'status'],
                  'no_observation forbids observations for that segment.',
                ),
              );
            }
          });
        } else if (
          expected.some((id) => !observedSet.has(id)) ||
          observed.some((id) => !expectedSet.has(id))
        ) {
          issues.push(
            issue(
              'EVIDENCE_COVERAGE_WINDOW_INCOMPLETE',
              ['observations'],
              'A coverage window must observe every supplied source segment and must not name a segment outside the window.',
            ),
          );
        }
      }
      return immutableEvidence(issues);
    },
  };
}

export const evidenceObserveArtifactContractV1 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V1,
    sourceDescription: 'synthetic artifact',
    boundedCandidateBatch: false,
    runtimeDerivedLocator: false,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: false,
    explicitCanonicalUtc: false,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX,
    maxOutputTokens: 2048,
    schemaName: 'evidence_observe_artifact_1_0_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceObserveArtifactOutputV1Schema,
  }),
);

export const evidenceObserveArtifactContractV2 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V2,
    sourceDescription: 'artifact',
    boundedCandidateBatch: false,
    runtimeDerivedLocator: false,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: false,
    explicitCanonicalUtc: false,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX,
    maxOutputTokens: 2048,
    schemaName: 'evidence_observe_artifact_1_0_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceObserveArtifactOutputV1Schema,
  }),
);

export const evidenceObserveArtifactContractV3 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V3,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: false,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: false,
    explicitCanonicalUtc: false,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_2_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceBoundedObserveArtifactOutputV1Schema,
  }),
);

export const evidenceObserveArtifactContractV4 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V4,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: false,
    explicitCanonicalUtc: false,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_3_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceBoundedObserveArtifactOutputV2Schema,
  }),
);

export const evidenceObserveArtifactContractV5 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V5,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: true,
    runtimeDerivedSegmentQuote: false,
    explicitCanonicalUtc: false,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_4_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceBoundedObserveArtifactOutputV3Schema,
  }),
);

export const evidenceObserveArtifactContractV6 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V6,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: true,
    explicitCanonicalUtc: false,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_5_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceBoundedObserveArtifactOutputSchema,
  }),
);

export const evidenceObserveArtifactContractV7 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V7,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: true,
    explicitCanonicalUtc: true,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_6_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceBoundedObserveArtifactOutputSchema,
  }),
);

export const evidenceObserveArtifactContractV8 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V8,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: true,
    explicitCanonicalUtc: true,
    coverageComplete: false,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ACTIVE,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_7_0',
    inputSchema: EvidenceObserveArtifactInputV1Schema,
    outputSchema: EvidenceBoundedActiveObserveArtifactOutputSchema,
  }),
);

export const evidenceObserveArtifactContractV9 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V9,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: true,
    explicitCanonicalUtc: true,
    coverageComplete: true,
    atomicCoverage: false,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ACTIVE,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_8_0',
    inputSchema: EvidenceObserveArtifactInputV2Schema,
    outputSchema: EvidenceBoundedActiveObserveArtifactOutputSchema,
  }),
);

export const evidenceObserveArtifactContractV10 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V10,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: true,
    explicitCanonicalUtc: true,
    coverageComplete: true,
    atomicCoverage: true,
    emptyRosterNullActor: false,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ATOMIC,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_9_0',
    inputSchema: EvidenceObserveArtifactInputV2Schema,
    outputSchema: EvidenceBoundedAtomicObserveArtifactOutputV5Schema,
  }),
);

export const evidenceObserveArtifactContractV11 = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF_V11,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: true,
    explicitCanonicalUtc: true,
    coverageComplete: true,
    atomicCoverage: true,
    emptyRosterNullActor: true,
    neighbourContext: false,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ATOMIC,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_10_0',
    inputSchema: EvidenceObserveArtifactInputV2Schema,
    outputSchema: EvidenceBoundedAtomicObserveArtifactOutputV5Schema,
  }),
);

export const evidenceObserveArtifactContract = Object.freeze(
  createContract({
    ref: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF,
    sourceDescription: 'artifact',
    boundedCandidateBatch: true,
    runtimeDerivedLocator: true,
    singleLineCandidate: false,
    runtimeDerivedSegmentQuote: true,
    explicitCanonicalUtc: true,
    coverageComplete: true,
    atomicCoverage: true,
    emptyRosterNullActor: true,
    neighbourContext: true,
    candidateBatchMax: EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX_ATOMIC,
    maxOutputTokens: 8192,
    schemaName: 'evidence_observe_artifact_1_11_0',
    inputSchema: EvidenceObserveArtifactInputSchema,
    outputSchema: EvidenceBoundedAtomicObserveArtifactOutputSchema,
  }),
);
