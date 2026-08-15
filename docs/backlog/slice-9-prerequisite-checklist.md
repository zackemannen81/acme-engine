# Slice 9 prerequisite checklist

Status: Stage A engineering boundary partially resolved; retained as the
working checklist for live execution, operations and every later data class

Purpose: gather every Slice 9 prerequisite that is currently scattered across
ADR-0028, ADR-0035, ADR-0036, ADR-0037, ADR-0038, the product definition, the
completion plan and the technical specification, and add the engineering
prerequisites discovered since those documents were written.

This file grants nothing. ADR-0040 separately authorizes only
`stage-a-anonymized-judicial-text/1`; ACME-0105 through ACME-0110 implement its
closed composition, import and bounded observation/relation/assessment journey.
Stage B and every other class remain closed and cannot activate by implication.
Unchecked legal,
security and operational rows remain real programme prerequisites.

## How to read this

The technical specification defines Slice 9 as a readiness gate:

> Reviewer capability: none until governance and safety prerequisites
> explicitly authorize a bounded new data class.

The completion plan defines a deny-by-default ladder, and constrains the first
decision:

1. synthetic material;
2. public or explicitly licensed non-confidential text with no personal,
   special-category, privileged or criminal-offence data;
3. de-identified private pilot material with documented re-identification
   controls;
4. identifiable or otherwise sensitive material only under later, stricter
   authority.

> The first Slice 9 decision should authorize at most one bounded class,
> purpose, organization, region, provider path and retention period. …
> Criminal-offence and privileged data remain blocked until specifically
> reviewed and authorized.

Preliminary investigation material (`förundersökningsprotokoll`) sits at rung 4
and is explicitly excluded from a first Slice 9 authorization. A programme that
intends to reach it needs **two** decisions: a first bounded authorization, then
a separate stricter one. Plan for both.

## A. Governance and legal input

Owner: the operator plus qualified legal/security review. Nothing in this
section is an engineering task and none of it can be produced by this
repository.

- [ ] A separately approved product need, written down, naming who benefits and
      what decision the material supports.
- [ ] Qualified legal review engaged and scoped, with a named reviewer.
- [ ] Qualified security review engaged and scoped, with a named reviewer.
- [ ] Lawful basis recorded for each intended processing purpose.
- [ ] Data-subject rights record: how access, rectification, erasure,
      restriction and objection are satisfied, and by whom, within what time.
- [ ] Data classification for the exact proposed class, written narrowly.
- [ ] Retention and deletion periods, per class and per artifact kind.
- [ ] Processor and geography terms for every third party in the path.
- [ ] Access-control model: who may read, review, export, administer.
- [ ] Incident response plan with a named owner and escalation path.
- [ ] Provider handling: what leaves the system, to whom, under what terms,
      and what is retained by them.
- [ ] Redaction and export policy for the class.
- [ ] DPIA determination — performed, or a recorded justification that it is
      not required.
- [ ] Documentation of all new authority **and residual risks** before any
      ingestion, per the specification.

### A1. Questions this programme's legal review must answer explicitly

These are recorded as questions, not conclusions. They are the ones where an
engineering assumption would be most costly if wrong.

- [ ] Does public availability of a judgment extend to the full preliminary
      investigation? Court decisions and investigation files are not
      necessarily the same disclosure question, and parts of an investigation
      may remain restricted after a verdict.
- [ ] Is public availability, where it applies, a *lawful basis for processing*
      — or only an absence of a disclosure restriction? These are separate
      questions and the second does not follow from the first.
- [ ] Under which regime does this processing fall, and does that regime permit
      consent as the operative basis for criminal-offence data, or require a
      separate statutory authorization?
- [ ] Whose consent is needed? Consent obtained from injured parties and called
      witnesses does not cover every data subject in an investigation file:
      the accused, police officers, experts, interpreters, and third parties
      named inside statements all appear in the material.
- [ ] What happens on withdrawal? Consent that cannot be withdrawn is not
      consent. Withdrawal must map to a concrete, provable system action — see
      section D3, which is currently not buildable.
- [ ] Are any of the selected cases subject to protected identities, sexual
      offence provisions, medical records or minors, which typically carry
      stricter handling than the rest of a file?
- [ ] Do defence-counsel or other professional confidentiality duties attach to
      any of this material independently of the data subjects' consent?

## B. The intended data class, stated narrowly

Fill this in before the ADR is drafted. Vagueness here is what makes a class
expand later.

