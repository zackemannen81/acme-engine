# ADR 0044 — POC #1 Live Product Acceptance Phase

Status: Accepted
Date: 2026-08-15
Decision owners: ACME maintainers

## Context

ADR-0040 separated permanent product invariants from synthetic-phase controls
and authorized one bounded Stage A live class. ADR-0039 fixed the live model-job
runtime, including a two-ceiling budget: a per-run ceiling declared in the
confirmation and an absolute deployment ceiling supplied by configuration.
ACME-0105 implemented that boundary fail-closed, and ACME-0111 through
ACME-0122 drove the provider path until ACME-0121 committed eight real
source-bound observations from one real call.

Those controls answered the question that was open at the time: can this
architecture reach a live provider without uncontrolled spend or silent mock
substitution? That question is answered. What remains encoded in the
composition and in task charters is the apparatus built to answer it — a
deployment call ceiling that must exist before the live capability resolves at
all, monetary ceilings as refusal preconditions, and charter rules capping a
campaign at six calls with no retry and no correction after a consumed call.

Retaining that apparatus now changes what is under test. A run that may not
retry, may not exceed six calls and may not be repaired mid-flight does not
exercise the Evidence Integrity Workbench; it exercises an artificially
handicapped variant of it, and a green result from that variant does not
support a claim about the product.

The first sustained browser use made the gap concrete. Inside one session the
product wedged itself at product evidence revision 2 against engine revision 5;
the live observation worker was found writing observations into the product
before the guard that rejects the projection; the observation job re-collected
every prior observation for an artifact rather than the executing run's; and
every session expired fifteen minutes after process start because the
development authenticator issues one fixed expiry for the process lifetime.
None of these are reachable by a deterministic offline suite or by a
six-call one-shot gate. All of them are ordinary consequences of a real
workflow against real persistence — which is precisely why the persistent
environment is now the test object rather than the test harness.

## Decision

### 1. The POC question changes

POC #1 acceptance is no longer "can we build the Evidence Integrity Workbench
correctly?" It is "can the Evidence Integrity Workbench carry a real evidence
workflow correctly?"

The acceptance shape is one continuous path:

real document → persistent case → real model calls → observations → human
review and acceptance → relations, open questions and assessment → persistent
projections → produced report/export → replay and audit verification.

No synthetic observation list may be injected part-way. No mock gateway may
stand in for the provider. No in-memory or file repository may stand in for
PostgreSQL. No object store may stand in for the private encrypted bucket.

### 2. Permanent guardrails

These are correctness properties of the product and are not relaxed by this
decision. They hold in every profile, alongside the ADR-0040 §1 invariants:

- strict schema validation of every model response and every product command;
- fail-closed refusal: an unproven precondition refuses rather than degrades;
- revision and integrity guards between engine state and product projection;
- transactional mutation: a refused projection leaves no partial product state;
- idempotency through command keys and exact resubmission;
- case isolation and deny-by-default authorization on every route;
- append-only, content-free audit for every product and live operation;
- provider-call logging: every call recorded with model, outcome and usage;
- cost measurement over recorded calls.

The ADR-0040 §5 live composition tuple — durable PostgreSQL, live provider,
authorized-external Stage A source, authorized-live execution authority —
remains conjunctive and fail-closed. It is a guardrail, not a phase control.

### 3. Retired phase controls

The following stop being preconditions:

- the deployment call ceiling as a condition for the live capability to exist.
  A live composition no longer refuses to resolve because no absolute maximum
  is configured;
- the monetary cost ceiling as a refusal precondition;
- charter rules capping a campaign at a fixed number of calls, forbidding
  retry, or forbidding code correction after a consumed call;
- mock gateways, in-memory or file persistence and fixture sources as
  acceptable substrate for a POC acceptance claim.

Operators may still configure an absolute maximum. It becomes optional
operator policy rather than a structural requirement.

### 4. Bounding an execution is not capping a campaign

These are different things and only one of them is a guardrail.

