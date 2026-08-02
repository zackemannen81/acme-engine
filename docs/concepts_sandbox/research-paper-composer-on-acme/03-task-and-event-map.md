# Research Paper Composer — tasks, events, sequences

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

## 1. Task inventory

| Module | Task | Role | Model? | State | Memory | Documents |
| --- | --- | --- | --- | --- | --- | --- |
| `research.evidence` | `observe-evidence` | analyzer | yes | source keys, questions | claims, sources | source snapshot |
| `research.composer` | `bootstrap-paper` | transformer | no* | meta | optional seed Q | — |
| `research.composer` | `plan-outline` | producer | yes | outline | no | `research.outline` |
| `research.composer` | `draft-section` | producer | yes | section status | no | `research.section` |
| `research.composer` | `revise-section` | producer | yes | section status | no | `research.section` |
| `research.composer` | `compile-paper` | transformer | no | optional compile stamp | no | `research.paper` |
| `research.validator` | `validate-section` | analyzer | yes | no | no | `research.validation-report` |

\*or product seeds composer state without EE.

### Not tasks

| Step | Owner |
| --- | --- |
| PDF text extraction | `PdfIngestGateway` |
| DOI metadata | `DoiResolveGateway` |
| Vector recall | `VectorSearchGateway` (hints only) |
| Bibliography formatting | pure policy + compile |
| Human edit / accept paper | product UI |
| Mark sections stale after new evidence | orchestrator + state delta |

## 2. Events

| Event | Emitter | Consumers |
| --- | --- | --- |
| `research.project.bootstrapped` | bootstrap | UI project row |
| `research.source.observed` | observe-evidence | index vectors; stale scan |
| `research.claim.standing-changed` | post-memory projection | re-validate sections |
| `research.outline.ready` | plan-outline | draft queue |
| `research.section.drafted` | draft/revise | validate queue |
| `research.section.validated` | validator | status patch; compile eligibility |
| `research.section.stale` | orchestrator | re-draft / re-validate |
| `research.paper.compiled` | compile | export / share |

## 3. Happy path — new paper

```text
[Product] create project
  → [EE] bootstrap-paper
  → [Product] ingest N sources (PDF/DOI/text)
  → for each source:
       [EE] observe-evidence
  → [EE] plan-outline
  → for each section in order (or parallel where safe):
       [EE] draft-section
       [EE] validate-section
            pass → mark validated
            revise → [EE] revise-section → validate again (max K)
            block → human review product path
  → [EE/transformer] compile-paper
  → project read models
```

## 4. New evidence path (revision without silent overwrite)

```text
[Product] ingest source Z
  → [EE] observe-evidence
       memory: create | reinforce | contest | supersede
  → standing sets update (verified/contested)
  → event research.claim.standing-changed
  → [Orchestrator] compute affected sections
       (sections that cited superseded/contested propositions)
  → mark sections stale in composer state
  → for each stale section:
       validate first (may already fail)
       revise-section with new allowedMemoryIds
       validate until pass or block
  → compile new paper snapshot (old snapshot retained as document history)
```

**Invariant:** previous section documents and memory records remain in ledger;
new compile produces a new document key, not an in-place mute edit.

## 5. Contradiction handling (research policy)

| Situation | Memory op | Paper effect |
| --- | --- | --- |
| Second independent study supports P | reinforce | claim may move deferred → verified |
| Study contradicts P | contest | both retained; validator flags overclaim if draft asserts P as settled |
| Stronger meta-analysis replaces weak study | supersede | prior record history-linked; drafts using old id go stale |
| Same lab republishes same dataset | ignore / no reinforce | independence policy |

This is the same *engine* operation set Legal will use; only policy thresholds
and identity keys differ.

## 6. Offline scenario sketch

```yaml
id: research-compose-contest-revise
steps:
  - execute: observe-evidence  # source A supports P
  - execute: observe-evidence  # source B supports P → verify
  - execute: plan-outline
  - execute: draft-section     # results asserts P
  - execute: validate-section  # pass
  - execute: observe-evidence  # source C contradicts P → contest
  - assert: contested contains P
  - execute: validate-section  # same draft → revise/block
  - execute: revise-section
  - execute: validate-section  # pass with qualified language
  - replay + assertDigest
```

## 7. Operation keys

```text
research:{projectId}:bootstrap
research:{projectId}:observe:{documentKey}
research:{projectId}:outline
research:{projectId}:draft:{sectionId}:r{n}
research:{projectId}:revise:{sectionId}:r{n}
research:{projectId}:validate:{sectionId}:{sectionDocKey}
research:{projectId}:compile:{paperDocKey}
```

## 8. Contract catalogue (initial)

| Ref id | Version |
| --- | --- |
| `research.observe-evidence` | `1.0.0` (align reference) |
| `research.plan-outline` | `1.0.0` |
| `research.draft-section` | `1.0.0` |
| `research.revise-section` | `1.0.0` |
| `research.validate-section` | `1.0.0` |

## 9. Coverage matrix

| Capability | ScenarioRunner | Product test |
| --- | --- | --- |
| Quote must appear in source | yes | yes |
| Independence-limited verify | yes | yes |
| Contest retains both sides | yes | yes |
| Supersede keeps history | yes | yes |
| Section validation gate | yes | yes |
| Stale-on-new-evidence | multi-step scenario | yes |
| PDF ingest | no | yes |
| Provider swap | gateway mock swap | live gated |

## 10. Link to ACME-CM-001

Memory conflict benchmark cases should be expressible as
`observe-evidence` sequences under this product’s policy pack. Passing
CM-001-style suites on product policy is a stronger claim than unit-testing
the reference module alone.
