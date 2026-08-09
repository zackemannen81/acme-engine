import { describe, expect, it } from 'vitest';

import { sha256, type ModelGateway, type ModelSelection } from '@acme/core';

import {
  createQualityEvaluationInput,
  runLiveModelQualityJudge,
  type QualityEvaluationRecord,
  type QualityEvaluationStore,
} from '../src/index.js';
import { QualityEvaluationError } from '../src/errors.js';

const selection: ModelSelection = { profile: 'live-quality' };

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

function input() {
  return createQualityEvaluationInput({
    runId: 'run-live-judge',
    executionResult: {
      status: 'committed',
      executionId: 'execution-live-judge',
      replayed: false,
      revision: 1,
      documentKeys: ['doc'],
      eventIds: [],
    },
    operationDigest: sha256('op-live'),
    artifact: { kind: 'document', id: 'doc', value: { text: 'ok' } },
    contract: {
      id: 'test.observe',
      version: '1.0.0',
      fingerprint: sha256('c'),
    },
  });
}

describe('runLiveModelQualityJudge', () => {
  it('parses a structured model response and stores a live-model record', async () => {
    const store = memoryStore();
    const gateway: ModelGateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        return {
          provider: 'fixture',
          model: 'fixture',
          receivedAt: '2026-08-06T20:00:00.000Z',
          finishReason: 'stop',
          text: JSON.stringify({
            scores: [
              {
                id: 'clarity',
                value: 0.8,
                scale: { min: 0, max: 1 },
                interpretation: 'higher-is-better',
              },
            ],
            findings: [
              {
                code: 'OK',
                severity: 'info',
                message: 'Artifact is coherent.',
              },
            ],
            verdict: 'pass',
          }),
          usage: {},
          metadata: {},
        };
      },
    };

    const record = await runLiveModelQualityJudge({
      store,
      gateway,
      selection,
      input: input(),
      evaluator: { id: 'quality.live-editorial', version: '1.0.0' },
    });

    expect(record.evaluator).toEqual({
      id: 'quality.live-editorial',
      version: '1.0.0',
      kind: 'live-model',
    });
    expect(record.result.verdict).toBe('pass');
    await expect(store.get(record.evaluationId)).resolves.toEqual(record);
  });

  it('refuses empty or non-JSON model responses', async () => {
    const store = memoryStore();
    const empty: ModelGateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        return {
          provider: 'fixture',
          model: 'fixture',
          receivedAt: '2026-08-06T20:00:00.000Z',
          finishReason: 'stop',
          text: '',
          usage: {},
          metadata: {},
        };
      },
    };
    await expect(
      runLiveModelQualityJudge({
        store,
        gateway: empty,
        selection,
        input: input(),
        evaluator: { id: 'quality.live-editorial', version: '1.0.0' },
      }),
    ).rejects.toBeInstanceOf(QualityEvaluationError);

    const badJson: ModelGateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        return {
          provider: 'fixture',
          model: 'fixture',
          receivedAt: '2026-08-06T20:00:00.000Z',
          finishReason: 'stop',
          text: 'not-json',
          usage: {},
          metadata: {},
        };
      },
    };
    await expect(
      runLiveModelQualityJudge({
        store,
        gateway: badJson,
        selection,
        input: input(),
        evaluator: { id: 'quality.live-editorial', version: '1.0.0' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_QUALITY_EVALUATION' });
  });

  it('maps gateway failures to INVALID_QUALITY_EVALUATION', async () => {
    const store = memoryStore();
    const gateway: ModelGateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        throw new Error('transport down');
      },
    };
    await expect(
      runLiveModelQualityJudge({
        store,
        gateway,
        selection,
        input: input(),
        evaluator: { id: 'quality.live-editorial', version: '1.0.0' },
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_QUALITY_EVALUATION',
      message: expect.stringContaining('transport down'),
    });
  });
});
