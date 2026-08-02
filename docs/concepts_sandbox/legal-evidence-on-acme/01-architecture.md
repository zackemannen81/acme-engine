# Legal / Evidence × ACME — architecture draft

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

**Not legal advice.** Architecture sketch only.

## 1. Purpose

Describe how a product for **crime interrogation support, document/evidence
classification, cross-reference, and analysis** could run on ACME: separate
domain modules, strict provenance, timeline-aware memory, contested testimony,
and explicit assessments — without putting legal vocabulary into core.

## 2. Domain character

| Dimension | Requirement |
| --- | --- |
| Provenance | Every assertion links to source artifact + locator + time |
| Time | Statements are true *as uttered at T*, not eternal facts |
| Person scope | “A said X” ≠ “world is X”; speaker is part of identity |
| Contradiction | Default to **contest** or **coexist**, not overwrite |
| Supersede | Rare, explicit (e.g. corrected transcript of same utterance) |
| Uncertainty | First-class on assessments, not hidden in prose |
| Audit | Replay must reconstruct why assessment Z was current |
| Generation | Mostly analysis/classification; limited drafting (summaries) |

Compared to Kids (creative) and Research (claims about the world via papers),
Legal is primarily **meta-claims about who said/showed what when**, plus a
**working theory** that must never erase the underlying record.

## 3. Product capabilities (scope of sketch)

In scope as software capabilities:

1. **Case bootstrap** — parties, roles, charge/context labels (product-defined).  
2. **Ingest evidence artifacts** — interview transcripts, PDFs, images/video
   metadata, lab reports (bytes via adapters; text/metadata into ACME).  
3. **Classify evidence** — type, sensitivity, chain-of-custody fields (as data).  
4. **Extract statements** — atomic utterances with speaker, time, locator.  
5. **Cross-reference** — link statements to exhibits; detect conflicts.  
6. **Timeline build** — ordered events from statements + docs.  
7. **Assessment** — analyst/AI proposed theory with uncertainty + support set.  
8. **Interrogation assist** — suggested question lines from gaps/conflicts
   (producer task; always non-canon until human accepts).  

Out of scope for this sketch:

- Court filing systems, privilege determination as law, automated guilt
  determination, real-time police radio, weaponised deception tooling.

## 4. Target layering

```text
apps/legal-evidence-api | worker | web
  → adapters (object store, transcription, e-discovery import, model gateway)
  → legal-policies + domain modules
  → @acme/core
```

```text
core → no “witness”, “exhibit”, “charge”, “hearsay”
module → no courtroom UI, no S3 SDK
adapter → no “this witness is lying”
```

### 4.1 Package map

```text
packages/core                         # unchanged
packages/legal-policies               # pure: scope keys, conflict rules,
                                      # classification taxonomies, redaction rules
packages/module-legal-evidence        # artifacts, statements, exhibits memory
packages/module-legal-timeline        # optional split: timeline state
packages/module-legal-assessment      # working theories / assessments
packages/module-legal-interrogation   # question suggestions (producer)
packages/module-legal-validator       # consistency / completeness gates
packages/legal-ports                  # Transcript, MediaMeta, BundleImport
apps/legal-evidence-*
```

Namespaces may collapse into fewer packages with more tasks; separation here
is for **ownership clarity**.

## 5. Role of ACME core

| Core | Legal use |
| --- | --- |
| ExecutionEngine | One extract, one classify, one cross-ref, one assess |
| MemoryEngine | Statement & exhibit records with contest/coexist |
| StateEngine | Case roster, timeline head, current assessment pointer |
| ResponsePipeline | Structured extraction only; no free-form canon |
| Ledger | Full model-call + decision audit trail |
| Replay / digest | “Why was assessment Z current at commit C?” |
| Outbox | “statements extracted” → cross-ref job; “assessment committed” → export |

Core never decides guilt, credibility scores as truth, or privilege.

## 6. The contradiction model (heart of the sketch)

### 6.1 Example retained as structured memory

```text
S1: speaker=WitnessA, time=T1, text="The door was open", source=Interview#1
S2: speaker=WitnessA, time=T2, text="The door was locked", source=Interview#2
D1: exhibit=DocLease, date=D, asserts="Door propped open for delivery"
V1: exhibit=VideoLobby, time=Tv, asserts="Door closed at Tv"
```

| Pair | Policy outcome |
| --- | --- |
| S1 vs S2 | **coexist** under different `utteredAt`; both active; conflict edge recorded |
| S1 vs D1 | **support** edge if scopes compatible (same door, overlapping day) |
| S2 vs V1 | **contest** if same time window; else coexist with timeline gap note |
| Assessment Z | Points to support set {S1,D1}, conflict set {S2}, uncertainty high on door state at Tv |

