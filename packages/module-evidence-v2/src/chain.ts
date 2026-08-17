/**
 * V2 domain organization: source parts to chains and chain instances.
 *
 * Slicing answers where a document begins and ends. This layer answers which
 * documents are the same subject over time, which is a semantic conclusion
 * rather than a structural one. It is therefore a *proposal* that a human
 * resolves, and every correction is an appended decision rather than a
 * mutation.
 *
 * Identity and time come from the document body's own labelled fields, never
 * from a part title. In the real binder the title line opening a part is the
 * trailing header of the *preceding* document, so one part titled
 * "Förhör med Ammouri, HUSSEIN" reports a body interview with Ammouri, Allia.
 * Reading the title would put that part in the wrong person's chain (R-02).
 */

import type {
  EvidenceV2SourcePart,
  EvidenceV2SourceStructure,
} from './source-structure.js';

export const EVIDENCE_V2_CHAIN_SCHEMA_VERSION = 'evidence-v2-chain/1';

export const EVIDENCE_V2_CHAIN_RULE_VERSION = 'evidence-v2-chain-rules/1';

/**
 * Labelled fields the Stage A judicial class states in its header block. The
 * value sits on the line after the label. This lexicon is class-specific, not
 * case-specific, and is pinned by the rule version: changing it changes every
 * derived chain.
 */
const FIELD_LABELS = {
  subject: 'Hörd person',
  date: 'Förhörsdatum',
  startTime: 'Förhör påbörjat',
  caseFileRef: 'Diarienr',
} as const;

const ALL_LABELS: readonly string[] = Object.values(FIELD_LABELS);

export interface EvidenceV2FieldValue {
  readonly value: string;
  readonly sourceLine: number;
}

export interface EvidenceV2DocumentIdentity {
  readonly sourcePartId: string;
  readonly subject: EvidenceV2FieldValue | null;
  readonly caseFileRef: EvidenceV2FieldValue | null;
  readonly date: EvidenceV2FieldValue | null;
  readonly startTime: EvidenceV2FieldValue | null;
}

export type EvidenceV2TemporalKind =
  'exact' | 'range' | 'approximate' | 'unknown';

export type EvidenceV2TemporalProvenance =
  'document-metadata' | 'reviewer' | 'unknown';

export interface EvidenceV2InstanceSourceTime {
  readonly kind: EvidenceV2TemporalKind;
  /** Exactly as the document states it. No conversion is performed. */
  readonly from: string | null;
  readonly to: string | null;
  /** No zone is asserted. The document states none, so neither does this. */
  readonly zone: null;
  readonly provenance: EvidenceV2TemporalProvenance;
  readonly sourceLine: number | null;
}

export interface EvidenceV2ChainMembership {
  readonly membershipId: string;
  readonly chainId: string;
  readonly sourcePartId: string;
  readonly primary: boolean;
  readonly instanceKey: string;
  readonly origin: 'proposed' | 'decided';
  readonly subjectSourceLine: number | null;
}

export interface EvidenceV2ChainInstance {
  readonly instanceKey: string;
  readonly instanceOrdinal: number;
  /** The opening part, then any continuation parts, in document order. */
  readonly sourcePartIds: readonly string[];
  readonly instanceSourceTime: EvidenceV2InstanceSourceTime;
  /** False when the instance has no known source time and cannot be placed. */
  readonly ordered: boolean;
}

export interface EvidenceV2Chain {
  readonly chainId: string;
  readonly subjectLabel: string;
  readonly caseFileRef: string | null;
  readonly instances: readonly EvidenceV2ChainInstance[];
}

export interface EvidenceV2ChainDiagnostic {
  readonly code: string;
  readonly sourcePartId: string | null;
  readonly message: string;
}

