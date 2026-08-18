/**
 * `ObservationOccurrence`: the first V2 object that is evidence.
 *
 * Immutable, bound to one artifact version and one citable unit, carrying the
 * unit's verbatim quote and its locator — never text the model wrote. ADR-0048
 * §2 keeps the authority ladder intact: the model selects and classifies, and
 * the record is assembled from the source.
 */

import { nodeHashing } from '@acme/core';
import { z } from 'zod';

export const EVIDENCE_V2_OCCURRENCE_SCHEMA_VERSION = 'evidence-v2-occurrence/1';

export const EvidenceV2OccurrenceKindSchema = z.enum([
  'statement-occurrence',
  'exhibit-assertion',
]);

export type EvidenceV2OccurrenceKind = z.infer<
  typeof EvidenceV2OccurrenceKindSchema
>;

/**
 * The only shape a stated time may take: a year, a month, a date, or a date
 * with a time of day. Nothing else is a time.
 *
 * This exists because a real live run returned the Swedish word `då` ("then")
 * as a stated time, and the product typed it into a bound. A word is not a
 * time, and a bound whose `from` is a word would be ordered on a timeline as if
 * it were one. Constraining the shape makes that unrepresentable rather than
 * detectable.
 */
export const EVIDENCE_V2_STATED_TIME_PATTERN =
  /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2})?)?)?)?$/u;

/**
 * A typed bound, or nothing.
 *
 * Missing precision stays missing: the product definition forbids inventing a
 * clock time from vague language, so `unknown` is a real answer and `null` means
 * the source offered none at all.
 */
export const EvidenceV2TemporalBoundSchema = z
  .object({
    kind: z.enum(['exact', 'range', 'approximate', 'unknown']),
    from: z.string().regex(EVIDENCE_V2_STATED_TIME_PATTERN).nullable(),
    to: z.string().regex(EVIDENCE_V2_STATED_TIME_PATTERN).nullable(),
    /** No zone is asserted. The source states none. */
    zone: z.null(),
  })
  .strict();

export type EvidenceV2TemporalBound = z.infer<
  typeof EvidenceV2TemporalBoundSchema
>;

export const EvidenceV2OccurrenceSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_OCCURRENCE_SCHEMA_VERSION),
    occurrenceId: z.string().min(1),
    artifactId: z.string().min(1),
    partId: z.string().min(1),
    unitId: z.string().min(1),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    /** Taken from the cited unit, verbatim. Never model text. */
    exactQuote: z.string().min(1),
    kind: EvidenceV2OccurrenceKindSchema,
    /** Null until a roster exists. `evidence-v2-observe/1` supplies none. */
    actorReference: z.null(),
    temporalBound: EvidenceV2TemporalBoundSchema.nullable(),
    /**
     * The identity of the act that produced this record, so it replays.
     *
     * For a model-produced occurrence that is the engine execution. For a
     * reviewer-authored one it is the authoring review decision, which carries
     * the principal, the time and the rationale and is equally auditable.
     * `authoredBy` says which namespace the value lives in; the field is never
     * two meanings at once without it.
     */
    executionId: z.string().min(1),
    contractVersion: z.string().min(1),
    windowId: z.string().min(1),
    /**
     * Who produced the record. Optional and defaulting to `model`, so every
     * `evidence-v2-occurrence/1` record written before reviewer authoring
     * existed still parses and still means what it meant.
     */
    authoredBy: z.enum(['model', 'reviewer']).optional(),
  })
  .strict();

export type EvidenceV2Occurrence = z.infer<typeof EvidenceV2OccurrenceSchema>;

/**
 * Content-derived identity.
 *
 * The same unit observed under the same contract version is the same
 * occurrence, so a replay produces an identical id and a resumed extraction
 * cannot duplicate one.
 */
export function deriveEvidenceV2OccurrenceId(input: {
  readonly artifactId: string;
  readonly unitId: string;
  readonly contractVersion: string;
}): string {
  const digest = nodeHashing.sha256(
    [input.artifactId, input.unitId, input.contractVersion].join('\n'),
  );
  return `occurrence-${digest.slice(0, 32)}`;
}
