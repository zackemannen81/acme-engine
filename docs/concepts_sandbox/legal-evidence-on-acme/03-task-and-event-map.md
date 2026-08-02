# Legal / Evidence — tasks, events, sequences

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

**Not legal advice.**

## 1. Task inventory

| Module | Task | Role | Model? | Writes memory? | Notes |
| --- | --- | --- | --- | --- | --- |
| `legal.evidence` | `bootstrap-case` | transformer | no | no | roster + label |
| `legal.evidence` | `register-artifact` | transformer | no | custody optional | inventory + doc |
| `legal.evidence` | `classify-artifact` | analyzer | yes | classification | taxonomy bound |
| `legal.evidence` | `extract-statements` | analyzer | yes | statements | quote-bound |
| `legal.evidence` | `extract-exhibit-assertions` | analyzer | yes | exhibit assertions | quote-bound |
| `legal.evidence` | `cross-reference` | analyzer | yes/hybrid | edges or docs | conflicts + gaps |
| `legal.timeline` | `build-timeline` | transformer | no* | no | pure sort v1 |
| `legal.assessment` | `propose-assessment` | producer | yes | no | report + pointer |
| `legal.assessment` | `revise-assessment` | producer | yes | no | history retained |
| `legal.interrogation` | `suggest-questions` | producer | yes | no | never statements |
| `legal.validator` | `validate-extraction` | analyzer | optional | no | gate |
| `legal.validator` | `validate-assessment` | analyzer | optional | no | gate |

\*optional model assist later, low trust.

### Product-only

| Step | Owner |
| --- | --- |
| Bundle import / media upload | ports |
| Transcription of raw audio | TranscriptionGateway then register text |
| Human accept assessment | product audit + state accept |
| Redacted export | RedactionExportGateway |
| Authz / case isolation | product |

## 2. Events

| Event | When | Consumers |
| --- | --- | --- |
| `legal.case.opened` | bootstrap | UI case row |
| `legal.artifact.registered` | register | extraction queue |
| `legal.artifact.classified` | classify | UI badges |
| `legal.statements.extracted` | extract-statements | validate + xref |
| `legal.exhibits.extracted` | extract-exhibit | xref |
| `legal.crossref.updated` | cross-reference | timeline, assessment stale |
| `legal.timeline.rebuilt` | build-timeline | UI |
| `legal.assessment.proposed` | propose | human review queue |
| `legal.assessment.accepted` | product accept | export eligibility |
| `legal.assessment.stale` | new evidence | revise queue |
| `legal.questions.suggested` | suggest-questions | interview prep UI |

## 3. Happy path — new case

```text
[Product] open case + participants
  → [EE] bootstrap-case
  → [Product] import bundle / upload media
  → for each artifact:
       [EE] register-artifact
       [EE] classify-artifact
       if transcript/doc:
         [EE] extract-statements | extract-exhibit-assertions
         [EE] validate-extraction
       if fail → human fix / re-OCR product path
  → [EE] cross-reference
  → [EE] build-timeline
  → [EE] propose-assessment
  → [EE] validate-assessment
  → [Product] human accept (rationale required)
  → [EE] suggest-questions (optional)
```

## 4. Canonical contradiction scenario (platform exam)

Narrative:

```text
Witness A @ T1: "The door was open."     (Interview 1)
Witness A @ T2: "The door was locked."   (Interview 2)
Document D: lease note supports "open" on date D0 ≠ T2
Video V @ Tv: door closed
```

Expected system behavior:

```text
1. Four memory records (or three statements + one exhibit assertion) all status active
2. cross-reference:
   - S1 vs S2 → direct-contradiction (same speaker, incompatible props, comparable scopes)
   - S1 vs D → corroboration or scope-mismatch depending on dates
   - S2 vs V → contradiction if Tv overlaps T2 window else tension + gap
3. No silent delete of S1 when S2 arrives
4. Assessment Z:
   - support: subset
   - conflict: S1 vs S2 called out
   - uncertainty: high on door state at Tv
   - every cited memory id valid
5. Replay digest matches after full sequence
```

ScenarioRunner outline:

```yaml
id: legal-door-contradiction
steps:
  - bootstrap-case
  - register + extract interview-1  # S1
  - register + extract interview-2  # S2
  - register + extract document-D
  - register + extract video-V meta/description
  - cross-reference
  - build-timeline
  - propose-assessment
  - validate-assessment  # pass
  - assert: memory count >= 4, none forgotten
  - assert: assessment has conflictMemoryIds non-empty
  - replay + assertDigest
```

## 5. New evidence path

```text
New interview-3 arrives
  → extract statements
  → cross-reference (incremental or full)
  → event assessment.stale if accepted assessment cites contested keys
  → revise-assessment (new document key)
  → historyDocumentKeys append prior
  → human re-accept required (product policy)
```

## 6. Interrogation assist path

```text
gaps + conflict report
  → suggest-questions(target=WitnessA)
  → document legal.question-list
  → human may ask questions outside system
  → new transcript registered later as normal evidence
```

Suggested questions **never** become statements without a new extract from a
real transcript.

## 7. Operation keys

```text
legal:{caseId}:bootstrap
legal:{caseId}:register:{artifactId}
legal:{caseId}:classify:{artifactId}
legal:{caseId}:extract:{artifactId}
legal:{caseId}:xref:{stateRevision}
legal:{caseId}:timeline:{stateRevision}
legal:{caseId}:assess:r{n}
legal:{caseId}:assess-revise:{priorDocKey}
legal:{caseId}:validate-extract:{artifactId}
legal:{caseId}:validate-assess:{docKey}
legal:{caseId}:questions:r{n}
```

## 8. Contract catalogue (initial)

| Ref id | Version |
| --- | --- |
| `legal.classify-artifact` | `1.0.0` |
| `legal.extract-statements` | `1.0.0` |
| `legal.extract-exhibit-assertions` | `1.0.0` |
| `legal.cross-reference` | `1.0.0` |
| `legal.propose-assessment` | `1.0.0` |
| `legal.revise-assessment` | `1.0.0` |
| `legal.suggest-questions` | `1.0.0` |
| `legal.validate-extraction` | `1.0.0` |
| `legal.validate-assessment` | `1.0.0` |

## 9. Memory ops coverage matrix

| Op | Exercised by |
| --- | --- |
| create | first extract of S1 |
| reinforce | re-extract same locator / repeated identical utterance policy |
| contest | S1 vs S2 direct contradiction handling |
| supersede | transcript v2 correction same artifact lineage |
| reject | quote not in source |
| ignore | exact duplicate delivery |

## 10. Offline vs product tests

| Capability | ScenarioRunner | Product |
| --- | --- | --- |
| Quote binding | yes | yes |
| Dual testimony retain | yes | yes |
| Scope-mismatch ≠ delete | yes | yes |
| Assessment uncertainty required | yes | yes |
| Human accept audit | no | yes |
| Redaction export | no | yes |
| Bundle import | no | yes |
| Provider swap | mock | live gated |

## 11. Relation to research & Kids

| Shared engine op | Kids example | Research example | Legal example |
| --- | --- | --- | --- |
| create | new character fact | new proposition | new situated statement |
| reinforce | repeated comfort anchor | 2nd independent study | repeated same utterance extract |
| contest | continuity conflict | contradicting paper | S1 vs S2 |
| supersede | corrected fact with evidence | stronger study | corrected transcript |
| reject | invalid model output | quote missing | quote missing |
| ignore | duplicate | same independence key | duplicate locator |

Same MemoryEngine; three policies; zero core domain words.
