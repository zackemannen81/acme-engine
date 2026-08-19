# POC #1 live product acceptance

Status: not applicable. Not activated. Depends on ACME-0131 and on ADR-0044 being
accepted.
POC #1 - accepted as is.

Purpose: define the acceptance run that is entitled to say POC #1 works.

This file grants nothing. It widens no data authority: Stage A remains the only
authorized non-synthetic class under ADR-0040, and Stage B stays closed.

## Discovery context

ACME-0129 was frozen as a six-call, one-shot Vitest gate. Its premise — that
live execution still had to be proven safe against uncontrolled spend — was
answered by ACME-0111 through ACME-0122. ADR-0044 records the resulting phase
change and supersedes that premise.

The first sustained real browser session then exposed four defects that no
offline suite and no bounded probe could have reached: a product wedged at
evidence revision 2 against engine revision 5, a worker writing observations
before the guard that rejects them, a job collecting observations by artifact
instead of by execution, and sessions expiring on process age rather than
sign-in. ACME-0131 repairs those. This proposal is what runs afterwards.

## Proposed outcome

One continuous real workflow, driven through the same authenticated case-first
surfaces a reviewer uses, on the real substrate:

1. import a real authorized Stage A document into a persistent case;
2. run live observation and produce source-bound candidates;
3. review them as a human: accept, reject and leave unresolved;
4. run live relation analysis and produce typed relations and open questions;
5. produce an assessment from accepted, source-complete evidence;
6. review the assessment;
7. import later evidence, observe the assessment become stale, and produce a
   reviewed successor;
8. release a report/export under the case export policy;
9. restart the process and reproduce the reviewed case from PostgreSQL;
10. verify replay and the audit trail.

No synthetic observation list is injected part-way. No mock gateway. No
in-memory or file repository. No fixture standing in for the source.

## Why this is outside the ACME-0131 charter

ACME-0131 is corrective and offline-verifiable. This is an acceptance run that
costs real money, needs real infrastructure and produces a claim rather than a
fix. They have different verification stories and must be approvable
separately.

## Dependencies

- ACME-0131 complete: session lifetime, execution-scoped collection,
  projection ordering and workspace scoping repaired.
- ADR-0044 accepted, and its retirement of the deployment call ceiling and cost
  ceiling implemented, so the run is not amputated part-way.
- A live integration tier that has been run against real PostgreSQL and a real
  object store before any acceptance attempt.
- A fresh case. The `POC1-AUTO-UI` case is wedged and is not a valid substrate.

## Suggested verification

- Domain outcomes only: sources, observations with exact locators, review
  standings, relations, open questions, assessment citations, stale predecessor
  and reviewed successor, released export, reproduced case after restart.
- Content-free evidence throughout. No source text in logs, audit records,
  journal or Git.
- Cost reported, not capped: actual call count, token usage and derived cost
  read from `acme.model_calls` per job and for the whole run.
- A failed run is recorded as a finding with its consumed calls, never retried
  into silence.

## Open questions

- Which real document pair is used, and is the later-evidence step served by a
  second document or a new version of the first?
- Does the acceptance run drive the browser or the case-first API? The API is
  automatable; the browser is what the completion rule in ADR-0040 §6 actually
  describes.
- What is reported as the POC result: the domain outcome alone, or the domain
  outcome plus the measured cost of reaching it?
