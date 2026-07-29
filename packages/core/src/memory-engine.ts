import { z } from 'zod';

import type { Hashing, IdGenerator, JsonValue, Schema } from './common.js';
import { AcmeError, type AcmeErrorCode } from './errors.js';
import { nodeHashing } from './hashing.js';
import type {
  DomainMemoryPolicy,
  MemoryCandidate,
  MemoryLifecycleContext,
  MemoryLifecycleDecision,
  MemoryLifecycleHook,
  MemoryMutation,
  MemoryPrepareContext,
  MemoryQuery,
  MemoryRecord,
  MemoryResolution,
  PreparedMemory,
  PreparedMemoryDecision,
  PreparedMemoryLifecycle,
  PreparedMemoryLifecycleDecision,
  RankedMemory,
  ProvenanceRef,
} from './memory.js';
import type { DomainIssue } from './state.js';

export interface MemoryEngineOptions {
  readonly ids: IdGenerator;
  readonly hashing?: Hashing;
}

export interface MemoryEngine {
  prepare(
    policy: DomainMemoryPolicy,
    candidates: readonly MemoryCandidate[],
    existing: readonly MemoryRecord[],
    context: MemoryPrepareContext,
  ): PreparedMemory;
  retrieve(
    policy: DomainMemoryPolicy,
    query: MemoryQuery,
    records: readonly MemoryRecord[],
  ): readonly RankedMemory[];
  applyLifecycle(
    policy: DomainMemoryPolicy,
    records: readonly MemoryRecord[],
    hook: MemoryLifecycleHook,
    context: MemoryLifecycleContext,
  ): PreparedMemoryLifecycle;
}

interface ValidatedJson<T> {
  readonly canonical: string;
  readonly value: T;
}

const jsonSchema = z.json();
const nonEmptyStringSchema = z.string().min(1);
const strengthSchema = z.number().finite().nonnegative();

const provenanceSchema = z
  .object({
    executionId: nonEmptyStringSchema,
    contract: z
      .object({
        id: nonEmptyStringSchema,
        version: nonEmptyStringSchema,
      })
      .strict(),
    modelCallId: nonEmptyStringSchema.optional(),
    documentKeys: z.array(nonEmptyStringSchema),
  })
  .strict() as unknown as Schema<ProvenanceRef>;

const candidateSchema = z
  .object({
    key: nonEmptyStringSchema,
    kind: nonEmptyStringSchema,
    schemaVersion: nonEmptyStringSchema,
    value: jsonSchema,
    confidence: z.number().finite().min(0).max(1).optional(),
    source: provenanceSchema,
  })
  .strict() as unknown as Schema<MemoryCandidate>;

const recordSchema: Schema<MemoryRecord> = z
  .object({
    memoryId: nonEmptyStringSchema,
    namespace: nonEmptyStringSchema,
    entityId: nonEmptyStringSchema,
    identityKey: nonEmptyStringSchema,
    kind: nonEmptyStringSchema,
    schemaVersion: nonEmptyStringSchema,
    value: jsonSchema,
    strength: strengthSchema,
    status: z.enum(['active', 'superseded', 'contested', 'forgotten']),
    firstSeenAt: nonEmptyStringSchema,
    lastSeenAt: nonEmptyStringSchema,
    lastReinforcedAt: nonEmptyStringSchema,
    provenance: z.array(provenanceSchema),
    recordVersion: z.number().int().positive(),
  })
  .strict();

