# Package and module API sketch

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

TypeScript below is **illustrative**. Names, versions and exact Zod shapes would
be fixed only if a future charter activates this work. Patterns follow existing
ACME authoring: `defineModule`, `defineTask`, `PromptContract`,
`DomainMemoryPolicy`, public package entrypoints only.

## 1. Package graph

```text
@acme/core
  ↑
@acme/kids-policies                    (pure, no core dependency required)
  ↑
@acme/module-kids-narrative ──┐
@acme/module-kids-illustration┤── depend on @acme/core (+ kids-policies where pure helpers help)
@acme/module-kids-safety ─────┘

@acme/kids-ports                       (product ports; may depend on core JsonValue only or be zero-dep)
  ↑
@acme/adapter-image-* / moderation / storage / voice

apps/* composition                     (wires registries, gateways, orchestrator)
```

Reference modules (`module-narrative`, `module-research`) stay unrelated; kids
does not import them for runtime composition (optional later for shared
helpers only if extracted to a neutral package).

---

## 2. `@acme/kids-policies` — pure functions

No network, no DB, no `@acme/core` required (unless shared brand types are
desired later).

### 2.1 Public surface (sketch)

```ts
// @acme/kids-policies

export type StoryMode = 'godnattsaga' | 'bildsaga' | 'veckosaga';
export type BookType = 'standard' | 'barnroman' | 'barndeckare' | 'faktabok';
export type CastType = 'solo' | 'duo' | 'group';
export type IllustrationStyleId =
  | 'classic'
  | 'modern'
  | 'comic'
  | '3d-animerad'
  | 'scandi'
  | '90s-animation';

export interface KidsGenerationProfile {
  readonly storyMode: StoryMode;
  readonly chapterCount: number;
  readonly wordsPerChapter: number;
  readonly imagesPerChapter: 1 | 2;
}

export function getKidsStoryGenerationProfile(
  storyMode: StoryMode,
): KidsGenerationProfile;

export function getFactBookGenerationProfile(): KidsGenerationProfile;
// always: bildsaga-like 6×150, 2 images, locked guide character policy

export interface FrameworkResolveInput {
  readonly bookType: BookType;
  readonly storyMode: StoryMode;
  readonly vibe: string;
  readonly theme: string;
  readonly castType: CastType;
  readonly characterCount: number;
  readonly ageGroup: string;
}

export interface FrameworkResolveResult {
  readonly frameworkId: string;
  readonly overlays: readonly string[];
  readonly signals: readonly string[];
  readonly pacingNotes: string;
  readonly closureNotes: string;
  readonly continuityDepth: string;
}

export function resolveKidsFramework(
  input: FrameworkResolveInput,
): FrameworkResolveResult;

export interface KidsChapterArchitectureBrief {
  readonly chapterEmotionalGoal: string;
  readonly chapterClueRole: string;
  readonly chapterRelationshipTurn: string;
  readonly chapterRhythmNote: string;
  readonly chapterComfortAnchor: string;
  readonly chapterRepetitionPattern: string;
  readonly resolutionTemperature: string;
  readonly continuityFocus: string;
  // plus shared context fields (age, comfort anchors list, tone guardrails, …)
}

export function buildChapterArchitectureBrief(/* … */): KidsChapterArchitectureBrief;

export function resolveKidsIllustrationStyle(
  raw: string,
): IllustrationStyleId; // hard-fail on unknown

export function buildAutoPremise(/* child/cast/vibe/theme */): string;
export function buildFactBookPremise(topic: string): string;

// Safety policy (already close to pure in production)
export const DEFAULT_MAX_KIDS_SAFETY_REVISION_ATTEMPTS = 2;

export function buildSafetyRevisionNote(report: {
  readonly reasons?: readonly string[];
  readonly suggested_fix?: string;
  readonly rewrite_mode?: string;
  readonly keep_elements?: readonly string[];
}): string;

export function isSafetyPass(verdict: string | undefined): boolean;
export function filterCopingSignals<T extends { tags?: readonly string[] }>(
  items: readonly T[],
): readonly T[];
```

Modules call these from `project()`; product calls them during init before any
ExecutionEngine run.

---

## 3. `@acme/module-kids-narrative`

### 3.1 Module definition

