import type { Hashing, JsonValue, Schema } from './common.js';
import { AcmeError, type AcmeErrorCode } from './errors.js';
import { nodeHashing } from './hashing.js';
import type { DomainModule, StateDelta, TaskMap } from './modules.js';
import type {
  DomainIssue,
  PreparedState,
  StatePrepareContext,
  StateSnapshot,
} from './state.js';

export const ACME_TRANSITION_ID_ALGORITHM = 'acme-transition-id-1' as const;

export interface TransitionIdentityInput {
  readonly executionId: string;
  readonly operationKey: string;
  readonly namespace: string;
  readonly entityId: string;
}

export interface StateEngineOptions {
  readonly hashing?: Hashing;
}

export interface StateEngine {
  prepare<TState, TDelta, TTasks extends TaskMap<TState, TDelta>>(
    module: DomainModule<TState, TDelta, TTasks>,
    current: StateSnapshot<TState> | null,
    expectedRevision: number,
    delta: StateDelta<TDelta> | undefined,
    context: StatePrepareContext,
  ): PreparedState<TState, TDelta> | null;
}

interface ValidatedJson<T> {
  readonly canonical: string;
  readonly value: T;
}

function invalid(
  code: AcmeErrorCode,
  message: string,
  details?: JsonValue,
  cause?: unknown,
): AcmeError {
  const data =
    details === undefined
      ? {
          code,
          message,
          stage: 'preparing-commit' as const,
          retryable: false,
        }
      : {
          code,
          message,
          stage: 'preparing-commit' as const,
          retryable: false,
          details,
        };

  return cause === undefined
    ? new AcmeError(data)
    : new AcmeError(data, { cause });
}

function requireNonEmpty(value: string, field: string): void {
  if (value.length === 0) {
    throw invalid('INVALID_REQUEST', `${field} must be non-empty.`, {
      field,
    });
  }
}

function cloneAndFreeze<T>(
  canonical: string,
  errorCode: AcmeErrorCode,
  phase: string,
): T {
  let clone: JsonValue;
  try {
    clone = JSON.parse(canonical) as JsonValue;
  } catch (error: unknown) {
    throw invalid(
      errorCode,
      `Could not clone ${phase} as JSON.`,
      { phase },
      error,
    );
  }
  return deepFreeze(clone) as T;
}

