export const EVIDENCE_VIEW_REGISTRY = Object.freeze([
  {
    schemaVersion: 'evidence-primary-work-queue-view/1',
    classification: 'primary-domain',
    defaultPath: '/',
  },
  {
    schemaVersion: 'evidence-primary-source-review-view/1',
    classification: 'primary-domain',
    defaultPath: '/sources/:artifactVersionId',
  },
  {
    schemaVersion: 'evidence-primary-observation-ledger-view/1',
    classification: 'primary-domain',
    defaultPath: '/observations',
  },
  {
    schemaVersion: 'evidence-primary-account-comparison-view/1',
    classification: 'primary-domain',
    defaultPath: '/accounts/compare',
  },
] as const);

export const EVIDENCE_PRIMARY_FORBIDDEN_TOKENS = Object.freeze([
  'acme',
  'engine',
  'execution',
  'modelCall',
  'operationDigest',
  'state',
  'memory',
  'scenario',
  'qualityScore',
  'contractFingerprint',
  'requestFingerprint',
  'replay',
] as const);

function tokens(value: string): readonly string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .toLocaleLowerCase('en-US')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function scanPrimaryViewVocabulary(value: unknown): readonly string[] {
  const matches = new Set<string>();
  const forbiddenSingles = new Set([
    'acme',
    'engine',
    'execution',
    'state',
    'memory',
    'scenario',
    'replay',
  ]);
  const forbiddenPairs = new Set([
    'model call',
    'operation digest',
    'quality score',
    'contract fingerprint',
    'request fingerprint',
  ]);
  function inspect(values: readonly string[], location: string): void {
    values.forEach((token, index) => {
      if (forbiddenSingles.has(token)) matches.add(`${location}:${token}`);
      const next = values[index + 1];
      if (next !== undefined && forbiddenPairs.has(`${token} ${next}`))
        matches.add(`${location}:${token}${next}`);
    });
  }
  function visit(current: unknown, path: readonly string[]): void {
    inspect(tokens(path.join('.')), path.join('.'));
    if (typeof current === 'string') {
      inspect(tokens(current), path.join('.'));
      return;
    }
    if (current === null || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }
    Object.entries(current).forEach(([key, child]) =>
      visit(child, [...path, key]),
    );
  }
  visit(value, []);
  return Object.freeze([...matches].sort());
}
