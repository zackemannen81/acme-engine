# ADR 0052 — Apache-2.0 open-source source distribution

Status: Accepted
Date: 2026-08-26
Decision owners: Rickard Zakrisson

## Context

ACME has been developed as an unpublished npm-private workspace. That
publication guard was easy to misread as a source-licensing decision, while
the repository had no root license text. Source access, permission to use the
source, npm publication, a versioned release and deployment are separate
boundaries and must not contradict one another in live documentation.

The selected license must preserve ACME's domain-neutral platform direction,
permit real independent adoption and commercial use, and avoid license-enforced
feature degradation. Opening source must not silently promise package
publication, official builds, certification, support or hosting. Repository
credential hygiene must also be checked before describing the source as ready
for open distribution.

## Decision

ACME repository source is open-source software under Apache License 2.0 unless
a file or incorporated third-party component explicitly states different
terms. The repository root carries the standard Apache-2.0 text in `LICENSE`,
and the root package manifest declares `Apache-2.0`.

The root npm `private: true` flag is retained. It is an
accidental-publication guard only; it does not make repository source private,
proprietary or unlicensed. Publishing any package, producing a versioned or
certified release, deploying a service, or announcing support remains a
separately authorized operation.

Apache-2.0 permits use, modification, redistribution, commercial use and
proprietary embedding subject to its conditions and includes an explicit
patent grant. It grants no trademark rights and creates no warranty, support,
certification, hosted-service or separate commercial-product commitment.
Third-party dependencies and incorporated materials retain their own license
terms.

Before open distribution is claimed, a content-redacted audit must cover
tracked files, ignored environment files, the current tree and every reachable
Git revision. Audit evidence records classifications and paths, never secret
values. A confirmed exposed credential requires owner/provider escalation and
rotation; deleting a current file alone neither revokes it nor removes it from
history.

## Alternatives Considered

### Remain unlicensed or rely on repository visibility

- Benefits: no immediate licensing decision.
- Costs: source visibility grants no clear reuse rights and cannot honestly be
  described as open source.
- Reason not selected: contradicts the intended independent adoption boundary.

### AGPL-3.0 with a separate commercial license

- Benefits: reciprocal network-source obligations can support a dual-license
  business model.
- Costs: higher integration friction, copyright-centralization requirements
  and a commercial boundary ACME has not selected.
- Reason not selected: the owner selected permissive open adoption rather than
  network copyleft and dual licensing.

### Source-available or closed distribution

- Benefits: could reserve specified uses or implementation details.
- Costs: would not be open source and would weaken independent conformance,
  embedding and platform learning.
- Reason not selected: conflicts with the explicit open-source direction.

## Consequences

### Positive

- Users and organizations receive clear, permissive rights to study, use,
  modify and redistribute ACME.
- The explicit patent terms reduce ambiguity for platform adopters.
- Package publication safety remains fail-closed.
- Commercial value can be built through services, expertise, official builds
  and operations without degrading the open engine by license.

### Negative

- Lawful forks and proprietary embedding cannot be prohibited by product
  policy.
- The license does not protect ACME branding; any trademark policy remains a
  separate decision.
- Open-source status does not itself provide release engineering, dependency
  notices, vulnerability reporting, support or operational readiness.

### Follow-ups

- Any package publication, tagged release, certified build, trademark policy
  or hosted offering requires its own claimed and frozen task.
- Future incorporated third-party material must retain compatible notices and
  terms.
- Repeat content-redacted secret checks before public release artifacts are
  produced.

## Compatibility and Migration

This decision changes distribution metadata and documentation only. It changes
no runtime contract, package API, persistence schema, provider behavior or
Evidence boundary. No npm package, release tag or deployment is created.

## References

- `LICENSE`
- `package.json`
- `docs/acceptance/ACME-0175-open-source-secret-audit.md`
- `docs/concepts_sandbox/acme-open-source-strategy.md` as non-authoritative
  discovery input
- ACME-0175