**No record is deleted** when conflict is detected. Optional `supersede` only
for same-utterance corrections (transcript v2 replaces v1 with link).

### 6.2 Identity dimensions (domain policy)

A legal memory identity key should incorporate:

```text
kind + speakerId? + proposition + effectiveTimeRange? + sourceArtifactId + locator
```

Not merely “proposition string” as in research-about-the-world. Research keys
propositions; legal keys **situated assertions**.

Operations still map to the same engine resolutions:

| Op | Legal meaning |
| --- | --- |
| create | First extraction of a situated assertion |
| reinforce | Same speaker repeats same claim (or corroborating exhibit same content) — policy-defined |
| contest | Incompatible assertions in overlapping scope |
| supersede | Corrected extraction of *same* underlying artifact version |
| reject | Failed validation (quote not in transcript) |
| ignore | Duplicate extraction same locator |

## 7. State / memory / documents

| Track | Content |
| --- | --- |
| **State** | Case label, participants/roles, evidence inventory refs, timeline summary pointer, current assessment id, open gaps |
| **Memory** | Statements, exhibit facts, conflict edges, chain-of-custody notes, classifications |
| **Documents** | Immutable transcript text, OCR pages, assessment reports, cross-ref reports, question lists |

Working theory lives as **assessment documents + state pointer**, not as
overwriting statement memory.

## 8. Module roles

### 8.1 `module-legal-evidence` (analyzer / producer light)

- `register-artifact` (transformer) — metadata into inventory  
- `classify-artifact` — type/sensitivity taxonomy  
- `extract-statements` — atomic statements from transcript/doc  
- `extract-exhibit-assertions` — claims from docs/media descriptions  

### 8.2 `module-legal-timeline` (analyzer / transformer)

- `build-timeline` — ordered events from memory; gaps as first-class  
- `project-window` — contract context for a time range  

### 8.3 `module-legal-assessment` (producer + state)

- `propose-assessment` — theory Z with support/conflict/uncertainty  
- `revise-assessment` — after new evidence  

Human acceptance may be product-side before state pointer advances.

### 8.4 `module-legal-interrogation` (producer)

- `suggest-questions` — from conflicts and gaps; **never** writes statements  

### 8.5 `module-legal-validator` (gate)

- quote present in source  
- speaker known to case  
- time parseable or explicitly unknown  
- assessment does not cite forgotten/rejected memory  
- no silent merge of distinct utterances  

## 9. Orchestration

### Offline ScenarioRunner

```text
register interview + extract S1
register interview2 + extract S2
cross-ref → conflict edge
register video meta + extract V1
build-timeline
propose-assessment
assert: both S1 and S2 active; assessment uncertainty; digest stable
replay
```

### Production

```text
import bundle → register artifacts
for each transcript: extract-statements (EE)
for each doc: classify + extract-exhibit-assertions (EE)
cross-reference (EE)
build-timeline (EE)
propose-assessment (EE) → human review product → accept pointer
suggest-questions (EE) for next interview
new evidence → extract → cross-ref → mark assessment stale → revise
```

## 10. Security, ethics, product gates (outside core)

| Concern | Owner |
| --- | --- |
| Access control / case isolation | product authz |
| Redaction for export | legal-policies + product |
| PII retention | product + encrypted payload port |
| Human-in-the-loop for assessment publish | product |
| Model hallucination risk | validator + quote binding + no free-form memory write |

## 11. Proof criteria

Running this on **unmodified** core alongside Kids and Research shows:

1. Same engines and ledger.  
2. No legal words in core.  
3. Same op vocabulary; different identity/scope policy.  
4. Contradiction → contest/coexist, not delete.  
5. Replay reconstructs assessment Z with sources.  
6. Provider swap does not move domain logic into adapters.

## 12. Suggested build order

1. Statement schema + extract-statements + quote binding tests.  
2. Two-interview conflict scenario (S1/S2) golden digest.  
3. Exhibit support/contest with time scopes.  
4. Timeline builder pure + task.  
5. Assessment propose/revise + validator.  
6. Interrogation suggestions last (lowest criticality for proof).  
7. Import adapters + redaction export.

## 13. Open questions

1. Are conflict edges memory records or derived documents only?  
2. Credibility scoring: exclude from v1 (too normative) or explicit non-canon diagnostic?  
3. Multi-jurisdiction taxonomies as policy packs?  
4. Media: store frames as artifacts; vision model as extract task with same quote/locator rules?  
5. Shared package with research for “proposition text normalize” only?

## 14. Summary

**Legal/evidence on ACME is a situated-assertion memory system with timeline
and assessment layers: the model proposes structure; the engine retains every
utterance and exhibit claim under scope; contradictions become explicit
contest or coexistence; current judgment is a pointer with uncertainty — never
a silent overwrite of the record.**
