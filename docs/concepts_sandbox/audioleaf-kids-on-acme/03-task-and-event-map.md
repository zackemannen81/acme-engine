# Task inventory, events and orchestrator sequence

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

Companion to [`01-architecture.md`](01-architecture.md) and
[`02-package-api.md`](02-package-api.md).

## 1. Task inventory

| Module | Task | Role | Model? | Writes state? | Writes memory? | Primary documents |
| --- | --- | --- | --- | --- | --- | --- |
| `kids.narrative` | `bootstrap-story` | transformer | no* | yes | seed facts | — |
| `kids.narrative` | `generate-outline` | producer | yes (creative) | outline + title | no | `kids.outline` |
| `kids.narrative` | `generate-chapter` | producer | yes (creative) | optional / deferred | no | `kids.chapter` |
| `kids.narrative` | `analyze-continuity` | analyzer | yes (analysis) | snapshot, window, chapter status | facts, character, clues… | `kids.continuity-report` |
| `kids.safety` | `chapter-safety-audit` | analyzer | yes (safety) | no | no | `kids.safety-report` |
| `kids.illustration` | `extract-illustration-briefs` | producer | yes (analysis) | no / later asset refs | no | `kids.illustration-briefs` |
| `kids.illustration` | `extract-cover-brief` | producer | yes (analysis) | cover brief only | no | `kids.cover-brief` |

\*bootstrap may be product-side StateEngine seed if core cannot run a no-gateway execution yet.

### Explicitly not tasks (product / adapters)

| Step | Mechanism |
| --- | --- |
| Job claim / retry | Product job ledger + Inngest |
| Forbidden-word regex | Pre-gateway pure policy |
| OpenAI Moderation | `ModerationGateway` |
| Parent PIN approve/reject | Product API + review table |
| Anchor secure / collage | Pure policy + `ImageGateway` |
| Chapter / cover image pixels | `ImageGateway` + `StorageGateway` |
| Projection to `story_books` | Outbox consumer / projector |
| STT / TTS / photo-traits | Product ports |
| Leafs / purchase | Product economy |

## 2. Outbox / domain events (sketch)

| Event type | When | Typical consumers |
| --- | --- | --- |
| `kids.story.bootstrapped` | after bootstrap | seed job ledgers, seed book row |
| `kids.outline.ready` | outline committed | promote chapter-1 job, optional outline projection |
| `kids.chapter.generated` | chapter document stored (pre or post safety) | optional telemetry only |
| `kids.safety.audited` | safety task done | metrics; orchestrator already branched |
| `kids.chapter.committed` | continuity applied | text projector, enqueue illustration finalize, next chapter |
| `kids.illustration.briefs-ready` | briefs document stored | illustration job prepare + ImageGateway |
| `kids.cover.brief-ready` | cover brief stored | cover image job |
| `kids.image.materialised` | **product** event after storage put | image projector (not ACME module) |

Core outbox delivers **at-least-once** after commit; product handlers must be
idempotent on event key + entity revision.

## 3. Full book sequence (happy path)

```text
[Product] onboarding + gates + purchase
    │
    ▼
[Product] create storyId, seed characters links
    │
    ▼
[EE] kids.narrative / bootstrap-story
    │  event: kids.story.bootstrapped
    ▼
[Product] seed kids_text_jobs2 + illustration_jobs2 + story_books stub
    │
    ▼
[EE] kids.narrative / generate-outline
    │  event: kids.outline.ready
    ▼
[Product] mark outline job complete; queue chapter 1
    │
    └────────── for each chapter 1..N ──────────┐
                │                               │
                ▼                               │
        [Product] claim text job                │
                │                               │
                ▼                               │
        [optional] RAG preflight                │
                │                               │
                ▼                               │
        [EE] generate-chapter ◄──┐              │
                │                │              │
                ▼                │              │
        [EE] chapter-safety-audit│              │
                │                │              │
           pass / revise / block │              │
                │                │              │
         revise ─┘  (max 2)      │              │
                │                │              │
              block → parent review wait ───────┤
                │                               │
              pass                              │
                │                               │
        ┌───────┴────────┐                      │
        ▼                ▼                      │
[EE] analyze-continuity  [EE] extract-briefs    │
        │                │                      │
        │ event: chapter.committed              │
        │ event: briefs-ready                   │
        ▼                ▼                      │
[Product] project text   [Product] ImageGateway │
        │                + Storage              │
        │                ▼                      │
        │         project images                │
        │                │                      │
        └─────── next chapter or finish ────────┘
                │
                ▼
        [EE] extract-cover-brief (if not earlier)
                │
                ▼
        [Product] cover image + project
                │
                ▼
        [Product] completeness / library visibility
```

