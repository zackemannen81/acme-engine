export const SEALED_EVALUATION_TRUTH_EXPORT =
  '@acme/evidence-testing/evaluation' as const;

export function assertNoSealedTruthPromptDependency(
  dependencySpecifiers: readonly string[],
): void {
  const forbidden = dependencySpecifiers.filter(
    (specifier) =>
      specifier === SEALED_EVALUATION_TRUTH_EXPORT ||
      specifier.includes('/evaluation/truth.json'),
  );
  if (forbidden.length > 0) {
    throw new TypeError(
      `Prompt-building dependencies cannot import sealed evaluation truth: ${forbidden.join(', ')}`,
    );
  }
}
