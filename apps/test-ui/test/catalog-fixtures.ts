import {
  createContractRegistry,
  createModuleRegistry,
  defineModule,
  defineTask,
  type ContractRegistry,
  type JsonValue,
  type ModelRequest,
  type ModuleRegistry,
  type DomainMemoryPolicy,
  type PromptContract,
} from '@acme/core';
import { z } from 'zod';

/**
 * A small registry pair for catalog tests.
 *
 * Two namespaces and two contracts are enough to prove ordering, task-to-
 * contract cross-linking and the unregistered-contract case, without pulling
 * a reference domain into an app test.
 */

const inputSchema = z.object({ text: z.string().min(1) }).strict();
const outputSchema = z.object({ fact: z.string().min(1) }).strict();
const stateSchema = z.object({ count: z.number().int() }).strict();
const deltaSchema = z.object({ increment: z.number().int() }).strict();

function contract(
  id: string,
): PromptContract<{ readonly text: string }, { readonly fact: string }> {
  return {
    ref: { id, version: '1.0.0' },
    inputSchema,
    outputSchema,
    requiredCapabilities: { structuredOutput: true, tools: false },
    retention: 'hash-only',
    buildRequest(): ModelRequest {
      return {
        messages: [],
        output: {
          mode: 'json',
          schemaName: 'catalog_fixture_1',
          jsonSchema: z.toJSONSchema(outputSchema) as JsonValue,
        },
      };
    },
    validateSemantics() {
      return [];
    },
  };
}

export const alphaContract = contract('alpha.observe');
export const betaContract = contract('beta.observe');
/** Registered by no module, so the catalog must show zero references. */
export const orphanContract = contract('orphan.observe');

const memoryPolicy: DomainMemoryPolicy = {
  validate: () => [],
  identity: (candidate) => candidate.key,
  retrieve: () => [],
  resolve: (candidate) => ({
    candidateKey: candidate.key,
    action: 'create',
    value: candidate.value,
    strength: 0.5,
  }),
  lifecycle: () => ({ action: 'retain' }),
};

function moduleFor(namespace: string, contractId: string) {
  // Task keys are deliberately out of alphabetical order so a test can prove
  // the catalog preserves declaration order instead of sorting for looks.
  const observe = defineTask<
    { readonly text: string },
    { readonly text: string },
    { readonly fact: string },
    { readonly count: number },
    { readonly increment: number }
  >({
    role: 'producer',
    inputSchema,
    contract: { id: contractId, version: '1.0.0' },
    project: (input) => input,
    interpret: () => ({
      documents: [],
      memories: [],
      events: [],
      diagnostics: [],
    }),
    projectState: () => undefined,
  });
  const analyze = defineTask<
    { readonly text: string },
    { readonly text: string },
    { readonly fact: string },
    { readonly count: number },
    { readonly increment: number }
  >({
    role: 'analyzer',
    inputSchema,
    // Points at a contract no registry holds, so the catalog must mark it.
    contract: { id: `${namespace}.missing`, version: '9.9.9' },
    project: (input) => input,
    interpret: () => ({
      documents: [],
      memories: [],
      events: [],
      diagnostics: [],
    }),
    projectState: () => undefined,
  });

  return defineModule<
    { readonly count: number },
    { readonly increment: number },
    { readonly observe: typeof observe; readonly analyze: typeof analyze }
  >({
    namespace,
    stateSchemaVersion: `${namespace}-state/1`,
    deltaSchemaVersion: `${namespace}-delta/1`,
    stateSchema,
    deltaSchema,
    tasks: { observe, analyze },
    memoryPolicy,
    initialState: () => ({ count: 0 }),
    reduce: (state, delta) => ({ count: state.count + delta.increment }),
    invariants: () => [],
  });
}

export function catalogModules(): ModuleRegistry {
  // Registered beta first; `list()` decides the rendered order, not this.
  return createModuleRegistry([
    moduleFor('beta', 'beta.observe'),
    moduleFor('alpha', 'alpha.observe'),
  ]);
}

export function catalogContracts(): ContractRegistry {
  return createContractRegistry([betaContract, orphanContract, alphaContract]);
}

export const validScenario = {
  schemaVersion: 'acme-scenario/1',
  name: 'catalog-fixture',
  seed: { clock: '2026-01-01T00:00:00.000Z', ids: 'sequential' },
  composition: { repository: 'memory', gateway: 'mock' },
  steps: [
    {
      execute: {
        as: 'first',
        requestKey: 'request-1',
        namespace: 'alpha',
        task: 'observe',
        entityId: 'entity-1',
        expectedRevision: 0,
        fixture: 'inputs/first.json',
        mockResponse: 'responses/first.json',
      },
    },
    {
      execute: {
        as: 'second',
        requestKey: 'request-2',
        namespace: 'ghost',
        task: 'observe',
        entityId: 'entity-1',
        expectedRevision: 1,
        fixture: '../outside.json',
        mockResponse: 'responses/missing.json',
      },
    },
    { assert: { execution: 'first', status: 'committed' } },
  ],
};

export const invalidScenario = {
  schemaVersion: 'acme-scenario/3',
  name: 'wrong-version',
};