```ts
import { defineModule } from '@acme/core';
import { kidsNarrativeMemoryPolicy } from './memory-policy.js';
import {
  KIDS_NARRATIVE_NAMESPACE,
  KIDS_NARRATIVE_STATE_SCHEMA_VERSION,
  KIDS_NARRATIVE_DELTA_SCHEMA_VERSION,
  KidsNarrativeStateSchema,
  KidsNarrativeDeltaSchema,
  type KidsNarrativeState,
  type KidsNarrativeDelta,
} from './schemas.js';
import {
  initialKidsNarrativeState,
  reduceKidsNarrativeState,
  kidsNarrativeInvariants,
} from './state.js';
import { bootstrapStoryTask } from './tasks/bootstrap-story.js';
import { generateOutlineTask } from './tasks/generate-outline.js';
import { generateChapterTask } from './tasks/generate-chapter.js';
import { analyzeContinuityTask } from './tasks/analyze-continuity.js';

export const kidsNarrativeModule = defineModule<
  KidsNarrativeState,
  KidsNarrativeDelta,
  {
    readonly 'bootstrap-story': typeof bootstrapStoryTask;
    readonly 'generate-outline': typeof generateOutlineTask;
    readonly 'generate-chapter': typeof generateChapterTask;
    readonly 'analyze-continuity': typeof analyzeContinuityTask;
  }
>({
  namespace: KIDS_NARRATIVE_NAMESPACE, // 'kids.narrative'
  stateSchemaVersion: KIDS_NARRATIVE_STATE_SCHEMA_VERSION, // 'kids-narrative-state/1'
  deltaSchemaVersion: KIDS_NARRATIVE_DELTA_SCHEMA_VERSION, // 'kids-narrative-delta/1'
  stateSchema: KidsNarrativeStateSchema,
  deltaSchema: KidsNarrativeDeltaSchema,
  tasks: Object.freeze({
    'bootstrap-story': bootstrapStoryTask,
    'generate-outline': generateOutlineTask,
    'generate-chapter': generateChapterTask,
    'analyze-continuity': analyzeContinuityTask,
  }),
  memoryPolicy: kidsNarrativeMemoryPolicy,
  initialState: ({ entityId, now }) => initialKidsNarrativeState(entityId, now),
  reduce: reduceKidsNarrativeState,
  invariants: kidsNarrativeInvariants,
});
```

### 3.2 State and delta (domain-owned)

```ts
// schemas.ts — conceptual Zod-backed types

export const KIDS_NARRATIVE_NAMESPACE = 'kids.narrative' as const;

export type OutlineChapterStatus =
  | 'planned'
  | 'queued'
  | 'written'
  | 'blocked'
  | 'skipped';

export interface KidsProductionProfile {
  readonly bookType: BookType;
  readonly storyMode: StoryMode;
  readonly language: string; // e.g. 'sv'
  readonly ageGroup: string;
  readonly vibe: string;
  readonly theme: string;
  readonly castType: CastType;
  readonly chapterCount: number;
  readonly wordsPerChapter: number;
  readonly imagesPerChapter: 1 | 2;
  readonly illustrationStyleId: IllustrationStyleId;
  readonly frameworkId: string;
  readonly premise: string;
  readonly premiseMode: 'auto' | 'custom';
}

export interface KidsCharacterRef {
  readonly characterId: string; // story-scoped id
  readonly sourceCharacterId?: string; // account characters table
  readonly name: string;
  readonly species?: string;
  readonly description?: string;
  readonly role?: string;
  readonly voiceSignature?: string;
  readonly visualAnchor?: {
    readonly physicalTraits: string;
    readonly clothing: string;
    readonly signatureItem: string;
    readonly colors?: readonly string[];
  };
}

export interface KidsOutlineChapter {
  readonly chapterId: string;
  readonly position: number; // 1-based
  readonly title: string;
  readonly summary: string; // downstream chapter instruction
  readonly status: OutlineChapterStatus;
}

export interface KidsSceneSnapshot {
  readonly chapterIndex: number;
  readonly location?: string;
  readonly timeOfDay?: string;
  readonly activeCharacterIds: readonly string[];
  readonly environmentBlock?: string;
  readonly styleBlock?: string;
}

export interface KidsNarrativeWindowItem {
  readonly chapterId: string;
  readonly position: number;
  readonly summary: string;
}

/**
 * Canonical narrative state. Explicitly excludes:
 * - job status, provider task ids
 * - storage URLs for images
 * - Leaf balance / subscription
 * - parent review rows
 */
export interface KidsNarrativeState {
  readonly production: KidsProductionProfile;
  readonly childProfile: {
    readonly name: string;
    readonly description?: string;
    readonly appearance?: string;
    readonly favoriteItem?: string;
    readonly ageLabel?: string;
  };
  readonly title?: string;
  readonly outline: {
    readonly chapters: readonly KidsOutlineChapter[];
  };
  readonly characters: readonly KidsCharacterRef[];
  readonly snapshot: KidsSceneSnapshot;
  readonly narrativeWindow: readonly KidsNarrativeWindowItem[]; // fixed max policy
  readonly writtenChapterIds: readonly string[];
}

/**
 * Partial intentional change. Reducer merges; invariants enforce legality.
 */
export interface KidsNarrativeDelta {
  readonly setProduction?: KidsProductionProfile;
  readonly setChildProfile?: KidsNarrativeState['childProfile'];
  readonly setTitle?: string;
  readonly replaceOutline?: KidsNarrativeState['outline'];
  readonly upsertCharacters?: readonly KidsCharacterRef[];
  readonly setSnapshot?: KidsSceneSnapshot;
  readonly pushNarrativeWindow?: KidsNarrativeWindowItem;
  readonly markChapterStatus?: {
    readonly chapterId: string;
    readonly status: OutlineChapterStatus;
  };
  readonly recordWrittenChapter?: { readonly chapterId: string };
}
```