export interface EvidenceV2ChainProposal {
  readonly schemaVersion: typeof EVIDENCE_V2_CHAIN_SCHEMA_VERSION;
  readonly ruleVersion: typeof EVIDENCE_V2_CHAIN_RULE_VERSION;
  readonly chains: readonly EvidenceV2Chain[];
  readonly memberships: readonly EvidenceV2ChainMembership[];
  readonly unassignedPartIds: readonly string[];
  readonly identities: readonly EvidenceV2DocumentIdentity[];
  readonly diagnostics: readonly EvidenceV2ChainDiagnostic[];
}

export type EvidenceV2ChainDecisionAction =
  'assign' | 'unassign' | 'set-primary';

export interface EvidenceV2ChainDecision {
  readonly decisionId: string;
  readonly action: EvidenceV2ChainDecisionAction;
  readonly sourcePartId: string;
  readonly chainId: string;
  /** The decision this one replaces. A proposal needs no supersession. */
  readonly supersedes: string | null;
  /** Supplied by the caller. This layer invents no principal and no clock. */
  readonly principal: string;
  readonly decidedAt: string;
  readonly rationale: string;
}

export interface EvidenceV2ChainState {
  readonly schemaVersion: typeof EVIDENCE_V2_CHAIN_SCHEMA_VERSION;
  readonly ruleVersion: typeof EVIDENCE_V2_CHAIN_RULE_VERSION;
  readonly chains: readonly EvidenceV2Chain[];
  readonly memberships: readonly EvidenceV2ChainMembership[];
  readonly unassignedPartIds: readonly string[];
  readonly diagnostics: readonly EvidenceV2ChainDiagnostic[];
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Subject normalization for grouping only.
 *
 * Case and internal whitespace are collapsed so `Ammouri, HUSSEIN` and
 * `Ammouri, Hussein` are one subject. Nothing else is inferred: this is string
 * normalization, not identity resolution, and two different people who write
 * their name identically stay one chain until a reviewer says otherwise.
 */
export function normalizeEvidenceV2Subject(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().toUpperCase();
}

function fieldAt(
  lines: readonly string[],
  startLine: number,
  label: string,
): EvidenceV2FieldValue | null {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if ((lines[index] ?? '').trim() !== label) continue;
    const raw = (lines[index + 1] ?? '').trim();
    // An empty field, or a field whose "value" is the next label, is absent.
    if (raw.length === 0 || ALL_LABELS.includes(raw)) return null;
    return { value: raw, sourceLine: startLine + index + 1 };
  }
  return null;
}

/**
 * Read one part's document identity from its body.
 *
 * The first occurrence of each label wins: the header block sits at the top of
 * a document, and a part that happens to contain a second block is reported
 * for the first one deterministically rather than merged.
 *
 * The part title is never consulted. A title such as
 * `Förhör med Ammouri, HUSSEIN; 2007-04-25 …` is a single line of prose, not a
 * bare label, so it cannot satisfy the label-then-value shape either.
 */
