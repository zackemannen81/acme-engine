# Legal / Evidence — package and module API sketch

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

**Not legal advice.** Illustrative TypeScript only.

## 1. Package graph

```text
@acme/core
  ↑
@acme/legal-policies
  ↑
@acme/module-legal-evidence
@acme/module-legal-timeline
@acme/module-legal-assessment
@acme/module-legal-interrogation
@acme/module-legal-validator

@acme/legal-ports
  ↑
adapters: object-store, transcription, bundle-import, model-*, redaction-export

apps/legal-evidence-{api,worker,web}
```

---

## 2. `@acme/legal-policies`

```ts
export type ArtifactKind =
  | 'interview-transcript'
  | 'written-statement'
  | 'document'
  | 'photo'
  | 'video'
  | 'audio'
  | 'lab-report'
  | 'other';

export type Sensitivity =
  | 'public'
  | 'internal'
  | 'restricted'
  | 'highly-restricted';

export type ParticipantRole =
  | 'subject'
  | 'witness'
  | 'officer'
  | 'expert'
  | 'victim'
  | 'other';

/** Time may be exact, range, or unknown — never invent precision. */
export type TimeBound =
  | { readonly kind: 'instant'; readonly at: string } // ISO
  | { readonly kind: 'range'; readonly from: string; readonly to: string }
  | { readonly kind: 'unknown'; readonly note?: string };

export interface ScopeDimensions {
  readonly speakerId?: string;
  readonly utteredAt?: TimeBound;
  readonly effectiveAt?: TimeBound; // when the claim is about
  readonly locationLabel?: string;
  readonly artifactId: string;
  readonly locator: string; // line range, page, timecode
}

/**
 * Identity for a situated assertion — domain-owned algorithm name in real impl.
 * Sketch name: legal-situated-assertion-key-1
 */
export function legalSituatedAssertionKey(input: {
  readonly kind: string;
  readonly speakerId?: string;
  readonly propositionNormalized: string;
  readonly utteredAt?: TimeBound;
  readonly artifactId: string;
  readonly locator: string;
}): string;

export type ConflictRelation =
  | 'direct-contradiction'
  | 'partial-tension'
  | 'scope-mismatch' // different times → coexist, not contest
  | 'corroboration';

export function classifyRelation(
  a: { proposition: string; scope: ScopeDimensions },
  b: { proposition: string; scope: ScopeDimensions },
): ConflictRelation;

export function maySupersede(input: {
  readonly priorArtifactId: string;
  readonly nextArtifactId: string;
  readonly reason: 'transcript-correction' | 'ocr-correction' | 'other';
}): boolean;
// transcript-correction same interview id → true; different interviews → false
```

---

## 3. `@acme/module-legal-evidence`

### 3.1 Module

```ts
export const LEGAL_EVIDENCE_NAMESPACE = 'legal.evidence' as const;

export const legalEvidenceModule = defineModule({
  namespace: LEGAL_EVIDENCE_NAMESPACE,
  stateSchemaVersion: 'legal-evidence-state/1',
  deltaSchemaVersion: 'legal-evidence-delta/1',
  tasks: {
    'bootstrap-case': bootstrapCaseTask,
    'register-artifact': registerArtifactTask,
    'classify-artifact': classifyArtifactTask,
    'extract-statements': extractStatementsTask,
    'extract-exhibit-assertions': extractExhibitAssertionsTask,
    'cross-reference': crossReferenceTask,
  },
  memoryPolicy: legalEvidenceMemoryPolicy,
  // ...
});
```

### 3.2 State

```ts
export interface CaseParticipant {
  readonly participantId: string;
  readonly displayName: string;
  readonly roles: readonly ParticipantRole[];
}

export interface ArtifactInventoryItem {
  readonly artifactId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly sensitivity: Sensitivity;
  readonly documentKey?: string; // immutable text/metadata doc
  readonly mediaRef?: string; // opaque storage
  readonly classified: boolean;
  readonly extracted: boolean;
}

export interface LegalEvidenceState {
  readonly caseLabel: string;
  readonly jurisdictionCode?: string; // opaque product string, not core enum
  readonly participants: readonly CaseParticipant[];
  readonly artifacts: readonly ArtifactInventoryItem[];
  readonly openGapIds: readonly string[];
}

export interface LegalEvidenceDelta {
  readonly setCaseLabel?: string;
  readonly upsertParticipants?: readonly CaseParticipant[];
  readonly upsertArtifacts?: readonly ArtifactInventoryItem[];
  readonly setOpenGaps?: readonly string[];
}
```