### 3.3 Memory kinds

```ts
export type KidsMemoryKind =
  | 'kids.fact'
  | 'kids.character-fact'
  | 'kids.relationship'
  | 'kids.clue'
  | 'kids.comfort-anchor'
  | 'kids.chekhov-tag'
  | 'kids.world-rule';

export interface KidsFactMemoryValue {
  readonly content: string;
  readonly severity: 'critical' | 'important' | 'minor';
  readonly factType: 'fact' | 'rule' | 'lore';
  readonly scope: 'story' | 'individual';
  readonly tags: readonly string[];
  readonly keepAlive: boolean;
  /** chapter position last referenced; policy-owned decay inputs */
  readonly lastReferencedChapter?: number;
}

// DomainMemoryPolicy responsibilities:
// - identityKey for each kind (deterministic)
// - create / reinforce / supersede / contest
// - retrieve ranking: Chekhov tags before similarity; filter coping; max 8
// - no vector I/O inside policy (adapter supplies ranked candidates if needed)
```

### 3.4 Document kinds

```ts
export type KidsDocumentKind =
  | 'kids.outline'
  | 'kids.chapter'
  | 'kids.continuity-report'
  | 'kids.safety-report'; // only if stored as evidence doc; else product audit table
```

### 3.5 Tasks

#### `bootstrap-story` (role: `transformer`, no model)

Deterministic. Still goes through ExecutionEngine so ledger/replay see the
initial state commit — **or** product writes initial state via a dedicated
init API that calls StateEngine only. Prefer task for uniform evidence.

```ts
export interface BootstrapStoryInput {
  readonly production: KidsProductionProfile;
  readonly childProfile: KidsNarrativeState['childProfile'];
  readonly characters: readonly KidsCharacterRef[];
  readonly initialFacts?: readonly {
    readonly content: string;
    readonly severity: 'critical' | 'important' | 'minor';
    readonly tags?: readonly string[];
  }[];
  readonly initialSnapshot?: Partial<KidsSceneSnapshot>;
}

// contract: optional null-contract / empty model path —
// authoring choice: either a transformer task that invents no model call,
// or composition uses StateEngine.prepare without ExecutionEngine.
// Sketch preference: special-case in product init that still records an
// execution with gateway: none if core later supports it; until then product
// seeds state and first real task is generate-outline.

export const bootstrapStoryTask = defineTask({
  role: 'transformer',
  inputSchema: BootstrapStoryInputSchema,
  contract: KIDS_BOOTSTRAP_CONTRACT_REF, // may be a no-op contract if allowed
  project(input, _context) {
    return input; // or void-shaped contract input
  },
  interpret(_output, input, context): ModuleResult<KidsNarrativeDelta> {
    return {
      documents: [],
      memories: (input.initialFacts ?? []).map(toFactCandidate),
      stateIntent: {
        schemaVersion: KIDS_NARRATIVE_DELTA_SCHEMA_VERSION,
        value: {
          setProduction: input.production,
          setChildProfile: input.childProfile,
          upsertCharacters: input.characters,
          setSnapshot: {
            chapterIndex: 0,
            activeCharacterIds: input.characters.map((c) => c.characterId),
            ...input.initialSnapshot,
          },
        },
      },
      events: [
        {
          key: `story-bootstrapped:${context.entityId}`,
          type: 'kids.story.bootstrapped',
          schemaVersion: 'kids.story.bootstrapped/1',
          payload: { entityId: context.entityId },
        },
      ],
      diagnostics: [],
    };
  },
  projectState(input) {
    return input.stateIntent;
  },
});
```

#### `generate-outline` (role: `producer`)