export function readEvidenceV2DocumentIdentity(
  part: EvidenceV2SourcePart,
  canonicalLines: readonly string[],
): EvidenceV2DocumentIdentity {
  const lines = canonicalLines.slice(part.startLine - 1, part.endLine);
  return {
    sourcePartId: part.partId,
    subject: fieldAt(lines, part.startLine, FIELD_LABELS.subject),
    caseFileRef: fieldAt(lines, part.startLine, FIELD_LABELS.caseFileRef),
    date: fieldAt(lines, part.startLine, FIELD_LABELS.date),
    startTime: fieldAt(lines, part.startLine, FIELD_LABELS.startTime),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME = /^\d{2}[:.]\d{2}$/u;

/**
 * Typed source time from body metadata.
 *
 * Date and time give an exact point. A date alone gives a range over that
 * calendar day, because a day is what the document actually says. Neither
 * gives `unknown`. Missing precision stays missing and nothing is invented.
 */
export function deriveEvidenceV2InstanceSourceTime(
  identity: EvidenceV2DocumentIdentity,
): EvidenceV2InstanceSourceTime {
  const date = identity.date;
  if (date === null || !DATE.test(date.value)) {
    return {
      kind: 'unknown',
      from: null,
      to: null,
      zone: null,
      provenance: 'unknown',
      sourceLine: null,
    };
  }

  const time = identity.startTime;
  if (time !== null && TIME.test(time.value)) {
    const normalized = time.value.replace('.', ':');
    const stamp = `${date.value}T${normalized}`;
    return {
      kind: 'exact',
      from: stamp,
      to: stamp,
      zone: null,
      provenance: 'document-metadata',
      sourceLine: date.sourceLine,
    };
  }

  return {
    kind: 'range',
    from: `${date.value}T00:00`,
    to: `${date.value}T23:59`,
    zone: null,
    provenance: 'document-metadata',
    sourceLine: date.sourceLine,
  };
}

interface WorkingDocument {
  readonly openingPartId: string;
  readonly chainKey: string;
  readonly subjectLabel: string;
  readonly caseFileRef: string | null;
  readonly instanceKey: string;
  readonly time: EvidenceV2InstanceSourceTime;
  readonly subjectSourceLine: number;
  readonly partIds: string[];
}

function timeSortKey(time: EvidenceV2InstanceSourceTime): string {
  // Unknown sorts last rather than to an invented position.
  return time.from ?? '￿';
}

function buildChains(
  documents: readonly WorkingDocument[],
): readonly EvidenceV2Chain[] {
  const byChain = new Map<string, WorkingDocument[]>();
  for (const document of documents) {
    const bucket = byChain.get(document.chainKey);
    if (bucket === undefined) byChain.set(document.chainKey, [document]);
    else bucket.push(document);
  }

  return [...byChain.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, group], chainIndex) => {
      const ordered = [...group].sort((left, right) => {
        const leftKey = timeSortKey(left.time);
        const rightKey = timeSortKey(right.time);
        if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
        return left.openingPartId < right.openingPartId ? -1 : 1;
      });
      const first = ordered[0];
      return {
        chainId: `chain-${pad(chainIndex + 1, 6)}`,
        subjectLabel: first?.subjectLabel ?? '',
        caseFileRef: first?.caseFileRef ?? null,
        instances: ordered.map((document, position) => ({
          instanceKey: document.instanceKey,
          instanceOrdinal: position + 1,
          sourcePartIds: [...document.partIds],
          instanceSourceTime: document.time,
          ordered: document.time.kind !== 'unknown',
        })),
      };
    });
}

/**
 * Propose chains over one artifact's structure.
 *
 * Deterministic and offline. A part with no body-derived subject that directly
 * follows a document continues it, because a size-capped part can split one
 * long interview. A part with no subject and no open document is unassigned:
 * reported, never placed.
 */