function deepFreeze(value: JsonValue): JsonValue {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function schemaIssues(
  issues: readonly {
    readonly code: string;
    readonly message: string;
    readonly path: readonly PropertyKey[];
  }[],
): JsonValue {
  return issues.map(({ code, message, path }) => ({
    code,
    message,
    path: path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
  }));
}

function validateJson<T>(
  schema: Schema<T>,
  input: unknown,
  hashing: Hashing,
  errorCode: AcmeErrorCode,
  phase: string,
): ValidatedJson<T> {
  let result: ReturnType<Schema<T>['safeParse']>;
  try {
    result = schema.safeParse(input);
  } catch (error: unknown) {
    throw invalid(
      errorCode,
      `Schema execution failed for ${phase}.`,
      { phase },
      error,
    );
  }

  if (!result.success) {
    throw invalid(errorCode, `Schema validation failed for ${phase}.`, {
      phase,
      issues: schemaIssues(result.error.issues),
    });
  }

  let inputCanonical: string;
  let outputCanonical: string;
  try {
    inputCanonical = hashing.canonicalJson(input as JsonValue);
    outputCanonical = hashing.canonicalJson(result.data as JsonValue);
  } catch (error: unknown) {
    throw invalid(
      errorCode,
      `${phase} must be a JSON value.`,
      { phase },
      error,
    );
  }

  if (inputCanonical !== outputCanonical) {
    throw invalid(errorCode, `Schema must not coerce or transform ${phase}.`, {
      phase,
    });
  }

  return {
    canonical: outputCanonical,
    value: cloneAndFreeze<T>(outputCanonical, errorCode, phase),
  };
}

function safeDomainIssues(issues: readonly unknown[]): JsonValue {
  return issues.map((issue) => ({
    code:
      typeof issue === 'object' &&
      issue !== null &&
      'code' in issue &&
      typeof issue.code === 'string'
        ? issue.code
        : 'INVALID_DOMAIN_ISSUE',
    message:
      typeof issue === 'object' &&
      issue !== null &&
      'message' in issue &&
      typeof issue.message === 'string'
        ? issue.message
        : 'Domain invariant failed.',
    path:
      typeof issue === 'object' &&
      issue !== null &&
      'path' in issue &&
      Array.isArray(issue.path)
        ? issue.path
            .filter(
              (part): part is string | number =>
                typeof part === 'string' || typeof part === 'number',
            )
            .map((part) => part)
        : [],
  }));
}

function actualRevision<TState>(current: StateSnapshot<TState> | null): number {
  if (current === null) {
    return 0;
  }
  if (!Number.isInteger(current.revision) || current.revision < 1) {
    throw invalid(
      'PERSISTENCE_CORRUPTION',
      'Current state revision must be a positive integer.',
      { revision: current.revision },
    );
  }
  return current.revision;
}

export function deriveTransitionId(
  input: TransitionIdentityInput,
  hashing: Hashing = nodeHashing,
): string {
  requireNonEmpty(input.executionId, 'executionId');
  requireNonEmpty(input.operationKey, 'operationKey');
  requireNonEmpty(input.namespace, 'namespace');
  requireNonEmpty(input.entityId, 'entityId');

  const identity: JsonValue = {
    algorithm: ACME_TRANSITION_ID_ALGORITHM,
    executionId: input.executionId,
    operationKey: input.operationKey,
    namespace: input.namespace,
    entityId: input.entityId,
  };

  return `transition_${hashing.sha256(hashing.canonicalJson(identity))}`;
}

class PureStateEngine implements StateEngine {
  readonly #hashing: Hashing;

  constructor(options: StateEngineOptions) {
    this.#hashing = options.hashing ?? nodeHashing;
  }

  prepare<TState, TDelta, TTasks extends TaskMap<TState, TDelta>>(
    module: DomainModule<TState, TDelta, TTasks>,
    current: StateSnapshot<TState> | null,
    expectedRevision: number,
    delta: StateDelta<TDelta> | undefined,
    context: StatePrepareContext,
  ): PreparedState<TState, TDelta> | null {
    requireNonEmpty(context.entityId, 'entityId');
    requireNonEmpty(context.executionId, 'executionId');
    requireNonEmpty(context.operationKey, 'operationKey');
    requireNonEmpty(module.namespace, 'namespace');

    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw invalid(
        'INVALID_REQUEST',
        'Expected revision must be a non-negative integer.',
        { expectedRevision },
      );
    }

    const fromRevision = actualRevision(current);
    if (expectedRevision !== fromRevision) {
      throw invalid(
        'CONFLICT_STATE_REVISION',
        'Expected state revision does not match current revision.',
        {
          expectedRevision,
          currentRevision: fromRevision,
        },
      );
    }

    let previous: ValidatedJson<TState> | null = null;
    if (current !== null) {
      if (
        current.entityId !== context.entityId ||
        current.namespace !== module.namespace
      ) {
        throw invalid(
          'INVALID_REQUEST',
          'Current state does not match the requested state identity.',
          {
            currentEntityId: current.entityId,
            currentNamespace: current.namespace,
            entityId: context.entityId,
            namespace: module.namespace,
          },
        );
      }
      if (current.schemaVersion !== module.stateSchemaVersion) {
        throw invalid(
          'INVALID_REQUEST',
          'Current state schema version is not supported by the module.',
          {
            currentSchemaVersion: current.schemaVersion,
            moduleSchemaVersion: module.stateSchemaVersion,
          },
        );
      }

      previous = validateJson(
        module.stateSchema,
        current.value,
        this.#hashing,
        'PERSISTENCE_CORRUPTION',
        'current state',
      );
      const computedPreviousHash = this.#hashing.sha256(previous.canonical);
      if (computedPreviousHash !== current.valueHash) {
        throw invalid(
          'PERSISTENCE_CORRUPTION',
          'Current state hash does not match its value.',
          {
            recordedHash: current.valueHash,
            computedHash: computedPreviousHash,
          },
        );
      }
    }

    if (delta === undefined) {
      return null;
    }

    if (delta.schemaVersion !== module.deltaSchemaVersion) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'State delta schema version does not match the module.',
        {
          deltaSchemaVersion: delta.schemaVersion,
          moduleDeltaSchemaVersion: module.deltaSchemaVersion,
        },
      );
    }

    let base: ValidatedJson<TState>;
    if (previous === null) {
      let initial: TState;
      try {
        initial = module.initialState({
          entityId: context.entityId,
          now: context.now,
        });
      } catch (error: unknown) {
        throw invalid(
          'DOMAIN_INVALID_RESULT',
          'Domain initial-state policy failed.',
          { phase: 'initial state' },
          error,
        );
      }
      base = validateJson(
        module.stateSchema,
        initial,
        this.#hashing,
        'DOMAIN_INVALID_RESULT',
        'initial state',
      );
    } else {
      base = previous;
    }

    const validatedDelta = validateJson(
      module.deltaSchema,
      delta.value,
      this.#hashing,
      'DOMAIN_INVALID_RESULT',
      'state delta',
    );

    let reduced: TState;
    try {
      reduced = module.reduce(base.value, validatedDelta.value);
    } catch (error: unknown) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Domain state reducer failed.',
        { phase: 'reducer' },
        error,
      );
    }

    const next = validateJson(
      module.stateSchema,
      reduced,
      this.#hashing,
      'DOMAIN_INVALID_RESULT',
      'next state',
    );

    let domainIssues: readonly DomainIssue[];
    try {
      domainIssues = module.invariants(
        next.value,
        previous === null ? null : previous.value,
      );
    } catch (error: unknown) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Domain state invariants failed.',
        { phase: 'invariants' },
        error,
      );
    }
    if (!Array.isArray(domainIssues)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Domain invariants must return an issue array.',
        { phase: 'invariants' },
      );
    }
    if (domainIssues.length > 0) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Domain state invariants rejected the next state.',
        {
          phase: 'invariants',
          issues: safeDomainIssues(domainIssues),
        },
      );
    }

    const nextRevision = fromRevision + 1;
    const nextHash = this.#hashing.sha256(next.canonical);
    const transitionId = deriveTransitionId(
      {
        executionId: context.executionId,
        operationKey: context.operationKey,
        namespace: module.namespace,
        entityId: context.entityId,
      },
      this.#hashing,
    );

    return Object.freeze({
      snapshot: Object.freeze({
        entityId: context.entityId,
        namespace: module.namespace,
        schemaVersion: module.stateSchemaVersion,
        revision: nextRevision,
        value: next.value,
        valueHash: nextHash,
        createdAt: context.now,
        executionId: context.executionId,
      }),
      transition: Object.freeze({
        transitionId,
        operationKey: context.operationKey,
        entityId: context.entityId,
        namespace: module.namespace,
        fromRevision,
        toRevision: nextRevision,
        deltaSchemaVersion: module.deltaSchemaVersion,
        delta: validatedDelta.value,
        previousHash: current?.valueHash ?? null,
        nextHash,
        executionId: context.executionId,
        createdAt: context.now,
      }),
    });
  }
}

export function createStateEngine(
  options: StateEngineOptions = {},
): StateEngine {
  return new PureStateEngine(options);
}
