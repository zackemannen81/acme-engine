import { randomUUID } from 'node:crypto';

import {
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  type Clock,
  type ExecutionEngine,
  type ExecutionRepository,
  type IdGenerator,
  type ModelGateway,
  type RepositoryEvidence,
} from '@acme/core';
import { createInMemoryExecutionRepository } from '@acme/adapter-memory';
import {
  createSqliteExecutionRepository,
  openDatabase,
} from '@acme/adapter-sqlite';
import {
  narrativeModule,
  narrativeObserveDocumentContract,
} from '@acme/module-narrative';
import {
  researchModule,
  researchObserveEvidenceContract,
} from '@acme/module-research';

import type { AdapterName } from './args.js';

/**
 * Both repository adapters expose read-only evidence beyond the port. A
 * composition root knows which adapter it selected, so inspection may use it.
 */
export type InspectableRepository = ExecutionRepository & {
  snapshot(): RepositoryEvidence;
};

export interface CompositionOverrides {
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}

export interface Composition {
  readonly repository: InspectableRepository;
  readonly close: () => void;
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

/**
 * The one place that selects concrete adapters. Everything else in the CLI
 * works through core ports.
 */
export function createComposition(
  adapter: AdapterName,
  database: string | undefined,
  overrides: CompositionOverrides = {},
): Composition {
  const ids = overrides.ids ?? defaultIds();
  const clock = overrides.clock ?? defaultClock();

  let repository: InspectableRepository;
  let close = (): void => {};

  if (adapter === 'sqlite') {
    if (database === undefined) {
      throw new Error('The SQLite adapter requires a database path.');
    }
    const connection = openDatabase({
      location: database,
      appliedAt: clock.now(),
    });
    close = (): void => {
      connection.close();
    };
    repository = createSqliteExecutionRepository({ database: connection, ids });
  } else {
    repository = createInMemoryExecutionRepository({ ids });
  }

  return {
    repository,
    close,
    engine(gateway) {
      return createExecutionEngine({
        clock,
        ids,
        modules: createModuleRegistry([narrativeModule, researchModule]),
        contracts: createContractRegistry([
          narrativeObserveDocumentContract,
          researchObserveEvidenceContract,
        ]),
        pipeline: createResponsePipeline(),
        gateway,
        memory: createMemoryEngine({ ids }),
        state: createStateEngine(),
        repository,
      });
    },
  };
}