### 3.3 Memory kinds

```ts
export type LegalMemoryKind =
  | 'legal.statement'
  | 'legal.exhibit-assertion'
  | 'legal.conflict-edge'
  | 'legal.custody-note'
  | 'legal.classification';

export interface LegalStatementValue {
  readonly speakerId: string;
  readonly proposition: string; // normalized atomic claim
  readonly rawText: string; // exact span
  readonly utteredAt: TimeBound;
  readonly effectiveAt?: TimeBound;
  readonly artifactId: string;
  readonly locator: string;
  readonly confidence?: number; // extraction confidence, not truth
}

export interface LegalExhibitAssertionValue {
  readonly proposition: string;
  readonly rawText: string;
  readonly effectiveAt?: TimeBound;
  readonly artifactId: string;
  readonly locator: string;
}

export interface LegalConflictEdgeValue {
  readonly leftMemoryId: string; // filled post-create via reinforce? or document-only
  readonly rightIdentityKey: string;
  readonly relation: ConflictRelation;
  readonly note?: string;
}
// Implementation choice: conflict edges as documents from cross-reference task
// may be simpler than memory; sketch allows either.
```

### 3.4 Tasks

#### `bootstrap-case` (transformer)

```ts
export interface BootstrapCaseInput {
  readonly caseLabel: string;
  readonly participants: readonly CaseParticipant[];
  readonly jurisdictionCode?: string;
}
```

#### `register-artifact` (transformer)

```ts
export interface RegisterArtifactInput {
  readonly artifactId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly sensitivity: Sensitivity;
  readonly text?: string; // if already extracted
  readonly mediaRef?: string;
  readonly custodyNote?: string;
}
// writes inventory + optional document + custody memory
```

#### `classify-artifact` (analyzer)

```ts
export interface ClassifyArtifactInput {
  readonly artifactId: string;
}

export interface ClassifyArtifactOutput {
  readonly kind: ArtifactKind;
  readonly sensitivity: Sensitivity;
  readonly tags: readonly string[];
  readonly summary: string;
}
// semantic: kind must be in taxonomy; does not invent participants
```

#### `extract-statements` (analyzer) — critical path

```ts
export interface ExtractStatementsInput {
  readonly artifactId: string;
  /** when transcript lacks absolute clock, product supplies session bound */
  readonly sessionTime?: TimeBound;
}

export interface ExtractStatementsOutput {
  readonly statements: readonly {
    readonly speakerNameOrId: string;
    readonly proposition: string;
    readonly rawText: string;
    readonly utteredAt?: TimeBound | null;
    readonly effectiveAt?: TimeBound | null;
    readonly locator: string;
    readonly confidence: number;
  }[];
}

export const extractStatementsTask = defineTask({
  role: 'analyzer',
  inputSchema: ExtractStatementsInputSchema,
  contract: LEGAL_EXTRACT_STATEMENTS_REF,
  project(input, context) {
    // full transcript document + participant roster for name→id resolution
  },
  interpret(output, input, context) {
    // SEMANTIC HARD RULES:
    // - every rawText must be substring of source document
    // - speaker must resolve to participant or explicit unknown-speaker policy
    // - unknown time → TimeBound unknown, never model-invented clock
    // memory candidates: legal.statement with legalSituatedAssertionKey
    // stateIntent: mark artifact extracted
  },
  projectState(input) {
    return input.stateIntent;
  },
});
```

#### `extract-exhibit-assertions` (analyzer)

Same quote-binding rules; no speaker required; `effectiveAt` from document date
fields when present in input (product-supplied metadata), not hallucinated.

#### `cross-reference` (analyzer)

