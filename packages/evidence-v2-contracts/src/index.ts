/**
 * V2 product contracts: the records the application stores and the one port it
 * stores them through.
 *
 * Shapes and a port only. Derivation lives in `@acme/module-evidence-v2` and
 * is never reimplemented here: the repository stores what that layer produced
 * and hands it back, so no read path can re-derive a structure (R-10).
 */

import type {
  EvidenceArtifactObjectEnvelope,
  EvidenceArtifactRepresentation,
} from '@acme/evidence-artifacts';
import type {
  EvidenceV2Claim,
  EvidenceV2ClaimGroupingDecision,
  EvidenceV2EffectiveStanding,
  EvidenceV2Occurrence,
  EvidenceV2Relation,
  EvidenceV2RelationReviewDecision,
  EvidenceV2ReviewDecision,
  EvidenceV2Chain,
  EvidenceV2ChainDecision,
  EvidenceV2ChainMembership,
  EvidenceV2ChainProposal,
  EvidenceV2SourcePart,
  EvidenceV2SourceStructure,
} from '@acme/module-evidence-v2';

export type {
  EvidenceV2Claim,
  EvidenceV2ClaimGroupingDecision,
  EvidenceV2EffectiveStanding,
  EvidenceV2Occurrence,
  EvidenceV2Relation,
  EvidenceV2RelationReviewDecision,
  EvidenceV2ReviewDecision,
  EvidenceV2Chain,
  EvidenceV2ChainDecision,
  EvidenceV2ChainMembership,
  EvidenceV2SourcePart,
  EvidenceV2SourceStructure,
};

export const EVIDENCE_V2_CASE_RECORD_VERSION = 'evidence-v2-case/1';
export const EVIDENCE_V2_ARTIFACT_RECORD_VERSION = 'evidence-v2-artifact/1';

/** Bound on any list a route or page may return (R-08). */
export const EVIDENCE_V2_MAX_PAGE_SIZE = 100;

export interface EvidenceV2CaseRecord {
  readonly schemaVersion: typeof EVIDENCE_V2_CASE_RECORD_VERSION;
  readonly caseId: string;
  readonly title: string;
  readonly caseReference: string;
  readonly createdAt: string;
}

export interface EvidenceV2ArtifactProvenance {
  /** The container the text was prepared from. Its bytes are never ingested. */
  readonly parentKind: string;
  readonly parentSha256: string;
  readonly parentByteLength: number;
  readonly pageCount: number | null;
  readonly extractionMethod: string;
  readonly extractedAt: string;
}

export const EVIDENCE_V2_TEXT_SOURCE_CLASS =
  'stage-a-anonymized-judicial-text/1';
export const EVIDENCE_V2_PDF_SOURCE_CLASS = 'stage-a-pdf-extracted-text/1';
export const EVIDENCE_V2_PDF_EXTRACTOR_RULE_VERSION = 'pdfjs-text/1';
export const EVIDENCE_V2_PDF_EXTRACTOR_METHOD = 'pdfjs-dist/6.2.108';

/** Same operational ceiling the existing text import already uses. */
export const EVIDENCE_V2_PDF_MAX_BYTES = 64 * 1024 * 1024;
export const EVIDENCE_V2_CANONICAL_TEXT_MAX_BYTES = 64 * 1024 * 1024;

/**
 * Image-only PDFs are refused. A judicial page states hundreds of characters;
 * fewer than this many non-whitespace characters per page is treated as no
 * text. OCR stays out.
 */
export const EVIDENCE_V2_PDF_MIN_CHARS_PER_PAGE = 20;

export type EvidenceV2PdfRefusalCode =
  | 'EVIDENCE_V2_PDF_NOT_PDF'
  | 'EVIDENCE_V2_PDF_ENCRYPTED'
  | 'EVIDENCE_V2_PDF_EMPTY_TEXT'
  | 'EVIDENCE_V2_PDF_OVERSIZE'
  | 'EVIDENCE_V2_PDF_TEXT_OVERSIZE'
  | 'EVIDENCE_V2_PDF_EXTRACT_FAILED';

export interface EvidenceV2PdfExtraction {
  readonly text: string;
  readonly pageCount: number;
  readonly extractionMethod: typeof EVIDENCE_V2_PDF_EXTRACTOR_METHOD;
  readonly extractionRuleVersion: typeof EVIDENCE_V2_PDF_EXTRACTOR_RULE_VERSION;
}

export type EvidenceV2PdfExtractResult =
  | { readonly ok: true; readonly value: EvidenceV2PdfExtraction }
  | { readonly ok: false; readonly code: EvidenceV2PdfRefusalCode };

/**
 * The PDF extractor port.
 *
 * The adapter implements this. Domain and contract layers see only the
 * result: canonical text, a page count, and a named refusal. They never see
 * the library's types.
 */
