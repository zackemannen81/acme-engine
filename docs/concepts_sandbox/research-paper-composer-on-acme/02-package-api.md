# Research Paper Composer — package and module API sketch

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

Illustrative TypeScript. Patterns match existing ACME authoring
(`defineModule`, `defineTask`, `PromptContract`, `DomainMemoryPolicy`).

## 1. Package graph

```text
@acme/core
  ↑
@acme/research-policies                 (pure)
  ↑
@acme/module-research                   (reference; optional dependency for identity helpers)
@acme/module-research-composer  ──┐
@acme/module-research-evidence  ──┼── @acme/core (+ policies)
@acme/module-research-validator ──┘

@acme/research-ports
  ↑
adapters: pdf-ingest, doi, model-*, vector, object-storage

apps/research-composer-{api,worker,web}
```

Sketch allows collapsing evidence+composer into one module with multiple tasks
if packaging overhead is undesirable. Validator stays separable (gate).

---

## 2. `@acme/research-policies`

```ts
export type PaperKind = 'empirical' | 'review' | 'position' | 'technical-report';
export type SectionKind =
  | 'abstract'
  | 'introduction'
  | 'related-work'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'conclusion'
  | 'custom';

export interface VenueProfile {
  readonly id: string;
  readonly maxWords?: number;
  readonly requiredSections: readonly SectionKind[];
  readonly citationStyle: 'apa' | 'ieee' | 'chicago' | 'custom';
  readonly allowUncitedBackground: boolean;
}

export function getVenueProfile(id: string): VenueProfile;

/** Evidence strength ladder — field packs can override. */
export type EvidenceStrength =
  | 'anecdote'
  | 'case-study'
  | 'observational'
  | 'controlled'
  | 'rct'
  | 'meta-analysis'
  | 'formal-proof';

export interface SupersessionRule {
  /** candidate may supersede existing only if strength strictly greater, etc. */
  readonly requireStrictlyStronger: boolean;
  readonly requireNewerRetrieval: boolean;
  readonly retainSupersededAsHistory: true; // always true in sketch
}

export function defaultSupersessionRule(): SupersessionRule;

export function formatCitation(
  style: VenueProfile['citationStyle'],
  source: {
    readonly title: string;
    readonly authors: readonly string[];
    readonly year?: number;
    readonly uri?: string;
  },
): string;

export function independenceClusterKey(input: {
  readonly institution?: string;
  readonly datasetId?: string;
  readonly authorSet?: readonly string[];
}): string;
```

---

## 3. `@acme/module-research-evidence`

Thin product wrapper around observe-evidence semantics (may re-home reference
module tasks).

### 3.1 Namespace and state

```ts
export const RESEARCH_EVIDENCE_NAMESPACE = 'research.evidence' as const;
// If product uses one entity per paper project, evidence state may be minimal
// and proposition standing can live on composer state as memory-id refs.
// Sketch: evidence module owns little state; memory is the heavy store.

export interface ResearchEvidenceState {
  readonly projectId: string;
  readonly observedSourceKeys: readonly string[];
  readonly openQuestionIds: readonly string[];
}
```

### 3.2 Memory kinds

```ts
export type ResearchMemoryKind =
  | 'research.source'
  | 'research.claim' // proposition + polarity + evidence payload
  | 'research.question'
  | 'research.method-note';

export interface ResearchClaimMemoryValue {
  readonly proposition: string; // canonical text for keying
  readonly polarity: 'supports' | 'contradicts' | 'refines';
  readonly confidence: number; // model-reported; NOT verification
  readonly strength: EvidenceStrength;
  readonly quote: string;
  readonly locator: string; // page/section
  readonly sourceUri: string;
  readonly sourceKey: string;
  readonly independenceKey: string;
  readonly retrievedAt: string; // UTC ISO
  readonly documentKey: string;
}
```

### 3.3 Task: `observe-evidence`

