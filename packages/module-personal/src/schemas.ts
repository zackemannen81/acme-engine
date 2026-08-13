import { z } from 'zod';

/**
 * Personal memory: one policy combining what two earlier experiments each got
 * right separately.
 *
 * From the slot experiment: identity by normalized subject and attribute, and
 * a revocation that names a slot without naming its contents.
 *
 * From the autonomy experiment: who is speaking. A model claim has to be
 * corroborated by independent evidence before it is believed; a person's own
 * word is its own evidence and seals the slot against models afterwards.
 *
 * The join between them is deliberate: standing is NOT decided when a claim is
 * written. Every distinct answer is its own record, and what is believed right
 * now is computed when the memory is read. That is what lets two answers
 * coexist, which the engine's write-time `contest` cannot express.
 */

export const PERSONAL_NAMESPACE = 'personal' as const;
export const PERSONAL_MEMORY_SCHEMA_VERSION = 'personal-memory/2' as const;
export const PERSONAL_IDENTITY_POLICY_VERSION = 'personal-identity/2' as const;

export const PERSONAL_CLAIM_KIND = 'personal.claim' as const;
export const PERSONAL_REVOCATION_KIND = 'personal.revocation' as const;

const nonBlank = z.string().min(1).max(400);
const isoTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u);

/**
 * Who is speaking. `human` is not a better model; it is a different source of
 * authority, and the only one that may overrule another `human` write.
 */
export const PersonalAuthoritySchema = z.enum(['model', 'human']);
export type PersonalAuthority = z.infer<typeof PersonalAuthoritySchema>;

export const PersonalClaimKindSchema = z.enum([
  'personal.preference',
  'personal.fact',
  'personal.relationship',
  'personal.project',
]);
export type PersonalClaimKind = z.infer<typeof PersonalClaimKindSchema>;

export const PersonalClaimValueSchema = z
  .object({
    kind: z.literal(PERSONAL_CLAIM_KIND),
    claimKind: PersonalClaimKindSchema,
    slotKey: nonBlank,
    assertionKey: nonBlank,
    subject: nonBlank,
    normalizedSubject: nonBlank,
    attribute: nonBlank,
    normalizedAttribute: nonBlank,
    value: nonBlank,
    normalizedValue: nonBlank,
    statedAt: isoTimestamp,
    authority: PersonalAuthoritySchema,
    /**
     * Distinct sources that have said this same thing. Two candidates carrying
     * the same evidence key never corroborate each other, so a model cannot
     * promote its own claim by repeating itself.
     */
    evidenceKeys: z.array(nonBlank).min(1),
  })
  .strict();
export type PersonalClaimValue = z.infer<typeof PersonalClaimValueSchema>;

/**
 * A revocation carries no subject, attribute, value or wording. The slot key is
 * an opaque digest, so the record proving someone asked to forget something
 * cannot itself reintroduce what they wanted forgotten.
 */
export const PersonalRevocationValueSchema = z
  .object({
    kind: z.literal(PERSONAL_REVOCATION_KIND),
    slotKey: nonBlank,
    revokedAt: isoTimestamp,
    authority: PersonalAuthoritySchema,
  })
  .strict();
export type PersonalRevocationValue = z.infer<
  typeof PersonalRevocationValueSchema
>;

export const PersonalMemoryValueSchema = z.union([
  PersonalClaimValueSchema,
  PersonalRevocationValueSchema,
]);
export type PersonalMemoryValue = z.infer<typeof PersonalMemoryValueSchema>;
