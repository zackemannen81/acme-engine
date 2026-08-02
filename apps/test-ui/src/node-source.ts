import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { comparePaths } from './catalog/paths.js';
import type {
  CatalogDiagnostic,
  DiscoveredFixtureFile,
  DiscoveredScenarioFile,
} from './read-model/catalog.js';

/**
 * Node discovery source for the catalog (ADR-0019).
 *
 * This is a separate entry point on purpose. The package's default surface
 * performs no I/O, so the read model stays assertable without a disk, and
 * only a caller that actually wants to walk a tree pulls this module in.
 *
 * Discovery is bounded, refuses to follow symbolic links and never leaves the
 * configured root. A bound that is hit is reported as a diagnostic rather
 * than silently truncating the catalog.
 */

export interface DiscoveryLimits {
  /** Maximum directory nesting below the root. */
  readonly maxDepth?: number;
  /** Maximum files collected in total. */
  readonly maxFiles?: number;
  /** Maximum bytes read for one scenario document. */
  readonly maxFileBytes?: number;
}

export interface DiscoveryOptions extends DiscoveryLimits {
  /** Absolute or process-relative directory to walk. */
  readonly directory: string;
  /**
   * The label the catalog renders. Defaults to the directory as given, so a
   * caller that passes an absolute path gets it back — pass a repo-relative
   * label to keep machine paths out of the view.
   */
  readonly root?: string;
}

export const DISCOVERY_DIAGNOSTIC = {
  depthExceeded: 'DISCOVERY_DEPTH_EXCEEDED',
  fileLimitExceeded: 'DISCOVERY_FILE_LIMIT_EXCEEDED',
  symlinkSkipped: 'DISCOVERY_SYMLINK_SKIPPED',
  unreadableDirectory: 'DISCOVERY_DIRECTORY_UNREADABLE',
  unreadableFile: 'DISCOVERY_FILE_UNREADABLE',
  undecodableScenario: 'DISCOVERY_SCENARIO_NOT_DECODABLE',
  fileTooLarge: 'DISCOVERY_FILE_TOO_LARGE',
} as const;

export interface DiscoveryResult {
  readonly root: string;
  readonly scenarios: readonly DiscoveredScenarioFile[];
  readonly fixtures: readonly DiscoveredFixtureFile[];
  readonly diagnostics: readonly CatalogDiagnostic[];
}

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_FILES = 2_000;
const DEFAULT_MAX_FILE_BYTES = 1_000_000;

function isScenarioFile(name: string): boolean {
  return name.endsWith('.yaml') || name.endsWith('.yml');
}

function isFixtureFile(name: string): boolean {
  return name.endsWith('.json');
}

/**
 * Walk `directory` and classify what it holds.
 *
 * Symbolic links are skipped rather than followed. That is what keeps the
 * walk free of cycles and inside the root: a link cannot be resolved out of
 * the tree if it is never resolved at all.
 */
export async function discoverCatalogSources(
  options: DiscoveryOptions,
): Promise<DiscoveryResult> {
  const base = resolve(options.directory);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  const diagnostics: CatalogDiagnostic[] = [];
  const scenarioPaths: string[] = [];
  const fixturePaths: string[] = [];
  let collected = 0;
  let limitReported = false;

  async function walk(
    absolute: string,
    relative: string,
    depth: number,
  ): Promise<void> {
    if (depth > maxDepth) {
      diagnostics.push({
        code: DISCOVERY_DIAGNOSTIC.depthExceeded,
        severity: 'warning',
        detail: { path: relative, maxDepth },
      });
      return;
    }

    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch {
      diagnostics.push({
        code: DISCOVERY_DIAGNOSTIC.unreadableDirectory,
        severity: 'warning',
        detail: { path: relative },
      });
      return;
    }

    // Sorted here so the walk order, and therefore which files a hit limit
    // drops, is the same on every platform and every run.
    for (const entry of [...entries].sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )) {
      const childRelative =
        relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        diagnostics.push({
          code: DISCOVERY_DIAGNOSTIC.symlinkSkipped,
          severity: 'info',
          detail: { path: childRelative },
        });
        continue;
      }
      if (entry.isDirectory()) {
        await walk(join(absolute, entry.name), childRelative, depth + 1);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (collected >= maxFiles) {
        if (!limitReported) {
          diagnostics.push({
            code: DISCOVERY_DIAGNOSTIC.fileLimitExceeded,
            severity: 'warning',
            detail: { maxFiles },
          });
          limitReported = true;
        }
        continue;
      }
      if (isScenarioFile(entry.name)) {
        scenarioPaths.push(childRelative);
        collected += 1;
      } else if (isFixtureFile(entry.name)) {
        fixturePaths.push(childRelative);
        collected += 1;
      }
    }
  }

  await walk(base, '', 0);

  const scenarios: DiscoveredScenarioFile[] = [];
  for (const path of [...scenarioPaths].sort(comparePaths)) {
    let raw: string;
    try {
      raw = await readFile(join(base, ...path.split('/')), 'utf8');
    } catch {
      diagnostics.push({
        code: DISCOVERY_DIAGNOSTIC.unreadableFile,
        severity: 'warning',
        detail: { path },
      });
      continue;
    }
    if (raw.length > maxFileBytes) {
      diagnostics.push({
        code: DISCOVERY_DIAGNOSTIC.fileTooLarge,
        severity: 'warning',
        detail: { path, maxFileBytes },
      });
      continue;
    }
    let document: unknown;
    try {
      document = parseYaml(raw) as unknown;
    } catch (error: unknown) {
      // Decoding is not validation. A file that is not YAML never reaches the
      // scenario validator, so it is reported here instead of being rendered
      // as an invalid scenario the validator never saw.
      diagnostics.push({
        code: DISCOVERY_DIAGNOSTIC.undecodableScenario,
        severity: 'warning',
        detail: {
          path,
          message: error instanceof Error ? error.message : 'not decodable',
        },
      });
      continue;
    }
    scenarios.push({ path, document });
  }

  return {
    root: options.root ?? options.directory,
    scenarios,
    fixtures: [...fixturePaths]
      .sort(comparePaths)
      .map((path) => ({ path }) satisfies DiscoveredFixtureFile),
    diagnostics,
  };
}
