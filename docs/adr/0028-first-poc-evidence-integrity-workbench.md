# ADR 0028 — First POC is the Evidence Integrity Workbench

Status: Accepted

Date: 2026-08-09

Decision owners: ACME maintainers

## Context

ACME's NarrativeModule and ResearchModule prove that one domain-neutral core
can host different domain policies. The next step is the first real product
POC. ACME-0073 compared Research, Legal/Evidence and Kids candidates and
provisionally recommended an evidence-to-decision research workbench.

Research is structurally natural because the implemented ResearchModule owns
sources, propositions, corroboration, contradiction and provenance. It is
harder for the current project owner to validate subtle scientific conclusions
without external subject-matter experts. Source and citation correctness can be
checked, but complete product correctness quickly extends beyond the corpus.

An evidence-reconciliation corpus makes a larger part of V1 behavior directly
verifiable: whether a quotation exists, a locator resolves, an actor made a
statement, accounts changed, temporal data was preserved, relations point to
both sources, prior evidence survived an update, and replay matches. It also
exercises ACME's candidate/decision/canonical separation, contest semantics,
revision control, provenance, resume and replay more aggressively.

The domain is high consequence. An unbounded “legal AI” could make credibility,
guilt, legal-sufficiency or other high-impact decisions. Current OpenAI policy
requires human review for high-stakes legal and law-enforcement decisions and
licensed-professional involvement for tailored legal advice. Regulation (EU)
2024/1689 identifies several law-enforcement evidence-evaluation and justice
uses as high-risk. GDPR Article 10 places special conditions on processing
personal data about criminal convictions and offences. These facts require a
narrow product authority, synthetic data and explicit future review; this ADR
does not provide a legal classification or legal advice.

## Decision

### Product selection and order

ACME's first real POC is the **Evidence Integrity Workbench** specified by
[`docs/design/evidence-integrity-workbench-product-definition.md`](../design/evidence-integrity-workbench-product-definition.md).

Research Synthesis becomes the intended POC #2. It is not activated by this
ADR. ACME-0073 remains a historical discovery record; its Research-first
recommendation is superseded by this decision.

### Product authority

V1 is a corpus-bound evidence review tool. It may canonically record that a
specific source contains a statement, exhibit assertion or temporal
observation and may create reviewable relations and assessments with complete
provenance.

Canonical acceptance means “durably accepted with provenance,” not “proven
true in the world.” The product must keep separate:

1. immutable source artifact versions;
2. source-bound observations;
3. propositions and structured candidates;
4. domain decisions and typed evidence relations;
5. versioned assessments with human review; and
6. excluded legal, credibility and guilt conclusions.

### Immutable V1 restrictions

V1 must not:

- determine truthfulness, credibility, guilt, liability or likely criminal
  behavior;
- decide legal sufficiency, admissibility, privilege or evidentiary weight;
- give tailored legal advice;
- automate a legal, justice or law-enforcement high-impact decision;
- infer sensitive attributes or profile a person;
- publish an assessment without explicit human review;
- acquire unrestricted external case data; or
- process real confidential, privileged or criminal-offence personal data.

The initial corpus is synthetic and contains no identifiable real person. Any
future weakening of these restrictions requires a new ADR, qualified legal and
privacy review, provider-policy review and a new evaluation plan.

### Evidence invariants

- Every accepted quoted observation resolves to one immutable artifact version
  and valid locator.
- A statement occurrence records what an actor said; it does not make the
  expressed proposition true.
- A later changed account is a new occurrence and never overwrites the earlier
  one.
- Supersession is limited to an explicit correction lineage of the same
  underlying source occurrence.
- Unknown, approximate and ranged times remain typed as such; exact times are
  never invented.
- A relation retains all endpoints, compatible scope, rationale, provenance
  and review state and never deletes evidence.
- Lack of supporting evidence is an open question, not proof of contradiction.
- Assessments are immutable versions. Relevant new evidence marks an accepted
  assessment stale and requires review of a new version.
- The model produces candidates only. Domain validation, memory decisions,
  reducers, invariants and expected revision precede canonical commit.
- Human acceptance authorizes sharing within the POC; it does not establish a
  legal conclusion.

### Architecture baseline

The product remains outside `packages/core`. Evidence vocabulary belongs in a
new domain module or pure domain-policy package. Product identity, access,
jobs, review workflow, retention and UX belong in the application layer.
Provider SDKs, databases, object storage and transports remain adapters.

The accepted design baseline is the existing strict TypeScript/Node/pnpm/Zod
workspace plus a React/Vite browser client, Fastify API, logically separate
Node worker, OpenAI Responses adapter, S3-compatible object storage and managed
PostgreSQL for the hosted POC. PostgreSQL requires a new adapter that passes
the unchanged repository conformance kit and PostgreSQL-specific atomicity,
compare-and-swap, resume and outbox proofs. SQLite remains the implemented
local/offline reference.

No managed PostgreSQL, identity, object-storage or hosting vendor is selected.
No implementation is authorized by this ADR.

