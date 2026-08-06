import { parseArgs } from 'node:util';

export class UsageError extends Error {}

export type AdapterName = 'memory' | 'sqlite';

/** How `execute` obtains a ModelGateway. */
export type ExecuteGateway =
  | { readonly kind: 'script'; readonly script: string }
  | { readonly kind: 'openai' };

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
      readonly gateway: ExecuteGateway;
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
      readonly kind: 'execution-stranded';
      readonly limit: number;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'execution-discharge';
      readonly executionId: string;
      readonly dischargedBy: string;
      readonly rationale: string;
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
      readonly kind: 'outbox-inspect';
      readonly status?: string;
      readonly limit: number;
      /** Alarm if pending count exceeds this (composition-root policy). */
      readonly maxPending?: number;
      /** Alarm if failed count exceeds this. */
      readonly maxFailed?: number;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'outbox-drain';
      readonly limit: number;
      readonly leaseTimeoutMs: number;
      /**
       * `report` = events only in stdout (default).
       * `file` = write versioned envelopes under `--outbox-dir`.
       */
      readonly transport: 'report' | 'file';
      readonly outboxDir?: string;
      readonly common: CommonOptions;
    }
  | {
      readonly kind: 'outbox-redrive';
      readonly eventId?: string;
      readonly allFailed: boolean;
      readonly limit: number;
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
  acme execute --request <file> --gateway openai [--adapter memory|sqlite]
               [--database <path>] [--json]
  acme scenario run <file> [--adapter memory|sqlite] [--database <path>] [--json]
  acme execution replay <execution-id> --mode verify [--adapter ...] [--database <path>] [--json]
  acme execution inspect <execution-id> [--show-payloads] [--adapter ...] [--database <path>] [--json]
  acme execution stranded [--limit <n>] [--adapter ...] [--database <path>] [--json]
  acme execution discharge <execution-id> --by <operator> --rationale <text>
               [--adapter ...] [--database <path>] [--json]
  acme state inspect <namespace> <entity-id> [--revision <n>] [--adapter ...] [--database <path>] [--json]
  acme memory inspect <namespace> <entity-id> [--status <status>] [--adapter ...] [--database <path>] [--json]
  acme outbox inspect [--status <status>] [--limit <n>]
               [--max-pending <n>] [--max-failed <n>]
               [--adapter ...] [--database <path>] [--json]
  acme outbox drain [--limit <n>] [--lease-timeout-ms <n>]
               [--transport report|file] [--outbox-dir <path>]
               [--adapter ...] [--database <path>] [--json]
  acme outbox redrive <event-id> [--adapter ...] [--database <path>] [--json]
  acme outbox redrive --all-failed [--limit <n>] [--adapter ...] [--database <path>] [--json]

  --adapter        memory (default) or sqlite
  --database       required with --adapter sqlite
  --script         deterministic model-call script (mock gateway)
  --gateway        openai for a live Responses call (requires OPENAI_API_KEY;
                   model from ACME_OPENAI_MODEL or ACME_LIVE_MODEL)
  --limit          maximum outbox or stranded entries to list (default 50)
  --lease-timeout-ms
                   how long an outbox claim stays exclusive (default 30000)
  --max-pending    outbox inspect: exit 1 if pending count exceeds N
  --max-failed     outbox inspect: exit 1 if failed count exceeds N
  --transport      outbox drain: report (default) or file
  --outbox-dir     required with --transport file; delivery JSON directory
  --by             operator identity for execution discharge
  --rationale      human reason for execution discharge
  --show-payloads  print document, memory and state values instead of redacting
  --json           versioned JSON on stdout instead of a text summary

Exactly one of --script or --gateway is required for execute.
Payloads are redacted unless --show-payloads is supplied.
Live calls may spend money; credentials are read only from the environment.`;

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

function positiveInteger(raw: unknown, flag: string, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new UsageError(`${flag} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInteger(raw: unknown, flag: string): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new UsageError(`${flag} must be a non-negative integer.`);
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
        gateway: { type: 'string' },
        adapter: { type: 'string' },
        database: { type: 'string' },
        mode: { type: 'string' },
        revision: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'string' },
        'lease-timeout-ms': { type: 'string' },
        by: { type: 'string' },
        rationale: { type: 'string' },
        'all-failed': { type: 'boolean' },
        'max-pending': { type: 'string' },
        'max-failed': { type: 'string' },
        transport: { type: 'string' },
        'outbox-dir': { type: 'string' },
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
    const gatewayFlag = values['gateway'] as string | undefined;
    if (request === undefined) {
      throw new UsageError('execute requires --request <file>.');
    }
    if (script !== undefined && gatewayFlag !== undefined) {
      throw new UsageError(
        'execute accepts either --script or --gateway, not both.',
      );
    }
    if (script !== undefined) {
      return {
        kind: 'execute',
        request,
        gateway: { kind: 'script', script },
        common: options,
      };
    }
    if (gatewayFlag !== undefined) {
      if (gatewayFlag !== 'openai') {
        throw new UsageError(
          '--gateway must be openai (the only live provider wired today).',
        );
      }
      return {
        kind: 'execute',
        request,
        gateway: { kind: 'openai' },
        common: options,
      };
    }
    throw new UsageError(
      'execute requires --script <file> or --gateway openai.',
    );
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
    if (action === 'stranded') {
      return {
        kind: 'execution-stranded',
        limit: positiveInteger(values['limit'], '--limit', 50),
        common: options,
      };
    }
    if (action === 'discharge') {
      const executionId = requirePositional(positionals, 2, 'execution-id');
      const dischargedBy = values['by'] as string | undefined;
      const rationale = values['rationale'] as string | undefined;
      if (dischargedBy === undefined || dischargedBy.trim().length === 0) {
        throw new UsageError(
          'execution discharge requires --by <operator>.',
        );
      }
      if (rationale === undefined || rationale.trim().length === 0) {
        throw new UsageError(
          'execution discharge requires --rationale <text>.',
        );
      }
      return {
        kind: 'execution-discharge',
        executionId,
        dischargedBy,
        rationale,
        common: options,
      };
    }
    throw new UsageError(
      'Unknown execution action; expected replay, inspect, stranded or discharge.',
    );
  }

  if (group === 'outbox') {
    const action = positionals[1];
    if (action !== 'inspect' && action !== 'drain' && action !== 'redrive') {
      throw new UsageError(
        'Unknown outbox action; expected inspect, drain or redrive.',
      );
    }
    const limit = positiveInteger(values['limit'], '--limit', 50);
    if (action === 'inspect') {
      const status = values['status'] as string | undefined;
      const maxPendingRaw = values['max-pending'] as string | undefined;
      const maxFailedRaw = values['max-failed'] as string | undefined;
      let maxPending: number | undefined;
      let maxFailed: number | undefined;
      if (maxPendingRaw !== undefined) {
        maxPending = nonNegativeInteger(maxPendingRaw, '--max-pending');
      }
      if (maxFailedRaw !== undefined) {
        maxFailed = nonNegativeInteger(maxFailedRaw, '--max-failed');
      }
      return {
        kind: 'outbox-inspect',
        ...(status === undefined ? {} : { status }),
        limit,
        ...(maxPending === undefined ? {} : { maxPending }),
        ...(maxFailed === undefined ? {} : { maxFailed }),
        common: options,
      };
    }
    if (action === 'redrive') {
      const allFailed = values['all-failed'] === true;
      const eventId = positionals[2];
      if (allFailed && eventId !== undefined) {
        throw new UsageError(
          'outbox redrive accepts either <event-id> or --all-failed, not both.',
        );
      }
      if (!allFailed && (eventId === undefined || eventId.length === 0)) {
        throw new UsageError(
          'outbox redrive requires <event-id> or --all-failed.',
        );
      }
      return {
        kind: 'outbox-redrive',
        ...(eventId === undefined ? {} : { eventId }),
        allFailed,
        limit,
        common: options,
      };
    }
    const transportRaw = (values['transport'] as string | undefined) ?? 'report';
    if (transportRaw !== 'report' && transportRaw !== 'file') {
      throw new UsageError('--transport must be report or file.');
    }
    const outboxDir = values['outbox-dir'] as string | undefined;
    if (transportRaw === 'file') {
      if (outboxDir === undefined || outboxDir.trim().length === 0) {
        throw new UsageError(
          'outbox drain --transport file requires --outbox-dir <path>.',
        );
      }
    } else if (outboxDir !== undefined) {
      throw new UsageError(
        '--outbox-dir is only meaningful with --transport file.',
      );
    }
    return {
      kind: 'outbox-drain',
      limit,
      leaseTimeoutMs: positiveInteger(
        values['lease-timeout-ms'],
        '--lease-timeout-ms',
        30_000,
      ),
      transport: transportRaw,
      ...(outboxDir === undefined ? {} : { outboxDir }),
      common: options,
    };
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
