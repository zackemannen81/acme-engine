# ADR 0024 — Local SPA shell and loopback workbench serve

Status: Accepted

Date: 2026-08-02

Decision owners: ACME maintainers

## Context

ADR-0019 gate 2 accepted a **local static SPA plus a thin local composition
process** wrapping CLI-equivalent entry points. Gates 6 and 7 require
localhost-only operation and keep the CLI as the sole CI entry point.

Phases 0–6 delivered S1–S10 as pure view contracts. Humans still cannot open
a browser and see them. Rendering must not become a second source of truth or
a place that invents verdicts (ADR-0019 § absence and verdict rules).

## Decision

### 1. Renderers are pure functions from view contracts to HTML

```text
view contract JSON  →  render*(view)  →  HTML string
```

Render code lives under `apps/test-ui/src/web/`. It may format and label. It
must not recompute pass rates, trust stages or digests from partial data. An
`unavailable` section is shown as unavailable with its reason, never as zero.

### 2. The browser never owns business logic

The SPA requests view JSON from the local process (or embeds demo fixtures).
It does not open SQLite, call providers or write the ledger. Launch and
workspace I/O stay in `@acme/test-ui/local`.

### 3. The serve process binds loopback only

The workbench HTTP listener accepts host `127.0.0.1` (or `localhost` resolved
to loopback) only. Requests to configure `0.0.0.0` or a public interface are
refused before `listen`. This is the executable form of ADR-0019 gate 6 for
this slice.

### 4. Assets are offline

CSS and shell HTML ship in-package. No CDN, no runtime font or script fetch
required to render. System fonts are acceptable.

### 5. First slice surfaces

| Surface | This slice |
| --- | --- |
| S3 runs | Full renderer + API over workspace |
| S4 execution | Full renderer; API from ledger path when configured, else demo fixture |
| S1, S2, S5–S10 | Shell navigation stubs naming the contract version |

Later charters deepen remaining surfaces without changing this boundary.

## Alternatives Considered

### Alternative A — Remote multi-tenant UI

- Rejected by ADR-0019 gates 1 and 6.

### Alternative B — Browser recomputes measurements and trust

- Costs: second source of truth; absence becomes zero.
- Rejected by ADR-0019.

### Alternative C — CDN Tailwind / external design system

- Costs: network dependency; CI and offline workbench break.
- Rejected for v1 shell.

## Consequences

### Positive

- View contracts remain the verification deliverable; HTML is a lens.
- Loopback binding is testable without opening the machine to the network.
- Pure renderers unit-test without Playwright.

### Negative

- First slice is incomplete for S1/S2/S5–S10 detail pages.
- Operators must still use TypeScript or CLI for full workflows until later
  slices wire launch and plan design into the shell.

### Follow-ups

- Render remaining surfaces from their contracts.
- Optional plan launch and live confirmation chrome in the shell.
- Optional non-authority visual polish inspired by concepts_sandbox mock.

## Compatibility and Migration

Default `@acme/test-ui` entry stays pure. Local serve is opt-in via the local
entry point. No core, adapter or CLI contract changes.

## References

- [ADR-0019](0019-domain-test-ui-boundary-and-view-contracts.md)
- [Domain Test UI — Specification](../design/domain-test-ui-specification.md)