> Superseded in part on 2026-08-11:
> [ADR-0029](0029-poc-1-self-hosted-supabase-persistence-platform.md) selects
> self-hosted Supabase as POC #1's persistence platform and requires the ACME
> adapter to target plain PostgreSQL. The identity provider, object-storage
> vendor and hosting platform remain unselected, and no implementation is
> authorized by either ADR.

### Evaluation boundary

V1 is precision-first and may abstain. The release-blocking golden-corpus gates
are exact quote and locator validity for accepted observations, complete
assessment provenance, no evidence loss, no invented exact time, no prohibited
conclusions, deterministic replay and no duplicate provider call during
durable resume. Semantic coverage and usefulness are measured separately.

The first annotated fixture establishes baselines for attribution, actor
resolution, temporal normalization and evidence-relation precision/recall.
Model-comparison thresholds must be frozen before comparisons are run.

## Alternatives Considered

### Research Synthesis as POC #1

- Benefits: directly extends the existing ResearchModule; source, proposition,
  corroboration and contradiction semantics already exist; ResearchGate access
  can supply real research later.
- Costs: subtle scientific validity rapidly requires subject-matter expertise,
  making the product harder for the current owner to validate independently.
- Reason not selected: Research remains valuable as POC #2, after the evidence
  POC has stress-tested BASE and an expert-review plan can be added.

### Evidence Workbench with legal conclusions

- Benefits: potentially more direct decision value for professional users.
- Costs: introduces professional, regulatory, privacy, fundamental-rights and
  provider-policy risk; correctness no longer lies mainly in the corpus.
- Reason not selected: it defeats the POC's verifiability advantage and exceeds
  the team's current authority and validation capability.

### Generic document chat

- Benefits: fastest familiar interface and low initial domain-model effort.
- Costs: weakly exercises ACME's canonical state, contest, revision and replay
  model; encourages untraceable prose and collapses product differentiation.
- Reason not selected: it is not a meaningful proof of ACME.

### SQLite-only hosted POC

- Benefits: uses the delivered adapter with no new persistence work.
- Costs: couples hosted writers to one database file and application host and
  does not prove the intended stateless multi-user architecture.
- Reason not selected: SQLite remains the offline reference; PostgreSQL is the
  hosted target, despite the required adapter work.

## Consequences

### Positive

- Most hard V1 invariants can be evaluated directly against a known corpus.
- The POC exercises ACME's core thesis under changing, contradictory and
  temporally ambiguous evidence.
- Precision-first acceptance and human review reduce the authority granted to
  model output.
- Research remains a valuable second domain product rather than being
  discarded.
- The product direction is now explicit enough to support a bounded technical
  specification task.

### Negative

- A new Evidence domain model and PostgreSQL adapter are required before the
  hosted POC exists.
- Synthetic success does not prove legal, operational or compliance fitness.
- The terminology and subject matter may still cause users to over-trust a
  non-legal product unless UX boundaries are prominent.
- Relation quality and identity resolution still require human-labelled
  fixtures and careful review.
- Real data, professional workflows and external multi-tenancy remain blocked
  pending separate assessments.

### Follow-ups

- Activate a product technical-specification task covering synthetic corpus,
  view contracts, module contracts and staged implementation slices.
- Design the minimal Evidence domain model without importing sandbox package
  sketches wholesale.
- Create the PostgreSQL repository adapter plan and proof matrix in a separate
  bounded task.
- Establish the synthetic golden corpus and annotation protocol before prompt
  or model evaluation.
- Run separate privacy, security, provider-policy and legal readiness work
  before any non-synthetic data path.
- Preserve ResearchGate access and formulate Research Synthesis as POC #2 only
  after POC #1 has a verified platform baseline.

## Compatibility and Migration

This ADR changes product direction only. It does not modify existing core,
reference modules, contracts, persistence or stored data. NarrativeModule and
ResearchModule remain reference proofs. SQLite remains the only delivered
durable adapter.

The prior Legal/Evidence files under `docs/concepts_sandbox/` remain historical
non-authority. Implementation may use them for discovery but must derive public
contracts from this ADR and the normative product definition. ACME-0073's
discovery memo receives a supersession note; its analysis remains intact.

## References

- [Evidence Integrity Workbench product definition](../design/evidence-integrity-workbench-product-definition.md)
- [First POC discovery](../design/first-poc-application-discovery.md)
- [ACME Project Brief](../PROJECT_BRIEF.md)
- [ADR-0009 — Reference-domain identity and provenance](0009-reference-domain-identity-and-provenance.md)
- [ADR-0010 — Input-bound validation and interpretation](0010-input-bound-validation-and-interpretation.md)
- [ADR-0016 — Encrypted payload retention](0016-encrypted-payload-retention.md)
- [ADR-0017 — Durable execution resume](0017-durable-execution-resume.md)
- [ADR-0018 — Outbox delivery boundary](0018-outbox-delivery-boundary.md)
- [ADR-0025 — Post-execution quality evaluation](0025-post-execution-quality-evaluation.md)
- [Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en)
- [Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [OpenAI Usage Policies](https://openai.com/policies/usage-policies/)
- [NIST AI 600-1 — Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)