- [ ] Exact class name and version, e.g. `<name>/1`.
- [ ] Exact case count and identifiers of the approved material.
- [ ] Exact consent artifacts: who consented, to what, when, in what form,
      where the signed record is stored, and how it is linked to the imported
      material without itself becoming an uncontrolled personal-data store.
- [ ] The recorded exclusion list — which witnesses, relatives and third
      parties must be omitted — expressed precisely enough to verify
      mechanically, not as prose.
- [ ] Purpose limitation: the exact demonstration and evaluation purpose, and
      the date or condition at which processing stops.
- [ ] Region and provider path for that class.
- [ ] Retention period, and the deletion event that ends it.

## C. Engineering prerequisites already recorded in accepted ADRs

- [ ] **Restore drill performed** (ADR-0037 follow-up). Never executed. A
      backup that has never been restored is a hypothesis.
- [ ] **KEK sufficiency decision** (ADR-0037 follow-up): is the mounted-secret
      key provider adequate for the proposed class, or must it be replaced by
      an external KMS/HSM adapter? Decide *before* authorization, not after.
- [ ] Deployment-specific retention periods, incident ownership and backup
      schedules defined (ADR-0037 follow-up).
- [ ] ADR-0038's accepted ingestion limits and attestation carried into the
      data-class review, which may narrow but not widen them.
- [ ] Case isolation (ADR-0036) re-proven against the new class, including
      adversarial same-organization tests.

## D. Engineering prerequisites discovered since those ADRs

### D1. `synthetic-only` is a contract, not a setting

ACME-0106 makes case/workspace data policy an exact two-value enum while
leaving assessment output/export synthetic-only. Ingestion is an additive
discriminated union: synthetic `/1` records are unchanged and Stage A uses
metadata/record `/2`. Every other policy/class still fails schema/runtime
validation.

This is deny-by-default at the type level, which is the right design — and it
means authorizing a class is a versioned contract change with migration, not a
flag.

- [x] Decide and implement the Stage A schema strategy across case, workspace
      and ingestion while leaving export/assessment closed.
- [x] Existing synthetic import commands and records stay on `/1` unchanged.
- [x] Add the Stage A authority/provider/provenance attestation without a
      client credential or actor field.
- [ ] Replace the synthetic attestation with a class-appropriate attestation
      that records consent reference, exclusion list and lawful basis.
- [x] Keep every non-authorized class failing closed after the change, and
      prove it with a refusal test per contract.

### D2. The live reviewer journey exists; real-provider acceptance remains

The default workbench still composes `createScriptedModelGateway`. ACME-0105
adds a fail-closed OpenAI capability behind PostgreSQL, hosted mode, a durable
payload key, explicit opt-in and nested budgets. ACME-0106 permits Stage A
storage only when that capability exists. ACME-0107 adds one case-first
observation job, ACME-0108 adds one case-first relation job over server-derived
current observations and ACME-0110 adds source-complete assessment plus review/
reassessment; import itself remains pure storage and makes no model call.

Consequence: imported real documents can now produce validated source-bound
observations, typed relations, open questions and reviewed assessments.
Timeline is the existing pure projection of observation temporal bounds.
ACME-0110 proves the human review and late-evidence reassessment journey.

- [x] Implement the gated/budgeted live-provider capability in the workbench.
- [x] Add the bounded case-first live observation job, content-free audit and
      primary source-review navigation.
- [x] Add live relation/timeline/open-question analysis. ACME-0108 derives
      current observations server-side, atomically projects validated relation
      output and proves full PostgreSQL restart without a second call.
- [x] Add the live assessment job and prove primary review plus late-evidence
      reassessment. ACME-0110 preserves historical replay and product evidence
      revision while using source-complete provider input.
- [x] Decide the Stage A live-call retention policy: ADR-0040 requires
      `encrypted-payload` with a durable mounted key.
- [ ] Establish what the provider receives, retains and logs, and reconcile
      that with section A's provider handling.
- [ ] Validate the `observe-artifact` strict structured-output contract with an
      explicitly budgeted real provider call on authorized material outside
      the sealed corpus. ACME-0107 proves the product path with injected
      transport and provides the opt-in acceptance entry, but no process
      credential was available for the paid call.

### D3. Consent withdrawal has no mechanism

Deletion today is per artifact representation, with tombstones. There is no
per-data-subject operation. If one witness withdraws, there is no supported way
to remove that person from a document while keeping the rest.

- [ ] Define what withdrawal means operationally for this programme.
- [ ] Build or explicitly accept the absence of a per-subject removal path, and
      record the consequence in the consent text itself so it is not promised
      and then unavailable.

