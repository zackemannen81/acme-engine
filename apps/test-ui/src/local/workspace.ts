import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { isSafeRunId, parseRunRecord, type RunRecord } from '../run-record.js';

/**
 * Interface-owned file storage (ADR-0021).
 *
 * ```text
 * <root>/
 * └── runs/
 *     └── <runId>.json
 * ```
 *
 * Nothing here is canonical. The engine never reads these files and the
 * interface never writes the engine's, so deleting the root loses run history
 * and no canonical fact.
 */

export interface WorkspaceOptions {
  /** Directory the interface owns. Never the ledger's location. */
  readonly root: string;
}

export interface WorkspaceHistory {
  readonly records: readonly RunRecord[];
  /** File names that exist but did not parse as a known record version. */
  readonly unreadable: readonly string[];
}

export interface Workspace {
  readonly root: string;
  recordRun(record: RunRecord): Promise<void>;
  loadRun(runId: string): Promise<RunRecord | null>;
  listRuns(): Promise<WorkspaceHistory>;
}

const RUNS_DIRECTORY = 'runs';

function runFileName(runId: string): string {
  if (!isSafeRunId(runId)) {
    // Refused before a path exists, so a crafted identifier cannot escape.
    throw new Error(
      `A run identifier must be a safe file name: ${JSON.stringify(runId)}`,
    );
  }
  return `${runId}.json`;
}

export function createFileWorkspace(options: WorkspaceOptions): Workspace {
  const root = resolve(options.root);
  const runsDirectory = join(root, RUNS_DIRECTORY);

  return {
    root,

    async recordRun(record) {
      const name = runFileName(record.runId);
      await mkdir(runsDirectory, { recursive: true });
      await writeFile(
        join(runsDirectory, name),
        `${JSON.stringify(record, null, 2)}\n`,
        'utf8',
      );
    },

    async loadRun(runId) {
      const name = runFileName(runId);
      let raw: string;
      try {
        raw = await readFile(join(runsDirectory, name), 'utf8');
      } catch {
        return null;
      }
      try {
        return parseRunRecord(JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },

    /**
     * The history index is derived by reading the records, so it cannot
     * disagree with what was written. There is no separate index to update.
     */
    async listRuns() {
      let entries: string[];
      try {
        entries = (await readdir(runsDirectory, { withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => entry.name);
      } catch {
        return { records: [], unreadable: [] };
      }

      const records: RunRecord[] = [];
      const unreadable: string[] = [];
      for (const name of [...entries].sort()) {
        let parsed: RunRecord | null;
        try {
          const raw = await readFile(join(runsDirectory, name), 'utf8');
          parsed = parseRunRecord(JSON.parse(raw) as unknown);
        } catch {
          parsed = null;
        }
        if (parsed === null) {
          unreadable.push(name);
        } else {
          records.push(parsed);
        }
      }
      return { records, unreadable };
    },
  };
}
