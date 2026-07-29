import type { ExecutionId, Hashing, IsoTimestamp, Schema } from './common.js';
import type {
  ModelCapabilities,
  ModelRequest,
  NormalizedModelResponse,
} from './model.js';

export interface ContractRef {
  readonly id: string;
  readonly version: string;
}

export interface SemanticIssue {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ContractBuildContext {
  readonly executionId: ExecutionId;
  readonly now: IsoTimestamp;
}

export interface PromptContract<TInput, TOutput> {
  readonly ref: ContractRef;
  readonly inputSchema: Schema<TInput>;
  readonly outputSchema: Schema<TOutput>;
  readonly requiredCapabilities: Partial<ModelCapabilities>;
  readonly retention: 'none' | 'hash-only' | 'encrypted-payload';
  buildRequest(input: TInput, context: ContractBuildContext): ModelRequest;
  validateSemantics(output: TOutput): readonly SemanticIssue[];
}

export interface ContractRegistry {
  get<TInput, TOutput>(ref: ContractRef): PromptContract<TInput, TOutput>;
  has(ref: ContractRef): boolean;
  fingerprint(ref: ContractRef): string;
  list(): readonly ContractRef[];
}

export type PipelineResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly warnings: readonly SemanticIssue[];
      readonly parsedHash: string;
    }
  | {
      readonly ok: false;
      readonly stage: 'empty' | 'parse' | 'schema' | 'semantic';
      readonly issues: readonly SemanticIssue[];
      readonly repairable: boolean;
    };

export interface ResponsePipeline {
  process<T>(
    response: NormalizedModelResponse,
    contract: PromptContract<unknown, T>,
  ): PipelineResult<T>;
}

export interface ResponsePipelineOptions {
  readonly hashing?: Hashing;
}

// Generic erasure is intentionally confined to registry construction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPromptContract = PromptContract<any, any>;