**Bounding an execution** stays. A single execution declares how many model
calls it may make, and exceeding that bound is a defect. This is runaway
protection and it is what makes "this job made exactly one call" auditable.

**Capping a campaign** goes. How many calls a case needs in total is an
outcome to be measured, not a limit to be enforced. If completing a real case
takes seven calls, seven is the finding.

### 5. Cost is governed by measurement

`acme.model_calls` already records every provider call. Cost governance is
reporting over that table — per job, per case and per acceptance run — not
refusal at an arbitrary threshold. An acceptance run reports its actual call
count, token usage and derived cost as evidence.

Spend protection that genuinely belongs to the operator stays with the
operator: the prepaid provider account is the real ceiling, and it does not
require the product to amputate its own execution.

### 6. Three separated verification tiers

| Tier | Substrate | Provider | Claim it supports |
| --- | --- | --- | --- |
| Offline deterministic suite | in-memory/file/SQLite | mock | the code behaves as specified |
| Live integration suite | real PostgreSQL, real object store | real | the composition works against real infrastructure |
| POC acceptance | real PostgreSQL, real object store, real case | real | the product performs a real evidence workflow |

The offline suite stays fast, free, reproducible and runs continuously. It
gates CI. It may never be reported as POC validation.

Only a POC acceptance run may state that POC #1 works. A green offline suite
concurrent with a product that mutates state in the wrong order on first real
use is the exact failure this separation exists to prevent.

### 7. Applicability of earlier decisions

- ADR-0039 §5's two-ceiling rule is amended in applicability: the run ceiling
  remains as execution bounding under §4; the deployment ceiling is no longer a
  precondition for live composition. The rest of ADR-0039 stands.
- ADR-0040 §1 invariants and §5 fail-closed tuple stand unchanged. Its §2
  profile-local controls continue to govern the synthetic/test profile.
- ADR-0035, ADR-0036, ADR-0037, ADR-0038 and ADR-0041 through ADR-0043 apply
  unchanged.
- Stage B remains closed. This decision widens execution policy, never data
  authority.

No historical ADR is edited or marked obsolete by this decision.

## Alternatives Considered

### Keep the six-call campaign cap and proceed carefully

- Benefits: preserves an apparently conservative posture and the existing
  frozen charter.
- Costs: the acceptance run cannot complete a real case, cannot retry a
  provider refusal and cannot absorb a correction, so it cannot answer the
  question the POC now asks.
- Reason not selected: the cap protects against a risk that measurement already
  covers while blocking the evidence the POC exists to produce.

### Remove all budget concepts

- Benefits: simplest execution path.
- Costs: loses runaway protection inside a single execution and the auditable
  "exactly one call" property that resume and replay proofs depend on.
- Reason not selected: execution bounding is a correctness guardrail; only the
  campaign cap is a phase control.

### Keep accepting the POC on the offline deterministic suite

- Benefits: fast, free and already green.
- Costs: it was green while the worker mutated product state before its own
  guard and while every session died fifteen minutes after start.
- Reason not selected: a suite that cannot observe transaction boundaries,
  persistence, reconnects, migrations, partial failures or real projection
  state cannot certify a product whose value is exactly those properties.

## Consequences

### Positive

- The POC claim becomes falsifiable against the artifact users will operate.
- Defects of the class just found — ordering, revision divergence, session
  lifetime — become reachable by the acceptance tier that is supposed to find
  them.
- Cost becomes data rather than a constraint, and real call counts per case
  become a reportable POC result.

### Negative

- Acceptance runs cost real money and cannot be replayed for free.
- A real run may consume calls and still fail, and that outcome must be
  recorded rather than retried into silence.
- The live integration and acceptance tiers need real infrastructure to be
  available, so they cannot gate every commit.

### Risks

- Removing the structural ceiling shifts spend protection to the operator's
  prepaid account. Measurement must therefore be reported per run, not
  discovered afterwards.
- Deterministic offline gates remain the default, so a live regression can
  reach acceptance undetected. The live integration tier exists to narrow that
  window and must be run before an acceptance attempt.