export function proposeEvidenceV2Chains(
  structure: EvidenceV2SourceStructure,
  canonicalText: string,
): EvidenceV2ChainProposal {
  const canonicalLines = canonicalText.split('\n');
  const identities: EvidenceV2DocumentIdentity[] = [];
  const diagnostics: EvidenceV2ChainDiagnostic[] = [];
  const documents: WorkingDocument[] = [];
  const unassignedPartIds: string[] = [];
  let open: WorkingDocument | undefined;

  for (const part of structure.parts) {
    // An index or front-matter part is a reference to documents, not a
    // document, and it ends whatever document was open (R-01).
    if (part.contentCharacter === 'index-or-front-matter') {
      open = undefined;
      unassignedPartIds.push(part.partId);
      continue;
    }

    const identity = readEvidenceV2DocumentIdentity(part, canonicalLines);
    identities.push(identity);

    const subject = identity.subject;
    if (subject === null) {
      if (open === undefined) {
        unassignedPartIds.push(part.partId);
        continue;
      }
      open.partIds.push(part.partId);
      continue;
    }

    const normalized = normalizeEvidenceV2Subject(subject.value);
    const caseFileRef = identity.caseFileRef?.value ?? null;
    const document: WorkingDocument = {
      openingPartId: part.partId,
      chainKey: `${normalized} ${caseFileRef ?? ''}`,
      subjectLabel: subject.value,
      caseFileRef,
      instanceKey: `instance-${part.partId}`,
      time: deriveEvidenceV2InstanceSourceTime(identity),
      subjectSourceLine: subject.sourceLine,
      partIds: [part.partId],
    };
    if (document.time.kind === 'unknown') {
      diagnostics.push({
        code: 'EVIDENCE_V2_INSTANCE_TIME_UNKNOWN',
        sourcePartId: part.partId,
        message: `Part ${part.partId} has a subject but no readable source time.`,
      });
    }
    documents.push(document);
    open = document;
  }

  const chains = buildChains(documents);
  const chainIdOfInstance = new Map<string, string>();
  const subjectLineOfInstance = new Map<string, number>();
  for (const document of documents)
    subjectLineOfInstance.set(document.instanceKey, document.subjectSourceLine);
  for (const chain of chains)
    for (const instance of chain.instances)
      chainIdOfInstance.set(instance.instanceKey, chain.chainId);

  const memberships: EvidenceV2ChainMembership[] = [];
  for (const chain of chains) {
    for (const instance of chain.instances) {
      for (const partId of instance.sourcePartIds) {
        memberships.push({
          membershipId: `membership-${chain.chainId}-${partId}`,
          chainId: chain.chainId,
          sourcePartId: partId,
          primary: true,
          instanceKey: instance.instanceKey,
          origin: 'proposed',
          subjectSourceLine:
            subjectLineOfInstance.get(instance.instanceKey) ?? null,
        });
      }
    }
  }

  return {
    schemaVersion: EVIDENCE_V2_CHAIN_SCHEMA_VERSION,
    ruleVersion: EVIDENCE_V2_CHAIN_RULE_VERSION,
    chains,
    memberships,
    unassignedPartIds,
    identities,
    diagnostics,
  };
}

interface FoldedMembership {
  chainId: string;
  sourcePartId: string;
  primary: boolean;
  instanceKey: string;
  origin: 'proposed' | 'decided';
  subjectSourceLine: number | null;
  decisionId: string | null;
}

/**
 * Fold appended decisions over a proposal into the effective chain state.
 *
 * Append-only: a decision supersedes an earlier one, and nothing is deleted or
 * rewritten. A decision always beats a proposal. Two decisions that both claim
 * the primary membership of one part, where neither supersedes the other, are
 * reported as a conflict and neither wins — a silently chosen winner would be
 * the product deciding something a reviewer must decide.
 */
