import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const excludedDirectories = new Set(['.git', 'dist', 'node_modules']);

async function findMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
}

function findLinkTargets(source) {
  const targets = [];
  const inlineLink = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  const referenceLink = /^\[[^\]]+\]:\s*(\S+)/gmu;

  for (const match of source.matchAll(inlineLink)) {
    targets.push(match[1]);
  }
  for (const match of source.matchAll(referenceLink)) {
    targets.push(match[1]);
  }

  return targets;
}

function normalizeLinkTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().split(/\s+["']/u, 1)[0];
  const withoutBrackets =
    withoutTitle.startsWith('<') && withoutTitle.endsWith('>')
      ? withoutTitle.slice(1, -1)
      : withoutTitle;
  return decodeURIComponent(withoutBrackets.split('#', 1)[0]);
}

function hasBalancedFences(source) {
  let marker;

  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/u);
    if (!match) {
      continue;
    }

    const currentMarker = match[1][0];
    if (marker === undefined) {
      marker = currentMarker;
    } else if (marker === currentMarker) {
      marker = undefined;
    }
  }

  return marker === undefined;
}

async function checkBacklogIndex() {
  const backlogDirectory = path.join(repoRoot, 'docs', 'backlog');
  const problems = [];

  let index;
  try {
    index = await readFile(path.join(backlogDirectory, 'README.md'), 'utf8');
  } catch {
    return ['docs/backlog/README.md: missing backlog index'];
  }

  const entries = await readdir(backlogDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith('.md') ||
      entry.name === 'README.md'
    ) {
      continue;
    }

    const relativeFile = `docs/backlog/${entry.name}`;
    const source = await readFile(
      path.join(backlogDirectory, entry.name),
      'utf8',
    );

    if (!/^Status:\s*\S/mu.test(source)) {
      problems.push(
        `${relativeFile}: missing a "Status:" line. A proposal declares its state in content, never in its filename or location.`,
      );
    }

    if (!index.includes(`(${entry.name})`)) {
      problems.push(
        `${relativeFile}: not listed in docs/backlog/README.md, which is the index readers use to see what is open.`,
      );
    }
  }

  return problems;
}

const errors = [];
const markdownFiles = await findMarkdownFiles(repoRoot);

for (const file of markdownFiles) {
  const source = await readFile(file, 'utf8');
  const relativeFile = path.relative(repoRoot, file);

  if (!hasBalancedFences(source)) {
    errors.push(`${relativeFile}: unbalanced Markdown fence`);
  }

  for (const rawTarget of findLinkTargets(source)) {
    if (rawTarget.startsWith('#') || /^[a-z][a-z\d+.-]*:/iu.test(rawTarget)) {
      continue;
    }

    const target = normalizeLinkTarget(rawTarget);
    if (target.length === 0) {
      continue;
    }

    const resolvedTarget = path.resolve(path.dirname(file), target);
    try {
      await access(resolvedTarget);
    } catch {
      errors.push(`${relativeFile}: missing link target "${rawTarget}"`);
    }
  }
}

errors.push(...(await checkBacklogIndex()));

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Checked ${markdownFiles.length} Markdown files for links and fences.\n`,
);
