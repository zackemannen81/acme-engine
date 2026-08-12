import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createFileEvidenceArtifactObjectStore } from '../../packages/adapter-evidence-artifact-file/src/index.js';
import { createS3EvidenceArtifactObjectStore } from '../../packages/adapter-evidence-artifact-s3/src/index.js';
import { artifactSha256 } from '../../packages/evidence-artifacts/src/index.js';
import { evidenceArtifactObjectStoreConformance } from '../../packages/evidence-testing/src/index.js';

evidenceArtifactObjectStoreConformance('filesystem', async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'acme-object-conformance-'),
  );
  return {
    store: createFileEvidenceArtifactObjectStore({ root: directory }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
});

evidenceArtifactObjectStoreConformance('S3-compatible', () => {
  const objects = new Map<string, Uint8Array>();
  const mockFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/bucket\/?/u, ''));
    if (request.method === 'PUT') {
      if (objects.has(key)) return new Response(null, { status: 412 });
      objects.set(key, new Uint8Array(await request.arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    if (request.method === 'HEAD') {
      const bytes = objects.get(key);
      return bytes === undefined
        ? new Response(null, { status: 404 })
        : new Response(null, {
            status: 200,
            headers: {
              'content-length': String(bytes.byteLength),
              'x-amz-meta-acme-sha256': artifactSha256(bytes),
            },
          });
    }
    if (request.method === 'GET' && url.searchParams.has('list-type')) {
      const prefix = url.searchParams.get('prefix') ?? '';
      const xml = [...objects.entries()]
        .filter(([objectKey]) => objectKey.startsWith(prefix))
        .map(
          ([objectKey, bytes]) =>
            `<Contents><Key>${objectKey}</Key><Size>${bytes.byteLength}</Size></Contents>`,
        )
        .join('');
      return new Response(`<ListBucketResult>${xml}</ListBucketResult>`, {
        status: 200,
      });
    }
    if (request.method === 'GET') {
      const bytes = objects.get(key);
      return bytes === undefined
        ? new Response(null, { status: 404 })
        : new Response(bytes, {
            status: 200,
            headers: { 'content-length': String(bytes.byteLength) },
          });
    }
    if (request.method === 'DELETE') {
      objects.delete(key);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 500 });
  };
  return {
    store: createS3EvidenceArtifactObjectStore({
      endpoint: 'https://storage.invalid',
      region: 'local',
      bucket: 'bucket',
      accessKeyId: 'server-access',
      secretAccessKey: 'server-secret',
      fetch: mockFetch,
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    }),
  };
});
