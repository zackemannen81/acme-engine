/**
 * Provision the V2 artifact bucket on a self-hosted Supabase Storage instance.
 *
 * ADR-0029 selects self-hosted Supabase and ADR-0037 selects its S3-compatible
 * endpoint for encrypted artifact objects. Neither makes the product a bucket
 * administrator: the object store port creates objects, never containers. This
 * is therefore an operator step with its own script rather than a startup side
 * effect, so a running product cannot invent storage it was not given.
 *
 * Idempotent. Creating a bucket that already exists is reported and succeeds.
 *
 * Required environment:
 *   SUPABASE_URL          e.g. http://127.0.0.1:8000
 *   SUPABASE_SERVICE_KEY  service role key, or a path in SUPABASE_SERVICE_KEY_FILE
 *   ACME_V2_S3_BUCKET     bucket name to ensure
 */
import { readFile } from 'node:fs/promises';
import process from 'node:process';

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

async function serviceKey() {
  const path = process.env['SUPABASE_SERVICE_KEY_FILE'];
  if (path !== undefined && path.trim().length > 0) {
    return (await readFile(path.trim(), 'utf8')).trim();
  }
  return required('SUPABASE_SERVICE_KEY');
}

async function main() {
  const baseUrl = required('SUPABASE_URL').replace(/\/$/u, '');
  const bucket = required('ACME_V2_S3_BUCKET');
  const key = await serviceKey();
  const headers = {
    authorization: `Bearer ${key}`,
    apikey: key,
    'content-type': 'application/json',
  };

  const existing = await fetch(`${baseUrl}/storage/v1/bucket/${bucket}`, {
    headers,
  });
  if (existing.ok) {
    const body = await existing.json();
    if (body.public === true) {
      throw new Error(
        `Bucket "${bucket}" is public. Artifact objects are encrypted, but a ` +
          'public bucket contradicts the ADR-0029 browser-isolation boundary. ' +
          'Make it private before using it.',
      );
    }
    process.stdout.write(`bucket "${bucket}" already exists and is private\n`);
    return;
  }
  if (existing.status !== 400 && existing.status !== 404) {
    throw new Error(
      `Bucket lookup failed (${existing.status}): ${await existing.text()}`,
    );
  }

  const created = await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: bucket, name: bucket, public: false }),
  });
  if (!created.ok) {
    throw new Error(
      `Bucket create failed (${created.status}): ${await created.text()}`,
    );
  }
  process.stdout.write(`bucket "${bucket}" created, private\n`);
}

await main();
