import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, dirname } from 'node:path';

import type { JsonValue, ModelGateway, ModelSelection } from '@acme/core';
import {
  createOpenAiResponsesGateway,
  type ProviderTransport,
} from '@acme/adapter-model-openai';
import { createFetchTransport } from '@acme/adapter-model-openai/transport-fetch';
import {
  parseScenario,
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

export interface RunScenarioFileOptions {
  /**
   * Injected OpenAI transport for offline multi-step live proofs (ACME-0064).
   * Production uses fetch when composition.gateway is openai.
   */
  readonly openAiTransport?: ProviderTransport;
  readonly openAiModel?: string;
}

function openAiModelId(options: RunScenarioFileOptions): string {
  if (options.openAiModel !== undefined && options.openAiModel.length > 0) {
    return options.openAiModel;
  }
  return (
    process.env['ACME_OPENAI_MODEL'] ??
    process.env['ACME_LIVE_MODEL'] ??
    'gpt-5.6-luna'
  );
}

function liveGatewayFor(
  selection: ModelSelection,
  options: RunScenarioFileOptions,
): ModelGateway {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (
    options.openAiTransport === undefined &&
    (apiKey === undefined || apiKey.trim().length === 0)
  ) {
    throw new UsageError(
      'scenario composition.gateway openai requires OPENAI_API_KEY (or an injected transport in tests).',
    );
  }
  const transport = options.openAiTransport ?? createFetchTransport();
  const model = openAiModelId(options);
  return createOpenAiResponsesGateway({
    transport,
    now: () => new Date().toISOString(),
    headers: () =>
      apiKey === undefined || apiKey.trim().length === 0
        ? {}
        : { authorization: `Bearer ${apiKey}` },
    profiles: [
      {
        selection,
        model,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
        },
      },
    ],
  });
}

export async function runScenarioFile(
  scenarioPath: string,
  createComposition: (overrides: CompositionOverrides) => Composition,
  options: RunScenarioFileOptions = {},
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

  // Validate early so live-gateway wiring matches the document.
  const parsed = parseScenario(document);
  if (parsed.composition.gateway === 'openai' && options.openAiTransport === undefined) {
    const optIn = process.env['ACME_LIVE_TEST'];
    if (optIn === undefined || optIn.trim().length === 0) {
      throw new UsageError(
        'scenario composition.gateway openai requires ACME_LIVE_TEST=1 (and OPENAI_API_KEY) for live runs.',
      );
    }
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
      return {
        repository: built.repository,
        engine: (gateway) => built.engine(gateway),
        ...(parsed.composition.gateway === 'openai'
          ? {
              liveGateway: (selection: ModelSelection) =>
                liveGatewayFor(selection, options),
            }
          : {}),
      };
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
