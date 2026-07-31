import { parseArgs } from 'node:util';

export class UsageError extends Error {}

export type AdapterName = 'memory' | 'sqlite';

export interface CommonOptions {
  readonly adapter: AdapterName;
  readonly database?: string;
  readonly json: boolean;
  readonly showPayloads: boolean;
}

export type Command =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'execute';
      readonly request: string;
      readonly script: string;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'scenario-run';
      readonly scenario: string;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'execution-replay';
      readonly executionId: string;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'execution-inspect';
      readonly executionId: string;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'state-inspect';
      readonly namespace: string;
      readonly entityId: string;
      readonly revision?: number;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'memory-inspect';
      readonly namespace: string;
      readonly entityId: string;
      readonly status?: string;
      readonly common: CommonOptions;
    };

export const USAGE = `acme — ACME composition root

  acme execute --request <file> --script <file> [--adapter memory|sqlite]
               [--database <path>] [--json]
  acme scenario run <file> [--adapter memory|sqlite] [--database <path>] [--json]
  acme execution replay <execution-id> --mode verify [--adapter ...] [--database <path>] [--json]
  acme execution inspect <execution-id> [--show-payloads] [--adapter ...] [--database <path>] [--json]
  acme state inspect <namespace> <entity-id> [--revision <n>] [--adapter ...] [--database <path>] [--json]
  acme memory inspect <namespace> <entity-id> [--status <status>] [--adapter ...] [--database <path>] [--json]

  --adapter        memory (default) or sqlite
  --database       required with --adapter sqlite
  --script         deterministic model-call script; no live provider exists
  --show-payloads  print document, memory and state values instead of redacting
  --json           versioned JSON on stdout instead of a text summary

Payloads are redacted unless --show-payloads is supplied.`;

function requirePositional(
  positionals: readonly string[],
  index: number,
  name: string,
): string {
  const value = positionals[index];
  if (value === undefined || value.length === 0) {
    throw new UsageError(`Missing required argument <${name}>.`);
  }
  return value;
}

function common(values: Record<string, unknown>): CommonOptions {
  const adapter = (values['adapter'] ?? 'memory') as string;
  if (adapter !== 'memory' && adapter !== 'sqlite') {
    throw new UsageError('--adapter must be memory or sqlite.');
  }
  const database = values['database'] as string | undefined;
  if (adapter === 'sqlite' && database === undefined) {
    throw new UsageError('--adapter sqlite requires --database <path>.');
  }
  if (adapter === 'memory' && database !== undefined) {
    throw new UsageError(
      '--database is only meaningful with --adapter sqlite.',
    );
  }
  return {
    adapter,
    ...(database === undefined ? {} : { database }),
    json: values['json'] === true,
    showPayloads: values['show-payloads'] === true,
  };
}

export function parseCommand(argv: readonly string[]): Command {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === 'help') {
    return { kind: 'help' };
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        request: { type: 'string' },
        script: { type: 'string' },
        adapter: { type: 'string' },
        database: { type: 'string' },
        mode: { type: 'string' },
        revision: { type: 'string' },
        status: { type: 'string' },
        json: { type: 'boolean' },
        'show-payloads': { type: 'boolean' },
      },
    });
  } catch (error: unknown) {
    // parseArgs reports unknown flags and missing values; surface them as
    // usage errors rather than letting a stack trace escape.
    throw new UsageError(
      error instanceof Error ? error.message : 'Invalid arguments.',
    );
  }

  const { positionals, values } = parsed;
  const options = common(values);
  const group = positionals[0];

  if (group === 'execute') {
    const request = values['request'] as string | undefined;
    const script = values['script'] as string | undefined;
    if (request === undefined) {
      throw new UsageError('execute requires --request <file>.');
    }
    if (script === undefined) {
      throw new UsageError(
        'execute requires --script <file>; no live provider transport exists.',
      );
    }
    return { kind: 'execute', request, script, common: options };
  }

  if (group === 'scenario') {
    if (positionals[1] !== 'run') {
      throw new UsageError('Unknown scenario action; expected run.');
    }
    const scenario = requirePositional(positionals, 2, 'file');
    return { kind: 'scenario-run', scenario, common: options };
  }

  if (group === 'execution') {
    const action = positionals[1];
    if (action === 'replay') {
      const executionId = requirePositional(positionals, 2, 'execution-id');
      if (values['mode'] !== 'verify') {
        throw new UsageError('execution replay requires --mode verify.');
      }
      return { kind: 'execution-replay', executionId, common: options };
    }
    if (action === 'inspect') {
      const executionId = requirePositional(positionals, 2, 'execution-id');
      return { kind: 'execution-inspect', executionId, common: options };
    }
    throw new UsageError(
      'Unknown execution action; expected replay or inspect.',
    );
  }

  if (group === 'state' || group === 'memory') {
    if (positionals[1] !== 'inspect') {
      throw new UsageError(`Unknown ${group} action; expected inspect.`);
    }
    const namespace = requirePositional(positionals, 2, 'namespace');
    const entityId = requirePositional(positionals, 3, 'entity-id');
    if (group === 'state') {
      const raw = values['revision'] as string | undefined;
      let revision: number | undefined;
      if (raw !== undefined) {
        revision = Number(raw);
        if (!Number.isSafeInteger(revision) || revision < 0) {
          throw new UsageError('--revision must be a non-negative integer.');
        }
      }
      return {
        kind: 'state-inspect',
        namespace,
        entityId,
        ...(revision === undefined ? {} : { revision }),
        common: options,
      };
    }
    const status = values['status'] as string | undefined;
    return {
      kind: 'memory-inspect',
      namespace,
      entityId,
      ...(status === undefined ? {} : { status }),
      common: options,
    };
  }

  throw new UsageError(`Unknown command "${String(group)}".`);
}
