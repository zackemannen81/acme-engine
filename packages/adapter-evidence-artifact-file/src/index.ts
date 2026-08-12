import {
  link,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  artifactSha256,
  type EvidenceArtifactObjectStat,
  type EvidenceArtifactObjectStore,
} from '@acme/evidence-artifacts';

function safeKey(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{0,500}$/u.test(value))
    throw new Error('Artifact object key is invalid.');
  const parts = value.split('/');
  if (parts.some((item) => item.length === 0 || item === '.' || item === '..'))
    throw new Error('Artifact object key is invalid.');
  return value;
}

function objectPath(root: string, key: string): string {
  const resolved = path.resolve(root, ...safeKey(key).split('/'));
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(prefix))
    throw new Error('Artifact path escaped root.');
  return resolved;
}

async function objectStat(
  root: string,
  key: string,
): Promise<EvidenceArtifactObjectStat | null> {
  const file = objectPath(root, key);
  try {
    const info = await stat(file);
    if (!info.isFile())
      throw new Error('Artifact object is not a regular file.');
    const bytes = await readFile(file);
    return {
      objectKey: key,
      byteLength: bytes.byteLength,
      sha256: artifactSha256(bytes),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function walk(
  root: string,
  directory: string,
  prefix: string,
  limit: number,
  output: EvidenceArtifactObjectStat[],
): Promise<void> {
  if (output.length >= limit) return;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (output.length >= limit) return;
    if (entry.isSymbolicLink())
      throw new Error('Artifact store contains a symlink.');
    const absolute = path.join(directory, entry.name);
    const key = path.relative(root, absolute).split(path.sep).join('/');
    if (entry.isDirectory()) await walk(root, absolute, prefix, limit, output);
    else if (entry.isFile() && key.startsWith(prefix)) {
      const value = await objectStat(root, key);
      if (value !== null) output.push(value);
    }
  }
}

export function createFileEvidenceArtifactObjectStore(options: {
  readonly root: string;
  readonly randomSuffix?: () => string;
}): EvidenceArtifactObjectStore {
  const root = path.resolve(options.root);
  return {
    async create(objectKey, bytes) {
      const key = safeKey(objectKey);
      const target = objectPath(root, key);
      await mkdir(path.dirname(target), { recursive: true });
      const suffix = options.randomSuffix?.() ?? randomUUID();
      const temporary = `${target}.${suffix}.staging`;
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await link(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          throw new Error('Artifact object already exists.', { cause: error });
        throw error;
      } finally {
        await rm(temporary, { force: true });
      }
      const created = await objectStat(root, key);
      if (created === null)
        throw new Error('Artifact object creation was lost.');
      return created;
    },
    stat: (objectKey) => objectStat(root, safeKey(objectKey)),
    async read(objectKey, maximumBytes) {
      if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0)
        throw new Error('Artifact read bound is invalid.');
      const file = objectPath(root, safeKey(objectKey));
      const info = await stat(file);
      if (!info.isFile() || info.size > maximumBytes)
        throw new Error('Artifact object exceeds the read bound.');
      return readFile(file);
    },
    async delete(objectKey) {
      await rm(objectPath(root, safeKey(objectKey)), { force: true });
    },
    async list(prefix, limit) {
      const safePrefix = prefix.length === 0 ? '' : safeKey(prefix);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000)
        throw new Error('Artifact list bound is invalid.');
      await mkdir(root, { recursive: true });
      const output: EvidenceArtifactObjectStat[] = [];
      await walk(root, root, safePrefix, limit, output);
      return output;
    },
  };
}
