import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, dirname } from 'node:path';

import type { JsonValue } from '@acme/core';
import {
  runScenario,
  seededIdGenerator,
  type ScenarioReport,
} from '@acme/testing';
import { parse as parseYaml } from 'yaml';

import { UsageError } from './args.js';
import type { Composition, CompositionOverrides } from './composition.js';

/**
 * Resolves a fixture path against the scenario root and refuses anything that
 * escapes it. The runner never touches the filesystem; this is the only place
 * a scenario can name a file, so it is the only place the rule is needed.
 */
export function resolveFixturePath(root: string, requested: string): string {
  if (isAbsolute(requested)) {
    throw new UsageError(
      `A scenario fixture path must be relative: ${requested}`,
    );
  }
  const resolved = resolve(root, requested);
  const within = relative(root, resolved);
  if (within.startsWith('..') || isAbsolute(within)) {
    throw new UsageError(
      `A scenario fixture path must stay below the scenario root: ${requested}`,
    );
  }
  return resolved;
}

export async function runScenarioFile(
  scenarioPath: string,
  createComposition: (overrides: CompositionOverrides) => Composition,
): Promise<{ report: ScenarioReport; close: () => void }> {
  let text: string;
  try {
    text = await readFile(scenarioPath, 'utf8');
  } catch {
    throw new UsageError(`Could not read the scenario file: ${scenarioPath}`);
  }

  let document: unknown;
  try {
    document = parseYaml(text) as unknown;
  } catch (error: unknown) {
    throw new UsageError(
      error instanceof Error
        ? `The scenario file is not valid YAML: ${error.message}`
        : 'The scenario file is not valid YAML.',
    );
  }

  const root = dirname(resolve(scenarioPath));
  let close = (): void => {};
  const report = await runScenario({
    document,
    composition(seed) {
      // The scenario's declared clock and ID allocation are the ones the run
      // uses, so a pinned digest is reproducible.
      const built = createComposition({
        clock: { now: () => seed.clock },
        ids: seededIdGenerator(seed),
      });
      close = built.close;
      return built;
    },
    async loadFixture(requested) {
      const path = resolveFixturePath(root, requested);
      let raw: string;
      try {
        raw = await readFile(path, 'utf8');
      } catch {
        throw new UsageError(`Could not read the fixture: ${requested}`);
      }
      try {
        return JSON.parse(raw) as JsonValue;
      } catch {
        throw new UsageError(`The fixture is not valid JSON: ${requested}`);
      }
    },
  });
  return { report, close };
}