## 4. Safety branch detail

```text
generate-chapter (r0)
  → safety-audit
       → pass → continue pipeline
       → revise → generate-chapter (r1, note) → safety-audit → …
       → block after max or hard block
            → kids_text_jobs2 = blocked_review
            → story_parent_reviews row
            → wait PIN
                 → reject: terminal for that path
                 → approve retry_generation: re-queue job (same job id semantics)
                 → approve apply_content:
                      edited text re-runs safety-audit only
                      pass → continue from continuity
                      non-pass → new pending review (no canon write)
```

## 5. Illustration branch detail

```text
briefs-ready
  → secure anchors (reuse character_anchor_images / story_anchor_images)
  → if missing: ImageGateway(kind=anchor) → Storage → record assetRef
  → for each slot:
       preparePrompt(pure)
       ImageGateway(kind=chapter)
       Storage
  → project primary_image_asset_url (+ extras)
  → on scenographer failure after retries: NO fallback image (product policy)
```

## 6. Mapping production Inngest handlers → sketch

| Production handler (approx.) | Sketch |
| --- | --- |
| `text_initHandler` | mark outline job; emit chapter queue (outline already EE) |
| `text_outlineHandler` | same; no second outline model call |
| `text.chaptertext` / chapter function | `runChapterPipeline` |
| `text.analyzetext` | `analyze-continuity` inside pipeline (or parallel child) |
| `illustration.scenografen` | `extract-illustration-briefs` |
| image prepare/dispatch/finalize | ImageGateway + jobs ledger |
| cover extraction + image | `extract-cover-brief` + ImageGateway |
| `story/review.required` | product only |
| review resolve API | `resolveParentReview` |

## 7. Preview vs complete (readiness)

Product helper (keep outside modules):

```ts
function resolveKidsStoryReadiness(readerPayload, vaultOutline, pendingReview): {
  readonly previewReady: boolean; // ch1 text + ch1 image + cover
  readonly complete: boolean;     // all chapters + primary images
  readonly blockedOnReview: boolean;
}
```

ACME state alone is insufficient for preview (images live in product
projection). Orchestrator/projector must combine narrative commit events with
image materialisation events.

## 8. Offline vs live coverage matrix

| Capability | ScenarioRunner | Product integration test |
| --- | --- | --- |
| Outline/chapter/continuity contracts | yes | yes |
| Memory identity / continuity apply | yes | yes |
| Safety pass/revise/block reports | yes (scripted) | yes |
| Safety revision loop | partial (multi execute steps) | yes |
| Parent review wait | no | yes |
| Image fallback policy | no | yes |
| Leafs / auth gates | no | yes |
| Replay digest after crash | yes (engine) | optional |
| Full 6-chapter fact book | yes with fixtures | staging live gated |

## 9. Contract ref catalogue (initial)

| Ref id | Version | Module |
| --- | --- | --- |
| `kids.outline.standard` | `1.0.0` | narrative |
| `kids.outline.faktabok` | `1.0.0` | narrative |
| `kids.chapter.standard` | `1.0.0` | narrative |
| `kids.chapter.faktabok` | `1.0.0` | narrative |
| `kids.continuity.analysis` | `1.0.0` | narrative |
| `kids.safety.chapter-audit` | `1.0.0` | safety |
| `kids.illustration.extraction` | `1.0.0` | illustration |
| `kids.cover.extraction` | `1.0.0` | illustration |

Source templates: `acme-domain_kids/contracts/*` and safety modules under
`policies and functions/safety/`.

## 10. Operation key conventions (idempotency)

```text
kids:{storyId}:bootstrap
kids:{storyId}:outline
kids:{storyId}:chapter:{chapterId}:gen:r{n}
kids:{storyId}:chapter:{chapterId}:safety:r{n}
kids:{storyId}:chapter:{chapterId}:continuity:{contentHash}
kids:{storyId}:chapter:{chapterId}:briefs:{contentHash}
kids:{storyId}:cover:brief
```

Product job retries must reuse the same operation key for the same logical
attempt so ExecutionEngine resume does not double-bill providers.
