import { createInMemoryExecutionRepository } from '@acme/adapter-memory';
import {
  createSqliteExecutionRepository,
  openDatabase,
} from '@acme/adapter-sqlite';
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
  type PayloadEncryptor,
  type RepositoryEvidence,
} from '@acme/core';
import {
  narrativeModule,
  narrativeObserveDocumentContract,
} from '@acme/module-narrative';
import {
  researchModule,
  researchObserveEvidenceContract,
} from '@acme/module-research';

/**
 * The interface's own composition root (ADR-0021).
 *
 * It selects the same concrete adapters `@acme/cli` selects, through the same
 * core entry points. It is not the CLI: each composition root owns its own
 * selection, and the interface has no argument parsing or exit codes.
 *
 * This module lives behind the `./local` entry point, so the package's
 * default surface still selects no adapter and performs no I/O.
 */

export type InterfaceRepository = ExecutionRepository & {
  snapshot(): RepositoryEvidence;
};

export interface CompositionOptions {
  readonly repository: 'memory' | 'sqlite';
  /** Required for the SQLite repository. */
  readonly database?: string;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly payloadEncryptor?: PayloadEncryptor;
}

export interface InterfaceComposition {
  readonly repository: InterfaceRepository;
  readonly clock: Clock;
  readonly close: () => void;
  engine(gateway: ModelGateway): ExecutionEngine;
}

export function createInterfaceComposition(
  options: CompositionOptions,
): InterfaceComposition {
  const { clock, ids } = options;
  let repository: InterfaceRepository;
  let close = (): void => {};

  if (options.repository === 'sqlite') {
    if (options.database === undefined) {
      throw new Error('The SQLite repository requires a database path.');
    }
    const connection = openDatabase({
      location: options.database,
      appliedAt: clock.now(),
    });
    close = (): void => {
      connection.close();
    };
    repository = createSqliteExecutionRepository({
      database: connection,
      ids,
      ...(options.payloadEncryptor === undefined
        ? {}
        : { payloadEncryptor: options.payloadEncryptor }),
    });
  } else {
    repository = createInMemoryExecutionRepository({
      ids,
      ...(options.payloadEncryptor === undefined
        ? {}
        : { payloadEncryptor: options.payloadEncryptor }),
    });
  }

  return {
    repository,
    clock,
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
