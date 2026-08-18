/**
 * `evidence-v2-compare/1` — J4 instance comparison.
 *
 * The model is shown two frozen sets of accepted occurrences: the current
 * instance and one earlier instance in the same chain. It returns relation
 * candidates that cite occurrence ids only. The product assembles the
 * relation from those ids, so no wording the model invents can enter either
 * endpoint (the observe rule, applied to comparison).
 *
 * Extraction stays blind. This contract is never the observe contract, and
 * observe never sees prior instances.
 */

import type {
  JsonValue,
  ModelMessage,
  PromptContract,
  SemanticIssue,
} from '@acme/core';
import { z } from 'zod';

import {
  EvidenceV2ComparableScopeSchema,
  EvidenceV2RelationTypeSchema,
  evidenceV2ContradictionScopeIssues,
} from './relation.js';

export const EVIDENCE_V2_COMPARE_CONTRACT_ID = 'evidence.v2.compare-window';
export const EVIDENCE_V2_COMPARE_CONTRACT_VERSION = '1.0.0';
export const EVIDENCE_V2_COMPARE_INPUT_SCHEMA_VERSION =
  'evidence-v2-compare-input/1';
export const EVIDENCE_V2_COMPARE_OUTPUT_SCHEMA_VERSION =
  'evidence-v2-compare-output/1';

/**
 * The wire name for the structured-output schema.
 *
 * Same constraint as observe: a provider allows `[a-zA-Z0-9_-]+` only, so
 * the schema version (which carries a slash) cannot be reused here.
 */
export const EVIDENCE_V2_COMPARE_OUTPUT_SCHEMA_NAME =
  'evidence_v2_compare_output_1';

const CompareOccurrenceSchema = z
  .object({
    occurrenceId: z.string().min(1),
    instanceKey: z.string().min(1),
    partId: z.string().min(1),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    exactQuote: z.string().min(1),
  })
  .strict();

export const EvidenceV2CompareInputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_COMPARE_INPUT_SCHEMA_VERSION),
    artifactId: z.string().min(1),
    chainId: z.string().min(1),
    windowId: z.string().min(1),
    currentInstanceKey: z.string().min(1),
    priorInstanceKey: z.string().min(1),
    current: z.array(CompareOccurrenceSchema).min(1),
    prior: z.array(CompareOccurrenceSchema).min(1),
  })
  .strict();

export type EvidenceV2CompareInput = z.infer<
  typeof EvidenceV2CompareInputSchema
>;