export function deriveEvidenceV2ChainState(
  proposal: EvidenceV2ChainProposal,
  decisions: readonly EvidenceV2ChainDecision[],
): EvidenceV2ChainState {
  const diagnostics: EvidenceV2ChainDiagnostic[] = [...proposal.diagnostics];
  const folded = new Map<string, FoldedMembership>();
  const key = (chainId: string, partId: string): string =>
    `${chainId} ${partId}`;

  for (const membership of proposal.memberships) {
    folded.set(key(membership.chainId, membership.sourcePartId), {
      chainId: membership.chainId,
      sourcePartId: membership.sourcePartId,
      primary: membership.primary,
      instanceKey: membership.instanceKey,
      origin: membership.origin,
      subjectSourceLine: membership.subjectSourceLine,
      decisionId: null,
    });
  }

  const instanceOfPart = new Map<string, string>();
  for (const membership of proposal.memberships)
    instanceOfPart.set(membership.sourcePartId, membership.instanceKey);

  for (const decision of decisions) {
    const own = key(decision.chainId, decision.sourcePartId);
    const others = [...folded.values()].filter(
      (item) =>
        item.sourcePartId === decision.sourcePartId &&
        item.chainId !== decision.chainId,
    );

    if (decision.action === 'unassign') {
      folded.delete(own);
      continue;
    }

    const conflicting = others.filter(
      (item) =>
        item.primary &&
        item.origin === 'decided' &&
        item.decisionId !== decision.supersedes,
    );

    if (conflicting.length > 0) {
      diagnostics.push({
        code: 'EVIDENCE_V2_CHAIN_PRIMARY_CONFLICT',
        sourcePartId: decision.sourcePartId,
        message: `Decision ${decision.decisionId} claims the primary membership of ${decision.sourcePartId} without superseding an existing decided one.`,
      });
      for (const item of conflicting) item.primary = false;
      const existing = folded.get(own);
      folded.set(own, {
        chainId: decision.chainId,
        sourcePartId: decision.sourcePartId,
        primary: false,
        instanceKey:
          existing?.instanceKey ??
          instanceOfPart.get(decision.sourcePartId) ??
          `instance-${decision.sourcePartId}`,
        origin: 'decided',
        subjectSourceLine: existing?.subjectSourceLine ?? null,
        decisionId: decision.decisionId,
      });
      continue;
    }

    // A proposal is a candidate; a decision replaces it outright. Demoting it
    // instead would leave the part with two memberships, which the V1 workflow
    // must never create even though the model represents it. A decided
    // membership is only ever demoted, never discarded.
    for (const item of others) {
      if (decision.action === 'assign' && item.origin === 'proposed')
        folded.delete(key(item.chainId, item.sourcePartId));
      else item.primary = false;
    }
    const existing = folded.get(own);
    folded.set(own, {
      chainId: decision.chainId,
      sourcePartId: decision.sourcePartId,
      primary: true,
      instanceKey:
        existing?.instanceKey ??
        instanceOfPart.get(decision.sourcePartId) ??
        `instance-${decision.sourcePartId}`,
      origin: 'decided',
      subjectSourceLine: existing?.subjectSourceLine ?? null,
      decisionId: decision.decisionId,
    });
  }

  const memberships: EvidenceV2ChainMembership[] = [...folded.values()]
    .sort((left, right) => {
      if (left.chainId !== right.chainId)
        return left.chainId < right.chainId ? -1 : 1;
      return left.sourcePartId < right.sourcePartId ? -1 : 1;
    })
    .map((item) => ({
      membershipId: `membership-${item.chainId}-${item.sourcePartId}`,
      chainId: item.chainId,
      sourcePartId: item.sourcePartId,
      primary: item.primary,
      instanceKey: item.instanceKey,
      origin: item.origin,
      subjectSourceLine: item.subjectSourceLine,
    }));

  const live = new Set(memberships.map((item) => item.chainId));
  const assigned = new Set(memberships.map((item) => item.sourcePartId));
  const chains = proposal.chains
    .filter((chain) => live.has(chain.chainId))
    .map((chain) => ({
      ...chain,
      instances: chain.instances
        .map((instance) => ({
          ...instance,
          sourcePartIds: instance.sourcePartIds.filter((partId) =>
            memberships.some(
              (item) =>
                item.sourcePartId === partId && item.chainId === chain.chainId,
            ),
          ),
        }))
        .filter((instance) => instance.sourcePartIds.length > 0),
    }))
    .filter((chain) => chain.instances.length > 0);

  const unassignedPartIds = [
    ...new Set([
      ...proposal.unassignedPartIds.filter((partId) => !assigned.has(partId)),
      ...proposal.memberships
        .map((item) => item.sourcePartId)
        .filter((partId) => !assigned.has(partId)),
    ]),
  ].sort();

  return {
    schemaVersion: EVIDENCE_V2_CHAIN_SCHEMA_VERSION,
    ruleVersion: EVIDENCE_V2_CHAIN_RULE_VERSION,
    chains,
    memberships,
    unassignedPartIds,
    diagnostics,
  };
}
