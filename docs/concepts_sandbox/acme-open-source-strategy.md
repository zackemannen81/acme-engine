# ACME Open-Source Strategy — Concept

- Date: 2026-08-10
- Updated at: 2026-08-10
- Owner: Rickard Zakrisson
- Status: Concept — release strategy candidate, no release authorized

## Authority Boundary

This document is non-authoritative concept work. It does not select or grant a
license, make the repository public, change package publication settings,
create a commercial offering, authorize a release or alter ACME architecture.
Only a separately activated task and accepted decisions may do those things.
This is not legal advice.

## Executive Direction

The preferred strategy is to release a complete, uncrippled ACME Community
Core after at least two complete consumer applications have demonstrated the
platform. Users should be able to inspect, modify, experiment with and build
real applications on ACME.

Commercial value should be built around the things that remain difficult even
when source is available:

- correct domain architecture and policies;
- conformance and compatibility;
- certified, traceable distributions;
- production operations and scale;
- advanced adapters and integrations;
- privacy, KMS, tenancy and governance;
- expert implementation and support; and
- validated domain modules and reference applications.

Artificial semantic limits in the core, such as licensing a larger retrieval
count, are rejected as the preferred direction. They weaken platform proof,
encourage forks and confuse compatibility with monetization.

## Current Repository Reality

As of 2026-08-10:

- the repository contains no `LICENSE` file;
- the root workspace and every package/application manifest are private;
- no ACME package has been published;
- the repository has a `BASE` source release tag but no package distribution;
- existing contributors are recorded through repository history, but no
  external contributor copyright policy, CLA or DCO is selected; and
- ACME has not announced a public compatibility or trademark policy.

This is a favorable point to make the licensing and contribution decisions
before outside contributions make later relicensing harder.

## Release Purpose

The public release should prove three things:

1. ACME is a usable platform rather than a private demonstration.
2. Independent builders can create domain modules and full applications
   without changing domain-neutral core.
3. ACME's architecture, evidence and replay guarantees remain testable across
   implementations and versions.

The primary early objective is adoption, falsification and ecosystem learning.
Revenue follows from production-grade trust and expertise rather than a
crippled experimental edition.

## Release Principles

### Complete enough to build

The community surface should include the real execution and evidence path, not
a toy SDK:

- contracts and registries;
- StateEngine, MemoryEngine and ExecutionEngine;
- replay, resume, evaluation and outbox boundaries;
- in-memory and SQLite adapters;
- deterministic mock and OpenAI adapter;
- shared repository, gateway, module and evaluation conformance kits;
- CLI and local workbench;
- Narrative and Research reference modules; and
- complete reference consumer applications when their release boundaries are
  ready.

Hosted PostgreSQL, enterprise identity or production services need not be
finished before a technical preview if local platform capability is complete
and the omissions are explicit.

### No license-enforced semantic degradation

The current `acme-memory-retrieval-1` limit of 50 is part of a versioned
execution identity and replay contract. It is not the total stored-memory
capacity and must not become a paid-edition switch.

A future retrieval design should preserve v1 compatibility and introduce a
new algorithm identity with independently defined candidate, context-record
and token budgets. Large-corpus workflows should use bounded nomination,
recorded truncation and batching rather than silently claiming completeness.
That work requires an ADR and evaluation; this concept does not define it.

### Extensions before forks

The platform should make the supported path easier than editing core:

- domain modules own meaning and policy;
- adapters own provider and persistence translation;
- applications own workflow, identity and UX;
- public contracts and conformance kits define compatibility;
- static registries remain the default until dynamic discovery is justified.

Forks remain legally permitted under a true open-source license, but official
identity and compatibility claims can remain governed.

## Compatibility Identities

| Identity | Meaning |
| --- | --- |
| ACME Community | Public source release under the selected open-source license |
| ACME Compatible | Passes the published versioned conformance requirements |
| ACME Certified | Officially produced artifact with supported version matrix, digest, provenance and verification |
| ACME Fork | Modified distribution that may be lawful but carries no automatic compatibility or official identity claim |

Certification must be evidence-based and reproducible. It must not imply that
community-built applications are prohibited.

## License Decision Matrix

