import { z } from 'zod';

/**
 * Provider wire shapes for the OpenAI Responses API.
 *
 * These schemas are deliberately tolerant of unknown fields. The wire format
 * belongs to the provider, so adding a field must not break the adapter; only
 * the fields ACME actually consumes are required.
 *
 * ADR-0014 records that these shapes are written from our understanding of the
 * Responses API rather than captured from a live call. They make the adapter
 * internally consistent; only the live-transport task can confirm them.
 */

export const OPENAI_PROVIDER = 'openai' as const;
export const OPENAI_RESPONSES_PATH = '/v1/responses' as const;

const OutputTextPartSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
});

const RefusalPartSchema = z.object({
  type: z.literal('refusal'),
  refusal: z.string(),
});

const UnknownPartSchema = z.object({ type: z.string() });

const ContentPartSchema = z.union([
  OutputTextPartSchema,
  RefusalPartSchema,
  UnknownPartSchema,
]);

const MessageItemSchema = z.object({
  type: z.literal('message'),
  content: z.array(ContentPartSchema).default([]),
});

const UnknownItemSchema = z.object({ type: z.string() });

const OutputItemSchema = z.union([MessageItemSchema, UnknownItemSchema]);

const UsageSchema = z.object({
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
});

export const OpenAiResponseSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  status: z.string().min(1),
  incomplete_details: z.object({ reason: z.string().optional() }).nullish(),
  error: z
    .object({ code: z.string().nullish(), message: z.string().optional() })
    .nullish(),
  output: z.array(OutputItemSchema).default([]),
  usage: UsageSchema.optional(),
});

export const OpenAiErrorBodySchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().nullish(),
    code: z.string().nullish(),
  }),
});

export type OpenAiResponse = z.infer<typeof OpenAiResponseSchema>;

/** Concatenated `output_text` in provider order. */
export function collectOutputText(response: OpenAiResponse): string {
  const chunks: string[] = [];
  for (const item of response.output) {
    if (item.type !== 'message') {
      continue;
    }
    const message = item as z.infer<typeof MessageItemSchema>;
    for (const part of message.content) {
      if (part.type === 'output_text') {
        chunks.push((part as z.infer<typeof OutputTextPartSchema>).text);
      }
    }
  }
  return chunks.join('');
}

export function hasRefusal(response: OpenAiResponse): boolean {
  return response.output.some((item) => {
    if (item.type !== 'message') {
      return false;
    }
    const message = item as z.infer<typeof MessageItemSchema>;
    return message.content.some((part) => part.type === 'refusal');
  });
}
