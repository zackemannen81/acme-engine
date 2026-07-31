import { z } from 'zod';

export const RESEARCH_NAMESPACE = 'research' as const;
export const RESEARCH_STATE_SCHEMA_VERSION = 'research-state/1' as const;
export const RESEARCH_DELTA_SCHEMA_VERSION = 'research-delta/1' as const;
export const RESEARCH_EVIDENCE_KIND = 'research.evidence' as const;
export const RESEARCH_EVIDENCE_SCHEMA_VERSION = 'research-evidence/1' as const;
export const RESEARCH_MEMORY_SCHEMA_VERSION = 'research-memory/1' as const;
export const RESEARCH_CONTRACT_INPUT_VERSION =
  'research-observe-input/1' as const;

/**
 * Fixed configuration facts. They are supplied to the model as immutable
 * context and are never read back from model output.
 */
export const RESEARCH_IDENTITY_POLICY_VERSION =
  'research-identity-policy/1' as const;
export const RESEARCH_VERIFICATION_THRESHOLD = 2 as const;

const nonBlankString = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: 'Expected a non-blank string.',
  });
const confidence = z.number().finite().min(0).max(1);

const isoTimestamp = nonBlankString.refine(
  (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value)),
  { message: 'Expected a canonical UTC ISO-8601 timestamp.' },
);

/**
 * Absolute credential-free HTTP(S) URI. The module records it as evidence and
 * never dereferences it.
 */
const sourceUri = nonBlankString.refine((value) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    parsed.username === '' &&
    parsed.password === ''
  );
}, 'Expected an absolute http(s) URI without credentials.');

export const ResearchIndependenceBasisSchema = z.enum([
  'publisher',
  'editorial-group',
  'origin',
  'fixture',
]);

export const ResearchIndependenceAssertionSchema = z
  .object({
    authority: nonBlankString,
    basis: ResearchIndependenceBasisSchema,
  })
  .strict();

export const ResearchSourceInputSchema = z
  .object({
    uri: sourceUri,
    title: nonBlankString.optional(),
    retrievedAt: isoTimestamp,
    publisher: nonBlankString.optional(),
    independence: ResearchIndependenceAssertionSchema,
  })
  .strict();

export const ResearchEvidenceInputSchema = z
  .object({
    documentKey: nonBlankString,
    source: ResearchSourceInputSchema,
    text: nonBlankString,
  })
  .strict();

export const ResearchEvidenceDocumentSchema = z
  .object({
    documentKey: nonBlankString,
    source: ResearchSourceInputSchema,
    text: nonBlankString,
  })
  .strict();

export const ResearchClaimPositionSchema = z.enum(['supports', 'contradicts']);

/**
 * A claim as the model reports it.
 *
 * `evidenceQuote` and `sourceLocator` are nullish rather than optional: under
 * strict structured output every property must be present, so an unknown value
 * arrives as `null`. Accepting that here keeps the recorded model call
 * identical to what the model produced. This schema is reachable only from
 * `ResearchContractOutputSchema`; the persisted shape is
 * `ResearchClaimEvidenceSchema`, which keeps `.optional()` so `null` never
 * reaches state and memory identity does not move.
 */
export const ResearchContractClaimSchema = z
  .object({
    proposition: nonBlankString,
    statement: nonBlankString,
    position: ResearchClaimPositionSchema,
    evidenceQuote: nonBlankString.nullish(),
    sourceLocator: nonBlankString.nullish(),
    confidence,
  })
  .strict();

export const ResearchContractOutputSchema = z
  .object({
    claims: z.array(ResearchContractClaimSchema),
    openQuestions: z.array(nonBlankString),
  })
  .strict();

export const ResearchContractClaimSummarySchema = z
  .object({
    identityKey: nonBlankString,
    proposition: nonBlankString,
    status: z.enum(['verified', 'contested', 'deferred']),
    independentSourceCount: z.number().int().min(0),
    statements: z.array(nonBlankString),
  })
  .strict();

export const ResearchContractInputSchema = z
  .object({
    contractInputVersion: z.literal(RESEARCH_CONTRACT_INPUT_VERSION),
    stateSchemaVersion: z.literal(RESEARCH_STATE_SCHEMA_VERSION),
    identityPolicyVersion: z.literal(RESEARCH_IDENTITY_POLICY_VERSION),
    verificationThreshold: z.literal(RESEARCH_VERIFICATION_THRESHOLD),
    document: ResearchEvidenceDocumentSchema,
    sourceKey: nonBlankString,
    independenceKey: nonBlankString,
    relevantClaims: z.array(ResearchContractClaimSummarySchema),
    openQuestions: z.array(nonBlankString),
  })
  .strict();

export const ResearchClaimEvidenceSchema = z
  .object({
    sourceKey: nonBlankString,
    independenceKey: nonBlankString,
    documentKey: nonBlankString,
    uri: sourceUri,
    retrievedAt: isoTimestamp,
    publisher: nonBlankString.optional(),
    sourceLocator: nonBlankString.optional(),
    evidenceQuote: nonBlankString.optional(),
  })
  .strict();

