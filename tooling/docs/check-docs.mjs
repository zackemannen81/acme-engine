import { execFile as execFileCallback } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

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

const collectionsRoot = path.join(repoRoot, 'docs');
const immutableCitationSources = [
  'docs/JOURNAL.md',
  'docs/finished',
  'docs/adr',
  'docs/acceptance',
];

// A declared naming convention is written for humans. Only these two tokens
// are translated into a pattern; anything else is matched literally.
function namingConventionToRegExp(convention) {
  const translated = convention
    .split(/(NNNN|task-slug)/u)
    .map((part) => {
      if (part === 'NNNN') {
        return '[0-9]{4}';
      }
      if (part === 'task-slug') {
        return '[a-z0-9-]+';
      }
      // Everything else is literal. A single-character class avoids
      // backslash escapes entirely.
      return part.replace(/[^A-Za-z0-9-]/gu, (character) => `[${character}]`);
    })
    .join('');
  return new RegExp(`^${translated}$`, 'u');
}

async function checkCollections() {
  const problems = [];
  const entries = await readdir(collectionsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || excludedDirectories.has(entry.name)) {
      continue;
    }

    const directory = path.join(collectionsRoot, entry.name);
    const collection = `docs/${entry.name}`;

    const members = (await readdir(directory, { withFileTypes: true }))
      .filter(
        (member) =>
          member.isFile() &&
          member.name.endsWith('.md') &&
          member.name !== 'README.md',
      )
      .map((member) => member.name);

    // A directory holding no Markdown records is an asset directory, not a
    // record collection, and declares nothing.
    if (members.length === 0) {
      continue;
    }

    let index;
    try {
      index = await readFile(path.join(directory, 'README.md'), 'utf8');
    } catch {
      problems.push(
        `${collection}/README.md: missing. Every collection under docs/ declares its discoverability mode in a README.`,
      );
      continue;
    }

    const declaration = index.match(
      /^Discoverability:\s*(index|naming convention\s+`([^`]+)`)/mu,
    );
    if (!declaration) {
      problems.push(
        `${collection}/README.md: no "Discoverability:" declaration. Use "index" or "naming convention \`PATTERN\`".`,
      );
      continue;
    }

    const stateRequired = /^Member state:\s*required/mu.test(index);
    const convention = declaration[2]
      ? namingConventionToRegExp(declaration[2])
      : undefined;

    for (const member of members) {
      const relativeFile = `${collection}/${member}`;

      if (convention) {
        if (!convention.test(member)) {
          problems.push(
            `${relativeFile}: does not match the declared naming convention "${declaration[2]}".`,
          );
        }
        // An index names a member either as a link target or as inline code.
      } else if (
        !index.includes(`(${member})`) &&
        !index.includes(`\`${member}\``)
      ) {
        problems.push(
          `${relativeFile}: not listed in ${collection}/README.md, which declares itself an index.`,
        );
      }

      if (stateRequired) {
        const source = await readFile(path.join(directory, member), 'utf8');
        if (!/^\s*[-*]?\s*Status:\s*\S/mu.test(source)) {
          problems.push(
            `${relativeFile}: missing a "Status:" line. A record declares its state in content, never in its filename or location.`,
          );
        }
      }
    }
  }

  return problems;
}