export interface EvidenceV2PdfExtractor {
  extract(bytes: Uint8Array): Promise<EvidenceV2PdfExtractResult>;
}

/** Encrypted received bytes of a PDF, stored separately from canonical text. */
export interface EvidenceV2ReceivedArtifact {
  readonly sha256: string;
  readonly byteLength: number;
  readonly objectKey: string;
  readonly mediaType: 'application/pdf';
  readonly representation: EvidenceArtifactRepresentation;
  readonly envelope: EvidenceArtifactObjectEnvelope;
}

export interface EvidenceV2ArtifactRecord {
  readonly schemaVersion: typeof EVIDENCE_V2_ARTIFACT_RECORD_VERSION;
  readonly artifactId: string;
  readonly caseId: string;
  readonly title: string;
  readonly canonicalSha256: string;
  readonly canonicalByteLength: number;
  readonly lineCount: number;
  readonly partCount: number;
  readonly chainCount: number;
  /** Where the encrypted canonical text lives in the object store. */
  readonly objectKey: string;
  /** The shared artifact foundation's envelope, so the text can be opened. */
  readonly representation: EvidenceArtifactRepresentation;
  readonly envelope: EvidenceArtifactObjectEnvelope;
  readonly importedAt: string;
  readonly structureRuleVersion: string;
  readonly chainRuleVersion: string;
  readonly provenance: EvidenceV2ArtifactProvenance;
  /**
   * Absent on artifacts imported before ACME-0158. Readers treat a missing
   * class as the text class. Never required, so existing records still parse.
   */
  readonly sourceClass?: string;
  /** Absent on text imports. Changing it is a new artifact version. */
  readonly extractionRuleVersion?: string;
  /** Present only when the L0 object is a retained PDF. */
  readonly received?: EvidenceV2ReceivedArtifact;
}

export interface EvidenceV2Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface EvidenceV2PageRequest {
  readonly offset: number;
  readonly limit: number;
}

/**
 * What one import writes, in one transaction.
 *
 * The structure and the proposal arrive already derived. Storing them together
 * with the artifact is what makes derivation happen exactly once.
 */
export interface EvidenceV2ImportWrite {
  readonly artifact: EvidenceV2ArtifactRecord;
  readonly structure: EvidenceV2SourceStructure;
  readonly proposal: EvidenceV2ChainProposal;
}

export interface EvidenceV2ChainDetail {
  readonly chain: EvidenceV2Chain;
  readonly memberships: readonly EvidenceV2ChainMembership[];
}

/** A chain in a bounded list: enough to choose one, without its instances. */
export interface EvidenceV2ChainSummary {
  readonly chainId: string;
  readonly subjectLabel: string;
  readonly caseFileRef: string | null;
  readonly instanceCount: number;
}

/**
 * One window's extraction outcome.
 *
 * Stored per window so a partially complete extraction is a fact a reviewer can
 * see — committed, outstanding or failed with its reason — rather than a job
 * that silently produced nothing (R-05).
 */
export interface EvidenceV2ExtractionWindowState {
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly windowId: string;
  readonly partId: string;
  readonly status: 'committed' | 'failed';
  readonly unitCount: number;
  readonly occurrenceCount: number;
  readonly executionId: string | null;
  readonly failureCode: string | null;
  readonly decidedAt: string;
}

/** An occurrence together with the instance it was stored under. */
export interface EvidenceV2OccurrenceBinding {
  readonly occurrence: EvidenceV2Occurrence;
  readonly instanceKey: string;
}

/**
 * One J4 window's comparison outcome.
 *
 * Stored per window so a partial compare is visible — committed, outstanding
 * or failed — and a re-run executes only windows with no committed execution.
 */
export interface EvidenceV2ComparisonWindowState {
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly windowId: string;
  readonly priorInstanceKey: string;
  readonly status: 'committed' | 'failed';
  readonly currentCount: number;
  readonly priorCount: number;
  readonly relationCount: number;
  readonly executionId: string | null;
  readonly failureCode: string | null;
  readonly decidedAt: string;
}

/**
 * The surfaces ADR-0049 fixes, and which of them this build serves.
 *
 * One list, read by navigation and by the status surface alike. R-07 is the
 * regression a second list would reintroduce: a case must not be able to
 * answer "there is no timeline" on one page and "the timeline is empty" on
 * another.
 */
export const EVIDENCE_V2_SURFACES = [
  { id: 'case', label: 'Case', state: 'available' },
  { id: 'documents', label: 'Documents', state: 'available' },
  { id: 'chains', label: 'Chains', state: 'available' },
  { id: 'claims', label: 'Claims', state: 'available' },
  { id: 'timeline', label: 'Timeline', state: 'not-implemented' },
  { id: 'relations', label: 'Relations', state: 'available' },
  { id: 'status', label: 'Status', state: 'available' },
] as const;

