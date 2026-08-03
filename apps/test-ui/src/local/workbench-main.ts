/**
 * CLI entry for the local workbench (ADR-0024).
 *
 * Usage (from repo after build):
 *   node apps/test-ui/dist/local/workbench-main.js --workspace <dir> [--port 8787]
 *
 * Env: ACME_TEST_UI_WORKSPACE, ACME_TEST_UI_PORT, ACME_TEST_UI_LEDGER (optional sqlite)
 */

import { resolve } from 'node:path';

import { startWorkbenchServer } from './server.js';

function argValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const workspace =
    argValue(args, '--workspace') ?? process.env['ACME_TEST_UI_WORKSPACE'];
  if (workspace === undefined || workspace.trim().length === 0) {
    process.stderr.write(
      'Usage: workbench-main --workspace <dir> [--port 8787] [--ledger <sqlite>]\n',
    );
    process.exitCode = 2;
    return;
  }

  const portRaw =
    argValue(args, '--port') ?? process.env['ACME_TEST_UI_PORT'] ?? '8787';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 0) {
    process.stderr.write('Invalid --port.\n');
    process.exitCode = 2;
    return;
  }

  const ledger =
    argValue(args, '--ledger') ?? process.env['ACME_TEST_UI_LEDGER'];

  let seq = 0;
  const server = await startWorkbenchServer({
    workspaceRoot: resolve(workspace),
    host: '127.0.0.1',
    port,
    ...(ledger === undefined ? {} : { ledgerDatabase: resolve(ledger) }),
    clock: {
      now: () => new Date().toISOString(),
    },
    ids: {
      next(kind) {
        seq += 1;
        return `${kind}-wb-${seq}`;
      },
    },
  });

  process.stdout.write(`ACME Test UI workbench listening on ${server.url}\n`);
  process.stdout.write('Loopback only (ADR-0024). Ctrl+C to stop.\n');

  const shutdown = (): void => {
    void server.close().then(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  process.stderr.write(
    error instanceof Error ? `${error.message}\n` : 'Workbench failed.\n',
  );
  process.exitCode = 1;
});
