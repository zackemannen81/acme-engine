# ADR 0029 — POC #1 persistence platform is self-hosted Supabase

Status: Accepted

Date: 2026-08-11

Decision owners: ACME maintainers

## Context

[ADR-0028](0028-first-poc-evidence-integrity-workbench.md) accepted the
Evidence Integrity Workbench as POC #1 and named PostgreSQL as the hosted
persistence target, but deliberately selected no vendor: "No managed
PostgreSQL, identity, object-storage or hosting vendor is selected." The
normative
[product definition](../design/evidence-integrity-workbench-product-definition.md)
repeats that deferral and lists "managed PostgreSQL, identity, object-storage
and hosting vendors" among the decisions left to the implementation charter.

That deferral has since been closed by an explicit maintainer decision, but the
decision existed only in a commit message and in no governing document. A
persistence platform constrains the repository adapter, transaction semantics,
schema layout, browser exposure and future migration, so under `AGENTS.md` it
requires an ADR rather than an assumption inside a task charter.

POC #1 is a functionality proof over a synthetic corpus, not a commercial
launch. Its operator must be able to inspect the complete corpus and its ground
truth, and no real, confidential or criminal-offence personal data is permitted
in V1. The platform therefore has to satisfy ACME's aggregate commit semantics
and the product's browser-isolation rule; it does not yet have to satisfy
multi-tenant production, processor-agreement or data-residency obligations.

## Decision

### Platform

POC #1's persistence and backend platform is **self-hosted Supabase**. It
replaces ADR-0028's unresolved "managed PostgreSQL" placeholder for this POC.

SQLite remains the implemented local and offline reference adapter and the
default for deterministic development and CI. Nothing in this ADR changes it.

### The ACME adapter targets PostgreSQL, not Supabase

The ACME repository adapter required by ADR-0028 is a **PostgreSQL** adapter
that speaks the PostgreSQL wire protocol through a server-side connection. It
must not depend on PostgREST, the Supabase client libraries or any other
Supabase-specific API.

This is not a stylistic preference. ACME commits evidence, state, events and
outbox rows atomically at an expected revision, and compare-and-swap plus the
aggregate `ExecutionRepository` contract cannot be expressed through a
per-request REST interface. Keeping the adapter on plain PostgreSQL also means
Supabase remains an operational choice that a later hosting decision can
change without touching the adapter or its conformance proofs.

The adapter must pass the unchanged repository conformance kit plus the
PostgreSQL-specific atomicity, compare-and-swap, resume and outbox proofs
already required by ADR-0028. This ADR adds no proof obligation and removes
none.

### Browser isolation is unchanged and explicit

The product definition forbids browser-to-database access. Supabase makes the
opposite the default path: PostgREST plus an anonymous key normally exposes
tables directly to a browser client.

For this POC:

- ACME schemas are never exposed through PostgREST, the anonymous key or any
  other browser-reachable interface;
- the browser communicates only with the product API, which holds the database
  credentials server-side; and
- row-level security is not accepted as a substitute for that boundary, because
  ACME's evidence, state, event and outbox tables are engine internals rather
  than a product read model.

### What this ADR does not decide

The following remain open and belong to the technical specification or a later
ADR:

- whether the product application adopts Supabase Auth, Storage, Realtime or
  Studio, or supplies those capabilities itself;
- which object store holds artifact bytes, including whether Supabase Storage
  serves as the S3-compatible target named in the product definition;
- the hosting environment, host location, network exposure and TLS termination;
- backup, restore, upgrade and key-lifecycle procedures;
- schema separation between product tables and ACME persistence; and
- the migration tooling and rollout order for the adapter.

Unused Supabase components must be left disabled rather than adopted by
default.

### What this ADR does not weaken

Every immutable V1 restriction in ADR-0028 and the product definition stands
unchanged: synthetic corpus only, no real confidential, privileged or
criminal-offence personal data, no credibility, guilt or legal-sufficiency
conclusions, and no publication without human review. A persistence platform
decision cannot widen product authority.

## Alternatives Considered

### Managed PostgreSQL (Supabase Cloud, Neon or equivalent)

