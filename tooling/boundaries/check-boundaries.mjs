import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const configPath = path.join(repoRoot, 'dependency-cruiser.config.mjs');
const dependencyCruiserCli = path.join(
  repoRoot,
  'node_modules/dependency-cruiser/bin/dependency-cruise.mjs',
);
const coreFixturePath = path.join(
  repoRoot,
  'tooling/boundaries/fixtures/packages/core/src/forbidden.ts',
);
const moduleFixturePath = path.join(
  repoRoot,
  'tooling/boundaries/fixtures/packages/module-fixture/src/forbidden.ts',
);
const crossModuleFixturePath = path.join(
  repoRoot,
  'tooling/boundaries/fixtures/packages/module-fixture/src/forbidden-module.ts',
);
const driverFixturePath = path.join(
  repoRoot,
  'tooling/boundaries/fixtures/packages/core/src/forbidden-driver.ts',
);
const coreSourcePath = path.join(repoRoot, 'packages/core/src');
const providerFixturePath = path.join(
  repoRoot,
  'tooling/boundaries/fixtures/packages/core/src/forbidden-provider.ts',
);
const forbiddenTerms = [
  'narrative',
  'research',
  'chapter',
  'character',
  'claim',
  'outline',
  'scene',
  'story',
  'openai',
  'anthropic',
  'gemini',
];

function runDependencyCruiser(inputs) {
  return spawnSync(
    process.execPath,
    [
      dependencyCruiserCli,
      ...inputs,
      '--config',
      configPath,
      '--output-type',
      'err',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );
}

async function findTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findTypeScriptFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath);
    }
  }

  return files;
}

async function verifyCoreVocabulary() {
  const violations = [];
  const files = await findTypeScriptFiles(coreSourcePath);

  for (const file of files) {
    if (file.endsWith('.test.ts')) {
      continue;
    }

    const source = await readFile(file, 'utf8');
    for (const term of forbiddenTerms) {
      const pattern = new RegExp(`\\b${term}\\b`, 'iu');
      if (pattern.test(source)) {
        violations.push(
          `${path.relative(repoRoot, file)} contains forbidden term "${term}"`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(violations.join('\n'));
  }
}

const workspaceResult = runDependencyCruiser(['packages', 'apps']);
if (workspaceResult.status !== 0) {
  process.stderr.write(workspaceResult.stdout);
  process.stderr.write(workspaceResult.stderr);
  process.exit(workspaceResult.status ?? 1);
}

await verifyCoreVocabulary();

function verifyForbiddenFixture(fixturePath, expectedRule) {
  const fixtureResult = runDependencyCruiser([fixturePath]);
  const fixtureOutput = `${fixtureResult.stdout}${fixtureResult.stderr}`;
  if (fixtureResult.status === 0 || !fixtureOutput.includes(expectedRule)) {
    process.stderr.write(fixtureOutput);
    throw new Error(
      `The forbidden-boundary fixture did not fail for ${expectedRule}.`,
    );
  }
}

verifyForbiddenFixture(coreFixturePath, 'core-is-domain-neutral');
verifyForbiddenFixture(
  moduleFixturePath,
  'domain-modules-do-not-depend-on-apps-adapters-or-testing',
);
verifyForbiddenFixture(
  crossModuleFixturePath,
  'domain-modules-do-not-depend-on-other-modules',
);
verifyForbiddenFixture(
  providerFixturePath,
  'provider-wire-shapes-stay-behind-their-adapter',
);
verifyForbiddenFixture(
  driverFixturePath,
  'sqlite-driver-stays-behind-its-adapter',
);

process.stdout.write(
  'Dependency graph, core vocabulary, and forbidden core/module/cross-module/provider/driver fixture checks passed.\n',
);
