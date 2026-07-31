import type { JsonValue } from '@acme/core';

export const CLI_OUTPUT_VERSION = 'acme-cli/1' as const;

export const REDACTED = '[redacted]' as const;

export interface CliIo {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

/**
 * Payloads are redacted by default. Only the caller's explicit
 * `--show-payloads` opts a local operator into content.
 */
export function payload(value: JsonValue, showPayloads: boolean): JsonValue {
  return showPayloads ? value : REDACTED;
}

export function emit(
  io: CliIo,
  command: string,
  body: Readonly<Record<string, JsonValue>>,
  json: boolean,
  summary: readonly string[],
): void {
  if (json) {
    io.stdout(
      JSON.stringify(
        { version: CLI_OUTPUT_VERSION, command, ...body },
        null,
        2,
      ),
    );
    return;
  }
  for (const line of summary) {
    io.stdout(line);
  }
}
