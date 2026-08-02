import { parseScenario } from '@acme/testing';
import { describe, expect, it } from 'vitest';

import {
  ADAPTER_KITS,
  buildCatalogView,
  CATALOG_VIEW_VERSION,
  isAvailable,
  PATH_REFUSAL,
  resolveReference,
  VIEW_UNAVAILABLE,
  type CatalogEvidence,
  type ScenarioValidator,
} from '../src/index.js';

import {
  alphaContract,
  catalogContracts,
  catalogModules,
  invalidScenario,
  validScenario,
} from './catalog-fixtures.js';

const validateScenario = parseScenario as unknown as ScenarioValidator;

function evidence(overrides: Partial<CatalogEvidence> = {}): CatalogEvidence {
  return {
    root: 'tests/scenario/files',
    modules: catalogModules(),
    contracts: catalogContracts(),
    scenarios: [
      { path: 'catalog-fixture.yaml', document: validScenario },
      { path: 'broken.yaml', document: invalidScenario },
    ],
    fixtures: [
      { path: 'responses/first.json' },
      { path: 'inputs/first.json' },
      { path: 'inputs/unused.json' },
    ],
    adapterTargets: [
      {
        id: 'adapter-sqlite',
        kit: 'execution-repository',
        package: '@acme/adapter-sqlite',
      },
      { id: 'made-up', kit: 'imagination', package: '@acme/nowhere' },
    ],
    ...overrides,
  };
}

const view = buildCatalogView(evidence(), { validateScenario });

describe('S1 catalog contract', () => {
  it('carries its version and survives JSON', () => {
    expect(view.view).toBe(CATALOG_VIEW_VERSION);
    expect(CATALOG_VIEW_VERSION).toBe('acme-view-catalog/1');
    expect(JSON.parse(JSON.stringify(view)) as unknown).toStrictEqual(view);
  });

  it('renders the root label the caller chose, not a machine path', () => {
    expect(view.root).toBe('tests/scenario/files');
  });
});

describe('S1 registries', () => {
  it('preserves registry order and task declaration order', () => {
    if (!isAvailable(view.modules)) {
      throw new Error('modules should be available');
    }
    // The registry sorts namespaces; the view repeats that order verbatim.
    expect(view.modules.modules.map((entry) => entry.namespace)).toStrictEqual([
      'alpha',
      'beta',
    ]);
    // Task order is declaration order, which is not alphabetical here.
    expect(
      view.modules.modules[0]?.tasks.map((task) => task.name),
    ).toStrictEqual(['observe', 'analyze']);
    expect(view.modules.moduleCount).toBe(2);
  });

  it('marks a task whose contract no registry holds', () => {
    if (!isAvailable(view.modules)) {
      throw new Error('modules should be available');
    }
    const [observe, analyze] = view.modules.modules[0]?.tasks ?? [];

    expect(observe?.contractRegistered).toBe(true);
    expect(observe?.contractFingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(analyze?.contractRegistered).toBe(false);
    expect(analyze?.contractFingerprint).toBeNull();
  });

  it('renders full fingerprints and cross-links contracts to tasks', () => {
    if (!isAvailable(view.contracts)) {
      throw new Error('contracts should be available');
    }
    expect(view.contracts.contracts.map((entry) => entry.id)).toStrictEqual([
      'alpha.observe',
      'beta.observe',
      'orphan.observe',
    ]);

    const alpha = view.contracts.contracts[0];
    expect(alpha?.fingerprint).toBe(
      catalogContracts().fingerprint(alphaContract.ref),
    );
    expect(alpha?.fingerprint).toHaveLength(64);
    expect(alpha?.referencedByTasks).toStrictEqual(['alpha.observe']);
    expect(alpha?.retention).toBe('hash-only');
    expect(alpha?.requiredCapabilities).toStrictEqual({
      structuredOutput: true,
      tools: false,
    });

    const orphan = view.contracts.contracts[2];
    expect(orphan?.referencedByTasks).toStrictEqual([]);
  });

  it('states that no evaluator registry exists instead of showing none', () => {
    expect(view.evaluators).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.evaluatorRegistry,
    });
  });

  it('reports an absent registry as unavailable', () => {
    const empty = buildCatalogView(
      { root: 'nowhere', modules: null, contracts: null },
      { validateScenario },
    );

    expect(empty.modules).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.moduleRegistry,
    });
    expect(empty.contracts).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.contractRegistry,
    });
  });
});

