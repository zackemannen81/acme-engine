import { z } from 'zod';

import type { JsonValue } from './common.js';
import type {
  AnyPromptContract,
  ContractRef,
  ContractRegistry,
  PromptContract,
} from './contracts.js';
import { AcmeError } from './errors.js';
import { nodeHashing } from './hashing.js';
import type { AnyDomainModule, ModuleRegistry } from './modules.js';

function contractKey(ref: ContractRef): string {
  if (ref.id.length === 0 || ref.version.length === 0) {
    throw new AcmeError({
      code: 'INVALID_REQUEST',
      message: 'Contract id and version must be non-empty.',
      stage: 'accepted',
      retryable: false,
    });
  }
  return `${ref.id}@${ref.version}`;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

function jsonSchema(schema: z.ZodType): JsonValue {
  return z.toJSONSchema(schema) as JsonValue;
}

function capabilityDescriptor(
  contract: AnyPromptContract,
): Record<string, JsonValue> {
  const descriptor: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(contract.requiredCapabilities)) {
    if (value !== undefined) {
      descriptor[key] = value;
    }
  }
  return descriptor;
}

function fingerprintContract(contract: AnyPromptContract): string {
  const descriptor: JsonValue = {
    ref: {
      id: contract.ref.id,
      version: contract.ref.version,
    },
    inputSchema: jsonSchema(contract.inputSchema),
    outputSchema: jsonSchema(contract.outputSchema),
    requiredCapabilities: capabilityDescriptor(contract),
    retention: contract.retention,
  };
  return nodeHashing.sha256(nodeHashing.canonicalJson(descriptor));
}

class StaticContractRegistry implements ContractRegistry {
  readonly #contracts: ReadonlyMap<string, AnyPromptContract>;
  readonly #fingerprints: ReadonlyMap<string, string>;
  readonly #refs: readonly ContractRef[];

  constructor(contracts: readonly AnyPromptContract[]) {
    const byKey = new Map<string, AnyPromptContract>();
    const fingerprints = new Map<string, string>();

    for (const contract of contracts) {
      const key = contractKey(contract.ref);
      if (byKey.has(key)) {
        throw new AcmeError({
          code: 'INTERNAL',
          message: `Duplicate contract registration: ${key}.`,
          stage: 'accepted',
          retryable: false,
          details: { key },
        });
      }
      byKey.set(key, contract);
      fingerprints.set(key, fingerprintContract(contract));
    }

    this.#contracts = byKey;
    this.#fingerprints = fingerprints;
    this.#refs = Object.freeze(
      [...byKey.values()]
        .map(({ ref }) => Object.freeze({ ...ref }))
        .sort((left, right) =>
          compareStrings(contractKey(left), contractKey(right)),
        ),
    );
  }

  get<TInput, TOutput>(ref: ContractRef): PromptContract<TInput, TOutput> {
    const key = contractKey(ref);
    const contract = this.#contracts.get(key);
    if (contract === undefined) {
      throw new AcmeError({
        code: 'NOT_FOUND_CONTRACT',
        message: `Contract not found: ${key}.`,
        stage: 'accepted',
        retryable: false,
        details: { key },
      });
    }
    return contract as PromptContract<TInput, TOutput>;
  }

  has(ref: ContractRef): boolean {
    return this.#contracts.has(contractKey(ref));
  }

  fingerprint(ref: ContractRef): string {
    const key = contractKey(ref);
    const fingerprint = this.#fingerprints.get(key);
    if (fingerprint === undefined) {
      throw new AcmeError({
        code: 'NOT_FOUND_CONTRACT',
        message: `Contract not found: ${key}.`,
        stage: 'accepted',
        retryable: false,
        details: { key },
      });
    }
    return fingerprint;
  }

  list(): readonly ContractRef[] {
    return this.#refs;
  }
}

class StaticModuleRegistry implements ModuleRegistry {
  readonly #modules: ReadonlyMap<string, AnyDomainModule>;
  readonly #namespaces: readonly string[];

  constructor(modules: readonly AnyDomainModule[]) {
    const byNamespace = new Map<string, AnyDomainModule>();

    for (const module of modules) {
      if (module.namespace.length === 0) {
        throw new AcmeError({
          code: 'INVALID_REQUEST',
          message: 'Module namespace must be non-empty.',
          stage: 'accepted',
          retryable: false,
        });
      }
      if (byNamespace.has(module.namespace)) {
        throw new AcmeError({
          code: 'INTERNAL',
          message: `Duplicate module registration: ${module.namespace}.`,
          stage: 'accepted',
          retryable: false,
          details: { namespace: module.namespace },
        });
      }
      byNamespace.set(module.namespace, module);
    }

    this.#modules = byNamespace;
    this.#namespaces = Object.freeze([...byNamespace.keys()].sort());
  }

  get(namespace: string): AnyDomainModule {
    const module = this.#modules.get(namespace);
    if (module === undefined) {
      throw new AcmeError({
        code: 'NOT_FOUND_MODULE',
        message: `Module not found: ${namespace}.`,
        stage: 'accepted',
        retryable: false,
        details: { namespace },
      });
    }
    return module;
  }

  list(): readonly string[] {
    return this.#namespaces;
  }
}

export function createContractRegistry(
  contracts: readonly AnyPromptContract[],
): ContractRegistry {
  return new StaticContractRegistry(contracts);
}

export function createModuleRegistry(
  modules: readonly AnyDomainModule[],
): ModuleRegistry {
  return new StaticModuleRegistry(modules);
}