```ts
export interface GenerateOutlineInput {
  /** If absent, use state.production after bootstrap */
  readonly titleHint?: string;
}

export interface OutlineContractInput {
  readonly bookTitle: string;
  readonly genre: string;
  readonly style: string;
  readonly tone: string;
  readonly language: string;
  readonly ageGroup: string;
  readonly premise: string;
  readonly storyMode: string;
  readonly chapterCount: number;
  readonly wordsPerChapter: number;
  readonly childProfile: string; // serialised for prompt
  readonly characters: string;
  readonly criticalFacts: string;
  readonly importantFacts: string;
  readonly frameworkBlock: string;
  // fact-book extras when bookType === 'faktabok'
}

export interface OutlineContractOutput {
  readonly title: string;
  readonly chapters: readonly {
    readonly title: string;
    readonly summary: string;
  }[];
}

export const generateOutlineTask = defineTask({
  role: 'producer',
  inputSchema: GenerateOutlineInputSchema,
  contract: KIDS_OUTLINE_CONTRACT_REF, // selected variant by bookType inside buildRequest or dual contracts
  project(input, context): OutlineContractInput {
    const state = readKidsState(context);
    // inject tokens from state + memory (critical/important)
    // choose standard vs faktabok contract via composition registry or task-local switch on state.production.bookType
    return { /* … */ };
  },
  interpret(output, input, context): ModuleResult<KidsNarrativeDelta> {
    // semantic: chapters.length === state.production.chapterCount
    const chapters = output.chapters.map((c, i) => ({
      chapterId: allocateChapterId(context, i + 1), // or deterministic chapter-1..n
      position: i + 1,
      title: c.title,
      summary: c.summary,
      status: 'planned' as const,
    }));
    return {
      documents: [
        {
          key: `outline:${context.entityId}`,
          kind: 'kids.outline',
          schemaVersion: 'kids.outline/1',
          value: { title: output.title, chapters: output.chapters },
          contentHash: hashOutline(output),
        },
      ],
      memories: [],
      stateIntent: {
        schemaVersion: KIDS_NARRATIVE_DELTA_SCHEMA_VERSION,
        value: {
          setTitle: output.title,
          replaceOutline: { chapters },
        },
      },
      events: [
        {
          key: `outline-ready:${context.entityId}`,
          type: 'kids.outline.ready',
          schemaVersion: 'kids.outline.ready/1',
          payload: {
            entityId: context.entityId,
            chapterCount: chapters.length,
          },
        },
      ],
      diagnostics: [],
    };
  },
  projectState(input) {
    return input.stateIntent;
  },
});
```

Contract selection sketch:

```ts
// contracts/index.ts
export const KIDS_OUTLINE_STANDARD_REF = { id: 'kids.outline.standard', version: '1.0.0' };
export const KIDS_OUTLINE_FAKTA_REF = { id: 'kids.outline.faktabok', version: '1.0.0' };
// Prompt templates migrated from Non-fiction_OutlineCreativeContract_kids.ts etc.
```

#### `generate-chapter` (role: `producer`)

```ts
export interface GenerateChapterInput {
  readonly chapterId: string;
  /** optional safety revision context from orchestrator */
  readonly safetyRevision?: {
    readonly attempt: number; // 1..max
    readonly note: string;
    readonly priorContentHash?: string;
  };
}

export interface ChapterContractInput {
  readonly bookTitle: string;
  readonly chapterTitle: string;
  readonly chapterInstruction: string; // outline summary
  readonly position: number;
  readonly chapterCount: number;
  readonly wordsPerChapter: number;
  readonly language: string;
  readonly ageGroup: string;
  readonly premise: string;
  readonly childProfile: string;
  readonly characterStates: string;
  readonly previousChapterEnding: string;
  readonly narrativeWindow: string;
  readonly recalledMemory: string;
  readonly frameworkBlock: string;
  readonly architectureBrief: string;
  readonly knowledgeCritical: string;
  readonly knowledgeImportant: string;
  readonly location: string;
  readonly timeOfDay: string;
  readonly activeCharacters: string;
  readonly safetyRevisionNote?: string;
}

export interface ChapterContractOutput {
  readonly title: string;
  readonly content: string;
  // keep output minimal; illustration briefs are a separate module task
}

export const generateChapterTask = defineTask({
  role: 'producer',
  inputSchema: GenerateChapterInputSchema,
  contract: KIDS_CHAPTER_CONTRACT_REF,
  project(input, context): ChapterContractInput { /* … */ },
  interpret(output, input, context): ModuleResult<KidsNarrativeDelta> {
    const chapter = findOutlineChapter(context, input.chapterId);
    return {
      documents: [
        {
          key: `chapter:${input.chapterId}`,
          kind: 'kids.chapter',
          schemaVersion: 'kids.chapter/1',
          value: {
            chapterId: input.chapterId,
            position: chapter.position,
            title: output.title,
            content: output.content,
            safetyRevisionAttempt: input.safetyRevision?.attempt ?? 0,
          },
          contentHash: hashChapter(output),
        },
      ],
      memories: [],
      // Prefer NOT marking written until continuity apply succeeds —
      // orchestrator may use analyze-continuity as the commit that marks written.
      // Sketch: emit document only; continuity apply marks status.
      stateIntent: undefined,
      events: [
        {
          key: `chapter-generated:${input.chapterId}`,
          type: 'kids.chapter.generated',
          schemaVersion: 'kids.chapter.generated/1',
          payload: {
            entityId: context.entityId,
            chapterId: input.chapterId,
            contentHash: hashChapter(output),
          },
        },
      ],
      diagnostics: [],
    };
  },
  projectState(input) {
    return input.stateIntent;
  },
});
```

#### `analyze-continuity` (role: `analyzer`)

