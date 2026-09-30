import { describe, expect, it } from 'vitest';
import {
  createAcmeModelRuntime,
  type ModelFunctionTool,
  type ModelRequest,
} from '../../acme-engine/src/index.js';
import { createInMemoryModelExecutionRepository } from '@acme-engine/adapter-memory';
import type {
  ProviderTransport,
  ProviderTransportRequest,
} from '@acme-engine/adapter-model-openai';

const strictTool: ModelFunctionTool = {
  type: 'function',
  name: 'strict_lookup',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
    additionalProperties: false,
  },
};
const looseTool: ModelFunctionTool = {
  type: 'function',
  name: 'loose_lookup',
  strict: false,
  parameters: {
    type: 'object',
    properties: {
      query: { oneOf: [{ type: 'integer' }, { type: 'number' }] },
    },
    additionalProperties: true,
  },
};
const mixedRequest: ModelRequest = {
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'Look up a value.' }] },
  ],
  output: { mode: 'text' },
  tools: [
    strictTool,
    looseTool,
    { ...strictTool, name: 'explicit_lookup', strict: true },
  ],
};
const expectedModes = [
  { toolIndex: 0, strict: true },
  { toolIndex: 1, strict: false },
  { toolIndex: 2, strict: true },
];

function fixture(
  route: 'openai' | 'compatible',
  status = 200,
  argumentsText = '{"unexpected":true}',
) {
  const sent: ProviderTransportRequest[] = [];
  const response =
    route === 'openai'
      ? {
          id: 'resp_fixture',
          model: 'fixture',
          status: 'completed',
          output: [
            {
              type: 'function_call',
              call_id: 'call_1',
              name: 'loose_lookup',
              arguments: argumentsText,
            },
          ],
        }
      : {
          id: 'chat_fixture',
          model: 'fixture',
          choices: [
            {
              index: 0,
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'loose_lookup',
                      arguments: argumentsText,
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };
  const body =
    status === 200
      ? JSON.stringify(response)
      : JSON.stringify({
          error: {
            message: 'Rejected strict tool.',
            type: 'invalid_request_error',
            code: 'invalid_function_parameters',
          },
        });
  const transport: ProviderTransport = {
    async send(request) {
      sent.push(request);
      return { kind: 'response', status, headers: {}, body };
    },
    async *stream(request) {
      sent.push(request);
      yield { kind: 'response-start', status, headers: {} };
      const streamBody =
        route === 'openai'
          ? `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`
          : `data: ${JSON.stringify({ id: 'chat_fixture', model: 'fixture', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'loose_lookup', arguments: argumentsText } }] }, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`;
      yield { kind: 'chunk', text: status === 200 ? streamBody : body };
      yield { kind: 'response-end' };
    },
  };
  const model = { profile: 'default', providerHint: route };
  const profiles = [{ selection: model, model: 'fixture' }];
  const repository = createInMemoryModelExecutionRepository();
  const runtime = createAcmeModelRuntime({
    now: () => '2026-09-30T12:00:00.000Z',
    repository,
    openAiTransport: transport,
    chatCompletionsTransport: transport,
    config:
      route === 'openai'
        ? { openAi: { apiKey: 'fixture-key', profiles } }
        : {
            compatible: [
              {
                providerHint: route,
                endpoint: 'https://fixture.invalid/v1/chat/completions',
                apiKey: 'fixture-key',
                profiles,
              },
            ],
          },
  });
  return { runtime, repository, sent, model };
}

describe('public facade per-tool strictness', () => {
  for (const route of ['openai', 'compatible'] as const) {
    it.each([false, true])(
      `${route} maps mixed modes for stream=%s and preserves replay identity`,
      async (stream) => {
        const { runtime, repository, sent, model } = fixture(route);
        const request = { ...mixedRequest, stream };
        const result = await runtime.execute({
          requestKey: 'mixed',
          model,
          request,
        });
        expect(result.status).toBe('succeeded');
        expect(result.diagnostic.toolModes).toEqual(expectedModes);
        expect(
          (await repository.get(result.modelExecutionId))?.diagnostic
            ?.toolModes,
        ).toEqual(expectedModes);
        const wire = JSON.parse(sent[0]?.body ?? '{}');
        const tools =
          route === 'openai'
            ? wire.tools
            : wire.tools.map((tool: { function: unknown }) => tool.function);
        expect(tools.map((tool: { strict: boolean }) => tool.strict)).toEqual([
          true,
          false,
          true,
        ]);
        expect(tools[1].parameters).toEqual(looseTool.parameters);
        expect(tools[0].parameters).toEqual(strictTool.parameters);
        expect(mixedRequest.tools?.[0]).not.toHaveProperty('strict');
        // ACME returns candidates; it neither executes tools nor silently repairs arguments.
        if (result.status === 'succeeded')
          expect(result.response.toolCalls?.[0]?.arguments).toEqual({
            unexpected: true,
          });
        const replay = await runtime.execute({
          requestKey: 'mixed',
          model,
          request,
        });
        expect(replay).toMatchObject({
          status: 'succeeded',
          replayed: true,
          diagnostic: { toolModes: expectedModes },
        });
        const conflict = await runtime.execute({
          requestKey: 'mixed',
          model,
          request: {
            ...request,
            tools: (request.tools ?? []).map((tool, index) =>
              index === 1 ? { ...tool, strict: true } : tool,
            ),
          },
        });
        expect(conflict.status).toBe('conflicted');
        expect(sent).toHaveLength(1);
      },
    );

    it(`${route} rejects invalid mode types before dispatch`, async () => {
      const { runtime, sent, model } = fixture(route);
      await expect(
        runtime.execute({
          requestKey: 'bad-mode',
          model,
          request: {
            ...mixedRequest,
            tools: [
              {
                ...strictTool,
                strict: 'false',
              } as unknown as ModelFunctionTool,
            ],
          },
        }),
      ).rejects.toMatchObject({ data: { code: 'INVALID_REQUEST' } });
      expect(sent).toHaveLength(0);
    });

    it.each([false, true])(
      `${route} retains mode diagnostics on provider failure stream=%s without retrying`,
      async (stream) => {
        const { runtime, sent, model } = fixture(route, 400);
        const request = { ...mixedRequest, stream };
        const result = await runtime.execute({
          requestKey: 'refused',
          model,
          request,
        });
        expect(result.status).toBe('failed');
        expect(result.diagnostic.toolModes).toEqual(expectedModes);
        expect(
          await runtime.execute({ requestKey: 'refused', model, request }),
        ).toEqual(result);
        expect(sent).toHaveLength(1);
      },
    );

    it.each([false, true])(
      `${route} still rejects malformed JSON arguments in non-strict mode stream=%s`,
      async (stream) => {
        const { runtime, sent, model } = fixture(route, 200, '{');
        const result = await runtime.execute({
          requestKey: 'malformed',
          model,
          request: { ...mixedRequest, stream },
        });
        expect(result).toMatchObject({
          status: 'failed',
          error: { code: 'MODEL_INVALID_RESPONSE' },
        });
        expect(sent).toHaveLength(1);
      },
    );
  }

  it.each([undefined, true])(
    'refuses incompatible Responses tools with strict=%s before transport',
    async (strict) => {
      const { runtime, sent, model } = fixture('openai');
      const tool: ModelFunctionTool = {
        type: looseTool.type,
        name: looseTool.name,
        parameters: looseTool.parameters,
      };
      const request: ModelRequest = {
        ...mixedRequest,
        tools: [{ ...tool, ...(strict === undefined ? {} : { strict }) }],
      };
      const result = await runtime.execute({
        requestKey: 'strict-refusal',
        model,
        request,
      });
      expect(result).toMatchObject({
        status: 'failed',
        error: { code: 'UNSUPPORTED_CAPABILITY' },
        diagnostic: { toolModes: [{ toolIndex: 0, strict: true }] },
      });
      expect(sent).toHaveLength(0);
    },
  );

  it('does not let one non-strict tool downgrade an incompatible strict neighbour', async () => {
    const { runtime, sent, model } = fixture('openai');
    const result = await runtime.execute({
      requestKey: 'mixed-refusal',
      model,
      request: {
        ...mixedRequest,
        tools: [looseTool, { ...looseTool, name: 'strict_bad', strict: true }],
      },
    });
    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'UNSUPPORTED_CAPABILITY' },
    });
    expect(sent).toHaveLength(0);
  });

  it('keeps structured final output strict and independently lowered', async () => {
    const { runtime, sent, model } = fixture('openai');
    await runtime.execute({
      requestKey: 'json',
      model,
      request: {
        ...mixedRequest,
        stream: false,
        output: {
          mode: 'json',
          schemaName: 'answer',
          jsonSchema: strictTool.parameters,
        },
      },
    });
    expect(JSON.parse(sent[0]?.body ?? '{}').text.format).toMatchObject({
      type: 'json_schema',
      strict: true,
      schema: strictTool.parameters,
    });
    const result = await runtime.execute({
      requestKey: 'bad-json',
      model,
      request: {
        ...mixedRequest,
        output: {
          mode: 'json',
          schemaName: 'bad',
          jsonSchema: looseTool.parameters,
        },
      },
    });
    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'UNSUPPORTED_CAPABILITY' },
    });
    expect(sent).toHaveLength(1);
  });
});