```ts
export interface CrossReferenceInput {
  readonly focusMemoryIds?: readonly string[]; // subset; default all active
}

export interface CrossReferenceOutput {
  readonly relations: readonly {
    readonly leftKey: string;
    readonly rightKey: string;
    readonly relation: ConflictRelation;
    readonly rationale: string;
  }[];
  readonly gaps: readonly {
    readonly description: string;
    readonly relatedKeys: readonly string[];
  }[];
}
// interpret: conflict-edge documents or memories; open gaps in state
// policy: scope-mismatch → coexist (relation recorded, not contest status on memory)
// direct-contradiction → mark both contested or add edge without forgetting
```

Memory policy sketch:

```ts
// create statement if new situated key
// reinforce if same key re-extracted (duplicate) → strength++
// contest if policy maps relation to contest on shared world-proposition index
//   (optional secondary index; primary records always retained)
// supersede only maySupersede(...) for corrections
// reject if quote bind fails
```

---

## 4. `@acme/module-legal-timeline`

```ts
export const LEGAL_TIMELINE_NAMESPACE = 'legal.timeline' as const;

export interface TimelineEvent {
  readonly eventId: string;
  readonly time: TimeBound;
  readonly label: string;
  readonly sourceMemoryIds: readonly string[];
  readonly kind: 'statement' | 'exhibit' | 'gap' | 'system';
}

export interface LegalTimelineState {
  readonly events: readonly TimelineEvent[];
  readonly orderedIds: readonly string[]; // stable sort keys
}

export interface BuildTimelineInput {
  readonly memoryIds?: readonly string[];
}

export const buildTimelineTask = defineTask({
  role: 'analyzer', // or transformer if pure sort without model
  // Prefer pure sort when times known; model only for vague narrative ordering with low authority
  // sketch: pure builder in policies + optional model assist task
});
```

Recommendation: **v1 timeline is pure** from `TimeBound` + deterministic sort;
model-assisted ordering is a separate optional task with explicit low trust.

---

## 5. `@acme/module-legal-assessment`

```ts
export const LEGAL_ASSESSMENT_NAMESPACE = 'legal.assessment' as const;

export interface AssessmentState {
  readonly currentAssessmentDocumentKey?: string;
  readonly status: 'none' | 'proposed' | 'accepted' | 'stale' | 'rejected';
  readonly historyDocumentKeys: readonly string[];
}

export interface ProposeAssessmentInput {
  readonly focusQuestion?: string;
  readonly candidateMemoryIds: readonly string[];
}

export interface ProposeAssessmentOutput {
  readonly summary: string; // theory Z in prose
  readonly claims: readonly {
    readonly text: string;
    readonly supportMemoryIds: readonly string[];
    readonly conflictMemoryIds: readonly string[];
    readonly uncertainty: 'low' | 'medium' | 'high';
    readonly uncertaintyRationale: string;
  }[];
  readonly overallUncertainty: 'low' | 'medium' | 'high';
}

export const proposeAssessmentTask = defineTask({
  role: 'producer',
  contract: LEGAL_PROPOSE_ASSESSMENT_REF,
  interpret(output, input) {
    // document legal.assessment-report
    // stateIntent: status=proposed, set current key (or product accepts later)
    // SEMANTIC: every support/conflict id must be in candidateMemoryIds
    // no memory deletes
  },
});

export interface ReviseAssessmentInput {
  readonly priorAssessmentDocumentKey: string;
  readonly newMemoryIds: readonly string[];
  readonly reason: string;
}
```

Human accept:

```ts
// product command — not necessarily an EE task
acceptAssessment({ caseId, assessmentDocumentKey, actorId, rationale })
// writes product audit + optional transformer task to set status=accepted
```

---

## 6. `@acme/module-legal-interrogation`

```ts
export interface SuggestQuestionsInput {
  readonly gapIds?: readonly string[];
  readonly conflictDocumentKey?: string;
  readonly interviewTargetParticipantId: string;
}

export interface SuggestQuestionsOutput {
  readonly questions: readonly {
    readonly text: string;
    readonly purpose: string;
    readonly relatedMemoryIds: readonly string[];
    readonly riskNotes?: string;
  }[];
}
// producer; documents only; never creates legal.statement
```

---

## 7. `@acme/module-legal-validator`

