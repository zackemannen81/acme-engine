# Local workbench durable execution ledger

Status: resolved / not applicable; not activated
POC #1 - accepted as is.

Decision: none yet. Changing the local composition's ledger persistence is an
architecture choice and needs a frozen charter, and probably an ADR.

## Discovery Context

Reported by the operator on 2026-08-12: several pages of the local Evidence
workbench show

```text
Workspace evidence revision does not match the supplied Evidence projection.
```

Reproduced deterministically. The local file composition persists the **product
store** to `.local/evidence-workbench/*.json` but creates the **ACME execution
ledger** with `createInMemoryExecutionRepository`. The seed import runs only
when the product store has no sources or no observations, so on any restart
against an existing product file the seed is skipped and the ledger stays
empty.

`evidenceProjection()` therefore returns `initialEvidenceState()` at revision 0
while the persisted workspace records revision N. Every builder that calls
`requireProjectionRevision` then throws:

- `buildEvidencePrimaryObservationLedgerView` — Observation ledger
- `buildEvidencePrimaryAccountComparisonView` — Compare accounts
- `buildEvidencePrimaryRelationReviewView` — Relations
- `buildEvidencePrimaryOpenQuestionsView` — Open questions
- and the timeline view on the same path

Views that do not project domain state keep working, which is why only *some*
pages fail: work queue, source review, assessment, search, case overview and
the Case Integrity Report are unaffected.

Reproduction, two starts against one data file:

```text
first start (fresh file) : product=1 projection=1 -> ok
second start (same file) : product=1 projection=0 -> throws
```

## Why this is not simply a defect

`apps/evidence-workbench-api/README.md` already records the constraint: the
local slice "deliberately keeps its ACME ledger in memory", and it instructs
using a fresh product file for a new session. The behaviour is intended; what
is missing is any signal when the instruction is not followed.

Restarting the composition against an existing product file is also a
*supported* flow — `local-blackbox.test.ts` restarts to prove import and
redaction records survive. It reads the repository directly and never serves a
projecting view, so it passes. A startup refusal was tried during the
investigation and rejected precisely because it broke that flow.

## Proposed Outcome

Pick one, under a frozen charter:

1. **Durable local ledger.** Compose the local file mode with the existing
   SQLite execution repository beside the product file so both persist
   together. Closest to the documented "SQLite is the local/hermetic default"
   position, and makes restart simply work. Adds a SQLite dependency to the
   local run path.
2. **Startup refusal with an opt-out.** Refuse to start when the product store
   records a revision this process cannot project, with an explicit option for
   callers that only want to inspect persisted records. Cheap, but leaves the
   product single-session.
3. **Rebuild the projection from the product store.** Rejected on sight: state
   is owned by the domain reducer, and re-deriving it outside that path would
   violate the fixed guardrail that state changes require an explicit delta,
   reducer and invariants.

Option 1 is the recommendation.

## Out of Scope

- Any change to the hosted PostgreSQL composition, whose ledger is already
  durable and does not exhibit this.
- Data authority. This is composition wiring; nothing here touches the
  synthetic-only policy or Slice 9.

## Interim Operator Guidance

Delete the stale product file and its siblings, then restart:

```bash
rm -rf .local/evidence-workbench
```
