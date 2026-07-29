import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  AcmeError,
  createContractRegistry,
  createModuleRegistry,
  type AnyDomainModule,
  type DomainModule,
  type PromptContract,
} from '../src/index.js';

interface Output {
  readonly value: number;
}

function makeContract(
  id: string,
  version = '1.0.0',
  outputSchema: z.ZodType<Output> = z.object({ value: z.number() }).strict(),
): PromptContract<unknown, Output> {
  return {
    ref: { id, version },
    inputSchema: z.unknown(),
    outputSchema,
    requiredCapabilities: { structuredOutput: true },
    retention: 'hash-only',
    buildRequest: () => ({
      messages: [],
      output: {
        mode: 'json',
        schemaName: id,
        jsonSchema: {},
      },
    }),
    validateSemantics: () => [],
  };
}

type FixtureModule = DomainModule<
  { readonly value: number },
  { readonly amount: number },
  Record<never, never>
>;

function makeModule(namespace: string): FixtureModule {
  return {
    namespace,
    stateSchemaVersion: '1.0.0',
    deltaSchemaVersion: '1.0.0',
    stateSchema: z.object({ value: z.number() }).strict(),
    deltaSchema: z.object({ amount: z.number() }).strict(),
    tasks: {},
    memoryPolicy: {
      validate: () => [],
      identity: ({ key }) => key,
      retrieve: () => [],
      resolve: ({ key }) => ({
        candidateKey: key,
        action: 'ignore',
        reason: 'fixture',
      }),
      lifecycle: () => ({ action: 'retain' }),
    },
    initialState: () => ({ value: 0 }),
    reduce: (state, delta) => ({
      value: state.value + delta.amount,
    }),
    invariants: () => [],
  };
}

function expectAcmeCode(
  operation: () => unknown,
  code: AcmeError['data']['code'],
): void {
  try {
    operation();
    throw new Error('Expected operation to throw.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AcmeError);
    expect((error as AcmeError).data.code).toBe(code);
  }
}

describe('contract registry', () => {
  it('looks up contracts and lists immutable refs deterministically', () => {
    const second = makeContract('zeta');
    const first = makeContract('alpha');
    const registry = createContractRegistry([second, first]);

    expect(registry.has(first.ref)).toBe(true);
    expect(registry.get(first.ref)).toBe(first);
    expect(registry.list()).toEqual([
      { id: 'alpha', version: '1.0.0' },
      { id: 'zeta', version: '1.0.0' },
    ]);
    expect(Object.isFrozen(registry.list())).toBe(true);
  });

  it('produces stable fingerprints and changes them with contract identity', () => {
    const first = makeContract('alpha');
    const same = makeContract('alpha');
    const nextVersion = makeContract('alpha', '1.0.1');

    expect(createContractRegistry([first]).fingerprint(first.ref)).toBe(
      createContractRegistry([same]).fingerprint(same.ref),
    );
    expect(createContractRegistry([first]).fingerprint(first.ref)).not.toBe(
      createContractRegistry([nextVersion]).fingerprint(nextVersion.ref),
    );
  });

  it('rejects duplicates and reports missing contracts', () => {
    const first = makeContract('alpha');

    expectAcmeCode(
      () => createContractRegistry([first, makeContract('alpha')]),
      'INTERNAL',
    );
    expectAcmeCode(
      () =>
        createContractRegistry([]).get({
          id: 'missing',
          version: '1.0.0',
        }),
      'NOT_FOUND_CONTRACT',
    );
  });
});

describe('module registry', () => {
  it('looks up modules and lists namespaces deterministically', () => {
    const second = makeModule('zeta');
    const first = makeModule('alpha');
    const registry = createModuleRegistry([
      second as AnyDomainModule,
      first as AnyDomainModule,
    ]);

    expect(registry.get('alpha')).toBe(first);
    expect(registry.list()).toEqual(['alpha', 'zeta']);
    expect(Object.isFrozen(registry.list())).toBe(true);
  });

  it('rejects duplicates and reports missing modules', () => {
    expectAcmeCode(
      () =>
        createModuleRegistry([
          makeModule('alpha') as AnyDomainModule,
          makeModule('alpha') as AnyDomainModule,
        ]),
      'INTERNAL',
    );
    expectAcmeCode(
      () => createModuleRegistry([]).get('missing'),
      'NOT_FOUND_MODULE',
    );
  });
});
