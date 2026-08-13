import { randomUUID } from 'node:crypto';

import {
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  type Clock,
  type ContractRegistry,
  type ExecutionEngine,
  type IdGenerator,
  type MemoryEngine,
  type ModelGateway,
  type ModuleRegistry,
  type PayloadEncryptor,
  type RepositoryEvidence,
} from '@acme/core';
import { createInMemoryExecutionRepository } from '@acme/adapter-memory';
import {
  narrativeModule,
  narrativeObserveDocumentContract,
} from '@acme/module-narrative';
import {
  researchModule,
  researchObserveEvidenceContract,
} from '@acme/module-research';

import type { ExecutionRepository } from '@acme/core';

/**
 * The MCP server's composition root. It selects the same registries and the
 * same in-memory repository the CLI selects, so the tools below are running
 * today's engine rather than a stand-in for it. Only the in-memory adapter is
 * wired: a stdio server holding a database file open is a separate decision
 * this prototype does not need to make.
 */
export type InspectableRepository = ExecutionRepository & {
  snapshot(): RepositoryEvidence | Promise<RepositoryEvidence>;
};

export interface CompositionOverrides {
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly payloadEncryptor?: PayloadEncryptor;
}

export interface Composition {
  readonly repository: InspectableRepository;
  readonly modules: ModuleRegistry;
  readonly contracts: ContractRegistry;
  readonly memory: MemoryEngine;
  readonly clock: Clock;
  engine(gateway: ModelGateway): ExecutionEngine;
}

function defaultIds(): IdGenerator {
  return {
    next(kind) {
      return `${kind}-${randomUUID()}`;
    },
  };
}

function defaultClock(): Clock {
  return {
    now() {
      return new Date().toISOString();
    },
  };
}

export function createComposition(
  overrides: CompositionOverrides = {},
): Composition {
  const ids = overrides.ids ?? defaultIds();
  const clock = overrides.clock ?? defaultClock();
  const repository = createInMemoryExecutionRepository({
    ids,
    ...(overrides.payloadEncryptor === undefined
      ? {}
      : { payloadEncryptor: overrides.payloadEncryptor }),
  });
  const modules = createModuleRegistry([narrativeModule, researchModule]);
  const contracts = createContractRegistry([
    narrativeObserveDocumentContract,
    researchObserveEvidenceContract,
  ]);
  const memory = createMemoryEngine({ ids });

  return {
    repository,
    modules,
    contracts,
    memory,
    clock,
    engine(gateway) {
      return createExecutionEngine({
        clock,
        ids,
        modules,
        contracts,
        pipeline: createResponsePipeline(),
        gateway,
        memory,
        state: createStateEngine(),
        repository,
      });
    },
  };
}