const resolutionSchema: Schema<MemoryResolution> = z.union([
  z
    .object({
      candidateKey: nonEmptyStringSchema,
      action: z.literal('create'),
      value: jsonSchema,
      strength: strengthSchema,
    })
    .strict(),
  z
    .object({
      candidateKey: nonEmptyStringSchema,
      action: z.literal('reinforce'),
      memoryId: nonEmptyStringSchema,
      strength: strengthSchema,
    })
    .strict(),
  z
    .object({
      candidateKey: nonEmptyStringSchema,
      action: z.literal('merge'),
      memoryId: nonEmptyStringSchema,
      value: jsonSchema,
      strength: strengthSchema,
    })
    .strict(),
  z
    .object({
      candidateKey: nonEmptyStringSchema,
      action: z.literal('contradict'),
      memoryIds: z.array(nonEmptyStringSchema).min(1),
      disposition: z.enum(['contest', 'reject-candidate']),
    })
    .strict(),
  z
    .object({
      candidateKey: nonEmptyStringSchema,
      action: z.literal('contradict'),
      memoryIds: z.array(nonEmptyStringSchema).min(1),
      disposition: z.literal('supersede-existing'),
      replacement: z
        .object({
          value: jsonSchema,
          strength: strengthSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      candidateKey: nonEmptyStringSchema,
      action: z.literal('ignore'),
      reason: nonEmptyStringSchema,
    })
    .strict(),
]);

const lifecycleDecisionSchema: Schema<MemoryLifecycleDecision> = z.union([
  z.object({ action: z.literal('retain') }).strict(),
  z
    .object({
      action: z.literal('update-strength'),
      strength: strengthSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('forget'),
      reason: nonEmptyStringSchema,
    })
    .strict(),
]);

const prepareContextSchema: Schema<MemoryPrepareContext> = z
  .object({
    namespace: nonEmptyStringSchema,
    entityId: nonEmptyStringSchema,
    executionId: nonEmptyStringSchema,
    now: nonEmptyStringSchema,
  })
  .strict();

const lifecycleContextSchema: Schema<MemoryLifecycleContext> = z
  .object({
    namespace: nonEmptyStringSchema,
    entityId: nonEmptyStringSchema,
    now: nonEmptyStringSchema,
  })
  .strict();

const querySchema = z
  .object({
    namespace: nonEmptyStringSchema,
    entityId: nonEmptyStringSchema,
    task: nonEmptyStringSchema,
    kinds: z.array(nonEmptyStringSchema).optional(),
    text: z.string().optional(),
    limit: z.number().int().positive(),
  })
  .strict() as unknown as Schema<MemoryQuery>;

const rankedMemorySchema: Schema<RankedMemory> = z
  .object({
    record: recordSchema,
    score: z.number().finite(),
    reasons: z.array(z.string()),
  })
  .strict();

const domainIssueSchema: Schema<DomainIssue> = z
  .object({
    code: nonEmptyStringSchema,
    path: z.array(z.union([z.string(), z.number()])),
    message: nonEmptyStringSchema,
  })
  .strict();

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

  let cloned: JsonValue;
  try {
    cloned = JSON.parse(outputCanonical) as JsonValue;
  } catch (error: unknown) {
    throw invalid(
      errorCode,
      `Could not clone ${phase} as JSON.`,
      { phase },
      error,
    );
  }

  return {
    canonical: outputCanonical,
    value: deepFreeze(cloned) as T,
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareRecords(left: MemoryRecord, right: MemoryRecord): number {
  return (
    compareText(left.identityKey, right.identityKey) ||
    compareText(left.memoryId, right.memoryId)
  );
}

function uniqueStrings(
  values: readonly string[],
  code: AcmeErrorCode,
  phase: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw invalid(code, `${phase} must not contain duplicates.`, {
        phase,
        duplicate: value,
      });
    }
    seen.add(value);
  }
}

function validateCandidates(
  candidates: readonly MemoryCandidate[],
  context: MemoryPrepareContext,
  hashing: Hashing,
): readonly MemoryCandidate[] {
  if (!Array.isArray(candidates)) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      'Memory candidates must be an array.',
      { phase: 'memory candidates' },
    );
  }

  const validated = candidates.map((candidate, index) => {
    const value = validateJson(
      candidateSchema,
      candidate,
      hashing,
      'DOMAIN_INVALID_RESULT',
      `memory candidate ${index}`,
    ).value;

    if (value.source.executionId !== context.executionId) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Memory candidate provenance must match the execution.',
        {
          candidateKey: value.key,
          executionId: context.executionId,
          sourceExecutionId: value.source.executionId,
        },
      );
    }
    uniqueStrings(
      value.source.documentKeys,
      'DOMAIN_INVALID_RESULT',
      `memory candidate ${value.key} document keys`,
    );
    return value;
  });

  uniqueStrings(
    validated.map(({ key }) => key),
    'DOMAIN_INVALID_RESULT',
    'memory candidate keys',
  );

  return Object.freeze(
    [...validated].sort((left, right) => compareText(left.key, right.key)),
  );
}

