/**
 * `evidence-v2-observe/1`, decided in ADR-0048.
 *
 * The model is shown one window of citable units and asked which of them state
 * something evidential, of which kind, and with what typed time. It returns unit
 * ids and classifications only. It never returns a quote: the occurrence's quote
 * and locator come from the cited unit, so no wording the model invents can
 * enter the record (ADR-0048 §2).
 *
 * It is also never asked to account for units it did not select. Coverage is
 * derived from stored rows, which is what removes the enumeration obligation
 * that made a 64-unit window fatal in the frozen application (ADR-0048 §3).
 */

import type {
  JsonValue,
  ModelMessage,
  PromptContract,
  SemanticIssue,
} from '@acme/core';
import { z } from 'zod';

import {
  EvidenceV2OccurrenceKindSchema,
  EvidenceV2TemporalBoundSchema,
} from './occurrence.js';

export const EVIDENCE_V2_OBSERVE_CONTRACT_ID = 'evidence.v2.observe-window';
export const EVIDENCE_V2_OBSERVE_CONTRACT_VERSION = '1.0.0';
export const EVIDENCE_V2_OBSERVE_INPUT_SCHEMA_VERSION =
  'evidence-v2-observe-input/1';
export const EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_VERSION =
  'evidence-v2-observe-output/1';

export const EvidenceV2ObserveInputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_OBSERVE_INPUT_SCHEMA_VERSION),
    artifactId: z.string().min(1),
    partId: z.string().min(1),
    windowId: z.string().min(1),
    units: z
      .array(
        z
          .object({
            unitId: z.string().min(1),
            startLine: z.number().int().positive(),
            endLine: z.number().int().positive(),
            exactQuote: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type EvidenceV2ObserveInput = z.infer<
  typeof EvidenceV2ObserveInputSchema
>;

export const EvidenceV2ObserveOutputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_VERSION),
    observations: z.array(
      z
        .object({
          sourceUnitId: z.string().min(1),
          kind: EvidenceV2OccurrenceKindSchema,
          /** Null unless a roster was supplied, and `/1` supplies none. */
          actorReference: z.null(),
          temporalBound: EvidenceV2TemporalBoundSchema.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type EvidenceV2ObserveOutput = z.infer<
  typeof EvidenceV2ObserveOutputSchema
>;

const SYSTEM = [
  'You examine one window of an anonymized judicial source document.',
  'Each unit below is a verbatim, uniquely locatable fragment of that source.',
  '',
  'For every unit that states something evidential — an account someone gave,',
  'or something a document records or depicts — return one observation naming',
  'that unit. Classify it as statement-occurrence when a person is recounting,',
  'or exhibit-assertion when a document or exhibit records or depicts.',
  '',
  'Return a temporalBound only when the unit itself states a time. Use kind',
  '"exact" for a stated point, "range" for a stated span, "approximate" for a',
  'hedged time, and "unknown" when the unit refers to a time it does not state.',
  'Never convert vague language into a clock time. Use null when the unit',
  'states no time at all. Always set zone to null and actorReference to null.',
  '',
  'Skip a unit that is a heading, a page marker, a form label, an index row or',
  'administrative boilerplate. Returning no observations is a valid answer.',
  'Never invent, paraphrase, trim or quote text: return unit ids only.',
  'Never name a unit that is not in this window, and never name one twice.',
].join('\n');

function text(role: ModelMessage['role'], content: string): ModelMessage {
  return { role, content: [{ type: 'text', text: content }] };
}

function unitList(input: EvidenceV2ObserveInput): string {
  return input.units
    .map(
      (unit) =>
        `${unit.unitId} (L${String(unit.startLine)}-L${String(unit.endLine)}): ${unit.exactQuote}`,
    )
    .join('\n\n');
}

/**
 * Every refusal in ADR-0048 §5. Each names the window, never the case.
 */
function validateSemantics(
  output: EvidenceV2ObserveOutput,
  input: EvidenceV2ObserveInput,
): readonly SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const supplied = new Set(input.units.map((unit) => unit.unitId));
  const seen = new Set<string>();

  output.observations.forEach((observation, index) => {
    if (!supplied.has(observation.sourceUnitId)) {
      issues.push({
        code: 'EVIDENCE_V2_UNIT_OUTSIDE_WINDOW',
        path: ['observations', index, 'sourceUnitId'],
        message: 'An observation must cite a unit supplied in this window.',
        severity: 'error',
      });
      return;
    }
    if (seen.has(observation.sourceUnitId)) {
      issues.push({
        code: 'EVIDENCE_V2_UNIT_CITED_TWICE',
        path: ['observations', index, 'sourceUnitId'],
        message: 'A unit may carry at most one observation per window.',
        severity: 'error',
      });
      return;
    }
    seen.add(observation.sourceUnitId);

    const bound = observation.temporalBound;
    if (bound === null) return;
    if (
      bound.kind === 'unknown' &&
      (bound.from !== null || bound.to !== null)
    ) {
      issues.push({
        code: 'EVIDENCE_V2_TEMPORAL_BOUND_UNTYPED',
        path: ['observations', index, 'temporalBound'],
        message: 'An unknown bound carries no from or to value.',
        severity: 'error',
      });
    }
    if (bound.kind !== 'unknown' && bound.from === null) {
      issues.push({
        code: 'EVIDENCE_V2_TEMPORAL_BOUND_UNTYPED',
        path: ['observations', index, 'temporalBound'],
        message: 'A known bound states at least a from value.',
        severity: 'error',
      });
    }
  });

  return issues;
}

export const evidenceV2ObserveContract: PromptContract<
  EvidenceV2ObserveInput,
  EvidenceV2ObserveOutput
> = {
  ref: {
    id: EVIDENCE_V2_OBSERVE_CONTRACT_ID,
    version: EVIDENCE_V2_OBSERVE_CONTRACT_VERSION,
  },
  inputSchema: EvidenceV2ObserveInputSchema,
  outputSchema: EvidenceV2ObserveOutputSchema,
  requiredCapabilities: { structuredOutput: true },
  retention: 'encrypted-payload',

  buildRequest(input) {
    return {
      messages: [
        text('system', SYSTEM),
        text(
          'user',
          `Window ${input.windowId} of part ${input.partId}.\n\n${unitList(input)}`,
        ),
      ],
      output: {
        mode: 'json',
        schemaName: EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_VERSION,
        jsonSchema: z.toJSONSchema(EvidenceV2ObserveOutputSchema) as JsonValue,
      },
      temperature: 0,
    };
  },

  /**
   * One bounded repair. It restates the refusals rather than the source, so a
   * repair cannot smuggle in new material.
   */
  buildRepairRequest(input, context) {
    const listed = context.issues
      .map((issue) => `- ${issue.code}: ${issue.message}`)
      .join('\n');
    return {
      messages: [
        text('system', SYSTEM),
        text(
          'user',
          `Window ${input.windowId} of part ${input.partId}.\n\n${unitList(input)}`,
        ),
        text(
          'user',
          [
            'The previous response was refused:',
            listed,
            '',
            'Return the same answer corrected. Cite only unit ids from this',
            'window, at most once each, and keep every temporal bound typed.',
          ].join('\n'),
        ),
      ],
      output: {
        mode: 'json',
        schemaName: EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_VERSION,
        jsonSchema: z.toJSONSchema(EvidenceV2ObserveOutputSchema) as JsonValue,
      },
      temperature: 0,
    };
  },

  validateSemantics,
};
