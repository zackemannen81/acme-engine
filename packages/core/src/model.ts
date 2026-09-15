import type { ExecutionId, IsoTimestamp, JsonValue } from './common.js';

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
    };

export interface ModelMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: readonly ModelContentPart[];
}

export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly output: {
    readonly mode: 'json';
    readonly schemaName: string;
    readonly jsonSchema: JsonValue;
  };
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly stop?: readonly string[];
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

export interface NormalizedModelResponse {
  readonly provider: string;
  readonly model: string;
  readonly providerResponseId?: string;
  readonly receivedAt: IsoTimestamp;
  readonly finishReason:
    'stop' | 'length' | 'tool' | 'content-filter' | 'unknown';
  readonly text: string;
  readonly usage: NormalizedUsage;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ModelGateway {
  capabilities(selection: ModelSelection): Promise<ModelCapabilities>;
  generate(
    request: ModelRequest,
    context: GatewayCallContext,
  ): Promise<NormalizedModelResponse>;
}
