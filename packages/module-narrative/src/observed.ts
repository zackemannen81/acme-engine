import type {
  NarrativeCorrectionEvidence,
  NarrativeObservedCorrectionEvidence,
  NarrativeObservedScene,
  NarrativeScene,
} from './schemas.js';

/**
 * Narrowing from what the model reported to what state may hold.
 *
 * The output contracts accept `null` for an unknown value, because a provider
 * under strict structured output must emit every property and has no way to
 * omit one. State does not accept it: `acme-cjson-1` distinguishes `null` from
 * an absent key, so allowing both would give one value two canonical forms and
 * two identities.
 *
 * The narrowing lives here rather than in the adapter on purpose. "Explicitly
 * unknown is not worth recording" is a statement about this domain, not about
 * a transport, and applying it here keeps the recorded model call identical to
 * what the model actually produced.
 */
export function omitAbsent<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export function narrowScene(scene: NarrativeObservedScene): NarrativeScene {
  const location = omitAbsent(scene.location);
  const time = omitAbsent(scene.time);
  return {
    ...(location === undefined ? {} : { location }),
    ...(time === undefined ? {} : { time }),
    summary: scene.summary,
  };
}

export function narrowCorrection(
  correction: NarrativeObservedCorrectionEvidence,
): NarrativeCorrectionEvidence {
  const sourceLocator = omitAbsent(correction.sourceLocator);
  return {
    targetIdentityKey: correction.targetIdentityKey,
    supersedesValue: correction.supersedesValue,
    evidenceQuote: correction.evidenceQuote,
    ...(sourceLocator === undefined ? {} : { sourceLocator }),
  };
}
