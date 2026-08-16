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
  /**
   * Optional bounded repair request for a recoverably invalid response.
   *
   * ADR-0045 §5. Prompt authorship stays with the contract: core decides
   * whether a repair is permitted and budgeted, never what it says. A contract
   * without this method is never repaired and its repair budget goes unused.
   *
   * The issues are the pipeline's own, and the returned request must target the
   * same schema as `buildRequest`.
   */
  buildRepairRequest?(
    input: TInput,
    context: ContractRepairContext,
  ): ModelRequest;
  validateSemantics(output: TOutput, input: TInput): readonly SemanticIssue[];
}

export interface ContractRepairContext extends ContractBuildContext {
  readonly attempt: number;
  readonly issues: readonly SemanticIssue[];
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
      readonly stage: 'input' | 'empty' | 'parse' | 'schema' | 'semantic';
      readonly issues: readonly SemanticIssue[];
      readonly repairable: boolean;
    };

export interface ResponsePipeline {
  process<TInput, TOutput>(
    response: NormalizedModelResponse,
    contract: PromptContract<TInput, TOutput>,
    input: TInput,
  ): PipelineResult<TOutput>;
}

export interface ResponsePipelineOptions {
  readonly hashing?: Hashing;
}

// Generic erasure is intentionally confined to registry construction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPromptContract = PromptContract<any, any>;
