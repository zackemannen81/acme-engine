import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createFileEvidenceArtifactObjectStore } from '../src/index.js';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

it('exclusively stores, bounds, lists and deletes artifact objects without traversal', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'acme-artifacts-'));
  roots.push(root);
  const store = createFileEvidenceArtifactObjectStore({
    root,
    randomSuffix: () => 'fixed',
  });
  const bytes = Buffer.from('encrypted bytes');
  const created = await store.create('cases/case-a/object-a', bytes);
  expect(created.byteLength).toBe(bytes.byteLength);
  await expect(store.create('cases/case-a/object-a', bytes)).rejects.toThrow(
    'already exists',
  );
  await expect(store.read('cases/case-a/object-a', 2)).rejects.toThrow('bound');
  expect(await store.read('cases/case-a/object-a', 100)).toEqual(bytes);
  expect(await store.list('cases/case-a', 10)).toEqual([created]);
  await expect(store.read('../escape', 100)).rejects.toThrow('invalid');
  await store.delete('cases/case-a/object-a');
  expect(await store.stat('cases/case-a/object-a')).toBeNull();
});
