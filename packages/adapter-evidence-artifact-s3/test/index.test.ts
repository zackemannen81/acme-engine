import { expect, it } from 'vitest';

import { artifactSha256 } from '@acme/evidence-artifacts';

import { createS3EvidenceArtifactObjectStore } from '../src/index.js';

it('uses signed server-side S3 requests for the bounded object contract', async () => {
  const objects = new Map<string, Uint8Array>();
  const digests = new Map<string, string>();
  const requests: Request[] = [];
  const mockFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    const url = new URL(request.url);
    const marker = '/bucket/';
    const key = decodeURIComponent(
      url.pathname.slice(url.pathname.indexOf(marker) + marker.length),
    );
    if (url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') ?? '';
      const content = [...objects]
        .filter(([item]) => item.startsWith(prefix))
        .map(
          ([item, bytes]) =>
            `<Contents><Key>${item}</Key><Size>${bytes.byteLength}</Size></Contents>`,
        )
        .join('');
      return new Response(`<ListBucketResult>${content}</ListBucketResult>`);
    }
    if (request.method === 'PUT') {
      if (objects.has(key)) return new Response('', { status: 412 });
      const bytes = new Uint8Array(await request.arrayBuffer());
      objects.set(key, bytes);
      digests.set(key, request.headers.get('x-amz-meta-acme-sha256') ?? '');
      return new Response('', { status: 200 });
    }
    if (request.method === 'HEAD') {
      const bytes = objects.get(key);
      return bytes === undefined
        ? new Response(null, { status: 404 })
        : new Response(null, {
            status: 200,
            headers: {
              'content-length': String(bytes.byteLength),
              'x-amz-meta-acme-sha256': digests.get(key) ?? '',
            },
          });
    }
    if (request.method === 'GET') {
      const bytes = objects.get(key);
      return bytes === undefined
        ? new Response('', { status: 404 })
        : new Response(bytes, {
            headers: { 'content-length': String(bytes.byteLength) },
          });
    }
    if (request.method === 'DELETE') {
      objects.delete(key);
      digests.delete(key);
      return new Response(null, { status: 204 });
    }
    return new Response('', { status: 500 });
  };
  const store = createS3EvidenceArtifactObjectStore({
    endpoint: 'https://storage.example.test/storage/v1/s3',
    region: 'test-region',
    bucket: 'bucket',
    accessKeyId: 'server-access',
    secretAccessKey: 'server-secret',
    fetch: mockFetch,
    now: () => new Date('2026-08-12T00:00:00.000Z'),
  });
  const bytes = Buffer.from('ciphertext');
  expect(await store.create('cases/case-a/object-a', bytes)).toEqual({
    objectKey: 'cases/case-a/object-a',
    byteLength: bytes.byteLength,
    sha256: artifactSha256(bytes),
  });
  expect(Buffer.from(await store.read('cases/case-a/object-a', 100))).toEqual(
    bytes,
  );
  expect(await store.list('cases/case-a', 10)).toHaveLength(1);
  await expect(store.create('cases/case-a/object-a', bytes)).rejects.toThrow(
    'already exists',
  );
  await store.delete('cases/case-a/object-a');
  expect(await store.stat('cases/case-a/object-a')).toBeNull();
  expect(
    requests.every((item) =>
      item.headers.get('authorization')?.startsWith('AWS4-HMAC-SHA256'),
    ),
  ).toBe(true);
  expect(requests.every((item) => !item.url.includes('server-secret'))).toBe(
    true,
  );
});