```ts
export interface ValidateExtractionInput {
  readonly artifactId: string;
  readonly extractionDocumentKey?: string; // or re-check memories for artifact
}

export interface ValidateAssessmentInput {
  readonly assessmentDocumentKey: string;
  readonly allowedMemoryIds: readonly string[];
}

export interface LegalValidationOutput {
  readonly verdict: 'pass' | 'revise' | 'block';
  readonly issues: readonly {
    readonly code: string;
    readonly message: string;
    readonly path?: string;
  }[];
}

// Codes (sketch):
// QUOTE_NOT_IN_SOURCE, UNKNOWN_SPEAKER, INVENTED_TIME,
// ASSESSMENT_UNKNOWN_MEMORY, ASSESSMENT_MISSING_UNCERTAINTY,
// SUPERSEDE_NOT_ALLOWED
```

---

## 8. `@acme/legal-ports`

```ts
export interface BundleImportGateway {
  importCaseBundle(input: {
    readonly bytes: Uint8Array;
  }): Promise<{
    readonly artifacts: readonly {
      readonly clientArtifactId: string;
      readonly kind: ArtifactKind;
      readonly title: string;
      readonly text?: string;
      readonly mediaRef?: string;
    }[];
  }>;
}

export interface TranscriptionGateway {
  transcribe(input: {
    readonly mediaRef: string;
    readonly language?: string;
  }): Promise<{ readonly text: string; readonly locatorScheme: 'timecode' | 'paragraph' }>;
}

export interface ObjectStorageGateway {
  put(ref: string, bytes: Uint8Array): Promise<void>;
  get(ref: string): Promise<Uint8Array>;
}

export interface RedactionExportGateway {
  exportAssessment(input: {
    readonly assessmentJson: unknown;
    readonly policy: 'full' | 'redacted-public';
  }): Promise<{ readonly bytes: Uint8Array }>;
}
```

---

## 9. Composition / orchestrator

```ts
export interface LegalCaseOrchestrator {
  openCase(input: BootstrapCaseInput): Promise<{ caseId: string }>;

  addArtifact(input: RegisterArtifactInput & { caseId: string }): Promise<void>;

  runExtractionPipeline(input: {
    readonly caseId: string;
    readonly artifactId: string;
  }): Promise<void>;
  // classify → extract → validate extraction → cross-reference delta

  rebuildTimeline(caseId: string): Promise<void>;

  proposeAssessment(input: ProposeAssessmentInput & { caseId: string }): Promise<{
    documentKey: string;
  }>;

  acceptAssessment(input: {
    readonly caseId: string;
    readonly documentKey: string;
    readonly actorId: string;
    readonly rationale: string;
  }): Promise<void>;

  suggestNextQuestions(input: SuggestQuestionsInput & { caseId: string }): Promise<void>;
}
```

Entity convention: `entityId = caseId` across namespaces `legal.evidence`,
`legal.timeline`, `legal.assessment`, etc.

---

## 10. Execution examples

```ts
await engine.execute({
  module: 'legal.evidence',
  task: 'extract-statements',
  entityId: caseId,
  input: { artifactId: 'interview-1', sessionTime: { kind: 'range', from: '…', to: '…' } },
  operationKey: `legal:${caseId}:extract:interview-1`,
});

await engine.execute({
  module: 'legal.evidence',
  task: 'cross-reference',
  entityId: caseId,
  input: {},
  operationKey: `legal:${caseId}:xref:${revision}`,
});

await engine.execute({
  module: 'legal.assessment',
  task: 'propose-assessment',
  entityId: caseId,
  input: {
    focusQuestion: 'Was the door open at time of entry?',
    candidateMemoryIds: allActiveStatementAndExhibitIds,
  },
  operationKey: `legal:${caseId}:assess:r0`,
});
```

---

## 11. File tree (if packages existed)

```text
packages/
  legal-policies/src/{taxonomy,scope,identity,relations,supersede,redaction}.ts
  module-legal-evidence/src/{module,schemas,memory-policy,tasks/*,contracts}.ts
  module-legal-timeline/src/...
  module-legal-assessment/src/...
  module-legal-interrogation/src/...
  module-legal-validator/src/...
  legal-ports/src/{bundle,transcription,storage,export}.ts
```

## 12. Deliberate omissions

- Credibility “lie detector” scores as canon  
- Automated charging recommendations  
- Privileged communication classifier as legal authority  
- Real-time multi-agency sync protocols  
- Core changes for graph DB (memory + documents suffice for v1 proof)
