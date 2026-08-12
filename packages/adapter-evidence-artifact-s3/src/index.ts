import { createHash, createHmac } from 'node:crypto';

import {
  artifactSha256,
  type EvidenceArtifactObjectStat,
  type EvidenceArtifactObjectStore,
} from '@acme/evidence-artifacts';

export interface EvidenceArtifactS3Options {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
}

const hash = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');
const hmac = (key: string | Uint8Array, value: string): Buffer =>
  createHmac('sha256', key).update(value).digest();

function safe(value: string, label: string): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,500}$/u.test(value) ||
    value.includes('..')
  )
    throw new Error(`S3 artifact ${label} is invalid.`);
  return value;
}

function isoBasic(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/gu, '');
}

function encodedPath(value: string): string {
  return value.split('/').map(encodeURIComponent).join('/');
}

function parseXmlValues(xml: string, tag: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gu');
  for (const match of xml.matchAll(pattern))
    values.push(
      (match[1] ?? '')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>'),
    );
  return values;
}

export function createS3EvidenceArtifactObjectStore(
  options: EvidenceArtifactS3Options,
): EvidenceArtifactObjectStore {
  const endpoint = new URL(options.endpoint.replace(/\/$/u, ''));
  const bucket = safe(options.bucket, 'bucket');
  const requestFetch = options.fetch ?? globalThis.fetch;

  async function request(input: {
    readonly method: string;
    readonly objectKey?: string;
    readonly query?: Readonly<Record<string, string>>;
    readonly body?: Uint8Array;
    readonly headers?: Readonly<Record<string, string>>;
  }): Promise<Response> {
    const now = options.now?.() ?? new Date();
    const timestamp = isoBasic(now);
    const date = timestamp.slice(0, 8);
    const keyPath =
      input.objectKey === undefined
        ? bucket
        : `${bucket}/${safe(input.objectKey, 'key')}`;
    const basePath = endpoint.pathname.replace(/\/$/u, '');
    const canonicalUri = `${basePath}/${encodedPath(keyPath)}`;
    const parameters = new URLSearchParams(input.query ?? {});
    parameters.sort();
    const canonicalQuery = parameters.toString().replaceAll('+', '%20');
    const payloadHash = hash(input.body ?? new Uint8Array());
    const host = endpoint.host;
    const extra = Object.entries(input.headers ?? {}).map(
      ([name, value]) => [name.toLowerCase(), value.trim()] as const,
    );
    const canonicalHeaders = [
      ['host', host] as const,
      ['x-amz-content-sha256', payloadHash] as const,
      ['x-amz-date', timestamp] as const,
      ...extra,
    ].sort(([a], [b]) => a.localeCompare(b));
    const signedHeaders = canonicalHeaders.map(([name]) => name).join(';');
    const canonicalRequest = [
      input.method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders.map(([name, value]) => `${name}:${value}\n`).join(''),
      signedHeaders,
      payloadHash,
    ].join('\n');
    const scope = `${date}/${options.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timestamp,
      scope,
      hash(canonicalRequest),
    ].join('\n');
    const signingKey = hmac(
      hmac(
        hmac(hmac(`AWS4${options.secretAccessKey}`, date), options.region),
        's3',
      ),
      'aws4_request',
    );
    const signature = hmac(signingKey, stringToSign).toString('hex');
    const headers = new Headers(input.headers);
    headers.set('host', host);
    headers.set('x-amz-content-sha256', payloadHash);
    headers.set('x-amz-date', timestamp);
    headers.set(
      'authorization',
      `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    );
    const url = new URL(endpoint);
    url.pathname = canonicalUri;
    url.search = canonicalQuery;
    return requestFetch(url, {
      method: input.method,
      headers,
      ...(input.body === undefined ? {} : { body: Buffer.from(input.body) }),
    });
  }

  async function statObject(
    objectKey: string,
  ): Promise<EvidenceArtifactObjectStat | null> {
    const response = await request({ method: 'HEAD', objectKey });
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`S3 artifact stat failed (${response.status}).`);
    const byteLength = Number(response.headers.get('content-length'));
    const sha256 = response.headers.get('x-amz-meta-acme-sha256');
    if (!Number.isSafeInteger(byteLength) || byteLength < 0 || sha256 === null)
      throw new Error('S3 artifact stat metadata is incomplete.');
    return { objectKey, byteLength, sha256 };
  }

  return {
    async create(objectKey, bytes) {
      const response = await request({
        method: 'PUT',
        objectKey,
        body: bytes,
        headers: {
          'if-none-match': '*',
          'content-type': 'application/octet-stream',
          'x-amz-meta-acme-sha256': artifactSha256(bytes),
        },
      });
      if (response.status === 409 || response.status === 412)
        throw new Error('Artifact object already exists.');
      if (!response.ok)
        throw new Error(`S3 artifact create failed (${response.status}).`);
      return {
        objectKey,
        byteLength: bytes.byteLength,
        sha256: artifactSha256(bytes),
      };
    },
    stat: statObject,
    async read(objectKey, maximumBytes) {
      const response = await request({ method: 'GET', objectKey });
      if (!response.ok)
        throw new Error(`S3 artifact read failed (${response.status}).`);
      const advertised = Number(response.headers.get('content-length'));
      if (Number.isFinite(advertised) && advertised > maximumBytes)
        throw new Error('Artifact object exceeds the read bound.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maximumBytes)
        throw new Error('Artifact object exceeds the read bound.');
      return bytes;
    },
    async delete(objectKey) {
      const response = await request({ method: 'DELETE', objectKey });
      if (!response.ok && response.status !== 404)
        throw new Error(`S3 artifact delete failed (${response.status}).`);
    },
    async list(prefix, limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000)
        throw new Error('Artifact list bound is invalid.');
      const response = await request({
        method: 'GET',
        query: { 'list-type': '2', prefix, 'max-keys': String(limit) },
      });
      if (!response.ok)
        throw new Error(`S3 artifact list failed (${response.status}).`);
      const xml = await response.text();
      const keys = parseXmlValues(xml, 'Key');
      const sizes = parseXmlValues(xml, 'Size');
      const output: EvidenceArtifactObjectStat[] = [];
      for (let index = 0; index < keys.length; index += 1) {
        const objectKey = keys[index];
        if (objectKey === undefined) continue;
        const value = await statObject(objectKey);
        if (value === null) continue;
        const size = Number(sizes[index]);
        output.push(
          Number.isSafeInteger(size) ? { ...value, byteLength: size } : value,
        );
      }
      return output;
    },
  };
}