### D4. Redaction does not retroactively clean citations

ADR-0038 redaction creates a *new* immutable derivative. Existing locators,
observations, reviews and assessments remain bound to the unredacted
predecessor, and the original bytes remain stored encrypted.

For an exclusion list this matters: redacting after analysis leaves every
observation and assessment citing the unredacted version.

- [ ] Decide the ordering rule: redact before any analysis, or accept that
      citations reference predecessors.
- [ ] Decide whether the unredacted original may persist at all for this class,
      and if not, how that squares with ADR-0037's immutability model.
- [ ] Redaction is currently manual per byte range and cannot span newlines.
      Decide how a whole-person exclusion is applied and verified across a
      full investigation file.

### D5. Operational debt that must clear first

- [x] `pnpm test:postgres` executed against a real server. Re-proved 2026-08-15
      under ACME-0110 against a clean `postgres:15`: 36 tests, including Stage
      A import, live observation/relation/assessment full-composition restart,
      human review, late-evidence reassessment, migration v7 and export-policy/
      audit.
      A separate two-document real-source acceptance also reopened identical
      PostgreSQL records/source hashes with zero provider calls. Hosted
      mode *is* PostgreSQL, so this stays a standing gate rather than a
      one-time tick — run it before any pilot.
- [ ] Local workbench single-session defect resolved or explicitly accepted —
      see [`local-workbench-durable-ledger.md`](local-workbench-durable-ledger.md).
- [ ] Hosted deployment topology, region and operator ownership settled.

## E. Open-source lock-down

The stated plan is to reduce the application to mock data only before open
sourcing. That is the right instinct, and it is easiest to guarantee if it is
designed in *before* real material is ever imported rather than cleaned up
afterwards.

- [x] Real material never becomes a repository fixture. The sealed corpus lives
      in `packages/evidence-testing/fixtures/`; anything placed there is in git
      history permanently.
- [x] Real material never enters test snapshots, golden files, journal entries,
      screenshots or documentation examples.
- [x] Working data stays outside Git only, and `.local/` remains
      gitignored.
- [x] A default build/composition mode that cannot reach Stage A,
      verified by a refusal test rather than by convention.
- [ ] Scrub procedure for logs, backups, object storage and key material at
      programme end, with the deletion evidenced.
- [ ] History review before publication, including the existing secret scan
      extended to the new class.
- [x] The published default composition is the synthetic one, and the
      demonstration corpus shipped publicly is the synthetic corpus.

## F. What the Slice 9 ADR itself must contain

Drafting can begin once A, B and C are answerable. The ADR must state:

- [x] ADR-0040 names the single bounded Stage A class, purpose and provider path
      and retention period it authorizes — and nothing else.
- [ ] That it authorizes rung 2 or 3, or, if it purports to authorize rung 4,
      why the stricter review the completion plan requires has been satisfied.
- [x] Every Stage A engineering gate before ingestion is expressed executably.
- [x] The refusal behaviour for every class it does not authorize.
- [ ] Residual risks, named and accepted by a named owner.
- [x] That the Primary Product Rule, source-binding invariants and the L5
      prohibition are unchanged. No Slice 9 decision may weaken them without
      superseding ADR-0028.

## Recommended sequencing

1. **Decide whether the tech demo needs real material at all.** The synthetic
   corpus already demonstrates the complete journey: correction lineage,
   changed account, scoped contradictions, temporal conflict, open questions,
   assessment, re-review, the Case Integrity Report and four deterministic
   export formats. If the demo can run on it, Slice 9 is not on the critical
   path for the demo, and the UI polish, user manual, presentation folder and
   demo video can proceed now with no gate at all.
2. If the demo must show genuine material, charter **live model in the
   workbench** first (D2). Authorized data without it produces no analysis.
3. Clear **D5** operational debt and **C** ADR-0037 follow-ups in parallel;
   they are independent of the legal track.
4. Answer **A** and **B** with the qualified reviewers, and settle **D1**,
   **D3** and **D4**, which are where an engineering surprise would be most
   expensive.
5. Draft the Slice 9 ADR (**F**) against a rung-2 or rung-3 class. Treat rung 4
   as a separate, later decision.
6. Design **E** lock-down before the first real import, not after.

## Out of scope

- This checklist grants no authority, activates no task and changes no data
  policy. It is planning input.
- It is not legal advice. Sections A and A1 are the questions a qualified
  reviewer must answer; the answers are theirs, not this document's.
