/**
 * Pure path rules for catalog discovery (ADR-0019).
 *
 * A scenario names its fixtures by relative path. The catalog resolves those
 * names so a reviewer can see which resolve, which are missing and which try
 * to leave the configured root — the same refusal `apps/cli/src/scenario.ts`
 * applies before a run, applied here before a render.
 *
 * These functions touch no filesystem and no `node:path`, so they behave
 * identically on every platform and every result is deterministic.
 */

export const PATH_REFUSAL = {
  /** The reference was empty or only separators. */
  empty: 'PATH_EMPTY',
  /** An absolute path, a drive letter or a UNC share. */
  absolute: 'PATH_ABSOLUTE',
  /** `..` segments would leave the configured root. */
  escapesRoot: 'PATH_ESCAPES_ROOT',
} as const;

export type PathRefusalReason =
  (typeof PATH_REFUSAL)[keyof typeof PATH_REFUSAL];

export type ResolvedReference =
  | { readonly status: 'resolved'; readonly path: string }
  | { readonly status: 'refused'; readonly reason: PathRefusalReason };

const DRIVE_LETTER = /^[a-z]:/iu;

function isAbsolute(reference: string): boolean {
  return (
    reference.startsWith('/') ||
    reference.startsWith('\\') ||
    DRIVE_LETTER.test(reference)
  );
}

/**
 * Normalize a root-relative reference to POSIX form.
 *
 * Windows separators are accepted because a scenario authored on Windows may
 * contain them, but the normalized output is always `/` separated so the view
 * renders the same bytes everywhere.
 */
export function resolveReference(reference: string): ResolvedReference {
  if (reference.trim().length === 0) {
    return { status: 'refused', reason: PATH_REFUSAL.empty };
  }
  if (isAbsolute(reference)) {
    return { status: 'refused', reason: PATH_REFUSAL.absolute };
  }

  const segments: string[] = [];
  for (const raw of reference.split(/[/\\]+/u)) {
    if (raw.length === 0 || raw === '.') {
      continue;
    }
    if (raw === '..') {
      if (segments.length === 0) {
        return { status: 'refused', reason: PATH_REFUSAL.escapesRoot };
      }
      segments.pop();
      continue;
    }
    segments.push(raw);
  }

  if (segments.length === 0) {
    return { status: 'refused', reason: PATH_REFUSAL.empty };
  }
  return { status: 'resolved', path: segments.join('/') };
}

/**
 * Normalize a path a discovery source already produced below the root.
 * Returns `null` when the source handed back something that cannot be a
 * root-relative path, which is a defect in the source, not a scenario error.
 */
export function normalizeDiscoveredPath(path: string): string | null {
  const resolved = resolveReference(path);
  return resolved.status === 'resolved' ? resolved.path : null;
}

/** Deterministic path ordering: segment count, then segment-wise compare. */
export function comparePaths(left: string, right: string): number {
  const leftSegments = left.split('/');
  const rightSegments = right.split('/');
  const shared = Math.min(leftSegments.length, rightSegments.length);
  for (let index = 0; index < shared; index += 1) {
    const a = leftSegments[index] ?? '';
    const b = rightSegments[index] ?? '';
    if (a !== b) {
      return a < b ? -1 : 1;
    }
  }
  return leftSegments.length - rightSegments.length;
}