```ts
export interface ObserveEvidenceInput {
  readonly documentKey: string;
  readonly title?: string;
  readonly text: string; // extracted plain text or chunk
  readonly sourceUri: string;
  readonly publisher?: string;
  readonly retrievedAt: string;
  readonly independenceAssertion: {
    readonly institution?: string;
    readonly datasetId?: string;
    readonly notes?: string;
  };
  /** product policy: minimum independent sources to mark verified in state */
  readonly verificationThreshold: number; // fixed config, never model-supplied
}

export interface ObserveEvidenceContractOutput {
  readonly claims: readonly {
    readonly proposition: string;
    readonly polarity: 'supports' | 'contradicts' | 'refines';
    readonly confidence: number;
    readonly strength: EvidenceStrength;
    readonly quote: string;
    readonly locator: string;
  }[];
  readonly questions: readonly { readonly text: string }[];
}

export const observeEvidenceTask = defineTask({
  role: 'analyzer',
  inputSchema: ObserveEvidenceInputSchema,
  contract: RESEARCH_OBSERVE_EVIDENCE_REF, // align with research.observe-evidence@1.0.0
  project(input, context) {
    // relevant memories: existing claims for same project; no silent merge in prompt
  },
  interpret(output, input, context) {
    // semantic: every quote must appear in input.text; no duplicate claim keys in one output
    // emit source document + claim memory candidates + question candidates
    // stateIntent: append observedSourceKeys; open questions
  },
  projectState(input) {
    // verified/contested decisions only from applied memory resolutions
  },
});
```

Memory policy sketch:

```ts
// create: new proposition key
// reinforce: same proposition, new independenceKey, polarity supports
// contest: same proposition, polarity contradicts (or incompatible refine)
// supersede: policy + stronger strength + explicit supersedesMemoryId
// ignore: same source independenceKey duplicate support (auditable no-op reinforce?)
```

---

## 4. `@acme/module-research-composer`

### 4.1 Module definition

```ts
export const RESEARCH_COMPOSER_NAMESPACE = 'research.composer' as const;

export const researchComposerModule = defineModule({
  namespace: RESEARCH_COMPOSER_NAMESPACE,
  stateSchemaVersion: 'research-composer-state/1',
  deltaSchemaVersion: 'research-composer-delta/1',
  tasks: {
    'bootstrap-paper': bootstrapPaperTask,
    'plan-outline': planOutlineTask,
    'draft-section': draftSectionTask,
    'revise-section': reviseSectionTask,
    'compile-paper': compilePaperTask, // may be transformer: assemble docs, no model
  },
  memoryPolicy: researchComposerMemoryPolicy, // or shared with evidence if one entity
  // ...
});
```

### 4.2 State

```ts
export interface PaperSectionNode {
  readonly sectionId: string;
  readonly kind: SectionKind;
  readonly title: string;
  readonly intent: string; // what this section must accomplish
  readonly targetClaimPropositionKeys: readonly string[]; // optional binding
  readonly status: 'planned' | 'drafted' | 'validated' | 'blocked' | 'stale';
  readonly currentDocumentKey?: string;
  readonly lastValidationDocumentKey?: string;
}

export interface ResearchComposerState {
  readonly title?: string;
  readonly researchQuestion: string;
  readonly paperKind: PaperKind;
  readonly venueProfileId: string;
  readonly constraints: {
    readonly language: string;
    readonly maxWords?: number;
    readonly mustCiteAllResultsClaims: boolean;
  };
  readonly outline: readonly PaperSectionNode[];
  /** standing sets: memory ids only */
  readonly verifiedClaimMemoryIds: readonly string[];
  readonly contestedClaimMemoryIds: readonly string[];
  readonly deferredClaimMemoryIds: readonly string[];
  readonly openQuestions: readonly string[];
  /** when evidence changes, mark sections stale */
  readonly staleSectionIds: readonly string[];
}

export interface ResearchComposerDelta {
  readonly setMeta?: Partial<
    Pick<
      ResearchComposerState,
      'title' | 'researchQuestion' | 'paperKind' | 'venueProfileId' | 'constraints'
    >
  >;
  readonly replaceOutline?: ResearchComposerState['outline'];
  readonly patchSection?: Partial<PaperSectionNode> & { readonly sectionId: string };
  readonly setStanding?: {
    readonly verifiedClaimMemoryIds?: readonly string[];
    readonly contestedClaimMemoryIds?: readonly string[];
    readonly deferredClaimMemoryIds?: readonly string[];
  };
  readonly markSectionsStale?: readonly string[];
  readonly clearStale?: readonly string[];
}
```

