import type { Hashing, JsonValue } from './common.js';
import { nodeHashing } from './hashing.js';
import type { ModelRequest } from './model.js';
import { validateModelRequest } from './model-validation.js';

export const ACME_MODEL_REQUEST_HASH_ALGORITHM =
  'acme-model-request-hash-1' as const;

export function computeModelRequestHash(
  request: ModelRequest,
  hashing: Hashing = nodeHashing,
): string {
  const validated = validateModelRequest(request);
  return hashing.sha256(
    hashing.canonicalJson({
      algorithm: ACME_MODEL_REQUEST_HASH_ALGORITHM,
      request: validated,
    } as unknown as JsonValue),
  );
}
