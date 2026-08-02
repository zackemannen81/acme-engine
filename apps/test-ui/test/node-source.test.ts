import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as testing from '@acme/testing';
import { parseScenario } from '@acme/testing';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ADAPTER_KITS,
  buildCatalogView,
  isAvailable,
  type ScenarioValidator,
} from '../src/index.js';
import {
  discoverCatalogSources,
  DISCOVERY_DIAGNOSTIC,
} from '../src/node-source.js';

const validateScenario = parseScenario as unknown as ScenarioValidator;

/** The repository's own scenario tree, discovered rather than described. */
const scenarioRoot = fileURLToPath(
  new URL('../../../tests/scenario/files', import.meta.url),
);

const temporaryRoots: string[] = [];

function temporaryTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-test-ui-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('adapter kit identifiers', () => {
  it('names kits @acme/testing actually exports', () => {
    const entryPoints: Record<(typeof ADAPTER_KITS)[number], string> = {
      'execution-repository': 'executionRepositoryConformance',
      'model-gateway': 'modelGatewayConformance',
      'domain-module': 'domainModuleConformance',
    };

    expect(Object.keys(entryPoints).sort()).toStrictEqual(
      [...ADAPTER_KITS].sort(),
    );
    for (const name of Object.values(entryPoints)) {
      expect(typeof (testing as unknown as Record<string, unknown>)[name]).toBe(
        'function',
      );
    }
  });
});

describe('node discovery over the repository scenario tree', () => {
  it('finds the scenario and its fixtures in deterministic order', async () => {
    const result = await discoverCatalogSources({
      directory: scenarioRoot,
      root: 'tests/scenario/files',
    });

    expect(result.root).toBe('tests/scenario/files');
    expect(result.scenarios.map((entry) => entry.path)).toStrictEqual([
      'narrative-phase-5.yaml',
    ]);
    expect(result.fixtures.map((entry) => entry.path)).toStrictEqual([
      'digests/narrative-phase-5.json',
      'inputs/chapter-1.json',
      'responses/chapter-1.json',
    ]);
    expect(result.diagnostics).toStrictEqual([]);
  });

  it('renders that tree as a catalog whose references all resolve', async () => {
    const discovered = await discoverCatalogSources({
      directory: scenarioRoot,
      root: 'tests/scenario/files',
    });
    const view = buildCatalogView(
      {
        root: discovered.root,
        scenarios: discovered.scenarios,
        fixtures: discovered.fixtures,
        diagnostics: discovered.diagnostics,
      },
      { validateScenario },
    );

    if (!isAvailable(view.scenarios) || !isAvailable(view.fixtures)) {
      throw new Error('discovery sections should be available');
    }
    const scenario = view.scenarios.scenarios[0];
    expect(scenario?.status).toBe('valid');
    expect(scenario?.name).toBe('narrative-phase-5');
    expect(scenario?.stepKinds).toStrictEqual({
      execute: 1,
      assert: 1,
      replay: 1,
      assertDigest: 1,
    });
    // Every fixture the scenario names exists on disk, and every discovered
    // fixture is claimed by it.
    expect(
      scenario?.references.every((entry) => entry.status === 'resolved'),
    ).toBe(true);
    expect(view.fixtures.orphanCount).toBe(0);

    // No module registry was supplied, so registration is unknown rather
    // than reported as unregistered.
    expect(scenario?.targets[0]).toMatchObject({
      namespace: 'narrative',
      task: 'observe-document',
      moduleRegistered: null,
      taskRegistered: null,
    });
  });
});

describe('node discovery bounds', () => {
  it('reports a depth bound instead of silently stopping', async () => {
    const root = temporaryTree();
    mkdirSync(join(root, 'a', 'b'), { recursive: true });
    writeFileSync(join(root, 'a', 'b', 'deep.json'), '{}', 'utf8');
    writeFileSync(join(root, 'shallow.json'), '{}', 'utf8');

    const result = await discoverCatalogSources({
      directory: root,
      root: 'temp',
      maxDepth: 1,
    });

    expect(result.fixtures.map((entry) => entry.path)).toStrictEqual([
      'shallow.json',
    ]);
    expect(result.diagnostics).toStrictEqual([
      {
        code: DISCOVERY_DIAGNOSTIC.depthExceeded,
        severity: 'warning',
        detail: { path: 'a/b', maxDepth: 1 },
      },
    ]);
  });

  it('reports a file bound instead of silently truncating', async () => {
    const root = temporaryTree();
    writeFileSync(join(root, 'a.json'), '{}', 'utf8');
    writeFileSync(join(root, 'b.json'), '{}', 'utf8');
    writeFileSync(join(root, 'c.json'), '{}', 'utf8');

    const result = await discoverCatalogSources({
      directory: root,
      root: 'temp',
      maxFiles: 2,
    });

    expect(result.fixtures.map((entry) => entry.path)).toStrictEqual([
      'a.json',
      'b.json',
    ]);
    expect(result.diagnostics[0]?.code).toBe(
      DISCOVERY_DIAGNOSTIC.fileLimitExceeded,
    );
  });

  it('reports an undecodable scenario without calling it invalid', async () => {
    const root = temporaryTree();
    writeFileSync(join(root, 'broken.yaml'), 'a: [1,\n  b: :', 'utf8');

    const result = await discoverCatalogSources({
      directory: root,
      root: 'temp',
    });

    // It never reached the validator, so it is a discovery diagnostic rather
    // than a scenario the catalog judged.
    expect(result.scenarios).toStrictEqual([]);
    expect(result.diagnostics[0]?.code).toBe(
      DISCOVERY_DIAGNOSTIC.undecodableScenario,
    );

    const view = buildCatalogView(
      {
        root: result.root,
        scenarios: result.scenarios,
        fixtures: result.fixtures,
        diagnostics: result.diagnostics,
      },
      { validateScenario },
    );
    expect(view.diagnostics[0]?.code).toBe(
      DISCOVERY_DIAGNOSTIC.undecodableScenario,
    );
    if (!isAvailable(view.scenarios)) {
      throw new Error('scenarios should be available');
    }
    expect(view.scenarios.scenarioCount).toBe(0);
  });

  it('ignores files that are neither scenarios nor fixtures', async () => {
    const root = temporaryTree();
    writeFileSync(join(root, 'notes.md'), '# notes', 'utf8');
    writeFileSync(join(root, 'keep.json'), '{}', 'utf8');

    const result = await discoverCatalogSources({
      directory: root,
      root: 'temp',
    });

    expect(result.fixtures.map((entry) => entry.path)).toStrictEqual([
      'keep.json',
    ]);
    expect(result.scenarios).toStrictEqual([]);
  });
});
