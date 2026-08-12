import { afterEach, describe, expect, it } from 'vitest';

import { createEvidenceArtifactInfrastructure } from '../src/local.js';

const names = [
  'ACME_ARTIFACT_KEK_FILE',
  'ACME_ARTIFACT_KEK_MANIFEST',
  'ACME_ARTIFACT_STORE',
  'ACME_ARTIFACT_S3_ENDPOINT',
  'ACME_ARTIFACT_S3_REGION',
  'ACME_ARTIFACT_S3_BUCKET',
  'ACME_ARTIFACT_S3_ACCESS_KEY_ID',
  'ACME_ARTIFACT_S3_SECRET_FILE',
] as const;
const original = new Map(names.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of names) {
    const value = original.get(name);
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
  }
});

describe('hosted artifact configuration', () => {
  it('refuses startup instead of falling back to local keys or object storage', async () => {
    for (const name of names) Reflect.deleteProperty(process.env, name);
    await expect(
      createEvidenceArtifactInfrastructure({
        basePath: 'unused-hosted-artifact-test',
        hosted: true,
      }),
    ).rejects.toThrow(
      'Hosted artifact storage requires ACME_ARTIFACT_KEK_FILE or ACME_ARTIFACT_KEK_MANIFEST.',
    );
  });
});
