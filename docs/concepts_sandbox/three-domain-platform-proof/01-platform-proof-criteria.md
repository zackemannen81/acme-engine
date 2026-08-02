# Platform proof criteria — Kids + Research + Legal

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

## 1. Claim under test

> ACME is a domain-neutral, replayable AI execution engine. Products are
> modules + policies + contracts + product orchestrators. The core does not
> grow domain vocabulary or product workflow special cases.

## 2. Shared substrate (must be identical binaries / packages)

All three products use the same:

| Component | Role |
| --- | --- |
| `ExecutionEngine` | One task at a time |
| `MemoryEngine` | Candidate → resolution → mutations |
| `StateEngine` | Delta + reducer + invariants + revision |
| `ResponsePipeline` | Empty / parse / schema / semantic |
| PromptContract machinery | Versioned I/O + capabilities |
| ModelGateway port | Provider-neutral calls |
| ExecutionRepository / UoW | Ledger, model-call retention, resume |
| Hashing / digests / replay | Bit-stable evidence |
| Outbox | Post-commit delivery boundary |
| ScenarioRunner | Offline multi-step proof (linear) |

**Not shared (by design):** domain packages, product apps, image/voice/PDF
ports, job queues, billing, UI, read models.

## 3. Hard constraints (fail the claim if violated)

1. **No domain words in core** — no chapter, DOI, witness, exhibit, vibe.  
2. **No product workflow in core** — no Inngest, no parent-PIN, no court export.  
3. **No silent overwrite** — contest/supersede/coexist are policy outcomes with
   retained history where required.  
4. **Model output is never canon** — only after validate + interpret + commit.  
5. **Adapters do not decide domain** — providers don’t encode “block chapter”
   or “witness is unreliable” as engine truth.  
6. **Provider swap** — change gateway implementation; modules unchanged.  
7. **Replay** — same fixtures → same state, documents, memory decisions, digest.  
8. **New product** — primarily new modules/policies/contracts/orchestrator,
   not a core fork.

## 4. Shared memory operations (same engine, three policies)

| Op | Kids | Research | Legal |
| --- | --- | --- | --- |
| **create** | New character/world fact | New proposition from paper | New situated statement |
| **reinforce** | Repeated comfort / reinforced fact | Independent corroborating study | Re-extract / repeated utterance policy |
| **merge** | Policy-defined fact merge | Refine polarity / combine support | Rare; prefer coexist by scope |
| **contest** | Continuity contradiction | Contradicting result | S1 vs S2 testimony |
| **supersede** | Evidence-backed correction | Stronger study replaces standing | Transcript correction same artifact |
| **reject** | Invalid / unsafe structural output | Quote not in source | Quote not in transcript |
| **ignore** | Duplicate noise | Non-independent duplicate support | Duplicate locator |

If Legal needs a new *engine* op that Kids/Research don’t, that is a core
design smell — prefer expressing it as policy over the existing op set.

## 5. Distinct pressures (why three is stronger than two)

```text
Kids        → long generative chains, safety revision loops, multimodal side path
Research    → generative prose + citation graph + stale sections on new evidence
Legal       → time/person/source scope, forced coexistence, assessment uncertainty
```

Research is the **bridge**: generative like Kids, evidence-hard like Legal.

Legal is the **exam**: approximate understanding is insufficient; provenance
and non-deletion under contradiction are mandatory.

## 6. Minimum proof scenarios (one per product)

### Kids

```text
bootstrap → outline → chapter-1 → safety pass → continuity
  → briefs document (image optional offline)
replay digest
```

### Research

```text
observe A (support P) → observe B (verify P) → outline → draft results
  → validate pass → observe C (contest P) → validate fails
  → revise → validate pass with qualified claim
replay digest
```

### Legal

```text
extract S1 (door open T1) → extract S2 (door locked T2)
  → extract D + V → cross-ref → timeline → assessment with conflicts + uncertainty
assert all statements still active
replay digest
```

All three digests stable under mock gateway; none require the others’ packages.

## 7. Product shell checklist (each app)

| Shell piece | Kids | Research | Legal |
| --- | --- | --- | --- |
| Composition root | yes | yes | yes |
| Orchestrator beyond ScenarioRunner | Inngest book pipeline | section + revalidate | extract + assess HITL |
| Read model | ReaderPayload / books | paper + claim graph | case file + timeline UI |
| Extra ports | Image, voice, moderation | PDF, DOI, vector | bundle, transcription, redaction |
| Human gates | parent review, safety block | validation block | assessment accept |

## 8. Anti-goals

- Building a universal ontology inside core  
- One “UberModule” with `if (domain === …)`  
- Treating embeddings as canon memory  
- Workflow language in v1 core (product orchestrators remain)  
- Claiming legal fitness for real-world adjudication from this sketch  

## 9. What would count as “proved in practice”

A conservative bar (concept, not charter):

1. Three product module packages in a workspace (or separate repos) depending
   only on `@acme/core` (+ pure policy packages).  
2. Boundary tests: dependency-cruiser forbids domain → adapter and core domain
   vocabulary.  
3. Shared conformance: MemoryEngine/StateEngine kits green for all three.  
4. Three offline scenarios with locked digests in CI (mock gateway).  
5. At least one live gated path per product (optional, budgeted) without module
   changes.  
6. Documented resume: crash after model call, re-execute, zero extra provider
   calls (existing ACME property) on a task from each product.

Until then, these folders remain **design sketches**, not proof.

## 10. Suggested narrative for stakeholders

```text
ACME core = camera body
Kids / Research / Legal = different lenses + different shoots
Same shutter, same film pipeline (ledger/replay), different subjects
```

Or:

```text
Core executes and remembers mechanically.
Domains decide what counts as the same fact, a fight, or a replacement.
Products decide who is allowed to run the next step.
```

## 11. Links

- [`../audioleaf-kids-on-acme/`](../audioleaf-kids-on-acme/)  
- [`../research-paper-composer-on-acme/`](../research-paper-composer-on-acme/)  
- [`../legal-evidence-on-acme/`](../legal-evidence-on-acme/)  
- Existing conflict benchmark:
  [`../acme_cm_001_memory_conflict_benchmark/`](../acme_cm_001_memory_conflict_benchmark/)  
- Reference modules in repo: `@acme/module-narrative`, `@acme/module-research`
