import type { Hashing, JsonValue } from './common.js';
import { AcmeError } from './errors.js';
import { nodeHashing } from './hashing.js';
import type {
  AppliedMemoryResolution,
  MemoryCandidate,
  MemoryResolution,
  PreparedMemory,
  PreparedMemoryDecision,
} from './memory.js';
import type {
  ModuleResult,
  StateProjectionInput,
  StateProjectionMemoryDecision,
} from './modules.js';

function invalid(
  message: string,
  details?: JsonValue,
  cause?: unknown,
): AcmeError {
  const data =
    details === undefined
      ? {
          code: 'DOMAIN_INVALID_RESULT' as const,
          message,
          stage: 'preparing-commit' as const,
          retryable: false,
        }
      : {
          code: 'DOMAIN_INVALID_RESULT' as const,
          message,
          stage: 'preparing-commit' as const,
          retryable: false,
          details,
        };

  return cause === undefined
    ? new AcmeError(data)
    : new AcmeError(data, { cause });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function cloneProjection<T>(
  value: StateProjectionInput<T>,
  hashing: Hashing,
): StateProjectionInput<T> {
  let canonical: string;
  try {
    canonical = hashing.canonicalJson(value as unknown as JsonValue);
  } catch (error: unknown) {
    throw invalid(
      'State projection input must contain only canonical JSON values.',
      undefined,
      error,
    );
  }

  try {
    return deepFreeze(JSON.parse(canonical) as StateProjectionInput<T>);
  } catch (error: unknown) {
    throw invalid(
      'State projection input could not be cloned.',
      undefined,
      error,
    );
  }
}

function requireKey(
  value: unknown,
  kind: 'candidate' | 'decision',
  index: number,
): string {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('key' in value || 'candidateKey' in value)
  ) {
    throw invalid(`Memory ${kind} ${index} is malformed.`, { kind, index });
  }

  const key =
    kind === 'candidate'
      ? (value as { readonly key?: unknown }).key
      : (value as { readonly candidateKey?: unknown }).candidateKey;
  if (typeof key !== 'string' || key.length === 0) {
    throw invalid(`Memory ${kind} ${index} key must be non-empty.`, {
      kind,
      index,
    });
  }
  return key;
}

function indexCandidates(
  candidates: readonly MemoryCandidate[],
): ReadonlyMap<string, MemoryCandidate> {
  const indexed = new Map<string, MemoryCandidate>();
  for (const [index, candidate] of candidates.entries()) {
    const key = requireKey(candidate, 'candidate', index);
    if (indexed.has(key)) {
      throw invalid(
        'Memory candidate keys must be unique for state projection.',
        {
          candidateKey: key,
        },
      );
    }
    indexed.set(key, candidate);
  }
  return indexed;
}

function indexDecisions(
  decisions: readonly PreparedMemoryDecision[],
): ReadonlyMap<string, PreparedMemoryDecision> {
  const indexed = new Map<string, PreparedMemoryDecision>();
  for (const [index, decision] of decisions.entries()) {
    const key = requireKey(decision, 'decision', index);
    if (
      decision.resolution === null ||
      typeof decision.resolution !== 'object' ||
      decision.resolution.candidateKey !== key
    ) {
      throw invalid(
        'Prepared memory resolution must match its decision candidate key.',
        { candidateKey: key },
      );
    }
    if (indexed.has(key)) {
      throw invalid('Prepared memory decision keys must be unique.', {
        candidateKey: key,
      });
    }
    indexed.set(key, decision);
  }
  return indexed;
}

function isAppliedResolution(
  resolution: MemoryResolution,
): resolution is AppliedMemoryResolution {
  return !(
    resolution.action === 'ignore' ||
    (resolution.action === 'contradict' &&
      resolution.disposition === 'reject-candidate')
  );
}

function appliedDecision(
  candidate: MemoryCandidate,
  decision: PreparedMemoryDecision,
): StateProjectionMemoryDecision | null {
  if (!isAppliedResolution(decision.resolution)) {
    return null;
  }
  return {
    candidate,
    identityKey: decision.identityKey,
    resolution: decision.resolution,
    affectedMemoryIds: decision.affectedMemoryIds,
  };
}

export function buildStateProjectionInput<TDelta>(
  result: ModuleResult<TDelta>,
  preparedMemory: PreparedMemory,
  hashing: Hashing = nodeHashing,
): StateProjectionInput<TDelta> {
  if (!Array.isArray(result.memories)) {
    throw invalid('Module memory candidates must be an array.');
  }
  if (!Array.isArray(preparedMemory.decisions)) {
    throw invalid('Prepared memory decisions must be an array.');
  }

  const candidates = indexCandidates(result.memories);
  const decisions = indexDecisions(preparedMemory.decisions);

  for (const candidateKey of candidates.keys()) {
    if (!decisions.has(candidateKey)) {
      throw invalid(
        'Every memory candidate must have one prepared decision before state projection.',
        { candidateKey },
      );
    }
  }
  for (const candidateKey of decisions.keys()) {
    if (!candidates.has(candidateKey)) {
      throw invalid(
        'Prepared memory decisions must not reference foreign candidates.',
        { candidateKey },
      );
    }
  }

  const memory: StateProjectionMemoryDecision[] = [];
  for (const decision of preparedMemory.decisions) {
    const candidate = candidates.get(decision.candidateKey);
    if (candidate === undefined) {
      throw invalid(
        'Prepared memory decisions must not reference foreign candidates.',
        { candidateKey: decision.candidateKey },
      );
    }
    const applied = appliedDecision(candidate, decision);
    if (applied !== null) {
      memory.push(applied);
    }
  }

  const input: StateProjectionInput<TDelta> =
    result.stateIntent === undefined
      ? { memory }
      : { stateIntent: result.stateIntent, memory };
  return cloneProjection(input, hashing);
}
