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
  EVIDENCE_V2_STATED_TIME_PATTERN,
  EvidenceV2OccurrenceKindSchema,
} from './occurrence.js';

export const EVIDENCE_V2_OBSERVE_CONTRACT_ID = 'evidence.v2.observe-window';
export const EVIDENCE_V2_OBSERVE_CONTRACT_VERSION = '1.0.0';
export const EVIDENCE_V2_OBSERVE_INPUT_SCHEMA_VERSION =
  'evidence-v2-observe-input/1';
export const EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_VERSION =
  'evidence-v2-observe-output/1';

/**
 * The wire name for the structured-output schema.
 *
 * A provider constrains this to `[a-zA-Z0-9_-]+`, so the schema *version* — which
 * carries a slash and belongs in the payload — cannot be reused here. The first
 * live call was rejected with HTTP 400 for exactly that reason.
 */
export const EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_NAME =
  'evidence_v2_observe_output_1';

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
          /**
           * The span the unit itself states. The product derives the typed
           * kind from it (ADR-0048 §2): asking the model to type it produced
           * a known kind with no value and refused the whole window twice.
           */
          statedTime: z
            .object({
              from: z.string().regex(EVIDENCE_V2_STATED_TIME_PATTERN),
              to: z.string().regex(EVIDENCE_V2_STATED_TIME_PATTERN).nullable(),
            })
            .strict()
            .nullable(),
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
  'Return statedTime only when the unit itself states a calendar time, as',
  'YYYY, YYYY-MM, YYYY-MM-DD or YYYY-MM-DDThh:mm: from for a point or the',
  'start of a span, to for the end of a span or null. A vague reference such',
  'as "då", "senare" or "på kvällen" is not a time — use null for it, and',
  'never convert vague language into a clock time or infer a time from',
  'elsewhere. Use null when the unit states no time at all. Always set',
  'actorReference to null.',
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

    const stated = observation.statedTime;
    if (stated === null) return;
    if (stated.to !== null && stated.to < stated.from) {
      issues.push({
        code: 'EVIDENCE_V2_STATED_TIME_REVERSED',
        path: ['observations', index, 'statedTime'],
        message: 'A stated span ends no earlier than it begins.',
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
        schemaName: EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_NAME,
        jsonSchema: z.toJSONSchema(EvidenceV2ObserveOutputSchema) as JsonValue,
      },
      // No temperature. A model may reject the parameter outright — this one
      // does — and a contract has no business assuming a provider tuning knob
      // exists. Structured output plus the refusals carry determinism instead.
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
            'window, at most once each, and give a stated time only as a',
            'calendar value, using null for anything vaguer.',
          ].join('\n'),
        ),
      ],
      output: {
        mode: 'json',
        schemaName: EVIDENCE_V2_OBSERVE_OUTPUT_SCHEMA_NAME,
        jsonSchema: z.toJSONSchema(EvidenceV2ObserveOutputSchema) as JsonValue,
      },
    };
  },

  validateSemantics,
};
