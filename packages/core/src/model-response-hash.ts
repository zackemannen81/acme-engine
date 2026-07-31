import type { Hashing, JsonValue } from './common.js';
import { nodeHashing } from './hashing.js';
import type { NormalizedModelResponse } from './model.js';
import { validateNormalizedModelResponse } from './model-validation.js';

export const ACME_MODEL_RESPONSE_HASH_ALGORITHM =
  'acme-model-response-hash-1' as const;

export function computeModelResponseHash(
  response: NormalizedModelResponse,
  hashing: Hashing = nodeHashing,
): string {
  const validated = validateNormalizedModelResponse(response);
  return hashing.sha256(
    hashing.canonicalJson({
      algorithm: ACME_MODEL_RESPONSE_HASH_ALGORITHM,
      response: validated,
    } as unknown as JsonValue),
  );
}
