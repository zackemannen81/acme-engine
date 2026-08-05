import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  parseFixtureApproval,
  type FixtureApprovalRecord,
} from '../fixture-approval.js';
import {
  BASELINE_VERSION,
  type MeasurementBaseline,
} from '../read-model/measurement.js';
import { isSafeRunId, parseRunRecord, type RunRecord } from '../run-record.js';

/**
 * Interface-owned file storage (ADR-0021).
 *
 * ```text
 * <root>/
 * ├── runs/
 * │   └── <runId>.json
 * ├── baselines/
 * │   └── <name>.json
 * └── approvals/
 *     └── <proposalId>.json
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

export interface WorkspaceApprovals {
  readonly records: readonly FixtureApprovalRecord[];
  /** File names that exist but did not parse as a known record version. */
  readonly unreadable: readonly string[];
}

export interface Workspace {
  readonly root: string;
  recordRun(record: RunRecord): Promise<void>;
  loadRun(runId: string): Promise<RunRecord | null>;
  listRuns(): Promise<WorkspaceHistory>;
  saveBaseline(baseline: MeasurementBaseline): Promise<void>;
  loadBaseline(name: string): Promise<MeasurementBaseline | null>;
  recordApproval(approval: FixtureApprovalRecord): Promise<void>;
  listApprovals(): Promise<WorkspaceApprovals>;
}

const RUNS_DIRECTORY = 'runs';
const BASELINES_DIRECTORY = 'baselines';
const APPROVALS_DIRECTORY = 'approvals';

/**
 * Every identifier the interface turns into a file name goes through here
 * (ADR-0021). Refused before a path exists, so a crafted value cannot escape
 * the root.
 */
function safeFileName(id: string, label: string): string {
  if (!isSafeRunId(id)) {
    throw new Error(
      `A ${label} must be a safe file name: ${JSON.stringify(id)}`,
    );
  }
  return `${id}.json`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBaseline(raw: unknown): MeasurementBaseline | null {
  if (!isObject(raw) || raw['version'] !== BASELINE_VERSION) {
    return null;
  }
  const name = raw['name'];
  const capturedAt = raw['capturedAt'];
  const values = raw['values'];
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    typeof capturedAt !== 'string' ||
    capturedAt.length === 0 ||
    !isObject(values)
  ) {
    return null;
  }
  const parsed: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    parsed[key] = value;
  }
  return {
    version: BASELINE_VERSION,
    name,
    capturedAt,
    values: parsed as MeasurementBaseline['values'],
  };
}

export function createFileWorkspace(options: WorkspaceOptions): Workspace {
  const root = resolve(options.root);
  const runsDirectory = join(root, RUNS_DIRECTORY);
  const baselinesDirectory = join(root, BASELINES_DIRECTORY);
  const approvalsDirectory = join(root, APPROVALS_DIRECTORY);

  async function write(
    directory: string,
    name: string,
    value: unknown,
    exclusive = false,
  ): Promise<void> {
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, name),
      `${JSON.stringify(value, null, 2)}\n`,
      { encoding: 'utf8', flag: exclusive ? 'wx' : 'w' },
    );
  }

  async function readJson(
    directory: string,
    name: string,
  ): Promise<unknown | undefined> {
    try {
      return JSON.parse(
        await readFile(join(directory, name), 'utf8'),
      ) as unknown;
    } catch {
      return undefined;
    }
  }

  return {
    root,

    async recordRun(record) {
      await write(
        runsDirectory,
        safeFileName(record.runId, 'run identifier'),
        record,
        true,
      );
    },

    async loadRun(runId) {
      const raw = await readJson(
        runsDirectory,
        safeFileName(runId, 'run identifier'),
      );
      return raw === undefined ? null : parseRunRecord(raw);
    },

    /**
     * The history index is derived by reading the records, so it cannot
     * disagree with what was written. There is no separate index to update.
     */
    async listRuns() {
      const { records, unreadable } = await collect(
        runsDirectory,
        parseRunRecord,
      );
      return { records, unreadable };
    },

    async saveBaseline(baseline) {
      await write(
        baselinesDirectory,
        safeFileName(baseline.name, 'baseline name'),
        baseline,
      );
    },

    async loadBaseline(name) {
      const raw = await readJson(
        baselinesDirectory,
        safeFileName(name, 'baseline name'),
      );
      return raw === undefined ? null : parseBaseline(raw);
    },

    async recordApproval(approval) {
      await write(
        approvalsDirectory,
        safeFileName(approval.proposalId, 'proposal identifier'),
        approval,
        true,
      );
    },

    async listApprovals() {
      const { records, unreadable } = await collect(
        approvalsDirectory,
        parseFixtureApproval,
      );
      return { records, unreadable };
    },
  };

  /**
   * Read every record in a directory. A file that will not parse is named
   * rather than skipped, so a format change shows up instead of silently
   * shortening what a reviewer sees.
   */
  async function collect<T>(
    directory: string,
    parse: (raw: unknown) => T | null,
  ): Promise<{ readonly records: T[]; readonly unreadable: string[] }> {
    let entries: string[];
    try {
      entries = (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name);
    } catch {
      return { records: [], unreadable: [] };
    }

    const records: T[] = [];
    const unreadable: string[] = [];
    for (const name of [...entries].sort()) {
      const raw = await readJson(directory, name);
      const parsed = raw === undefined ? null : parse(raw);
      if (parsed === null) {
        unreadable.push(name);
      } else {
        records.push(parsed);
      }
    }
    return { records, unreadable };
  }
}