export type EvidenceV2SurfaceId = (typeof EVIDENCE_V2_SURFACES)[number]['id'];

/**
 * Why an unbuilt surface is unbuilt, and what delivers it.
 *
 * A surface that does not exist reports this. It never reports zero: "0
 * claims" is a statement about the case, and the true statement is about the
 * product.
 */
export interface EvidenceV2SurfaceGap {
  readonly state: 'not-implemented';
  readonly reason: string;
  readonly deliveredBy: string;
}

export const EVIDENCE_V2_SURFACE_GAPS: Readonly<
  Record<'timeline' | 'consensus', EvidenceV2SurfaceGap>
> = {
  timeline: {
    state: 'not-implemented',
    reason: 'The temporal projection over occurrences and claims is not built.',
    deliveredBy: 'ACME-0162',
  },
  consensus: {
    state: 'not-implemented',
    reason:
      'The consensus projection has no reviewed material to compute from.',
    deliveredBy: 'ACME-0162',
  },
};

/**
 * What one case contains, and where to resume.
 *
 * A projection: it stores nothing, it is recomputed from stored rows on every
 * read, and it reports counts rather than findings. Counts come from the rows
 * themselves rather than from the artifact record's denormalized totals, so
 * the surface reports what is actually persisted.
 */
export interface EvidenceV2CaseOverview {
  readonly caseId: string;
  readonly counts: {
    readonly artifacts: number;
    readonly lines: number;
    readonly parts: number;
    readonly citableUnits: number;
    readonly chains: number;
    readonly instances: number;
    readonly occurrences: number;
    readonly committedWindows: number;
    readonly failedWindows: number;
    readonly chainDecisions: number;
    /** Review, folded from the decision log. Never a stored field. */
    readonly reviewDecisions: number;
    readonly pending: number;
    readonly accepted: number;
    readonly rejected: number;
    readonly needsRevision: number;
    readonly reviewerAuthored: number;
    /** Claims, and how much evidence they currently group. */
    readonly claims: number;
    readonly claimGroupingDecisions: number;
    readonly groupedOccurrences: number;
    readonly crossInstanceClaims: number;
    /** Relations, folded from the review log. Never a stored field. */
    readonly relations: number;
    readonly relationReviewDecisions: number;
    readonly acceptedRelations: number;
    readonly pendingRelations: number;
    readonly rejectedRelations: number;
    readonly modelProposedRelations: number;
    readonly reviewerAuthoredRelations: number;
  };
  /** Instances with no committed extraction window. Work, not evidence. */
  readonly instancesWithoutExtraction: number;
  /** Instances extracted but holding at least one undecided occurrence. */
  readonly instancesPendingReview: number;
  /**
   * A concrete next instance, or null when there is nothing outstanding.
   * Named rather than counted, because "where do I resume" is answered by a
   * link and not by a number.
   */
  readonly resumeAt: {
    readonly artifactId: string;
    readonly chainId: string;
    readonly instanceKey: string;
    readonly subjectLabel: string;
    readonly instanceOrdinal: number;
  } | null;
  /** Surfaces that report a named condition instead of a count. */
  readonly unavailable: Readonly<Record<string, EvidenceV2SurfaceGap>>;
}

/**
 * The one port the V2 application stores through.
 *
 * `readEffectiveMemberships` returns the fold of the stored proposal and the
 * appended decisions. `readProposedMemberships` returns the proposal as it was
 * written at import, which is what makes "the decision changed nothing else"
 * checkable rather than asserted.
 */
export interface EvidenceV2Repository {
  createCase(record: EvidenceV2CaseRecord): Promise<void>;
  listCases(
    page: EvidenceV2PageRequest,
  ): Promise<EvidenceV2Page<EvidenceV2CaseRecord>>;
  readCase(caseId: string): Promise<EvidenceV2CaseRecord | undefined>;

  writeImport(write: EvidenceV2ImportWrite): Promise<void>;
  listArtifacts(
    caseId: string,
    page: EvidenceV2PageRequest,
  ): Promise<EvidenceV2Page<EvidenceV2ArtifactRecord>>;
  readArtifact(
    artifactId: string,
  ): Promise<EvidenceV2ArtifactRecord | undefined>;

  listParts(
    artifactId: string,
    page: EvidenceV2PageRequest,
  ): Promise<EvidenceV2Page<EvidenceV2SourcePart>>;
  readPart(
    artifactId: string,
    partId: string,
  ): Promise<EvidenceV2SourcePart | undefined>;

  listChains(
    artifactId: string,
    page: EvidenceV2PageRequest,
  ): Promise<EvidenceV2Page<EvidenceV2ChainSummary>>;
  readChain(
    artifactId: string,
    chainId: string,
  ): Promise<EvidenceV2ChainDetail | undefined>;

