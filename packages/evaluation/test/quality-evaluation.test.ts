import { canonicalJson, sha256, type JsonValue } from '@acme/core';
import { describe, expect, it } from 'vitest';

import {
  QualityEvaluationHarness,
  QualityEvaluatorRegistry,
  computeQualityArtifactDigest,
  createQualityEvaluationInput,
  createQualityEvaluationRecord,
  createRecordedQualityEvaluation,
  recordedExternalEvaluator,
  validateQualityEvaluationInputIdentity,
  type QualityEvaluationRecord,
  type QualityEvaluationStore,
  type QualityEvaluator,
} from '../src/index.js';

function memoryStore(): QualityEvaluationStore {
  const records = new Map<string, QualityEvaluationRecord>();
  return {
    async put(record) {
      if (records.has(record.evaluationId)) return 'existing';
      records.set(record.evaluationId, record);
      return 'created';
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async list() {
      return [...records.values()];
    },
  };
}

const result = {
  status: 'committed' as const,
  executionId: 'execution-quality-1',
  replayed: false,
  revision: 1,
  documentKeys: ['artifact-1'],
  eventIds: [],
};

function input(artifact: JsonValue = { title: 'A', complete: true }) {
  return createQualityEvaluationInput({
    runId: 'run-quality-1',
    executionResult: result,
    operationDigest: sha256('operation'),
    artifact: {
      kind: 'document',
      id: 'artifact-1',
      value: artifact,
    },
    contract: {
      id: 'example.observe',
      version: '1.0.0',
      fingerprint: sha256('contract'),
    },
  });
}

const passingEvaluator: QualityEvaluator = {
  id: 'quality.required-fields',
  version: '1.0.0',
  kind: 'deterministic',
  evaluate(candidate) {
    const artifact = candidate.artifact as { readonly complete?: unknown };
    return {
      scores: [
        {
          id: 'completeness',
          value: artifact.complete === true ? 1 : 0,
          scale: { min: 0, max: 1 },
          interpretation: 'higher-is-better',
        },
      ],
      findings:
        artifact.complete === true
          ? []
          : [
              {
                code: 'MISSING_COMPLETENESS',
                severity: 'error',
                message: 'The artifact is not complete.',
                path: ['complete'],
              },
            ],
      verdict: artifact.complete === true ? 'pass' : 'fail',
    };
  },
};

describe('post-execution quality evaluation', () => {
  it('derives byte-stable records and keeps caller evidence detached and frozen', async () => {
    const artifact = { title: 'A', complete: true };
    const built = input(artifact);
    const evaluator: QualityEvaluator = {
      ...passingEvaluator,
      evaluate(candidate) {
        expect(Object.isFrozen(candidate)).toBe(true);
        expect(Object.isFrozen(candidate.artifact)).toBe(true);
        expect(() => {
          (candidate.artifact as { complete: boolean }).complete = false;
        }).toThrow();
        return passingEvaluator.evaluate(candidate);
      },
    };
    const store = memoryStore();
    const harness = new QualityEvaluationHarness({
      registry: new QualityEvaluatorRegistry([evaluator]),
      store,
    });

    const first = await harness.run(built, [
      { id: evaluator.id, version: evaluator.version, kind: evaluator.kind },
    ]);
    const second = await harness.run(built, [
      { id: evaluator.id, version: evaluator.version, kind: evaluator.kind },
    ]);

    expect(canonicalJson(first[0] as unknown as JsonValue)).toBe(
      canonicalJson(second[0] as unknown as JsonValue),
    );
    expect(artifact).toStrictEqual({ title: 'A', complete: true });
    expect(first[0]?.result.verdict).toBe('pass');
    expect(first[0]?.subject.artifact).toStrictEqual({
      kind: 'document',
      id: 'artifact-1',
      digest: computeQualityArtifactDigest(artifact),
    });
    expect(first[0]).toMatchObject({
      evaluationId:
        'quality_evaluation_69441eb4cd56853208e97bdebe310240cca627fab158309082d8e1b09f140d30',
      subjectDigest:
        '74bfd5cc2743d2c8f6a5fa496fd2011c57c8f011e9fbed094bcb7f1f27d6fcd3',
      resultDigest:
        '245f518b6e825338fc1041537885c8a6a15d9ad7e0ba9108c1a2caa4f864f31f',
      subject: {
        executionResultDigest:
          '35daab481de04ce1267ea62109a817958d992e4d758c1f806b8e0b7910c5272e',
      },
    });
    expect(first[0]).not.toHaveProperty('artifact');
  });

  it('validates score ranges and keeps harness failure separate from verdict', () => {
    expect(() =>
      createQualityEvaluationRecord({
        input: input(),
        evaluator: {
          id: 'invalid-score',
          version: '1',
          kind: 'deterministic',
        },
        result: {
          scores: [
            {
              id: 'quality',
              value: 2,
              scale: { min: 0, max: 1 },
              interpretation: 'higher-is-better',
            },
          ],
          findings: [],
          verdict: 'fail',
        },
      }),
    ).toThrow(/inside the scale/u);

    const failedInput = input({ complete: false });
    const failed = createQualityEvaluationRecord({
      input: failedInput,
      evaluator: passingEvaluator,
      result: passingEvaluator.evaluate(failedInput),
    });
    expect(failed.result.verdict).toBe('fail');
  });

  it('requires exact evaluator identities and rejects duplicate registration', () => {
    expect(
      () => new QualityEvaluatorRegistry([passingEvaluator, passingEvaluator]),
    ).toThrow(/Duplicate quality evaluator/u);
    const registry = new QualityEvaluatorRegistry([passingEvaluator]);
    expect(() =>
      registry.get({
        id: passingEvaluator.id,
        version: '2.0.0',
        kind: 'deterministic',
      }),
    ).toThrow(/No deterministic quality evaluator/u);
  });

  it('replays a fully bound external recording and refuses subject or digest drift', async () => {
    const subject = input();
    const external: QualityEvaluator = {
      id: 'external.review-board',
      version: '2026-08-05',
      kind: 'recorded-external',
      evaluate() {
        return {
          scores: [],
          findings: [
            {
              code: 'RECORDED_REVIEW',
              severity: 'info',
              message: 'Previously reviewed by the external board.',
            },
          ],
          verdict: 'inconclusive',
        };
      },
    };
    const sourceHarness = new QualityEvaluationHarness({
      registry: new QualityEvaluatorRegistry([]),
      store: memoryStore(),
    });
    const source = (await sourceHarness.runWith(subject, [external]))[0];
    if (source === undefined) throw new Error('record was not produced');
    const recording = createRecordedQualityEvaluation(source);
    const replay = recordedExternalEvaluator(recording);
    const replayed = await new QualityEvaluationHarness({
      registry: new QualityEvaluatorRegistry([]),
      store: memoryStore(),
    }).runWith(subject, [replay]);
    expect(replayed).toStrictEqual([source]);

    await expect(
      new QualityEvaluationHarness({
        registry: new QualityEvaluatorRegistry([]),
        store: memoryStore(),
      }).runWith(input({ title: 'changed' }), [replay]),
    ).rejects.toMatchObject({ code: 'RECORDED_SUBJECT_MISMATCH' });

    expect(() =>
      recordedExternalEvaluator({
        ...recording,
        resultDigest: sha256('wrong'),
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'RECORDED_RESULT_MISMATCH' }),
    );
  });

  it('pins artifact digests and rejects async evaluator work', async () => {
    expect(() =>
      createQualityEvaluationInput({
        runId: 'run',
        executionResult: result,
        artifact: {
          kind: 'document',
          id: 'artifact',
          value: {},
          expectedDigest: sha256('different'),
        },
        contract: {
          id: 'contract',
          version: '1',
          fingerprint: sha256('contract'),
        },
      }),
    ).toThrow(/Artifact digest was/u);

    await expect(
      new QualityEvaluationHarness({
        registry: new QualityEvaluatorRegistry([]),
        store: memoryStore(),
      }).runWith(input(), [
        {
          id: 'async',
          version: '1',
          kind: 'deterministic',
          evaluate: async () => ({
            scores: [],
            findings: [],
            verdict: 'pass',
          }),
        },
      ]),
    ).rejects.toThrow(/must return synchronously/u);
  });

  it('revalidates subject content before any evaluator runs', async () => {
    const built = input();
    const tampered = JSON.parse(JSON.stringify(built)) as typeof built;
    (tampered.artifact as { complete: boolean }).complete = false;
    let calls = 0;
    const evaluator: QualityEvaluator = {
      ...passingEvaluator,
      evaluate(candidate) {
        calls += 1;
        return passingEvaluator.evaluate(candidate);
      },
    };
    expect(() => validateQualityEvaluationInputIdentity(tampered)).toThrow(
      /artifact does not match/u,
    );
    await expect(
      new QualityEvaluationHarness({
        registry: new QualityEvaluatorRegistry([evaluator]),
        store: memoryStore(),
      }).run(tampered, [
        { id: evaluator.id, version: evaluator.version, kind: evaluator.kind },
      ]),
    ).rejects.toThrow(/artifact does not match/u);
    expect(calls).toBe(0);
  });

  it('runs more than one named evaluator over one immutable subject', async () => {
    const second: QualityEvaluator = {
      id: 'quality.second-opinion',
      version: '1.0.0',
      kind: 'deterministic',
      evaluate: () => ({ scores: [], findings: [], verdict: 'inconclusive' }),
    };
    const records = await new QualityEvaluationHarness({
      registry: new QualityEvaluatorRegistry([passingEvaluator, second]),
      store: memoryStore(),
    }).run(input(), [
      {
        id: passingEvaluator.id,
        version: passingEvaluator.version,
        kind: passingEvaluator.kind,
      },
      { id: second.id, version: second.version, kind: second.kind },
    ]);
    expect(records.map((record) => record.result.verdict)).toStrictEqual([
      'pass',
      'inconclusive',
    ]);
  });
});