function validateRecords(
  records: readonly MemoryRecord[],
  namespace: string,
  entityId: string,
  hashing: Hashing,
): readonly MemoryRecord[] {
  if (!Array.isArray(records)) {
    throw invalid(
      'PERSISTENCE_CORRUPTION',
      'Loaded memory records must be an array.',
      { phase: 'loaded memory records' },
    );
  }

  const validated = records.map((record, index) => {
    const value = validateJson(
      recordSchema,
      record,
      hashing,
      'PERSISTENCE_CORRUPTION',
      `loaded memory record ${index}`,
    ).value;

    if (value.namespace !== namespace || value.entityId !== entityId) {
      throw invalid(
        'PERSISTENCE_CORRUPTION',
        'Loaded memory record does not match the requested scope.',
        {
          memoryId: value.memoryId,
          recordNamespace: value.namespace,
          recordEntityId: value.entityId,
          namespace,
          entityId,
        },
      );
    }
    for (const [provenanceIndex, provenance] of value.provenance.entries()) {
      uniqueStrings(
        provenance.documentKeys,
        'PERSISTENCE_CORRUPTION',
        `memory record ${value.memoryId} provenance ${provenanceIndex} document keys`,
      );
    }
    return value;
  });

  uniqueStrings(
    validated.map(({ memoryId }) => memoryId),
    'PERSISTENCE_CORRUPTION',
    'loaded memory IDs',
  );
  uniqueStrings(
    validated.map(({ identityKey }) => identityKey),
    'PERSISTENCE_CORRUPTION',
    'loaded memory identity keys',
  );

  return Object.freeze([...validated].sort(compareRecords));
}

function validatePolicyIssues(
  rawIssues: readonly DomainIssue[],
  hashing: Hashing,
  candidateKey: string,
): void {
  const issues = validateJson(
    z.array(domainIssueSchema),
    rawIssues,
    hashing,
    'DOMAIN_INVALID_RESULT',
    `memory candidate ${candidateKey} policy issues`,
  ).value;

  if (issues.length > 0) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      'Domain memory policy rejected a candidate.',
      {
        candidateKey,
        issues: issues as unknown as JsonValue,
      },
    );
  }
}

function policyIdentity(
  policy: DomainMemoryPolicy,
  candidate: MemoryCandidate,
): string {
  let identityKey: string;
  try {
    identityKey = policy.identity(candidate);
  } catch (error: unknown) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      'Domain memory identity policy failed.',
      { candidateKey: candidate.key },
      error,
    );
  }

  if (typeof identityKey !== 'string' || identityKey.length === 0) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      'Domain memory identity must be a non-empty string.',
      { candidateKey: candidate.key },
    );
  }
  return identityKey;
}

function appendProvenance(
  existing: readonly ProvenanceRef[],
  source: ProvenanceRef,
  hashing: Hashing,
): readonly ProvenanceRef[] {
  const sourceCanonical = hashing.canonicalJson(source as unknown as JsonValue);
  if (
    existing.some(
      (item) =>
        hashing.canonicalJson(item as unknown as JsonValue) === sourceCanonical,
    )
  ) {
    return existing;
  }
  return Object.freeze([...existing, source]);
}

function prepareUpdate(
  current: MemoryRecord,
  changes: Partial<MemoryRecord>,
): {
  readonly record: MemoryRecord;
  readonly mutation: MemoryMutation;
} {
  const record = Object.freeze({
    ...current,
    ...changes,
    recordVersion: current.recordVersion + 1,
  });
  return {
    record,
    mutation: Object.freeze({
      action: 'update',
      expectedRecordVersion: current.recordVersion,
      record,
    }),
  };
}

function workingRecords(
  records: ReadonlyMap<string, MemoryRecord>,
): readonly MemoryRecord[] {
  return Object.freeze([...records.values()].sort(compareRecords));
}

function requireTarget(
  records: ReadonlyMap<string, MemoryRecord>,
  memoryId: string,
  candidateKey: string,
): MemoryRecord {
  const target = records.get(memoryId);
  if (target === undefined) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      'Memory resolution references an unknown record.',
      { candidateKey, memoryId },
    );
  }
  return target;
}

