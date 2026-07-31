/**
 * Narrowing from what the model reported to what state may hold.
 *
 * `ResearchContractClaimSchema` accepts `null` for an unknown value, because a
 * provider under strict structured output must emit every property and has no
 * way to omit one. State does not accept it: `acme-cjson-1` distinguishes
 * `null` from an absent key, so allowing both would give one value two
 * canonical forms and two identities.
 *
 * This matters beyond types. Claim identity folds `sourceLocator` into its
 * preimage, so an unknown locator must reduce to exactly one form regardless
 * of whether the model omitted it or said `null`. Otherwise two claims that
 * make the same assertion would not deduplicate.
 */
export function omitAbsent<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}