```ts
export interface AnalyzeContinuityInput {
  readonly chapterId: string;
  /** hash of the chapter document that was accepted post-safety */
  readonly chapterContentHash: string;
}

export interface ContinuityContractOutput {
  readonly summary?: string;
  readonly scene_snapshot?: {
    readonly location?: string;
    readonly time_of_day?: string;
    readonly active_characters?: readonly string[];
    readonly environment_block?: string;
  };
  readonly new_facts?: readonly {
    readonly content: string;
    readonly severity: 'critical' | 'important' | 'minor';
    readonly type?: 'fact' | 'rule' | 'lore';
    readonly scope?: 'story' | 'individual';
    readonly tags?: readonly string[];
    readonly duplicate_of?: string | null;
  }[];
  readonly character_updates?: /* structured */ unknown;
  readonly potential_conflicts?: readonly unknown[];
  readonly tone_safety_audit?: unknown;
  readonly narrative_alignment_audit?: unknown;
  // illustration_briefs intentionally excluded — kids illustration module owns that
}

export const analyzeContinuityTask = defineTask({
  role: 'analyzer',
  inputSchema: AnalyzeContinuityInputSchema,
  contract: KIDS_CONTINUITY_CONTRACT_REF,
  project(input, context) { /* chapter text from documents + state + memory */ },
  interpret(output, input, context): ModuleResult<KidsNarrativeDelta> {
    return {
      documents: [
        {
          key: `continuity:${input.chapterId}:${input.chapterContentHash}`,
          kind: 'kids.continuity-report',
          schemaVersion: 'kids.continuity-report/1',
          value: output as unknown as JsonValue,
          contentHash: hashJson(output),
        },
      ],
      memories: factsToCandidates(output.new_facts, context),
      stateIntent: {
        schemaVersion: KIDS_NARRATIVE_DELTA_SCHEMA_VERSION,
        value: {
          setSnapshot: mapScene(output, context),
          pushNarrativeWindow: {
            chapterId: input.chapterId,
            position: /* … */,
            summary: output.summary ?? '',
          },
          markChapterStatus: {
            chapterId: input.chapterId,
            status: 'written',
          },
          recordWrittenChapter: { chapterId: input.chapterId },
        },
      },
      events: [
        {
          key: `chapter-committed:${input.chapterId}`,
          type: 'kids.chapter.committed',
          schemaVersion: 'kids.chapter.committed/1',
          payload: {
            entityId: context.entityId,
            chapterId: input.chapterId,
            chapterContentHash: input.chapterContentHash,
          },
        },
      ],
      diagnostics: [],
    };
  },
  projectState(input, context) {
    // post-memory: only apply character/fact-derived state that survived memory decisions
    return mergeStateIntentWithAppliedMemory(input, context);
  },
});
```

### 3.6 Package exports

```ts
// @acme/module-kids-narrative
export { kidsNarrativeModule } from './module.js';
export {
  KIDS_NARRATIVE_NAMESPACE,
  KidsNarrativeStateSchema,
  KidsNarrativeDeltaSchema,
  // input schemas for composition / CLI
  BootstrapStoryInputSchema,
  GenerateOutlineInputSchema,
  GenerateChapterInputSchema,
  AnalyzeContinuityInputSchema,
} from './schemas.js';
export {
  KIDS_OUTLINE_STANDARD_REF,
  KIDS_OUTLINE_FAKTA_REF,
  KIDS_CHAPTER_STANDARD_REF,
  KIDS_CHAPTER_FAKTA_REF,
  KIDS_CONTINUITY_REF,
} from './contracts/refs.js';
```

---

## 4. `@acme/module-kids-safety`

```ts
export const KIDS_SAFETY_NAMESPACE = 'kids.safety' as const;

// Option A (preferred sketch): safety is a module with empty/minimal state
// and analyzer tasks only — no durable kids.safety state machine.
// Option B: pure package of contracts + helpers, executed under kids.narrative
// namespace (worse isolation).

export interface KidsSafetyState {
  readonly schemaMarker: 'empty'; // or omit module state entirely if core requires state —
  // if core requires state schema, use a unit state { readonly ok: true }
}

export interface ChapterSafetyAuditInput {
  readonly ageGroup: string;
  readonly childProfileSummary: string;
  readonly text: string; // premise or chapter
  readonly stage: 'input_premise' | 'output_chapter';
  readonly chapterId?: string;
}

export interface ChapterSafetyAuditOutput {
  readonly verdict: 'pass' | 'revise' | 'block';
  readonly severity?: string;
  readonly reasons: readonly string[];
  readonly flagged_spans?: readonly string[];
  readonly suggested_fix?: string;
  readonly safe_summary?: string | null;
  readonly rewrite_mode?: string;
  readonly tone_adjustment?: string | null;
  readonly keep_elements?: readonly string[];
}

export const chapterSafetyAuditTask = defineTask({
  role: 'analyzer',
  inputSchema: ChapterSafetyAuditInputSchema,
  contract: KIDS_CHAPTER_SAFETY_AUDIT_REF,
  project(input) {
    return input;
  },
  interpret(output, input, context): ModuleResult<KidsSafetyDelta> {
    // semantic: suggested_fix must not equal full replacement chapter;
    // validate verdict enum; non-pass does not write narrative docs
    return {
      documents: [
        {
          key: `safety:${input.chapterId ?? 'premise'}:${hashText(input.text)}`,
          kind: 'kids.safety-report',
          schemaVersion: 'kids.safety-report/1',
          value: output as unknown as JsonValue,
          contentHash: hashJson(output),
        },
      ],
      memories: [],
      stateIntent: undefined,
      events: [
        {
          key: `safety:${context.executionId}`,
          type: 'kids.safety.audited',
          schemaVersion: 'kids.safety.audited/1',
          payload: {
            verdict: output.verdict,
            stage: input.stage,
            chapterId: input.chapterId ?? null,
          },
        },
      ],
      diagnostics: [],
    };
  },
  projectState() {
    return undefined;
  },
});
```

