import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderEvidenceWorkbenchShell } from '@acme/evidence-workbench-web';

async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await files(target)));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}

describe('Evidence auth secret surfaces', () => {
  it('keeps credential/token material out of corpus fixtures and rendered HTML', async () => {
    const fixtureRoot = path.resolve(
      'packages/evidence-testing/fixtures/rillford-annex-review-1',
    );
    const prohibited =
      /(?:access[_-]?token|refresh[_-]?token|session[_-]?token|authorization\s*:\s*bearer|password\s*[:=])/iu;
    for (const file of await files(fixtureRoot)) {
      const content = await readFile(file, 'utf8');
      expect(content, path.relative(fixtureRoot, file)).not.toMatch(prohibited);
    }
    const html = renderEvidenceWorkbenchShell({ caseId: 'case-dev' });
    expect(html).not.toMatch(
      /(?:accessToken|refreshToken|rawToken|sessionKey|localStorage)/u,
    );
  });

  it('keeps startup logging independent of auth configuration and secrets', async () => {
    const source = await readFile(
      path.resolve('apps/evidence-workbench-api/src/local-main.ts'),
      'utf8',
    );
    const outputCalls = source.match(/process\.stdout\.write\([\s\S]*?\);/gu);
    expect(outputCalls).toHaveLength(1);
    expect(outputCalls?.[0]).not.toMatch(
      /(?:process\.env|authCredentials|password|publishable|sessionKey|token)/iu,
    );
  });
});