- Benefits: backups, availability, upgrades and patching are operated by the
  provider; the least operational work for a small team.
- Costs: recurring spend before the POC has proven anything; a processor
  relationship and data-residency questions for a proof that needs neither;
  less control over the environment the maintainer wants to inspect directly.
- Reason not selected: POC #1 runs on a synthetic corpus whose purpose is a
  functionality proof. Self-hosting keeps cost and control with the maintainer,
  and the adapter's PostgreSQL boundary keeps a later move to a managed
  provider open.

### Plain self-hosted PostgreSQL without Supabase

- Benefits: the smallest possible surface; nothing installed that the POC does
  not use.
- Costs: the product shell would have to supply identity, object storage and
  administrative tooling itself, all of which the POC eventually needs.
- Reason not selected: Supabase bundles those candidate components behind the
  same PostgreSQL server, and this ADR keeps them optional and disabled until
  the technical specification adopts them explicitly. The ACME adapter sees
  plain PostgreSQL either way.

### SQLite for the hosted POC

- Benefits: uses the delivered adapter with no new persistence work.
- Costs: couples hosted writers to one database file and one application host.
- Reason not selected: already rejected by ADR-0028. SQLite remains the offline
  reference adapter.

## Consequences

### Positive

- The persistence platform is now recorded where later work can rely on it,
  instead of living in a commit message.
- ACME-0076 can reference a decided platform rather than carrying an
  undocumented selection inside a task charter.
- The PostgreSQL-wire-protocol boundary keeps the adapter portable and its
  conformance proofs vendor-neutral.
- The browser-isolation rule is stated against the concrete platform whose
  defaults would otherwise violate it.
- Cost and data control stay with the maintainer for the synthetic-corpus
  phase.

### Negative

- Backups, restores, upgrades, patching, monitoring and key lifecycle become
  the operations owner's responsibility, and none of them exist yet.
- A self-hosted single instance is not a high-availability target; the POC
  accepts that.
- Supabase installs components the POC may never use, which is surface that has
  to be kept disabled and patched rather than ignored.
- Any later move to a hosted, multi-tenant or non-synthetic path reopens
  availability, residency and processor questions that this ADR does not
  answer.
- ADR-0028 and the product definition now carry a superseded phrase each and
  must be read together with this ADR.

### Follow-ups

- Reference this ADR from ACME-0076 and let the technical specification place
  the adapter work in its slice order.
- Specify the PostgreSQL adapter, schema separation and migration plan in their
  own bounded task, as ADR-0028 already requires.
- Decide Supabase component adoption (Auth, Storage, Realtime, Studio)
  explicitly in the technical specification.
- Define backup, restore, upgrade and key-lifecycle procedures before any
  environment holds data that matters.
- Re-examine the platform before any non-synthetic corpus, together with the
  privacy, security and legal readiness work ADR-0028 already blocks it behind.

## Compatibility and Migration

No code, contract, schema or stored data changes. No adapter exists yet, so
there is nothing to migrate. SQLite remains the only delivered durable adapter
and the CI and offline default.

This ADR supersedes exactly two statements and nothing else: ADR-0028's "No
managed PostgreSQL ... vendor is selected" and the product definition's
deferral of the managed PostgreSQL vendor, both on the vendor point only. The
identity provider, object-storage vendor, model and hosting platform remain
deferred as those documents state. Both documents receive a pointer to this ADR
rather than a rewrite.

Rollback is a new ADR: because the adapter targets plain PostgreSQL, moving to
a managed provider changes connection configuration and operations, not the
adapter contract or its conformance proofs.

## References

- [ADR-0028 — First POC is the Evidence Integrity Workbench](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0003 — SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ADR-0013 — Durable SQLite schema and driver](0013-durable-sqlite-schema-and-driver.md)
- [ADR-0018 — Outbox delivery boundary](0018-outbox-delivery-boundary.md)
- [Evidence Integrity Workbench product definition](../design/evidence-integrity-workbench-product-definition.md)
- [First POC discovery](../design/first-poc-application-discovery.md)