Orchestrator helper (product or kids-policies):

```ts
export type SafetyLoopOutcome =
  | { readonly kind: 'pass'; readonly content: string; readonly report: ChapterSafetyAuditOutput }
  | { readonly kind: 'blocked'; readonly content: string; readonly report: ChapterSafetyAuditOutput }
  | { readonly kind: 'needs-revision'; readonly note: string; readonly report: ChapterSafetyAuditOutput };

// runKidsChapterSafetyLoop is NOT inside ExecutionEngine —
// it calls execute(generate-chapter) / execute(safety-audit) repeatedly.
```

---

## 5. `@acme/module-kids-illustration`

```ts
export const KIDS_ILLUSTRATION_NAMESPACE = 'kids.illustration' as const;

export interface KidsIllustrationState {
  readonly styleId: IllustrationStyleId;
  readonly characterAnchors: readonly {
    readonly characterId: string;
    readonly styleId: IllustrationStyleId;
    readonly assetRef?: string; // opaque storage key, not URL policy
  }[];
  readonly storyAnchor?: {
    readonly memberOrder: readonly string[];
    readonly assetRef?: string;
  };
  readonly coverAssetRef?: string;
}

export interface ExtractIllustrationBriefsInput {
  readonly chapterId: string;
  readonly chapterContentHash: string;
  readonly slotCount: 1 | 2;
}

export interface IllustrationBriefSlot {
  readonly slot: number;
  readonly sceneSummary: string;
  readonly charactersPresent: readonly string[];
  readonly cameraOrComposition?: string;
  readonly mood?: string;
  readonly mustInclude?: readonly string[];
  readonly mustAvoid?: readonly string[];
}

export interface ExtractIllustrationBriefsOutput {
  readonly slots: readonly IllustrationBriefSlot[];
}

export const extractIllustrationBriefsTask = defineTask({
  role: 'producer',
  inputSchema: ExtractIllustrationBriefsInputSchema,
  contract: KIDS_ILLUSTRATION_EXTRACTION_REF,
  project(input, context) {
    // load chapter document + character visual anchors from read context
    // (cross-entity: product may pass visual baselines in task input if
    // illustration state is separate entityId)
  },
  interpret(output, input, context): ModuleResult<KidsIllustrationDelta> {
    // semantic: output.slots.length === input.slotCount
    return {
      documents: [
        {
          key: `briefs:${input.chapterId}:${input.chapterContentHash}`,
          kind: 'kids.illustration-briefs',
          schemaVersion: 'kids.illustration-briefs/1',
          value: output as unknown as JsonValue,
          contentHash: hashJson(output),
        },
      ],
      memories: [],
      stateIntent: undefined,
      events: [
        {
          key: `briefs-ready:${input.chapterId}`,
          type: 'kids.illustration.briefs-ready',
          schemaVersion: 'kids.illustration.briefs-ready/1',
          payload: {
            chapterId: input.chapterId,
            slotCount: output.slots.length,
          },
        },
      ],
      diagnostics: [],
    };
  },
  projectState() {
    return undefined;
  },
});

export interface ExtractCoverBriefInput {
  readonly bookTitle: string;
  // optional: chapter 1 hash, character ids
}

export const extractCoverBriefTask = defineTask({
  role: 'producer',
  inputSchema: ExtractCoverBriefInputSchema,
  contract: KIDS_COVER_EXTRACTION_REF,
  // … analogous: document kids.cover-brief + event kids.cover.brief-ready
});
```

**Image generation is not a DomainModule task in this sketch.** See ports.

---

## 6. `@acme/kids-ports` — product ports

These are **not** required to live in `@acme/core`. Sketch them as a thin
package the composition root implements.