### 4.3 Tasks

#### `bootstrap-paper`

```ts
export interface BootstrapPaperInput {
  readonly researchQuestion: string;
  readonly paperKind: PaperKind;
  readonly venueProfileId: string;
  readonly language: string;
  readonly titleHint?: string;
  readonly seedNotes?: string;
}
// transformer or light producer; sets state, optional seed question memories
```

#### `plan-outline` (producer)

```ts
export interface PlanOutlineInput {
  readonly preferSectionKinds?: readonly SectionKind[];
}

export interface PlanOutlineContractOutput {
  readonly title: string;
  readonly sections: readonly {
    readonly kind: SectionKind;
    readonly title: string;
    readonly intent: string;
    readonly targetPropositions?: readonly string[];
  }[];
}
// interpret → replaceOutline, documents kids.outline analogue research.outline
```

#### `draft-section` (producer)

```ts
export interface DraftSectionInput {
  readonly sectionId: string;
  /** orchestrator supplies allowed proposition keys / memory ids */
  readonly allowedMemoryIds: readonly string[];
  readonly forbiddenUncitedClaims: boolean;
}

export interface DraftSectionContractOutput {
  readonly title: string;
  readonly markdown: string;
  readonly usedPropositionKeys: readonly string[];
  readonly citationKeys: readonly string[]; // source keys
}
// semantic: if forbiddenUncitedClaims, every factual sentence must map to usedPropositionKeys
// (heuristic semantic checks + validator gate afterwards)
```

#### `revise-section` (producer)

```ts
export interface ReviseSectionInput {
  readonly sectionId: string;
  readonly priorDocumentKey: string;
  readonly validationDocumentKey: string;
  readonly allowedMemoryIds: readonly string[];
}
// project() includes prior draft + validation issues + evidence snippets
```

#### `compile-paper` (transformer)

```ts
export interface CompilePaperInput {
  readonly sectionDocumentKeys: readonly string[];
}
// no model: assemble paper snapshot document + bibliography from memory
```

---

## 5. `@acme/module-research-validator`

```ts
export const RESEARCH_VALIDATOR_NAMESPACE = 'research.validator' as const;

export interface ValidateSectionInput {
  readonly sectionId: string;
  readonly sectionDocumentKey: string;
  readonly standingMemoryIds: readonly string[];
}

export interface AssertionFinding {
  readonly assertion: string;
  readonly verdict: 'supported' | 'contested' | 'unsupported' | 'overclaim' | 'orphan-citation';
  readonly supportingMemoryIds: readonly string[];
  readonly contradictingMemoryIds: readonly string[];
  readonly notes?: string;
}

export interface ValidateSectionContractOutput {
  readonly verdict: 'pass' | 'revise' | 'block';
  readonly findings: readonly AssertionFinding[];
  readonly summary: string;
}

export const validateSectionTask = defineTask({
  role: 'analyzer',
  inputSchema: ValidateSectionInputSchema,
  contract: RESEARCH_VALIDATE_SECTION_REF,
  project(input, context) {
    // load section document text + freeze memory records for standingMemoryIds
  },
  interpret(output, input) {
    // documents: research.validation-report
    // events: research.section.validated
    // no memory writes; no composer state writes (orchestrator patches status)
  },
  projectState() {
    return undefined;
  },
});
```

Optional pure pre-gate (no model):

```ts
export function quickCitationCoverageCheck(
  draft: { usedPropositionKeys: readonly string[]; citationKeys: readonly string[] },
  memory: readonly ResearchClaimMemoryValue[],
): readonly string[]; // issue codes
```

---

## 6. `@acme/research-ports`

