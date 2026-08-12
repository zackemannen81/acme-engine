/**
 * Gated PostgreSQL test entry. Refuses when no connection is configured
 * (mirrors the live provider gate). Invoked by `pnpm test:postgres`.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

function hasConnection() {
  if (process.env.ACME_POSTGRES_URL?.trim()) {
    return true;
  }
  if (process.env.ACME_POSTGRES_HOST?.trim()) {
    return true;
  }
  return false;
}

if (!hasConnection()) {
  process.stderr.write(
    'ACME_POSTGRES_URL (or ACME_POSTGRES_HOST/PORT/USER/PASSWORD/DATABASE) is required for pnpm test:postgres. Refusing rather than skipping.\n',
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    path.join(repoRoot, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    'vitest.postgres.config.ts',
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  },
);

process.exit(result.status ?? 1);