export const ResearchClaimMemoryValueSchema = z
  .object({
    kind: z.literal('research.claim'),
    propositionKey: nonBlankString,
    proposition: nonBlankString,
    normalizedProposition: nonBlankString,
    statement: nonBlankString,
    position: ResearchClaimPositionSchema,
    evidence: z.array(ResearchClaimEvidenceSchema).min(1),
  })
  .strict();

export const ResearchSourceMemoryValueSchema = z
  .object({
    kind: z.literal('research.source'),
    sourceKey: nonBlankString,
    independenceKey: nonBlankString,
    normalizedUri: sourceUri,
    uri: sourceUri,
    retrievedAt: isoTimestamp,
    publisher: nonBlankString.optional(),
    documentKeys: z.array(nonBlankString).min(1),
    independence: ResearchIndependenceAssertionSchema,
  })
  .strict();

export const ResearchQuestionMemoryValueSchema = z
  .object({
    kind: z.literal('research.question'),
    questionKey: nonBlankString,
    normalizedQuestion: nonBlankString,
    question: nonBlankString,
    documentKeys: z.array(nonBlankString).min(1),
  })
  .strict();

export const ResearchMemoryValueSchema = z.discriminatedUnion('kind', [
  ResearchClaimMemoryValueSchema,
  ResearchSourceMemoryValueSchema,
  ResearchQuestionMemoryValueSchema,
]);

export const ResearchVerifiedClaimSchema = z
  .object({
    identityKey: nonBlankString,
    statement: nonBlankString,
    independentSourceCount: z.number().int().min(1),
    memoryIds: z.array(nonBlankString).min(1),
  })
  .strict();

export const ResearchContestedClaimSchema = z
  .object({
    identityKey: nonBlankString,
    variants: z.array(nonBlankString).min(2),
    memoryIds: z.array(nonBlankString).min(1),
  })
  .strict();

export const ResearchStateSchema = z
  .object({
    identityPolicyVersion: z.literal(RESEARCH_IDENTITY_POLICY_VERSION),
    verificationThreshold: z.literal(RESEARCH_VERIFICATION_THRESHOLD),
    verifiedClaims: z.array(ResearchVerifiedClaimSchema),
    contestedClaims: z.array(ResearchContestedClaimSchema),
    openQuestions: z.array(nonBlankString),
  })
  .strict();

export const ResearchClaimDecisionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('verify'),
      identityKey: nonBlankString,
      statement: nonBlankString,
      independentSourceCount: z.number().int().min(1),
      memoryIds: z.array(nonBlankString).min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal('contest'),
      identityKey: nonBlankString,
      variants: z.array(nonBlankString).min(2),
      memoryIds: z.array(nonBlankString).min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal('defer'),
      identityKey: nonBlankString,
    })
    .strict(),
]);

export const ResearchDeltaSchema = z
  .object({
    claimDecisions: z.array(ResearchClaimDecisionSchema),
    questions: z.array(nonBlankString),
  })
  .strict();

export type ResearchIndependenceBasis = z.infer<
  typeof ResearchIndependenceBasisSchema
>;
export type ResearchIndependenceAssertion = z.infer<
  typeof ResearchIndependenceAssertionSchema
>;
export type ResearchSourceInput = z.infer<typeof ResearchSourceInputSchema>;
export type ResearchEvidenceInput = z.infer<typeof ResearchEvidenceInputSchema>;
export type ResearchEvidenceDocument = z.infer<
  typeof ResearchEvidenceDocumentSchema
>;
export type ResearchClaimPosition = z.infer<typeof ResearchClaimPositionSchema>;
export type ResearchContractClaim = z.infer<typeof ResearchContractClaimSchema>;
export type ResearchContractOutput = z.infer<
  typeof ResearchContractOutputSchema
>;
export type ResearchContractClaimSummary = z.infer<
  typeof ResearchContractClaimSummarySchema
>;
export type ResearchContractInput = z.infer<typeof ResearchContractInputSchema>;
export type ResearchClaimEvidence = z.infer<typeof ResearchClaimEvidenceSchema>;
export type ResearchClaimMemoryValue = z.infer<
  typeof ResearchClaimMemoryValueSchema
>;
export type ResearchSourceMemoryValue = z.infer<
  typeof ResearchSourceMemoryValueSchema
>;
export type ResearchQuestionMemoryValue = z.infer<
  typeof ResearchQuestionMemoryValueSchema
>;
export type ResearchMemoryValue = z.infer<typeof ResearchMemoryValueSchema>;
export type ResearchVerifiedClaim = z.infer<typeof ResearchVerifiedClaimSchema>;
export type ResearchContestedClaim = z.infer<
  typeof ResearchContestedClaimSchema
>;
export type ResearchState = z.infer<typeof ResearchStateSchema>;
export type ResearchClaimDecision = z.infer<typeof ResearchClaimDecisionSchema>;
export type ResearchDelta = z.infer<typeof ResearchDeltaSchema>;