```ts
// @acme/kids-ports

export interface ImageGenerateRequest {
  readonly jobKey: string; // idempotency
  readonly kind: 'anchor' | 'chapter' | 'cover';
  readonly styleId: string;
  readonly promptText: string;
  readonly negativePrompt?: string;
  readonly referenceImageRefs: readonly string[];
  readonly geometry: {
    readonly width: number;
    readonly height: number;
  };
  readonly modelProfile?: string;
}

export interface ImageGenerateResult {
  readonly provider: string;
  readonly model: string;
  readonly providerTaskId?: string;
  readonly resultRef: string; // storage ref or temp URL opaque
  readonly usage?: { readonly estimatedCost?: number };
}

export interface ImageGateway {
  generate(request: ImageGenerateRequest): Promise<ImageGenerateResult>;
}

export interface StoragePutRequest {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface StorageGateway {
  put(request: StoragePutRequest): Promise<{ readonly assetRef: string }>;
  resolveUrl?(assetRef: string): Promise<string>;
}

export type ModerationDecision =
  | { readonly kind: 'pass' }
  | { readonly kind: 'pass-with-note'; readonly note: string }
  | { readonly kind: 'parent-review'; readonly categories: readonly string[] }
  | { readonly kind: 'block'; readonly categories: readonly string[] };

export interface ModerationGateway {
  check(input: {
    readonly text: string;
    readonly pipelineStep: string;
  }): Promise<ModerationDecision>;
}

export interface SpeechToTextGateway {
  transcribe(input: {
    readonly audio: Uint8Array;
    readonly mimeType: string;
    readonly language?: string;
  }): Promise<{ readonly text: string; readonly provider: string; readonly model: string }>;
}

export interface TextToSpeechGateway {
  speak(input: {
    readonly text: string;
    readonly voice: string;
  }): Promise<{ readonly audioBase64: string; readonly contentType: string }>;
}

/**
 * Optional vector recall. Returns ids/snippets; ranking fusion with
 * MemoryEngine results is orchestrator or memory retrieval adapter concern.
 */
export interface VectorMemoryGateway {
  search(input: {
    readonly entityId: string;
    readonly query: string;
    readonly limit: number;
  }): Promise<readonly { readonly memoryId: string; readonly score: number }[]>;
}
```

### Image prepare (pure, lives in kids-policies or illustration package)

```ts
export function prepareChapterImagePrompt(input: {
  readonly brief: IllustrationBriefSlot;
  readonly styleId: IllustrationStyleId;
  readonly characterAnchors: readonly { name: string; traits: string }[];
  readonly storyAnchorRef?: string;
}): {
  readonly promptText: string;
  readonly negativePrompt: string;
  readonly referenceImageRefs: readonly string[];
};
```

---

## 7. Composition root API (app-level)

```ts
// apps/audioleaf-kids-worker/src/composition.ts (sketch)

import { ExecutionEngine, createModuleRegistry, createContractRegistry } from '@acme/core';
import { kidsNarrativeModule } from '@acme/module-kids-narrative';
import { kidsSafetyModule } from '@acme/module-kids-safety';
import { kidsIllustrationModule } from '@acme/module-kids-illustration';
import { createOpenAiModelGateway } from '@acme/adapter-model-openai';
// product adapters…
import { KidsBookOrchestrator } from './orchestrator.js';

export function buildKidsComposition(env: Env) {
  const modules = createModuleRegistry([
    kidsNarrativeModule,
    kidsSafetyModule,
    kidsIllustrationModule,
  ]);
  const contracts = createContractRegistry([
    /* all PromptContracts from modules */
  ]);
  const gateway = /* multi-provider ModelGateway facade resolving creative/analysis/safety */;
  const repository = /* sqlite | supabase hybrid */;
  const engine = new ExecutionEngine({ modules, contracts, gateway, repository /* … */ });

  const images = createImageGatewayWithFallback(env);
  const storage = createSupabaseStorage(env);
  const moderation = createOpenAiModeration(env);

  return new KidsBookOrchestrator({
    engine,
    images,
    storage,
    moderation,
    jobs: createJobLedger(env),
    projector: createStoryProjector(env),
  });
}
```

### Orchestrator surface

```ts
export interface KidsBookOrchestrator {
  /** After product gates + purchase; creates entity + bootstrap + outline */
  startStory(input: StartStoryCommand): Promise<StartStoryResult>;

  /** Inngest: text.chaptertext */
  runChapterPipeline(input: {
    readonly storyId: string;
    readonly chapterId: string;
    readonly jobId: string;
  }): Promise<ChapterPipelineResult>;

  /** Inngest: illustration after briefs */
  runIllustrationPipeline(input: {
    readonly storyId: string;
    readonly chapterId: string;
    readonly jobId: string;
  }): Promise<void>;

  /** Parent PIN decision */
  resolveParentReview(input: ParentReviewCommand): Promise<void>;
}

export type ChapterPipelineResult =
  | { readonly status: 'committed' }
  | { readonly status: 'blocked_review'; readonly reviewId: string }
  | { readonly status: 'failed'; readonly error: string };
```

`runChapterPipeline` (conceptual body):

```ts
async runChapterPipeline({ storyId, chapterId, jobId }) {
  await this.jobs.claim(jobId);
  // optional RAG preflight…
  let contentHash: string | undefined;
  let revision = 0;
  for (;;) {
    const gen = await this.engine.execute({
      namespace: 'kids.narrative',
      task: 'generate-chapter',
      entityId: storyId,
      input: {
        chapterId,
        safetyRevision: revision === 0 ? undefined : { attempt: revision, note },
      },
      // operationKey includes jobId + revision for idempotency
    });
    contentHash = /* from result documents */;
    const audit = await this.engine.execute({
      namespace: 'kids.safety',
      task: 'chapter-safety-audit',
      entityId: storyId, // or safety entity; sketch: same story entity different namespace
      input: { /* text from gen */ },
    });
    if (pass) break;
    if (block) return parentReview(…);
    if (revise && revision < MAX) { revision++; note = buildSafetyRevisionNote(…); continue; }
    return blocked;
  }
  await Promise.all([
    this.engine.execute({ task: 'analyze-continuity', input: { chapterId, chapterContentHash: contentHash } }),
    this.engine.execute({
      namespace: 'kids.illustration',
      task: 'extract-illustration-briefs',
      input: { chapterId, chapterContentHash: contentHash, slotCount },
    }),
  ]);
  // outbox drain or sync projector for text
  await this.jobs.complete(jobId);
  return { status: 'committed' };
}
```