export const EvidenceV2CompareOutputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_COMPARE_OUTPUT_SCHEMA_VERSION),
    relations: z.array(
      z
        .object({
          fromOccurrenceId: z.string().min(1),
          toOccurrenceId: z.string().min(1),
          type: EvidenceV2RelationTypeSchema,
          comparableScope: EvidenceV2ComparableScopeSchema,
          rationale: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export type EvidenceV2CompareOutput = z.infer<
  typeof EvidenceV2CompareOutputSchema
>;

const SYSTEM = [
  'You compare two frozen sets of accepted observations from one anonymized',
  'judicial source chain. CURRENT is a later interview or document.',
  'PRIOR is an earlier one. Extraction of CURRENT did not see PRIOR.',
  '',
  'Propose typed relations from a CURRENT occurrence to a PRIOR occurrence.',
  'Use exactly one of these types:',
  '- contradicts: CURRENT states something incompatible with PRIOR.',
  '- adds: CURRENT supplies material PRIOR did not, without confirming or',
  '  contradicting it.',
  '- supports: CURRENT confirms what PRIOR already stated.',
  '- qualifies: CURRENT limits, conditions or partially revises PRIOR,',
  '  including when the scopes are not comparable enough to contradict.',
  '',
  'For each relation, judge four scopes independently — actor, time,',
  'location, entity — as comparable, incomparable or unknown. Unknown means',
  'the source did not supply that axis. Do not infer a missing actor, time,',
  'place or entity.',
  '',
  'A contradicts relation is valid only when actor and time are both',
  'comparable. If they are not, use qualifies instead of forcing a',
  'contradiction.',
  '',
  'Cite occurrence ids only. Never invent, paraphrase, trim or quote text.',
  'fromOccurrenceId must be a CURRENT id. toOccurrenceId must be a PRIOR id.',
  'Never relate an occurrence to itself. Never name an id that is not in',
  'this window. Returning no relations is a valid answer: silence is not a',
  'contradiction.',
].join('\n');

function text(role: ModelMessage['role'], content: string): ModelMessage {
  return { role, content: [{ type: 'text', text: content }] };
}

function list(label: string, items: EvidenceV2CompareInput['current']): string {
  return (
    `${label}\n` +
    items
      .map(
        (item) =>
          `${item.occurrenceId} (${item.instanceKey} L${String(item.startLine)}-L${String(item.endLine)}): ${item.exactQuote}`,
      )
      .join('\n\n')
  );
}

function validateSemantics(
  output: EvidenceV2CompareOutput,
  input: EvidenceV2CompareInput,
): readonly SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const current = new Set(input.current.map((item) => item.occurrenceId));
  const prior = new Set(input.prior.map((item) => item.occurrenceId));
  const seen = new Set<string>();

  output.relations.forEach((relation, index) => {
    if (!current.has(relation.fromOccurrenceId)) {
      issues.push({
        code: 'EVIDENCE_V2_COMPARE_FROM_OUTSIDE_CURRENT',
        path: ['relations', index, 'fromOccurrenceId'],
        message:
          'fromOccurrenceId must be a CURRENT occurrence in this window.',
        severity: 'error',
      });
      return;
    }
    if (!prior.has(relation.toOccurrenceId)) {
      issues.push({
        code: 'EVIDENCE_V2_COMPARE_TO_OUTSIDE_PRIOR',
        path: ['relations', index, 'toOccurrenceId'],
        message: 'toOccurrenceId must be a PRIOR occurrence in this window.',
        severity: 'error',
      });
      return;
    }
    if (relation.fromOccurrenceId === relation.toOccurrenceId) {
      issues.push({
        code: 'EVIDENCE_V2_COMPARE_SELF_RELATION',
        path: ['relations', index],
        message: 'A relation must name two distinct occurrences.',
        severity: 'error',
      });
      return;
    }
    const pair = `${relation.fromOccurrenceId}>${relation.toOccurrenceId}:${relation.type}`;
    if (seen.has(pair)) {
      issues.push({
        code: 'EVIDENCE_V2_COMPARE_PAIR_CITED_TWICE',
        path: ['relations', index],
        message: 'A typed pair may be proposed at most once per window.',
        severity: 'error',
      });
      return;
    }
    seen.add(pair);

    if (relation.type === 'contradicts') {
      for (const code of evidenceV2ContradictionScopeIssues(
        relation.comparableScope,
      )) {
        issues.push({
          code,
          path: ['relations', index, 'comparableScope'],
          message:
            'A contradiction requires comparable actor and time. Use qualifies when they are not.',
          severity: 'error',
        });
      }
    }
  });

  return issues;
}

export const evidenceV2CompareContract: PromptContract<
  EvidenceV2CompareInput,
  EvidenceV2CompareOutput
> = {
  ref: {
    id: EVIDENCE_V2_COMPARE_CONTRACT_ID,
    version: EVIDENCE_V2_COMPARE_CONTRACT_VERSION,
  },
  inputSchema: EvidenceV2CompareInputSchema,
  outputSchema: EvidenceV2CompareOutputSchema,
  requiredCapabilities: { structuredOutput: true },
  retention: 'encrypted-payload',

  buildRequest(input) {
    return {
      messages: [
        text('system', SYSTEM),
        text(
          'user',
          [
            `Window ${input.windowId} of chain ${input.chainId}.`,
            '',
            list('CURRENT', input.current),
            '',
            list('PRIOR', input.prior),
          ].join('\n'),
        ),
      ],
      output: {
        mode: 'json',
        schemaName: EVIDENCE_V2_COMPARE_OUTPUT_SCHEMA_NAME,
        jsonSchema: z.toJSONSchema(EvidenceV2CompareOutputSchema) as JsonValue,
      },
    };
  },

  buildRepairRequest(input, context) {
    const listed = context.issues
      .map((issue) => `- ${issue.code}: ${issue.message}`)
      .join('\n');
    return {
      messages: [
        text('system', SYSTEM),
        text(
          'user',
          [
            `Window ${input.windowId} of chain ${input.chainId}.`,
            '',
            list('CURRENT', input.current),
            '',
            list('PRIOR', input.prior),
          ].join('\n'),
        ),
        text(
          'user',
          [
            'The previous response was refused:',
            listed,
            '',
            'Return the same answer corrected. Cite only CURRENT ids as',
            'fromOccurrenceId and only PRIOR ids as toOccurrenceId. A',
            'contradiction needs comparable actor and time; otherwise use',
            'qualifies. Returning no relations is valid.',
          ].join('\n'),
        ),
      ],
      output: {
        mode: 'json',
        schemaName: EVIDENCE_V2_COMPARE_OUTPUT_SCHEMA_NAME,
        jsonSchema: z.toJSONSchema(EvidenceV2CompareOutputSchema) as JsonValue,
      },
    };
  },

  validateSemantics,
};
