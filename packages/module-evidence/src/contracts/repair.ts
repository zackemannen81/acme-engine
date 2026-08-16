import { immutableEvidence } from '../immutable.js';

import type { ModelRequest, SemanticIssue } from '@acme/core';

/**
 * Build a bounded repair request from the request that produced an invalid
 * response.
 *
 * ADR-0045 §5. The engine decides whether a repair is permitted and budgeted;
 * the contract decides what it says. The repair keeps the original request
 * intact — same schema, same source material, same instructions — and appends
 * the pipeline's own issues so the model corrects exactly what failed rather
 * than answering afresh.
 *
 * Nothing here weakens validation. A repaired response passes the same schema
 * and the same semantic checks as the first, or it fails again.
 */
export function buildEvidenceRepairRequest(input: {
  readonly request: ModelRequest;
  readonly issues: readonly SemanticIssue[];
}): ModelRequest {
  const issues = input.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path,
  }));
  return immutableEvidence({
    ...input.request,
    messages: [
      ...input.request.messages,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'The previous response failed validation. Correct only the ' +
              'listed problems and return the complete JSON for the same ' +
              'schema. Do not add, drop or restate anything else, and do not ' +
              'explain the correction. Every value must still come from the ' +
              'supplied source material.\n' +
              JSON.stringify({ issues }),
          },
        ],
      },
    ],
  });
}
