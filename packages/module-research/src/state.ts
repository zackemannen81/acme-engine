import type { DomainIssue } from '@acme/core';

import {
  deriveResearchQuestionKey,
  normalizeReferenceText,
} from './identity.js';
import { immutableJson } from './immutable.js';
import {
  RESEARCH_IDENTITY_POLICY_VERSION,
  RESEARCH_VERIFICATION_THRESHOLD,
  type ResearchContestedClaim,
  type ResearchDelta,
  type ResearchState,
  type ResearchVerifiedClaim,
} from './schemas.js';

function issue(
  code: string,
  path: readonly (string | number)[],
  message: string,
): DomainIssue {
  return immutableJson({ code, path, message });
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function isSortedUnique(values: readonly string[]): boolean {
  return (
    values.length === new Set(values).size &&
    values.every(
      (value, index) => index === 0 || (values[index - 1] as string) < value,
    )
  );
}

function questionKeySafe(question: string): string | null {
  try {
    return deriveResearchQuestionKey(question);
  } catch {
    return null;
  }
}

/**
 * Deduplicates open questions by `research-question-key-1` while keeping the
 * first observed wording, then orders them by normalized text so replay is
 * stable.
 */
function mergeQuestions(
  existing: readonly string[],
  incoming: readonly string[],
): string[] {
  const byKey = new Map<string, string>();
  for (const question of [...existing, ...incoming]) {
    const key = questionKeySafe(question);
    if (key === null) {
      continue;
    }
    if (!byKey.has(key)) {
      byKey.set(key, question);
    }
  }
  return [...byKey.values()].sort((left, right) =>
    normalizeReferenceText(left).localeCompare(normalizeReferenceText(right)),
  );
}

export function initialResearchState(): ResearchState {
  return immutableJson({
    identityPolicyVersion: RESEARCH_IDENTITY_POLICY_VERSION,
    verificationThreshold: RESEARCH_VERIFICATION_THRESHOLD,
    verifiedClaims: [],
    contestedClaims: [],
    openQuestions: [],
  });
}

export function reduceResearchState(
  state: ResearchState,
  delta: ResearchDelta,
): ResearchState {
  const verified = new Map<string, ResearchVerifiedClaim>(
    state.verifiedClaims.map((claim) => [claim.identityKey, claim]),
  );
  const contested = new Map<string, ResearchContestedClaim>(
    state.contestedClaims.map((claim) => [claim.identityKey, claim]),
  );

  for (const decision of delta.claimDecisions) {
    switch (decision.action) {
      case 'verify': {
        // A contested claim is never silently re-verified; contest wins until
        // a later contest decision is absent from the delta.
        if (contested.has(decision.identityKey)) {
          break;
        }
        verified.set(decision.identityKey, {
          identityKey: decision.identityKey,
          statement: decision.statement,
          independentSourceCount: decision.independentSourceCount,
          memoryIds: uniqueSorted(decision.memoryIds),
        });
        break;
      }
      case 'contest': {
        verified.delete(decision.identityKey);
        const previous = contested.get(decision.identityKey);
        contested.set(decision.identityKey, {
          identityKey: decision.identityKey,
          variants: uniqueSorted([
            ...(previous?.variants ?? []),
            ...decision.variants,
          ]),
          memoryIds: uniqueSorted([
            ...(previous?.memoryIds ?? []),
            ...decision.memoryIds,
          ]),
        });
        break;
      }
      case 'defer':
        // A deferred claim keeps its current standing; evidence lives in
        // memory until it reaches the threshold or is contradicted.
        break;
    }
  }

  return immutableJson({
    identityPolicyVersion: RESEARCH_IDENTITY_POLICY_VERSION,
    verificationThreshold: RESEARCH_VERIFICATION_THRESHOLD,
    verifiedClaims: [...verified.values()].sort((left, right) =>
      left.identityKey.localeCompare(right.identityKey),
    ),
    contestedClaims: [...contested.values()].sort((left, right) =>
      left.identityKey.localeCompare(right.identityKey),
    ),
    openQuestions: mergeQuestions(state.openQuestions, delta.questions),
  });
}

export function researchStateInvariants(
  next: ResearchState,
  previous: ResearchState | null,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];

  if (next.identityPolicyVersion !== RESEARCH_IDENTITY_POLICY_VERSION) {
    issues.push(
      issue(
        'RESEARCH_IDENTITY_POLICY_VERSION',
        ['identityPolicyVersion'],
        `Research state must use ${RESEARCH_IDENTITY_POLICY_VERSION}.`,
      ),
    );
  }
  if (next.verificationThreshold !== RESEARCH_VERIFICATION_THRESHOLD) {
    issues.push(
      issue(
        'RESEARCH_VERIFICATION_THRESHOLD',
        ['verificationThreshold'],
        'Research verification threshold is immutable configuration.',
      ),
    );
  }

  const verifiedKeys = next.verifiedClaims.map(
    ({ identityKey }) => identityKey,
  );
  const contestedKeys = next.contestedClaims.map(
    ({ identityKey }) => identityKey,
  );
  if (new Set(verifiedKeys).size !== verifiedKeys.length) {
    issues.push(
      issue(
        'RESEARCH_DUPLICATE_VERIFIED_CLAIM',
        ['verifiedClaims'],
        'Verified claim identities must be unique.',
      ),
    );
  }
  if (new Set(contestedKeys).size !== contestedKeys.length) {
    issues.push(
      issue(
        'RESEARCH_DUPLICATE_CONTESTED_CLAIM',
        ['contestedClaims'],
        'Contested claim identities must be unique.',
      ),
    );
  }
  for (const identityKey of verifiedKeys.filter((key) =>
    contestedKeys.includes(key),
  )) {
    issues.push(
      issue(
        'RESEARCH_DUAL_CLAIM_STATUS',
        ['verifiedClaims', identityKey],
        'A claim cannot be verified and contested at the same time.',
      ),
    );
  }

  next.verifiedClaims.forEach((claim, index) => {
    if (claim.independentSourceCount < RESEARCH_VERIFICATION_THRESHOLD) {
      issues.push(
        issue(
          'RESEARCH_VERIFIED_BELOW_THRESHOLD',
          ['verifiedClaims', index, 'independentSourceCount'],
          `A verified claim requires at least ${RESEARCH_VERIFICATION_THRESHOLD} independent sources.`,
        ),
      );
    }
    if (claim.memoryIds.length === 0) {
      issues.push(
        issue(
          'RESEARCH_VERIFIED_WITHOUT_EVIDENCE',
          ['verifiedClaims', index, 'memoryIds'],
          'A verified claim must reference its memory evidence.',
        ),
      );
    }
    if (!isSortedUnique(claim.memoryIds)) {
      issues.push(
        issue(
          'RESEARCH_UNSTABLE_MEMORY_REFERENCES',
          ['verifiedClaims', index, 'memoryIds'],
          'Memory references must be unique and stably sorted.',
        ),
      );
    }
    if (claim.statement.trim().length === 0) {
      issues.push(
        issue(
          'RESEARCH_EMPTY_STATEMENT',
          ['verifiedClaims', index, 'statement'],
          'A verified claim statement must be non-blank.',
        ),
      );
    }
  });

  next.contestedClaims.forEach((claim, index) => {
    if (claim.variants.length < 2) {
      issues.push(
        issue(
          'RESEARCH_CONTESTED_WITHOUT_VARIANTS',
          ['contestedClaims', index, 'variants'],
          'A contested claim requires at least two distinct variants.',
        ),
      );
    }
    if (claim.variants.some((variant) => variant.trim().length === 0)) {
      issues.push(
        issue(
          'RESEARCH_EMPTY_VARIANT',
          ['contestedClaims', index, 'variants'],
          'Contested claim variants must be non-blank.',
        ),
      );
    }
    if (claim.memoryIds.length === 0) {
      issues.push(
        issue(
          'RESEARCH_CONTESTED_WITHOUT_EVIDENCE',
          ['contestedClaims', index, 'memoryIds'],
          'A contested claim must reference its memory evidence.',
        ),
      );
    }
    if (!isSortedUnique(claim.memoryIds)) {
      issues.push(
        issue(
          'RESEARCH_UNSTABLE_MEMORY_REFERENCES',
          ['contestedClaims', index, 'memoryIds'],
          'Memory references must be unique and stably sorted.',
        ),
      );
    }
  });

  const questionKeys = next.openQuestions.map(questionKeySafe);
  questionKeys.forEach((key, index) => {
    if (key === null) {
      issues.push(
        issue(
          'RESEARCH_EMPTY_QUESTION',
          ['openQuestions', index],
          'Open questions must be non-blank.',
        ),
      );
    }
  });
  const presentKeys = questionKeys.filter((key): key is string => key !== null);
  if (new Set(presentKeys).size !== presentKeys.length) {
    issues.push(
      issue(
        'RESEARCH_DUPLICATE_QUESTION',
        ['openQuestions'],
        'Open questions must be unique by research-question-key-1.',
      ),
    );
  }

  if (previous !== null) {
    for (const claim of previous.verifiedClaims) {
      if (
        !verifiedKeys.includes(claim.identityKey) &&
        !contestedKeys.includes(claim.identityKey)
      ) {
        issues.push(
          issue(
            'RESEARCH_VERIFIED_CLAIM_DROPPED',
            ['verifiedClaims', claim.identityKey],
            'A verified claim may only move to contested, never disappear.',
          ),
        );
      }
    }
    for (const claim of previous.contestedClaims) {
      if (!contestedKeys.includes(claim.identityKey)) {
        issues.push(
          issue(
            'RESEARCH_CONTESTED_CLAIM_DROPPED',
            ['contestedClaims', claim.identityKey],
            'A contested claim cannot be removed by a delta.',
          ),
        );
      }
    }
    for (const question of previous.openQuestions) {
      const key = questionKeySafe(question);
      if (key !== null && !presentKeys.includes(key)) {
        issues.push(
          issue(
            'RESEARCH_QUESTION_DROPPED',
            ['openQuestions'],
            'Open questions cannot be removed by a delta.',
          ),
        );
      }
    }
  }

  return immutableJson(issues);
}