function allocateMemoryId(
  ids: IdGenerator,
  records: ReadonlyMap<string, MemoryRecord>,
  candidateKey: string,
): string {
  let memoryId: string;
  try {
    memoryId = ids.next('memory');
  } catch (error: unknown) {
    throw invalid(
      'INTERNAL',
      'Memory ID allocation failed.',
      { candidateKey },
      error,
    );
  }
  if (
    typeof memoryId !== 'string' ||
    memoryId.length === 0 ||
    records.has(memoryId)
  ) {
    throw invalid('INTERNAL', 'Memory ID allocation returned an invalid ID.', {
      candidateKey,
      memoryId,
    });
  }
  return memoryId;
}

function newRecord(
  memoryId: string,
  identityKey: string,
  candidate: MemoryCandidate,
  value: JsonValue,
  strength: number,
  context: MemoryPrepareContext,
): MemoryRecord {
  return Object.freeze({
    memoryId,
    namespace: context.namespace,
    entityId: context.entityId,
    identityKey,
    kind: candidate.kind,
    schemaVersion: candidate.schemaVersion,
    value,
    strength,
    status: 'active',
    firstSeenAt: context.now,
    lastSeenAt: context.now,
    lastReinforcedAt: context.now,
    provenance: Object.freeze([candidate.source]),
    recordVersion: 1,
  });
}

function createMutation(record: MemoryRecord): MemoryMutation {
  return Object.freeze({ action: 'create', record });
}

function decision(
  candidateKey: string,
  identityKey: string,
  resolution: MemoryResolution,
  affectedMemoryIds: readonly string[],
): PreparedMemoryDecision {
  return Object.freeze({
    candidateKey,
    identityKey,
    resolution,
    affectedMemoryIds: Object.freeze([...affectedMemoryIds]),
  });
}

class PureMemoryEngine implements MemoryEngine {
  readonly #ids: IdGenerator;
  readonly #hashing: Hashing;

  constructor(options: MemoryEngineOptions) {
    this.#ids = options.ids;
    this.#hashing = options.hashing ?? nodeHashing;
  }