describe('S1 scenarios', () => {
  it('classifies documents with the runner validator and keeps invalid ones visible', () => {
    if (!isAvailable(view.scenarios)) {
      throw new Error('scenarios should be available');
    }
    expect(view.scenarios.scenarios.map((entry) => entry.path)).toStrictEqual([
      'broken.yaml',
      'catalog-fixture.yaml',
    ]);
    expect(view.scenarios.validCount).toBe(1);
    expect(view.scenarios.invalidCount).toBe(1);

    const broken = view.scenarios.scenarios[0];
    expect(broken?.status).toBe('invalid');
    // The validator's own message, not a message this package invented.
    expect(broken?.error?.message).toContain('acme-scenario/1');
    expect(broken?.name).toBeNull();
    expect(broken?.stepCount).toBeNull();
  });

  it('summarizes a valid scenario without re-deciding anything', () => {
    if (!isAvailable(view.scenarios)) {
      throw new Error('scenarios should be available');
    }
    const scenario = view.scenarios.scenarios[1];

    expect(scenario?.status).toBe('valid');
    expect(scenario?.name).toBe('catalog-fixture');
    expect(scenario?.schemaVersion).toBe('acme-scenario/1');
    expect(scenario?.composition).toStrictEqual({
      repository: 'memory',
      gateway: 'mock',
    });
    expect(scenario?.seed?.clock).toBe('2026-01-01T00:00:00.000Z');
    expect(scenario?.stepCount).toBe(3);
    expect(scenario?.stepKinds).toStrictEqual({ execute: 2, assert: 1 });
  });

  it('marks a step that targets an unregistered namespace', () => {
    if (!isAvailable(view.scenarios)) {
      throw new Error('scenarios should be available');
    }
    const targets = view.scenarios.scenarios[1]?.targets ?? [];

    expect(targets[0]).toMatchObject({
      namespace: 'alpha',
      task: 'observe',
      moduleRegistered: true,
      taskRegistered: true,
    });
    expect(targets[1]).toMatchObject({
      namespace: 'ghost',
      moduleRegistered: false,
      taskRegistered: false,
    });
  });

  it('resolves, misses and refuses fixture references distinctly', () => {
    if (!isAvailable(view.scenarios)) {
      throw new Error('scenarios should be available');
    }
    const references = view.scenarios.scenarios[1]?.references ?? [];

    expect(references).toStrictEqual([
      {
        stepIndex: 0,
        field: 'fixture',
        requested: 'inputs/first.json',
        status: 'resolved',
        path: 'inputs/first.json',
        reason: null,
      },
      {
        stepIndex: 0,
        field: 'mockResponse',
        requested: 'responses/first.json',
        status: 'resolved',
        path: 'responses/first.json',
        reason: null,
      },
      {
        stepIndex: 1,
        field: 'fixture',
        requested: '../outside.json',
        status: 'refused',
        path: null,
        reason: PATH_REFUSAL.escapesRoot,
      },
      {
        stepIndex: 1,
        field: 'mockResponse',
        requested: 'responses/missing.json',
        status: 'missing',
        path: 'responses/missing.json',
        reason: null,
      },
    ]);
  });

  it('cannot classify scenarios without the runner validator', () => {
    const withoutValidator = buildCatalogView(evidence());

    expect(withoutValidator.scenarios).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.scenarioValidator,
    });
  });

  it('reports absent discovery as unavailable, not as an empty tree', () => {
    const undiscovered = buildCatalogView(
      { root: 'nowhere' },
      { validateScenario },
    );

    expect(undiscovered.scenarios).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.scenarioDiscovery,
    });
    expect(undiscovered.fixtures).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.fixtureDiscovery,
    });
  });
});

describe('S1 fixtures', () => {
  it('orders fixtures deterministically and exposes orphans', () => {
    if (!isAvailable(view.fixtures)) {
      throw new Error('fixtures should be available');
    }
    expect(view.fixtures.fixtures.map((entry) => entry.path)).toStrictEqual([
      'inputs/first.json',
      'inputs/unused.json',
      'responses/first.json',
    ]);
    expect(view.fixtures.fixtures[0]?.referencedBy).toStrictEqual([
      'catalog-fixture.yaml',
    ]);
    expect(view.fixtures.fixtures[1]?.orphan).toBe(true);
    expect(view.fixtures.orphanCount).toBe(1);
  });
});

describe('S1 adapter targets', () => {
  it('names the kits @acme/testing publishes and flags anything else', () => {
    if (!isAvailable(view.adapterTargets)) {
      throw new Error('targets should be available');
    }
    expect(view.adapterTargets.knownKits).toStrictEqual([...ADAPTER_KITS]);
    expect(view.adapterTargets.targets[0]).toMatchObject({
      id: 'adapter-sqlite',
      kit: 'execution-repository',
      kitStatus: 'known',
    });
    // An unknown kit is shown as unknown rather than dropped.
    expect(view.adapterTargets.targets[1]).toMatchObject({
      id: 'made-up',
      kitStatus: 'unknown',
    });
  });

  it('reports no declared targets as unavailable', () => {
    const none = buildCatalogView({ root: 'nowhere' }, { validateScenario });

    expect(none.adapterTargets).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.adapterTargets,
    });
  });
});

describe('reference path rules', () => {
  it('refuses absolute, escaping and empty references', () => {
    expect(resolveReference('/etc/passwd')).toStrictEqual({
      status: 'refused',
      reason: PATH_REFUSAL.absolute,
    });
    expect(resolveReference('C:\\secrets.json')).toStrictEqual({
      status: 'refused',
      reason: PATH_REFUSAL.absolute,
    });
    expect(resolveReference('\\\\share\\secrets.json')).toStrictEqual({
      status: 'refused',
      reason: PATH_REFUSAL.absolute,
    });
    expect(resolveReference('a/../../b.json')).toStrictEqual({
      status: 'refused',
      reason: PATH_REFUSAL.escapesRoot,
    });
    expect(resolveReference('   ')).toStrictEqual({
      status: 'refused',
      reason: PATH_REFUSAL.empty,
    });
    expect(resolveReference('.')).toStrictEqual({
      status: 'refused',
      reason: PATH_REFUSAL.empty,
    });
  });

  it('normalizes accepted references to one POSIX form', () => {
    expect(resolveReference('inputs\\first.json')).toStrictEqual({
      status: 'resolved',
      path: 'inputs/first.json',
    });
    expect(resolveReference('./a/./b/../c.json')).toStrictEqual({
      status: 'resolved',
      path: 'a/c.json',
    });
  });
});