```ts
export interface PdfIngestGateway {
  extractText(input: {
    readonly bytes: Uint8Array;
    readonly filename?: string;
  }): Promise<{
    readonly text: string;
    readonly pageCount?: number;
    readonly warnings: readonly string[];
  }>;
}

export interface DoiResolveGateway {
  resolve(doi: string): Promise<{
    readonly title: string;
    readonly authors: readonly string[];
    readonly year?: number;
    readonly uri: string;
    readonly publisher?: string;
  }>;
}

export interface VectorSearchGateway {
  search(input: {
    readonly projectId: string;
    readonly query: string;
    readonly limit: number;
  }): Promise<readonly { readonly documentKey: string; readonly score: number }[]>;
}
// Vector hits are retrieval hints only — never auto-create claims.
```

Model access remains core `ModelGateway`.

---

## 7. Composition and orchestrator

```ts
export interface PaperOrchestrator {
  createProject(cmd: BootstrapPaperInput): Promise<{ projectId: string }>;

  ingestSource(cmd: {
    readonly projectId: string;
    readonly source: { uri?: string; doi?: string; pdf?: Uint8Array; text?: string };
  }): Promise<{ documentKey: string }>;

  /** EE: observe-evidence */
  observeSource(cmd: {
    readonly projectId: string;
    readonly documentKey: string;
  }): Promise<void>;

  planAndDraftAll(cmd: { readonly projectId: string }): Promise<void>;

  /** draft → validate → revise loop per section */
  runSectionPipeline(cmd: {
    readonly projectId: string;
    readonly sectionId: string;
  }): Promise<'validated' | 'blocked' | 'failed'>;

  /** after new evidence: mark stale sections, re-validate */
  onEvidenceChanged(cmd: { readonly projectId: string }): Promise<void>;
}
```

Cross-module entity convention:

| Concept | Value |
| --- | --- |
| entityId | `projectId` (paper project) |
| evidence namespace | `research.evidence` |
| composer namespace | `research.composer` |
| validator namespace | `research.validator` (unit state) |

Orchestrator copies standing memory ids from evidence/composer into validator
input; modules do not import each other.

---

## 8. Execution request examples

```ts
await engine.execute({
  module: 'research.evidence',
  task: 'observe-evidence',
  entityId: projectId,
  input: {
    documentKey: 'src:doi:10.1234/example',
    text: extracted,
    sourceUri: 'https://doi.org/10.1234/example',
    retrievedAt: '2026-08-02T12:00:00.000Z',
    independenceAssertion: { institution: 'Lab A' },
    verificationThreshold: 2,
  },
  operationKey: `research:${projectId}:observe:src:doi:10.1234/example`,
});

await engine.execute({
  module: 'research.composer',
  task: 'draft-section',
  entityId: projectId,
  input: {
    sectionId: 'sec-results',
    allowedMemoryIds: verifiedIds,
    forbiddenUncitedClaims: true,
  },
  operationKey: `research:${projectId}:draft:sec-results:r0`,
});

await engine.execute({
  module: 'research.validator',
  task: 'validate-section',
  entityId: projectId,
  input: {
    sectionId: 'sec-results',
    sectionDocumentKey: 'section:sec-results:v3',
    standingMemoryIds: [...verifiedIds, ...contestedIds],
  },
  operationKey: `research:${projectId}:validate:sec-results:v3`,
});
```

---

## 9. File tree (if packages existed)

```text
packages/
  research-policies/src/{venue,strength,supersession,citation,independence}.ts
  module-research-evidence/src/{module,schemas,memory-policy,tasks/observe-evidence,contracts}.ts
  module-research-composer/src/{module,schemas,state,tasks/*,contracts}.ts
  module-research-validator/src/{module,tasks/validate-section,contracts}.ts
  research-ports/src/{pdf,doi,vector}.ts
```

## 10. Deliberate omissions

- LaTeX build pipeline, Overleaf sync  
- Human peer-review workflow  
- Automatic web scraping as memory write  
- Field-specific medical/legal claim ontologies (packs later)  
- Core changes for tools/function-calling (product ports first)