async function git(args) {
  const { stdout } = await execFile('git', args, {
    cwd: repoRoot,
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

// A file cited by append-only or archived documentation keeps its path.
// Renaming one is not repairable: the citations live in records that may not
// be edited. Compared against a base ref rather than the previous commit, so a
// rename cannot pass by being split across two commits on one branch.
async function checkPathStability() {
  let base;
  for (const candidate of ['origin/main', 'main']) {
    try {
      base = (await git(['rev-parse', '--verify', candidate])).trim();
      break;
    } catch {
      base = undefined;
    }
  }

  if (base === undefined) {
    process.stdout.write(
      'Path stability: skipped. Neither origin/main nor main resolves here, so renames cannot be compared.\n',
    );
    return [];
  }

  let renames;
  try {
    renames = await git([
      'diff',
      '--name-status',
      '--find-renames',
      '--diff-filter=R',
      // Two-dot against the working tree, so a rename is caught before it is
      // committed as well as after.
      base,
    ]);
  } catch {
    process.stdout.write(
      'Path stability: skipped. The base ref resolves but the diff could not be computed.\n',
    );
    return [];
  }

  const problems = [];

  for (const line of renames.split('\n')) {
    const [, from, to] = line.split('\t');
    if (from === undefined || to === undefined) {
      continue;
    }

    const basename = path.posix.basename(from);
    if (basename === 'README.md') {
      continue;
    }

    let citedBy;
    try {
      citedBy = await git([
        'grep',
        '--name-only',
        '--fixed-strings',
        basename,
        base,
        '--',
        ...immutableCitationSources,
      ]);
    } catch {
      continue; // git grep exits non-zero when nothing matches
    }

    const sources = citedBy
      .split('\n')
      .filter(Boolean)
      .map((entry) => entry.replace(`${base}:`, ''));

    if (sources.length > 0) {
      problems.push(
        `${from} -> ${to}: renamed although append-only or archived documentation cites it (${sources.slice(0, 3).join(', ')}${sources.length > 3 ? `, +${sources.length - 3} more` : ''}). Those records may not be edited to follow the rename; restore the original path.`,
      );
    }
  }

  return problems;
}

// Documents that describe the present are validated: a path they name must
// exist. Documents that record the past are not. A journal entry or an
// archived task legitimately names a file that has since been removed, and
// making that fail would force edits to records that may not be edited, so
// those findings are reported as warnings instead.
const proseValidatedSurfaces = [
  'AGENTS.md',
  'docs/CURRENT_TASK.md',
  'docs/CURRENT_STATUS.md',
  'docs/SYSTEMDOC.md',
  'docs/FILESTRUCTURE.md',
  'docs/design/',
  'docs/ops/',
  'docs/acceptance/',
];
const proseExemptSurfaces = ['docs/JOURNAL.md', 'docs/finished/', 'docs/adr/'];

function proseSurfaceKind(relativeFile) {
  const file = relativeFile.split(path.sep).join('/');

  // Exemption wins over the collection-index rule below, so the indexes of
  // docs/adr/ and docs/finished/ are exempt too. Their completeness is already
  // enforced by checkCollections and their links by the link check.
  if (proseExemptSurfaces.some((surface) => file.startsWith(surface))) {
    return 'exempt';
  }
  if (proseValidatedSurfaces.some((surface) => file.startsWith(surface))) {
    return 'validated';
  }
  // Collection indexes describe what a directory holds right now.
  if (/^docs\/[^/]+\/README\.md$/u.test(file)) {
    return 'validated';
  }

  return 'ignored';
}

const repositoryRootEntries = new Set(
  (await readdir(repoRoot, { withFileTypes: true })).map((entry) => entry.name),
);

// A citation is a candidate only when it looks like a path from the repository
// root: a real top-level entry, a separator, and a filename whose extension
// starts with a letter. That leaves `packages/core` (no file), `acme-test-plan/1`
// (no extension), `pdfjs-dist/6.2.108` (a version, not an extension) and
// package-relative fragments such as `src/extract.ts` alone. Fragments are
// deliberately unchecked: they name no single file in the repository.
function isPathCandidate(text) {
  if (
    !text.includes('/') ||
    text.includes('://') ||
    text.includes('*') ||
    text.includes(' ') ||
    text.endsWith('/')
  ) {
    return false;
  }

  if (!repositoryRootEntries.has(text.slice(0, text.indexOf('/')))) {
    return false;
  }

  const basename = text.slice(text.lastIndexOf('/') + 1);
  return /^[\w.-]+\.[A-Za-z][A-Za-z\d]*$/u.test(basename);
}

function findProseCitations(source) {
  const citations = [];
  let insideFence = false;

  for (const line of source.split(/\r?\n/u)) {
    if (/^\s{0,3}(`{3,}|~{3,})/u.test(line)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) {
      continue;
    }

    for (const match of line.matchAll(/`([^`\n]+)`/gu)) {
      // Drop a line or anchor suffix before deciding.
      const text = match[1].trim().replace(/[:#].*$/u, '');
      if (isPathCandidate(text)) {
        citations.push(text.replace(/^\.\//u, ''));
      }
    }
  }

  return citations;
}

const errors = [];
const warnings = [];
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

  const surface = proseSurfaceKind(relativeFile);
  if (surface === 'ignored') {
    continue;
  }

  for (const citation of findProseCitations(source)) {
    const candidates = [
      path.resolve(repoRoot, citation),
      path.resolve(path.dirname(file), citation),
    ];

    let exists = false;
    for (const candidate of candidates) {
      try {
        await access(candidate);
        exists = true;
        break;
      } catch {
        // try the next resolution
      }
    }

    if (exists) {
      continue;
    }

    const report = `${relativeFile}: cited path does not exist "${citation}"`;
    if (surface === 'validated') {
      errors.push(report);
    } else {
      warnings.push(`${report} (historical record, not a gate)`);
    }
  }
}

errors.push(...(await checkCollections()));
errors.push(...(await checkPathStability()));

if (warnings.length > 0) {
  process.stdout.write(
    `${warnings.length} stale citation${warnings.length === 1 ? '' : 's'} in records that may not be edited:\n${warnings.join('\n')}\n\n`,
  );
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Checked ${markdownFiles.length} Markdown files for links, fences, collections and cited paths.\n`,
);
