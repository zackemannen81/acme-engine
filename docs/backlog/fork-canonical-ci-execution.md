# Felix fork canonical CI execution

Status: Proposed 2026-08-17

## Discovery context

ACME-0149 landed the authenticated AAL v3 runtime host on `felixnissen/acme-engine/main` as `19ff83c94fad1611c1f7fa95ec4231a2c2a62e8a`, while deliberately keeping runtime compatibility `unverified`.

The repository already contains the canonical `.github/workflows/ci.yml` covering frozen-lockfile installation, documentation, formatting, lint, typecheck, boundaries, unit/conformance/integration/scenario suites, build and PostgreSQL tests. Despite that workflow existing, the private Felix fork returns zero Actions runs for:

- ACME-0149 PR #3 when opened;
- PR #3 after close/reopen;
- the `19ff83c...` push to fork `main`.

The local execution environment cannot resolve `github.com`, and the connected GitHub API can read the private repository but does not expose its archive as executable local bytes. Rickard/upstream must not be modified solely to obtain verification.

## Proposed outcome

Provide one supported canonical execution path for Felix's fork so the existing workflow-equivalent gates can run against an exact fork commit and produce durable evidence.

Prefer restoring/enabling GitHub Actions for the private fork. A hermetic external runner is acceptable only if it executes the repository's pinned Node/pnpm versions and the same commands without silently weakening gates.

## Why this is outside ACME-0149

ACME-0149's frozen deliverable is the runtime-host boundary. Repository/organization CI enablement is infrastructure and permission work, not runtime-host behavior. The task explicitly permits unavailable gates to remain unchecked when the external limitation is recorded honestly.

## Dependencies

- Administrative access to the fork's Actions/repository settings, or a supported authenticated runner that can checkout the private fork.
- No dependency on changing Rickard/upstream.

## Suggested verification

Against the exact current fork commit, run and retain evidence for:

1. `pnpm install --frozen-lockfile`
2. `pnpm docs:check`
3. `pnpm format:check`
4. `pnpm lint`
5. `pnpm typecheck`
6. `pnpm boundaries`
7. `pnpm test:unit`
8. `pnpm test:conformance`
9. `pnpm test:integration`
10. `pnpm test:scenario`
11. `pnpm build`
12. PostgreSQL adapter suite as defined by `.github/workflows/ci.yml`

Only after those gates execute successfully may ACME-0149's engine verification boxes be marked passed or compatibility be reconsidered.
