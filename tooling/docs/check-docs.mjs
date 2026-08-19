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

// The register allocates task identities. Its value is that a simultaneous
// claim becomes a merge conflict, which only holds while rows are appended in
// strictly ascending order. It carries no status column: task state belongs to
// the active charter and the archive, and a trunk-level statement about active
// work would contradict the one-active-task rule.
const registerColumns = '| Task ID | Title | Owner | Claimed | Work |';

async function checkTaskIdRegister() {
  const problems = [];
  const registerPath = path.join(repoRoot, 'docs', 'TASK_IDS.md');

  let register;
  try {
    register = await readFile(registerPath, 'utf8');
  } catch {
    return ['docs/TASK_IDS.md: missing task identity register'];
  }

  // Compare the whole header line. A substring test would accept an appended
  // column, which is exactly the failure this check exists to prevent.
  const headerLine = register
    .split(/\r?\n/u)
    .find((line) => line.trimEnd().startsWith('| Task ID'));

  if (headerLine === undefined || headerLine.trimEnd() !== registerColumns) {
    problems.push(
      `docs/TASK_IDS.md: the claim table must have exactly the columns "${registerColumns}". A status column would duplicate task state that the active charter and the archive already own.`,
    );
  }

  const floorMatch = register.match(/^Floor:\s*ACME-(\d{4})\s*$/mu);
  if (!floorMatch) {
    problems.push(
      'docs/TASK_IDS.md: no "Floor: ACME-NNNN" line. The floor states which identities predate the register and are addressed by the archive instead.',
    );
    return problems;
  }
  const floor = Number(floorMatch[1]);

  const claimed = [];
  for (const row of register.matchAll(/^\|\s*ACME-(\d{4})\s*\|/gmu)) {
    claimed.push(Number(row[1]));
  }

  if (claimed.length === 0) {
    problems.push('docs/TASK_IDS.md: the claim table has no rows');
    return problems;
  }

  for (let index = 1; index < claimed.length; index += 1) {
    if (claimed[index] <= claimed[index - 1]) {
      problems.push(
        `docs/TASK_IDS.md: ACME-${String(claimed[index]).padStart(4, '0')} is listed after ACME-${String(claimed[index - 1]).padStart(4, '0')}. Claims are appended in strictly ascending order; an out-of-order or duplicate row means two claims merged cleanly when they should have conflicted.`,
      );
    }
  }

  const claimedSet = new Set(claimed);

  const archived = await readdir(path.join(repoRoot, 'docs', 'finished'));
  for (const entry of archived) {
    const archivedId = entry.match(/^ACME-(\d{4})_/u);
    if (!archivedId) {
      continue;
    }
    const id = Number(archivedId[1]);
    if (id >= floor && !claimedSet.has(id)) {
      problems.push(
        `docs/finished/${entry}: ACME-${archivedId[1]} is archived but never claimed in docs/TASK_IDS.md.`,
      );
    }
  }

  const activeTask = await readFile(
    path.join(repoRoot, 'docs', 'CURRENT_TASK.md'),
    'utf8',
  );
  const activeId = activeTask.match(/^Task ID:\s*ACME-(\d{4})\s*$/mu);
  if (activeId && !claimedSet.has(Number(activeId[1]))) {
    problems.push(
      `docs/CURRENT_TASK.md: ACME-${activeId[1]} is the active task but has no claim in docs/TASK_IDS.md. Claim the identity and merge it before freezing the charter.`,
    );
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
  'docs/CURRENT_STATUS.md',
  'docs/SYSTEMDOC.md',
  'docs/FILESTRUCTURE.md',
  'docs/design/',
  'docs/ops/',
  'docs/acceptance/',
];
// docs/CURRENT_TASK.md is exempt for the mirror image of the reason the
// archive is: a charter names its deliverables before they exist, the way a
// journal entry names files after they are gone. Both legitimately cite paths
// that do not exist now.
const proseExemptSurfaces = [
  'docs/JOURNAL.md',
  'docs/finished/',
  'docs/adr/',
  'docs/CURRENT_TASK.md',
];

function proseSurfaceKind(relativeFile) {
  const file = relativeFile.split(path.sep).join('/');

  if (file === 'docs/CURRENT_TASK.md') {
    return 'planned';
  }
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
    } else if (surface === 'planned') {
      warnings.push(`${report} (active charter, not yet created)`);
    } else {
      warnings.push(`${report} (historical record, not a gate)`);
    }
  }
}

errors.push(...(await checkCollections()));
errors.push(...(await checkTaskIdRegister()));
errors.push(...(await checkPathStability()));

if (warnings.length > 0) {
  process.stdout.write(
    `${warnings.length} cited path${warnings.length === 1 ? '' : 's'} that do not exist, reported without gating:\n${warnings.join('\n')}\n\n`,
  );
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Checked ${markdownFiles.length} Markdown files for links, fences, collections and cited paths.\n`,
);
