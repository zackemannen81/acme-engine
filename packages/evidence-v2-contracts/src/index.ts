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
  EvidenceV2Occurrence,
  EvidenceV2Chain,
  EvidenceV2ChainDecision,
  EvidenceV2ChainMembership,
  EvidenceV2ChainProposal,
  EvidenceV2SourcePart,
  EvidenceV2SourceStructure,
} from '@acme/module-evidence-v2';

export type {
  EvidenceV2Occurrence,
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