---

## 8. Entity and registry conventions

| Concept | Value |
| --- | --- |
| Story entityId | Product `story_id` (UUID) as ACME `EntityId` |
| Narrative namespace | `kids.narrative` |
| Safety namespace | `kids.safety` (unit state or shared entity) |
| Illustration namespace | `kids.illustration` (optional separate state machine) |
| Task names | kebab-case, stable, versioned via contract refs not task names |
| Contract ids | `kids.<area>.<name>` + semver `1.0.0` |
| Document keys | deterministic: `chapter:{chapterId}`, `outline:{entityId}` |
| Event types | `kids.<aggregate>.<verb>` with schemaVersion suffix |

Cross-namespace reads: ExecutionEngine today is module-scoped. Product
orchestrator loads chapter document from narrative commit evidence / repository
and passes content (or contentHash + repository read) into illustration task
input. Do **not** let illustration module import narrative module.

---

## 9. Execution request shape (core-facing)

Aligns with existing ExecutionEngine request types (names approximate):

```ts
await engine.execute({
  module: 'kids.narrative',
  task: 'generate-chapter',
  entityId: storyId,
  input: { chapterId: 'chapter-1' },
  expectedRevision: currentRevision, // CAS
  operationKey: `kids:${storyId}:chapter-1:gen:r${revision}`,
  // policy: retention, model selection hints via composition — not domain
});
```

Model selection (creative vs analysis vs safety) is **composition/gateway
routing**, frozen at init into product config and/or execution policy — not
chosen inside interpret().

---

## 10. Offline scenario shape

```yaml
# conceptual acme-scenario/1 fragment
id: kids-chapter1-offline
seed:
  clock: "2026-08-02T00:00:00.000Z"
  ids: sequential
steps:
  - id: outline
    type: execute
    module: kids.narrative
    task: generate-outline
    entityId: story-1
    input: {}
    script: fixtures/outline-standard.json
  - id: chapter
    type: execute
    module: kids.narrative
    task: generate-chapter
    entityId: story-1
    input: { chapterId: "chapter-1" }
    script: fixtures/chapter-1.json
  - id: safety
    type: execute
    module: kids.safety
    task: chapter-safety-audit
    entityId: story-1
    input: { /* … */ }
    script: fixtures/safety-pass.json
  - id: continuity
    type: execute
    module: kids.narrative
    task: analyze-continuity
    entityId: story-1
    input: { chapterId: "chapter-1", chapterContentHash: "…" }
    script: fixtures/continuity-1.json
  - id: assert-state
    type: assert
    # outline chapter-1 written, window length, fact memories…
  - id: replay
    type: replay
    execution: continuity
```

Parent-review branches and image providers are **out of ScenarioRunner**;
cover those with product integration tests + scripted ImageGateway.

---

## 11. What this API deliberately omits

- HTTP route handlers and React hooks  
- Inngest function IDs (product)  
- Leaf pricing tables  
- Exact Supabase column mapping  
- Core changes for multi-model routing (composition facade first)  
- Evaluator registry in core (still deferred; safety uses analyzer task + product loop)

---

## 12. File tree if packages were created

```text
packages/
  kids-policies/
    src/index.ts
    src/profiles.ts
    src/framework.ts
    src/architecture.ts
    src/premise.ts
    src/illustration-style.ts
    src/safety-policy.ts
    src/coping.ts
  module-kids-narrative/
    src/index.ts
    src/module.ts
    src/schemas.ts
    src/state.ts
    src/memory-policy.ts
    src/identity.ts
    src/immutable.ts
    src/contracts/*.ts
    src/tasks/{bootstrap-story,generate-outline,generate-chapter,analyze-continuity}.ts
  module-kids-safety/
    src/index.ts
    src/module.ts
    src/schemas.ts
    src/contracts/chapter-safety-audit.ts
    src/tasks/chapter-safety-audit.ts
  module-kids-illustration/
    src/index.ts
    src/module.ts
    src/schemas.ts
    src/contracts/{illustration-extraction,cover-extraction}.ts
    src/tasks/{extract-illustration-briefs,extract-cover-brief}.ts
  kids-ports/
    src/index.ts
    src/image.ts
    src/storage.ts
    src/moderation.ts
    src/voice.ts
    src/vector-memory.ts
```

This tree is documentation only until an activated charter says otherwise.