The [Open Source Definition](https://opensource.org/osd) requires modification
and derived works to be allowed and prohibits restrictions by field of
endeavor. A license that blocks core modification, production use or a class
of business use cannot accurately be marketed as open source.

| Direction | Adoption effect | Commercial protection | Main consequence | Concept disposition |
| --- | --- | --- | --- | --- |
| Apache-2.0 | Lowest adoption friction | Relies on brand, services and execution | Forks and proprietary embedding are permitted; explicit patent terms | Strong candidate if ecosystem adoption is primary |
| AGPL-3.0 + commercial license | Source remains available; some proprietary adopters require a commercial path | Network copyleft can support dual licensing | Requires controlled copyright and careful integration guidance | Strong candidate if reciprocal source and licensing revenue are primary |
| BSL 1.1 | Source visible and modifiable for permitted uses | Production limits can reserve commercial value until change date | BSL states that it is not open source before conversion | Reject if ACME promises an immediate open-source release |
| ELv2-style source available | Broad use with managed-service and license-key restrictions | Protects a vendor distribution from defined competition | Not an OSI-approved open-source direction | Reject if ACME promises open source; consider only after explicit repositioning |
| Closed prebuilt core | Maximum technical restriction | Keeps implementation proprietary | Prevents meaningful modification, conformance learning and community trust | Reject as the preferred community strategy |

### Decision rule

- Choose **Apache-2.0** if the primary goal is rapid adoption and ACME as a
  broadly embedded standard.
- Choose **AGPL-3.0 plus a commercial license** if reciprocal network-source
  obligations and proprietary embedding licenses are central to the business
  model.
- Choose BSL or ELv2 only if the project deliberately chooses
  **source-available**, and label it accurately.

Final selection requires qualified legal review of dependencies, copyright
ownership, contribution history, commercial objectives and jurisdiction.

## Commercial Value Layers

```text
open community core
  → conformance and official compatibility
  → certified builds and supported versions
  → production runtime and operations
  → advanced adapters and enterprise controls
  → domain systems and implementation expertise
```

### Certified distribution

- signed release artifacts;
- exact source revision and build digest;
- SBOM in a standard format;
- build provenance;
- supported Node/platform/database matrix;
- migration and compatibility guarantees;
- full verification record; and
- security and maintenance policy.

SLSA defines provenance as verifiable information about where, when and how an
artifact was produced. SPDX is an international standard for software bill of
materials data. Both are useful foundations; no conformance level is claimed
today.

### Production platform

- managed execution and job control;
- tenant isolation, auth and policy enforcement;
- PostgreSQL and object-storage operation;
- observability, budgets and rate controls;
- backup, restore, disaster recovery and upgrades;
- provider routing and production support.

### Enterprise trust

- KMS integration and rotation;
- privacy deletion and retention policy;
- audit export and compliance evidence;
- SSO, RBAC and multi-tenancy;
- approved deployment patterns and support windows.

### Domain value

- correctly modeled domain modules;
- curated prompts, evaluators and golden fixtures;
- expert-reviewed policies and invariants;
- reference applications and integration programs;
- implementation, architecture review and training.

## Contribution and Ownership Strategy

Before accepting outside code, decide:

- whether contributions use a DCO, CLA or another attestation;
- whether the project must retain the right to dual-license contributions;
- how corporate contributions are authorized;
- how third-party code and generated artifacts are audited;
- who may approve protocol, contract and compatibility changes; and
- which decisions require ADRs and version migration paths.

A permissive single-license project may need less copyright centralization.
Dual commercial licensing generally requires the project to control sufficient
copyright or receive appropriate contributor grants. Legal counsel must define
the actual mechanism.

## Trademark and Identity

Open-source rights and brand rights are separate. The license may permit forks
while a trademark policy defines when a distribution may call itself ACME,
ACME Compatible or ACME Certified.

The policy should permit truthful nominative references and community use
while preventing modified, unverified builds from implying official support.

## Public Release Prerequisites

### Legal and repository hygiene

- choose and add the license and notices;
- audit copyright and third-party dependencies;
- define contribution attestation and governance;
- define trademark usage;
- scan history and current tree for credentials, personal data and private
  artifacts;
- confirm generated fixtures and live-provider records are redistributable.

### Product and compatibility proof

- complete at least two consumer applications on the same core;
- publish a stable quickstart and bounded reference architecture;
- define supported extension points and forbidden dependency directions;
- publish conformance commands and a compatibility versioning policy;
- document the retrieval v1 boundary honestly;
- demonstrate install, execute, replay and resume from a clean environment.

### Community readiness

- README and architecture introduction;
- security policy and private disclosure channel;
- code of conduct and contribution guide;
- issue and proposal templates;
- release/version policy and support window;
- public roadmap that distinguishes commitments from concepts.

### Supply-chain readiness

- deterministic or reproducible build procedure where practical;
- signed artifacts;
- checksums, SBOM and provenance;
- dependency update and vulnerability response policy;
- no package publication before clean-room install verification.

## Staged Release Plan

### Stage 0 — Internal platform proof

- Evidence Integrity Workbench completed against synthetic corpus;
- Research Synthesis or another materially different POC completed;
- both use supported extension paths rather than core forks;
- retrieval and scaling boundaries documented from observed use.

### Stage 1 — Public technical preview

- source repository public under the selected license;
- packages may remain source-consumed initially if publication quality is not
  ready;
- complete local examples, conformance suite and architecture docs;
- experimental compatibility statement;
- feedback focused on independent builds and module authoring.

### Stage 2 — Public beta

- versioned packages published;
- clean install and upgrade path;
- documented compatible-module contract;
- first external module/application examples;
- security and maintenance process operating.

### Stage 3 — Stable ecosystem release

- stable public contract policy;
- certified distribution and support offering;
- production adapter matrix;
- governance and compatibility program;
- measured external adoption and upgrade evidence.

## Why Two Consumer Applications First

One application can accidentally encode product-specific assumptions while
appearing generic. Two materially different applications test whether:

- core remains domain-neutral;
- modules can own meaning without core changes;
- adapters remain replaceable;
- conformance is reusable;
- documentation supports independent composition; and
- upgrades do not silently privilege one product.

The first two planned applications are Evidence Integrity Workbench and
Research Synthesis. POC means a platform/reference-application proof, not a
commitment to sell either application as a service.

## Community Feedback as Platform Validation

External builders test properties internal development cannot fully prove:

- whether the public contracts are understandable;
- whether docs support a cold start;
- whether extension points are sufficient;
- whether conformance failures are actionable;
- whether upgrades and migrations are credible; and
- where users feel forced to fork core.

The release should collect these signals explicitly rather than equating stars
or downloads with platform correctness.

## Success Measures

- independent clean install and first committed execution;
- independent domain module passing shared conformance;
- complete application built without core modification;
- replay/resume evidence reproduced outside the maintainer environment;
- compatibility retained across an upgrade;
- time to diagnose failures from recorded evidence;
- number and cause of core forks;
- certified/support demand separated from community usage.

## Risks and Controls

| Risk | Control |
| --- | --- |
| Release before contracts stabilize | Two-app proof and explicit technical-preview compatibility |
| Community edition is perceived as a toy | Release the real uncrippled execution path |
| Fork fragmentation | Strong extension contracts, conformance and trademark clarity |
| No monetization after permissive release | Build scarce value in certification, operations, enterprise trust and domains |
| Copyleft reduces adoption | Choose license from explicit adoption versus reciprocity objective |
| Dual licensing becomes impossible | Resolve copyright/contribution policy before external contributions |
| Users over-trust ACME guarantees | Publish exact proof boundaries and non-guarantees |
| Supply-chain compromise | Signed artifacts, SBOM, provenance and response policy |
| POC-specific concepts leak into core | Boundary tests and two materially different consumer applications |

## Explicit Non-Decisions

This concept does not decide:

- the license;
- whether dual licensing is used;
- package names or registry;
- legal entity or commercial company structure;
- pricing;
- certification criteria or fees;
- hosting provider;
- contribution agreement;
- trademark registration;
- public release date; or
- Retrieval v2 architecture.

## Recommended Next Decisions

1. Complete the two consumer-application platform proofs.
2. Run a dependency, copyright and secret-history audit.
3. Decide whether adoption or reciprocal/commercial licensing is primary.
4. Obtain legal review of Apache-2.0 versus AGPL-3.0 plus commercial terms.
5. Define public extension and compatibility contracts.
6. Draft contribution, security, trademark and release policies.
7. Run a private clean-room install with a builder who has not seen the repo.
8. Activate a separately bounded public-preview task only after those gates.

## Repository References

- [`PROJECT_BRIEF.md`](../PROJECT_BRIEF.md)
- [`CURRENT_STATUS.md`](../CURRENT_STATUS.md)
- [`SYSTEMDOC.md`](../SYSTEMDOC.md)
- [`ADR-0028`](../adr/0028-first-poc-evidence-integrity-workbench.md)
- [Evidence Integrity Workbench product definition](../design/evidence-integrity-workbench-product-definition.md)
- [Docs-first packaging concept](docs-first-open-source-packaging.md)

## External References

- [Open Source Definition](https://opensource.org/osd)
- [OSI-approved licenses](https://opensource.org/licenses)
- [GNU Affero General Public License v3](https://www.gnu.org/licenses/agpl-3.0.html.en)
- [Apache Software Foundation licenses](https://www.apache.org/licenses/)
- [Business Source License 1.1](https://mariadb.com/bsl11/)
- [Elastic License 2.0 FAQ](https://www.elastic.co/licensing/elastic-license/faq/)
- [SLSA specification 1.2](https://slsa.dev/spec/v1.2/)
- [SPDX specifications](https://spdx.dev/use/specifications/)