  readProposedMemberships(
    artifactId: string,
  ): Promise<readonly EvidenceV2ChainMembership[]>;
  readEffectiveMemberships(
    artifactId: string,
  ): Promise<readonly EvidenceV2ChainMembership[]>;

  /** Idempotent: an occurrence is content-identified and immutable. */
  putOccurrences(
    artifactId: string,
    instanceKey: string,
    occurrences: readonly EvidenceV2Occurrence[],
  ): Promise<void>;
  listOccurrences(
    artifactId: string,
    instanceKey: string,
    page: EvidenceV2PageRequest,
  ): Promise<EvidenceV2Page<EvidenceV2Occurrence>>;
  putExtractionWindow(state: EvidenceV2ExtractionWindowState): Promise<void>;
  readExtractionWindows(
    artifactId: string,
    instanceKey: string,
  ): Promise<readonly EvidenceV2ExtractionWindowState[]>;

  appendChainDecision(
    artifactId: string,
    decision: EvidenceV2ChainDecision,
  ): Promise<void>;
  listChainDecisions(
    artifactId: string,
  ): Promise<readonly EvidenceV2ChainDecision[]>;

  /**
   * Append-only. A decision is never updated and never deleted; a reversal is
   * a further decision that supersedes its predecessor.
   */
  appendReviewDecision(decision: EvidenceV2ReviewDecision): Promise<void>;
  listReviewDecisions(
    artifactId: string,
    instanceKey: string,
  ): Promise<readonly EvidenceV2ReviewDecision[]>;
  /** The whole log for one occurrence, oldest first. */
  readOccurrenceReviewHistory(
    artifactId: string,
    occurrenceId: string,
  ): Promise<readonly EvidenceV2ReviewDecision[]>;
  /** Which instances of one artifact hold a committed window. */
  readExtractedInstanceKeys(artifactId: string): Promise<readonly string[]>;

  createClaim(claim: EvidenceV2Claim): Promise<void>;
  listClaims(
    caseId: string,
    page: EvidenceV2PageRequest,
  ): Promise<EvidenceV2Page<EvidenceV2Claim>>;
  readClaim(claimId: string): Promise<EvidenceV2Claim | undefined>;
  /** Append-only, exactly as review decisions are. */
  appendClaimGrouping(decision: EvidenceV2ClaimGroupingDecision): Promise<void>;
  listClaimGroupings(
    claimId: string,
  ): Promise<readonly EvidenceV2ClaimGroupingDecision[]>;
  /** Which claims one occurrence currently belongs to. */
  readOccurrenceClaimIds(
    occurrenceId: string,
  ): Promise<readonly EvidenceV2ClaimGroupingDecision[]>;
  /** The occurrences named by a set of ids, for the claim projection. */
  readOccurrencesById(
    ids: readonly string[],
  ): Promise<readonly EvidenceV2Occurrence[]>;

  createRelation(relation: EvidenceV2Relation): Promise<void>;
  listRelations(
    caseId: string,
    page: EvidenceV2PageRequest,
  ): Promise<EvidenceV2Page<EvidenceV2Relation>>;
  readRelation(relationId: string): Promise<EvidenceV2Relation | undefined>;
  /** Append-only, exactly as occurrence review and claim grouping are. */
  appendRelationReview(
    decision: EvidenceV2RelationReviewDecision,
  ): Promise<void>;
  listRelationReviews(
    relationId: string,
  ): Promise<readonly EvidenceV2RelationReviewDecision[]>;
  /**
   * Occurrence plus the instance it was stored under. The occurrence record
   * itself has no instance key; the table does.
   */
  readOccurrenceBindings(
    ids: readonly string[],
  ): Promise<readonly EvidenceV2OccurrenceBinding[]>;
  putComparisonWindow(state: EvidenceV2ComparisonWindowState): Promise<void>;
  readComparisonWindows(
    artifactId: string,
    instanceKey: string,
  ): Promise<readonly EvidenceV2ComparisonWindowState[]>;

  /**
   * The case overview projection. One read, aggregate queries, no structure
   * re-derivation and no snapshot clone (R-10).
   */
  readCaseOverview(caseId: string): Promise<EvidenceV2CaseOverview>;
}

export function clampEvidenceV2Page(
  offset: number | undefined,
  limit: number | undefined,
): EvidenceV2PageRequest {
  const safeOffset =
    Number.isFinite(offset) && (offset ?? 0) > 0 ? Math.floor(offset ?? 0) : 0;
  const requested =
    Number.isFinite(limit) && (limit ?? 0) > 0 ? Math.floor(limit ?? 0) : 25;
  return {
    offset: safeOffset,
    limit: Math.min(requested, EVIDENCE_V2_MAX_PAGE_SIZE),
  };
}
