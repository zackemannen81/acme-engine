# Slice 9 prerequisite checklist

Status: Proposed working checklist; not an activation and not an authorization

Purpose: gather every Slice 9 prerequisite that is currently scattered across
ADR-0028, ADR-0035, ADR-0036, ADR-0037, ADR-0038, the product definition, the
completion plan and the technical specification, and add the engineering
prerequisites discovered since those documents were written.

This file grants nothing. Slice 9 remains closed and, per ADR-0038, "cannot
activate by implication". Ticking every box here produces the *input* to a
Slice 9 ADR and a qualified legal/security review — not their conclusion.

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

`dataPolicy: z.literal('synthetic-only')` appears in `evidence-case/1`,
`evidence-workspace/1`, `evidence-assessment-output/1` and the module export
guard. Ingestion additionally pins `dataClass: z.literal(
'synthetic-utf8-plain-text/1')` and `syntheticAuthorityAttested: z.literal(true)`.
Export and assessment output both refuse any other value at runtime.

This is deny-by-default at the type level, which is the right design — and it
means authorizing a class is a versioned contract change with migration, not a
flag.

- [ ] Decide the schema versioning strategy for a second data class across
      case, workspace, ingestion, export and assessment-output contracts.
- [ ] Decide whether existing synthetic records migrate or stay on `/1`.
- [ ] Replace the synthetic attestation with a class-appropriate attestation
      that records consent reference, exclusion list and lawful basis.
- [ ] Keep every non-authorized class failing closed after the change, and
      prove it with a refusal test per contract.

### D2. There is no live model path in the product

The workbench composes `createScriptedModelGateway` only, with responses pinned
to exact request hashes of the fixed corpus. `POST /api/text-imports` is pure
storage: it calls `ingestion.importText` and runs no model.

Consequence: an imported real document today becomes an encrypted, readable,
redactable source with **zero observations** — and therefore no relations, no
timeline, no contradictions and no assessment.

- [ ] Live model in the workbench, gated and budgeted, as its own charter.
      Without it, authorized real data yields nothing analysable.
- [ ] Decide the retention policy for live calls on this class (ADR-0016
      `hash-only` versus `encrypted-payload`), knowing the payload is now
      personal data.
- [ ] Establish what the provider receives, retains and logs, and reconcile
      that with section A's provider handling.
- [ ] Validate the `observe-artifact` strict structured-output contract against
      material outside the sealed corpus. It has only ever run on seven fixed
      artifacts.

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

- [ ] `pnpm test:postgres` executed against a real server. Migration v7 and the
      PostgreSQL export-policy and export-audit write paths are typechecked and
      conformance-covered but have never been executed. Hosted mode *is*
      PostgreSQL.
- [ ] Local workbench single-session defect resolved or explicitly accepted —
      see [`local-workbench-durable-ledger.md`](local-workbench-durable-ledger.md).
- [ ] Hosted deployment topology, region and operator ownership settled.

## E. Open-source lock-down

The stated plan is to reduce the application to mock data only before open
sourcing. That is the right instinct, and it is easiest to guarantee if it is
designed in *before* real material is ever imported rather than cleaned up
afterwards.

- [ ] Real material never becomes a repository fixture. The sealed corpus lives
      in `packages/evidence-testing/fixtures/`; anything placed there is in git
      history permanently.
- [ ] Real material never enters test snapshots, golden files, journal entries,
      screenshots or documentation examples.
- [ ] Working data stays under gitignored paths only, and `.local/` remains
      gitignored.
- [ ] A build or composition mode that *cannot* reach a non-synthetic path,
      verified by a refusal test rather than by convention.
- [ ] Scrub procedure for logs, backups, object storage and key material at
      programme end, with the deletion evidenced.
- [ ] History review before publication, including the existing secret scan
      extended to the new class.
- [ ] The published default composition is the synthetic one, and the
      demonstration corpus shipped publicly is the synthetic corpus.

## F. What the Slice 9 ADR itself must contain

Drafting can begin once A, B and C are answerable. The ADR must state:

- [ ] The single bounded class, purpose, organization, region, provider path
      and retention period it authorizes — and nothing else.
- [ ] That it authorizes rung 2 or 3, or, if it purports to authorize rung 4,
      why the stricter review the completion plan requires has been satisfied.
- [ ] Every gate that must pass before ingestion, expressed executably.
- [ ] The refusal behaviour for every class it does not authorize.
- [ ] Residual risks, named and accepted by a named owner.
- [ ] That the Primary Product Rule, source-binding invariants and the L5
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
