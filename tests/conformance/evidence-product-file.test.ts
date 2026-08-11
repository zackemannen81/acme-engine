import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll } from 'vitest';

import { createFileEvidenceProductRepository } from '../../packages/adapter-evidence-product-file/src/index.js';
import {
  evidencePrimaryViewConformance,
  evidenceProductRepositoryConformance,
} from '../../packages/evidence-testing/src/product-conformance.js';

const root = mkdtempSync(
  path.join(os.tmpdir(), 'evidence-product-conformance-'),
);
let next = 0;
const createRepository = () =>
  createFileEvidenceProductRepository({
    filePath: path.join(root, `repository-${String(++next)}.json`),
  });

afterAll(() => rmSync(root, { recursive: true, force: true }));

evidenceProductRepositoryConformance({ createRepository });
evidencePrimaryViewConformance({ createRepository });