  prepare(
    policy: DomainMemoryPolicy,
    candidates: readonly MemoryCandidate[],
    existing: readonly MemoryRecord[],
    rawContext: MemoryPrepareContext,
  ): PreparedMemory {
    const context = validateJson(
      prepareContextSchema,
      rawContext,
      this.#hashing,
      'INVALID_REQUEST',
      'memory prepare context',
    ).value;
    const orderedCandidates = validateCandidates(
      candidates,
      context,
      this.#hashing,
    );
    const orderedRecords = validateRecords(
      existing,
      context.namespace,
      context.entityId,
      this.#hashing,
    );

    const records = new Map(
      orderedRecords.map((record) => [record.memoryId, record]),
    );
    const identities = new Map(
      orderedRecords.map((record) => [record.identityKey, record.memoryId]),
    );
    const decisions: PreparedMemoryDecision[] = [];
    const mutations: MemoryMutation[] = [];

    for (const candidate of orderedCandidates) {
      let rawIssues: readonly DomainIssue[];
      try {
        rawIssues = policy.validate(candidate);
      } catch (error: unknown) {
        throw invalid(
          'DOMAIN_INVALID_RESULT',
          'Domain memory validation policy failed.',
          { candidateKey: candidate.key },
          error,
        );
      }
      validatePolicyIssues(rawIssues, this.#hashing, candidate.key);

      const identityKey = policyIdentity(policy, candidate);
      let rawResolution: MemoryResolution;
      try {
        rawResolution = policy.resolve(candidate, workingRecords(records), {
          now: context.now,
        });
      } catch (error: unknown) {
        throw invalid(
          'DOMAIN_INVALID_RESULT',
          'Domain memory resolution policy failed.',
          { candidateKey: candidate.key },
          error,
        );
      }
      const resolution = validateJson(
        resolutionSchema,
        rawResolution,
        this.#hashing,
        'DOMAIN_INVALID_RESULT',
        `memory candidate ${candidate.key} resolution`,
      ).value;

      if (resolution.candidateKey !== candidate.key) {
        throw invalid(
          'DOMAIN_INVALID_RESULT',
          'Memory resolution candidate key does not match its candidate.',
          {
            candidateKey: candidate.key,
            resolutionCandidateKey: resolution.candidateKey,
          },
        );
      }

      switch (resolution.action) {
        case 'create': {
          if (identities.has(identityKey)) {
            throw invalid(
              'DOMAIN_INVALID_RESULT',
              'Memory create resolution conflicts with an existing identity.',
              { candidateKey: candidate.key, identityKey },
            );
          }
          const memoryId = allocateMemoryId(this.#ids, records, candidate.key);
          const record = newRecord(
            memoryId,
            identityKey,
            candidate,
            resolution.value,
            resolution.strength,
            context,
          );
          records.set(memoryId, record);
          identities.set(identityKey, memoryId);
          mutations.push(createMutation(record));
          decisions.push(
            decision(candidate.key, identityKey, resolution, [memoryId]),
          );
          break;
        }

        case 'reinforce':
        case 'merge': {
          const current = requireTarget(
            records,
            resolution.memoryId,
            candidate.key,
          );
          const prepared = prepareUpdate(current, {
            value:
              resolution.action === 'merge' ? resolution.value : current.value,
            strength: resolution.strength,
            lastSeenAt: context.now,
            lastReinforcedAt: context.now,
            provenance: appendProvenance(
              current.provenance,
              candidate.source,
              this.#hashing,
            ),
          });
          records.set(current.memoryId, prepared.record);
          mutations.push(prepared.mutation);
          decisions.push(
            decision(candidate.key, identityKey, resolution, [
              current.memoryId,
            ]),
          );
          break;
        }

        case 'contradict': {
          uniqueStrings(
            resolution.memoryIds,
            'DOMAIN_INVALID_RESULT',
            `memory candidate ${candidate.key} contradiction targets`,
          );
          const targetIds = [...resolution.memoryIds].sort(compareText);
          const targets = targetIds.map((memoryId) =>
            requireTarget(records, memoryId, candidate.key),
          );

          if (resolution.disposition === 'reject-candidate') {
            decisions.push(
              decision(candidate.key, identityKey, resolution, []),
            );
            break;
          }

          let replacementId: string | null = null;
          if (resolution.disposition === 'supersede-existing') {
            if (identities.has(identityKey)) {
              throw invalid(
                'DOMAIN_INVALID_RESULT',
                'Memory replacement conflicts with an existing identity.',
                { candidateKey: candidate.key, identityKey },
              );
            }
            replacementId = allocateMemoryId(this.#ids, records, candidate.key);
          }

          for (const current of targets) {
            const prepared = prepareUpdate(current, {
              status:
                resolution.disposition === 'contest'
                  ? 'contested'
                  : 'superseded',
              lastSeenAt: context.now,
              provenance: appendProvenance(
                current.provenance,
                candidate.source,
                this.#hashing,
              ),
            });
            records.set(current.memoryId, prepared.record);
            mutations.push(prepared.mutation);
          }

          if (
            resolution.disposition === 'supersede-existing' &&
            replacementId !== null
          ) {
            const replacement = newRecord(
              replacementId,
              identityKey,
              candidate,
              resolution.replacement.value,
              resolution.replacement.strength,
              context,
            );
            records.set(replacementId, replacement);
            identities.set(identityKey, replacementId);
            mutations.push(createMutation(replacement));
          }

          decisions.push(
            decision(
              candidate.key,
              identityKey,
              resolution,
              replacementId === null
                ? targetIds
                : [...targetIds, replacementId],
            ),
          );
          break;
        }

        case 'ignore':
          decisions.push(decision(candidate.key, identityKey, resolution, []));
          break;
      }
    }

    return Object.freeze({
      decisions: Object.freeze(decisions),
      mutations: Object.freeze(mutations),
    });
  }

  retrieve(
    policy: DomainMemoryPolicy,
    rawQuery: MemoryQuery,
    records: readonly MemoryRecord[],
  ): readonly RankedMemory[] {
    const query = validateJson(
      querySchema,
      rawQuery,
      this.#hashing,
      'INVALID_REQUEST',
      'memory query',
    ).value;
    if (query.kinds !== undefined) {
      uniqueStrings(query.kinds, 'INVALID_REQUEST', 'memory query kinds');
    }
    const orderedRecords = validateRecords(
      records,
      query.namespace,
      query.entityId,
      this.#hashing,
    );

    let rawRanked: readonly RankedMemory[];
    try {
      rawRanked = policy.retrieve(query, orderedRecords);
    } catch (error: unknown) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Domain memory retrieval policy failed.',
        { task: query.task },
        error,
      );
    }
    const ranked = validateJson(
      z.array(rankedMemorySchema),
      rawRanked,
      this.#hashing,
      'DOMAIN_INVALID_RESULT',
      'ranked memories',
    ).value;

    uniqueStrings(
      ranked.map(({ record }) => record.memoryId),
      'DOMAIN_INVALID_RESULT',
      'ranked memory IDs',
    );

    const byId = new Map(
      orderedRecords.map((record) => [record.memoryId, record]),
    );
    const normalized = ranked.map((item) => {
      const record = byId.get(item.record.memoryId);
      if (
        record === undefined ||
        this.#hashing.canonicalJson(record as unknown as JsonValue) !==
          this.#hashing.canonicalJson(item.record as unknown as JsonValue)
      ) {
        throw invalid(
          'DOMAIN_INVALID_RESULT',
          'Retrieval policy returned an unknown or modified memory record.',
          { memoryId: item.record.memoryId },
        );
      }
      return Object.freeze({
        record,
        score: item.score,
        reasons: Object.freeze([...item.reasons]),
      });
    });

    normalized.sort(
      (left, right) =>
        right.score - left.score ||
        compareText(left.record.identityKey, right.record.identityKey) ||
        compareText(left.record.memoryId, right.record.memoryId),
    );

    return Object.freeze(normalized.slice(0, query.limit));
  }

  applyLifecycle(
    policy: DomainMemoryPolicy,
    records: readonly MemoryRecord[],
    hook: MemoryLifecycleHook,
    rawContext: MemoryLifecycleContext,
  ): PreparedMemoryLifecycle {
    const context = validateJson(
      lifecycleContextSchema,
      rawContext,
      this.#hashing,
      'INVALID_REQUEST',
      'memory lifecycle context',
    ).value;
    if (
      hook !== 'execution-start' &&
      hook !== 'execution-commit' &&
      hook !== 'maintenance'
    ) {
      throw invalid('INVALID_REQUEST', 'Memory lifecycle hook is invalid.', {
        hook,
      });
    }
    const orderedRecords = validateRecords(
      records,
      context.namespace,
      context.entityId,
      this.#hashing,
    );
    const decisions: PreparedMemoryLifecycleDecision[] = [];
    const mutations: MemoryMutation[] = [];

    for (const current of orderedRecords) {
      let rawDecision: MemoryLifecycleDecision;
      try {
        rawDecision = policy.lifecycle(current, hook, { now: context.now });
      } catch (error: unknown) {
        throw invalid(
          'DOMAIN_INVALID_RESULT',
          'Domain memory lifecycle policy failed.',
          { memoryId: current.memoryId, hook },
          error,
        );
      }
      const lifecycleDecision = validateJson(
        lifecycleDecisionSchema,
        rawDecision,
        this.#hashing,
        'DOMAIN_INVALID_RESULT',
        `memory record ${current.memoryId} lifecycle decision`,
      ).value;

      decisions.push(
        Object.freeze({
          memoryId: current.memoryId,
          decision: lifecycleDecision,
        }),
      );

      if (lifecycleDecision.action === 'retain') {
        continue;
      }

      const prepared = prepareUpdate(
        current,
        lifecycleDecision.action === 'update-strength'
          ? { strength: lifecycleDecision.strength }
          : { status: 'forgotten' },
      );
      mutations.push(prepared.mutation);
    }

    return Object.freeze({
      decisions: Object.freeze(decisions),
      mutations: Object.freeze(mutations),
    });
  }
}

export function createMemoryEngine(options: MemoryEngineOptions): MemoryEngine {
  return new PureMemoryEngine(options);
}
