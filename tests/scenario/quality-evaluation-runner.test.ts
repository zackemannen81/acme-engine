import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createInMemoryExecutionRepository,
  createInMemoryQualityEvaluationStore,
} from '../../packages/adapter-memory/src/index.js';
import {
  canonicalJson,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  type JsonValue,
} from '../../packages/core/src/index.js';
import {
  QualityEvaluationHarness,
  QualityEvaluatorRegistry,
  type QualityEvaluator,
} from '../../packages/evaluation/src/index.js';
import {
  narrativeModule,
  narrativeObserveDocumentContract,
} from '../../packages/module-narrative/src/index.js';
import {
  parseScenario,
  runScenario,
  seededIdGenerator,
  type ScenarioDocument,
  type ScenarioSeed,
} from '../../packages/testing/src/index.js';

const root = dirname(fileURLToPath(import.meta.url));
const scenarioPath = join(root, 'quality-evaluation.json');

const passingEvaluator: QualityEvaluator = {
  id: 'quality.chapter-structure',
  version: '1.0.0',
  kind: 'deterministic',
  evaluate(input) {
    const artifact = input.artifact as {
      readonly title?: unknown;
      readonly text?: unknown;
    };
    const present =
      typeof artifact.title === 'string' &&
      artifact.title.length > 0 &&
      typeof artifact.text === 'string' &&
      artifact.text.length > 0;
    return {
      scores: [
        {
          id: 'required-fields',
          value: present ? 1 : 0,
          scale: { min: 0, max: 1 },
          interpretation: 'higher-is-better',
        },
      ],
      findings: present
        ? []
        : [
            {
              code: 'REQUIRED_FIELDS_MISSING',
              severity: 'error',
              message: 'Title and text are required.',
            },
          ],
      verdict: present ? 'pass' : 'fail',
    };
  },
};

async function document(): Promise<ScenarioDocument> {
  return parseScenario(
    JSON.parse(await readFile(scenarioPath, 'utf8')) as unknown,
  );
}

async function run(
  scenario: ScenarioDocument,
  evaluator: QualityEvaluator = passingEvaluator,
) {
  const qualityStore = createInMemoryQualityEvaluationStore();
  const harness = new QualityEvaluationHarness({
    registry: new QualityEvaluatorRegistry([evaluator]),
    store: qualityStore,
  });
  const report = await runScenario({
    document: scenario,
    quality: { runId: 'quality-run-001', harness },
    composition(seed: ScenarioSeed) {
      const ids = seededIdGenerator(seed);
      const repository = createInMemoryExecutionRepository({ ids });
      return {
        repository,
        engine(gateway) {
          return createExecutionEngine({
            clock: { now: () => seed.clock },
            ids,
            modules: createModuleRegistry([narrativeModule]),
            contracts: createContractRegistry([
              narrativeObserveDocumentContract,
            ]),
            pipeline: createResponsePipeline(),
            gateway,
            memory: createMemoryEngine({ ids }),
            state: createStateEngine(),
            repository,
          });
        },
      };
    },
    async loadFixture(requested) {
      return JSON.parse(
        await readFile(join(root, requested), 'utf8'),
      ) as JsonValue;
    },
  });
  return { report, records: await qualityStore.list() };
}

describe('ScenarioRunner acme-scenario/2 quality evaluation', () => {
  it('runs deterministic and recorded-external evaluators over real execution evidence', async () => {
    const scenario = await document();
    const first = await run(scenario);
    const second = await run(scenario);

    expect(first.report.status).toBe('passed');
    expect(first.report.steps.map((step) => step.kind)).toStrictEqual([
      'execute',
      'evaluate',
      'evaluate',
      'assertEvaluation',
      'assertEvaluation',
    ]);
    expect(first.records).toHaveLength(2);
    expect(first.records.map((record) => record.evaluator.kind).sort()).toEqual(
      ['deterministic', 'recorded-external'],
    );
    expect(canonicalJson(first.records as unknown as JsonValue)).toBe(
      canonicalJson(second.records as unknown as JsonValue),
    );
  });

  it('records a fail verdict successfully and fails only an explicit assertion', async () => {
    const source = await document();
    const failingEvaluator: QualityEvaluator = {
      ...passingEvaluator,
      evaluate: () => ({ scores: [], findings: [], verdict: 'fail' }),
    };
    const evaluateOnly: ScenarioDocument = {
      ...source,
      steps: source.steps.slice(0, 2),
    };
    const evaluated = await run(evaluateOnly, failingEvaluator);
    expect(evaluated.report.status).toBe('passed');
    expect(evaluated.report.steps[1]).toMatchObject({
      status: 'passed',
      detail: { qualityVerdict: 'fail' },
    });

    const executeStep = source.steps[0];
    const evaluateStep = source.steps[1];
    const assertionStep = source.steps[3];
    if (
      executeStep === undefined ||
      evaluateStep === undefined ||
      assertionStep === undefined
    ) {
      throw new Error('quality scenario fixture is incomplete');
    }
    const withAssertion: ScenarioDocument = {
      ...source,
      steps: [executeStep, evaluateStep, assertionStep],
    };
    const asserted = await run(withAssertion, failingEvaluator);
    expect(asserted.report.status).toBe('failed');
    expect(asserted.report.failure?.message).toContain(
      'was fail, expected pass',
    );
  });

  it('keeps evaluation steps out of acme-scenario/1', () => {
    expect(() =>
      parseScenario({
        schemaVersion: 'acme-scenario/1',
        name: 'v1-cannot-evaluate',
        seed: { clock: '2026-08-05T00:00:00.000Z', ids: 'sequential' },
        composition: { repository: 'memory', gateway: 'mock' },
        steps: [
          {
            evaluate: {
              as: 'quality',
              execution: 'first',
              evaluator: {
                id: 'quality',
                version: '1',
                kind: 'deterministic',
              },
              artifact: {
                kind: 'fixture',
                id: 'fixture',
                fixture: 'fixture.json',
                digest: 'a'.repeat(64),
              },
            },
          },
        ],
      }),
    ).toThrow(/requires acme-scenario\/2/u);
  });
});
