import { randomUUID } from 'node:crypto';

import {
  createAes256GcmPayloadEncryptor,
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
  createInMemoryExecutionRepository,
  createInMemoryQualityEvaluationStore,
} from '@acme/adapter-memory';
import {
  createSqliteExecutionRepository,
  createSqliteQualityEvaluationStore,
  openDatabase,
} from '@acme/adapter-sqlite';
import type { QualityEvaluationStore } from '@acme/evaluation';
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
  readonly payloadEncryptor?: PayloadEncryptor;
}

/**
 * Optional env-backed encryptor for live/local CLI use.
 * `ACME_PAYLOAD_KEY` is 32 raw bytes as base64; `ACME_PAYLOAD_KEY_ID` names it.
 * Composition owns key acquisition; core never reads the environment.
 */
function payloadEncryptorFromEnv(): PayloadEncryptor | undefined {
  const encoded = process.env['ACME_PAYLOAD_KEY'];
  if (encoded === undefined || encoded.trim().length === 0) {
    return undefined;
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.byteLength !== 32) {
    throw new Error(
      'ACME_PAYLOAD_KEY must decode to exactly 32 bytes (AES-256).',
    );
  }
  const keyId = process.env['ACME_PAYLOAD_KEY_ID'] ?? 'env-default';
  return createAes256GcmPayloadEncryptor({
    key: new Uint8Array(key),
    keyId,
  });
}

export interface Composition {
  readonly repository: InspectableRepository;
  /** Sibling quality store (memory or same SQLite file as the ledger). */
  readonly qualityStore: QualityEvaluationStore;
  /** The selected clock, so commands that need time do not invent one. */
  readonly clock: Clock;
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
  const payloadEncryptor =
    overrides.payloadEncryptor ?? payloadEncryptorFromEnv();

  let repository: InspectableRepository;
  let qualityStore: QualityEvaluationStore;
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
    repository = createSqliteExecutionRepository({
      database: connection,
      ids,
      ...(payloadEncryptor === undefined ? {} : { payloadEncryptor }),
    });
    qualityStore = createSqliteQualityEvaluationStore({ database: connection });
  } else {
    repository = createInMemoryExecutionRepository({
      ids,
      ...(payloadEncryptor === undefined ? {} : { payloadEncryptor }),
    });
    qualityStore = createInMemoryQualityEvaluationStore();
  }

  return {
    repository,
    qualityStore,
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
