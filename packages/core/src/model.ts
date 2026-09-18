import type { ExecutionId, IsoTimestamp, JsonValue } from './common.js';
import type { AcmeErrorData } from './errors.js';

export interface ModelCapabilities {
  readonly structuredOutput: boolean;
  readonly tools: boolean;
  readonly vision: boolean;
  readonly maxInputTokens?: number;
  readonly maxOutputTokens?: number;
}

export type ModelContentPart =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'image';
      readonly mediaType: string;
      readonly dataRef: string;
    }
  | {
      readonly type: 'tool-result';
      readonly toolCallId: string;
      readonly value: JsonValue;
    }
  | {
      readonly type: 'tool-call';
      readonly toolCallId: string;
      readonly name: string;
      readonly arguments: JsonValue;
    };

export interface ModelMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: readonly ModelContentPart[];
}

export type ModelJsonOutput = {
  readonly mode: 'json';
  readonly schemaName: string;
  readonly jsonSchema: JsonValue;
};

export type ModelTextOutput = {
  readonly mode: 'text';
};

export type ModelOutputSpec = ModelJsonOutput | ModelTextOutput;

export interface ModelFunctionTool {
  readonly type: 'function';
  readonly name: string;
  readonly description?: string;
  readonly parameters: JsonValue;
}

export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly output: ModelOutputSpec;
  readonly tools?: readonly ModelFunctionTool[];
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxOutputTokens?: number;
  readonly stop?: readonly string[];
  readonly reasoningBudget?: number;
  readonly enableThinking?: boolean;
  readonly reasoningEffort?: string;
  readonly seed?: number;
  readonly stream?: boolean;
}

export function isJsonModelOutput(
  output: ModelOutputSpec,
): output is ModelJsonOutput {
  return output.mode === 'json';
}

export interface ModelSelection {
  readonly profile: string;
  readonly providerHint?: string;
  readonly modelHint?: string;
}

export interface GatewayCallContext {
  readonly executionId: ExecutionId;
  readonly callKey: string;
  readonly selection: ModelSelection;
  readonly requiredCapabilities: Partial<ModelCapabilities>;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface NormalizedUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCostMinor?: number;
  readonly currency?: string;
}

export interface NormalizedToolCall {
  readonly toolCallId: string;
  readonly name: string;
  readonly arguments: JsonValue;
}

export interface NormalizedModelResponse {
  readonly provider: string;
  readonly model: string;
  readonly providerResponseId?: string;
  readonly receivedAt: IsoTimestamp;
  readonly finishReason:
    'stop' | 'length' | 'tool' | 'content-filter' | 'unknown';
  readonly text: string;
  readonly toolCalls?: readonly NormalizedToolCall[];
  readonly usage: NormalizedUsage;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export type ModelStreamEvent =
  | {
      readonly type: 'reasoning-delta';
      readonly sequence: number;
      readonly text: string;
    }
  | {
      readonly type: 'content-delta';
      readonly sequence: number;
      readonly text: string;
    }
  | {
      readonly type: 'tool-call-delta';
      readonly sequence: number;
      readonly index: number;
      readonly toolCallId?: string;
      readonly name?: string;
      readonly argumentsDelta?: string;
    }
  | {
      readonly type: 'completed';
      readonly sequence: number;
      readonly response: NormalizedModelResponse;
    }
  | {
      readonly type: 'failed';
      readonly sequence: number;
      readonly error: AcmeErrorData;
    };

export interface ModelGateway {
  capabilities(selection: ModelSelection): Promise<ModelCapabilities>;
  generate(
    request: ModelRequest,
    context: GatewayCallContext,
  ): Promise<NormalizedModelResponse>;
  stream?(
    request: ModelRequest,
    context: GatewayCallContext,
  ): AsyncIterable<ModelStreamEvent>;
}
