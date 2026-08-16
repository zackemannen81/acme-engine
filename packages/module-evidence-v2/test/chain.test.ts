import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_V2_CHAIN_RULE_VERSION,
  EVIDENCE_V2_CHAIN_SCHEMA_VERSION,
  deriveEvidenceV2ChainState,
  deriveEvidenceV2SourceStructure,
  normalizeEvidenceV2Subject,
  proposeEvidenceV2Chains,
  readEvidenceV2DocumentIdentity,
  type EvidenceV2ChainDecision,
} from '../src/index.js';

function header(title: string): string {
  return `Förhör med ${title}   diarienr: 0500-K39890-04`;
}

function block(subject: string, date: string, time: string | null): string {
  return [
    'Hörd person',
    subject,
    'Personnummer',
    'Diarienr',
    '0500-K39890-04',
    'Förhörsdatum',
    date,
    ...(time === null ? [] : ['Förhör påbörjat', time]),
    'Berättelse',
  ].join('\n');
}

function propose(text: string) {
  const structure = deriveEvidenceV2SourceStructure(text);
  return {
    structure,
    proposal: proposeEvidenceV2Chains(structure, text),
  };
}

/**
 * The failure the whole layer exists for: the header line opening a part is
 * the trailing header of the preceding document, so its title names a
 * different person than the body reports. Verified in the real binder, where
 * a part titled "Förhör med Ammouri, HUSSEIN; 2007-04-25" reports a body
 * interview with Ammouri, Allia.
 */
const titleSaysOneBodySaysAnother = [
  header('Ammouri, HUSSEIN; 2007-04-25 14:10'),
  block('Ammouri, Allia', '2004-11-09', '11:27'),
  'Allia berättar om kvällen den nittonde oktober.',
].join('\n');

describe('evidence v2 chain proposal', () => {
  it('pins the schema and rule versions', () => {
    expect(EVIDENCE_V2_CHAIN_SCHEMA_VERSION).toBe('evidence-v2-chain/1');
    expect(EVIDENCE_V2_CHAIN_RULE_VERSION).toBe('evidence-v2-chain-rules/1');
  });

  it('chains by body subject, never by part title', () => {
    const { proposal } = propose(titleSaysOneBodySaysAnother);

    expect(proposal.chains).toHaveLength(1);
    expect(proposal.chains[0]?.subjectLabel).toBe('Ammouri, Allia');
    expect(
      proposal.chains.some((chain) =>
        normalizeEvidenceV2Subject(chain.subjectLabel).includes('HUSSEIN'),
      ),
    ).toBe(false);
  });

  it('reads no identity from a title alone', () => {
    const text = [
      header('Ammouri, HUSSEIN; 2004-11-09 10:55'),
      'Ingen fältrubrik finns i den här delen, bara löpande text.',
    ].join('\n');
    const structure = deriveEvidenceV2SourceStructure(text);
    const part = structure.parts[0];

    if (part === undefined) throw new Error('expected a part');
    const identity = readEvidenceV2DocumentIdentity(part, text.split('\n'));
    expect(identity.subject).toBeNull();
    expect(identity.date).toBeNull();
  });

  it('groups one subject across case variants and orders by body time', () => {
    const text = [
      header('X; 2004-01-01 08:00'),
      block('Ammouri, HUSSEIN', '2004-11-29', '12:15'),
      'Andra förhöret.',
      header('Y; 2004-01-02 08:00'),
      block('Ammouri, Hussein', '2004-10-22', '07:55'),
      'Första förhöret.',
    ].join('\n');
    const { proposal } = propose(text);

    expect(proposal.chains).toHaveLength(1);
    const instances = proposal.chains[0]?.instances ?? [];
    expect(instances.map((item) => item.instanceSourceTime.from)).toEqual([
      '2004-10-22T07:55',
      '2004-11-29T12:15',
    ]);
    expect(instances.map((item) => item.instanceOrdinal)).toEqual([1, 2]);
  });

  it('attaches a continuation part to the document it continues', () => {
    const filler = Array.from(
      { length: 420 },
      (_, index) => `Rad ${String(index)} i en lång berättelse som fortsätter.`,
    ).join('\n');
    const text = [
      header('Klint, Hans; 2004-10-19 17:00'),
      block('Klint, Hans', '2004-10-19', '17:00'),
      filler,
    ].join('\n');
    const { structure, proposal } = propose(text);

    expect(structure.parts.length).toBeGreaterThan(1);
    expect(proposal.chains).toHaveLength(1);
    const instances = proposal.chains[0]?.instances ?? [];
    expect(instances).toHaveLength(1);
    expect(instances[0]?.sourcePartIds.length).toBe(structure.parts.length);
    expect(proposal.unassignedPartIds).toEqual([]);
  });

  it('never places an index part in a chain', () => {
    // Classification is per part, so both the document and the index have to
    // be part-sized — which is how a binder's contents pages actually appear.
    // A short document merged into a large index block is a known boundary
    // condition of the structure layer, recorded in the backlog.
    const indexPage = Array.from(
      { length: 420 },
      (_, index) =>
        `Förhör med annan, Person ${String(index)} ...........................${String(100 + index)}`,
    ).join('\n');
    const statement = Array.from(
      { length: 420 },
      (_, index) => `Klint berättar vidare, stycke ${String(index)}.`,
    ).join('\n');
    const text = [
      header('Klint, Hans; 2004-10-19 17:00'),
      block('Klint, Hans', '2004-10-19', '17:00'),
      statement,
      indexPage,
    ].join('\n');
    const { structure, proposal } = propose(text);

    const indexParts = structure.parts
      .filter((part) => part.contentCharacter === 'index-or-front-matter')
      .map((part) => part.partId);
    expect(indexParts.length).toBeGreaterThan(0);
    for (const partId of indexParts) {
      expect(proposal.unassignedPartIds).toContain(partId);
      expect(
        proposal.memberships.some((item) => item.sourcePartId === partId),
      ).toBe(false);
    }
    expect(proposal.chains[0]?.subjectLabel).toBe('Klint, Hans');
  });

  it('types instance source time and leaves missing precision missing', () => {
    const exact = propose(
      [
        header('A; 2004-01-01 08:00'),
        block('Person, A', '2004-10-22', '07:55'),
        'Text.',
      ].join('\n'),
    ).proposal.chains[0]?.instances[0]?.instanceSourceTime;
    expect(exact?.kind).toBe('exact');
    expect(exact?.from).toBe('2004-10-22T07:55');
    expect(exact?.zone).toBeNull();
    expect(exact?.provenance).toBe('document-metadata');

    const dateOnly = propose(
      [
        header('B; 2004-01-01 08:00'),
        block('Person, B', '2004-10-22', null),
        'Text.',
      ].join('\n'),
    ).proposal.chains[0]?.instances[0]?.instanceSourceTime;
    expect(dateOnly?.kind).toBe('range');
    expect(dateOnly?.from).toBe('2004-10-22T00:00');
    expect(dateOnly?.to).toBe('2004-10-22T23:59');
  });

  it('marks an instance without a known time unordered and sorts it last', () => {
    const text = [
      header('A; 2004-01-01 08:00'),
      block('Person, A', 'okänt datum', null),
      'Utan datum.',
      header('B; 2004-01-02 08:00'),
      block('Person, A', '2004-10-22', '07:55'),
      'Med datum.',
    ].join('\n');
    const { proposal } = propose(text);
    const instances = proposal.chains[0]?.instances ?? [];

    expect(instances.map((item) => item.ordered)).toEqual([true, false]);
    expect(instances[1]?.instanceSourceTime.kind).toBe('unknown');
    expect(proposal.diagnostics.map((item) => item.code)).toContain(
      'EVIDENCE_V2_INSTANCE_TIME_UNKNOWN',
    );
  });

  it('reports a part with no subject and no open document as unassigned', () => {
    const text = ['Ett löst stycke utan rubrik och utan fältblock.'].join('\n');
    const { proposal } = propose(text);

    expect(proposal.chains).toEqual([]);
    expect(proposal.unassignedPartIds).toHaveLength(1);
  });

  it('is deterministic', () => {
    const structure = deriveEvidenceV2SourceStructure(
      titleSaysOneBodySaysAnother,
    );
    expect(
      proposeEvidenceV2Chains(structure, titleSaysOneBodySaysAnother),
    ).toEqual(proposeEvidenceV2Chains(structure, titleSaysOneBodySaysAnother));
  });
});

describe('evidence v2 chain decisions', () => {
  const text = [
    header('A; 2004-01-01 08:00'),
    block('Person, A', '2004-10-22', '07:55'),
    'Första.',
    header('B; 2004-01-02 08:00'),
    block('Person, B', '2004-10-23', '09:00'),
    'Andra.',
  ].join('\n');

  const decision = (
    over: Partial<EvidenceV2ChainDecision>,
  ): EvidenceV2ChainDecision => ({
    decisionId: 'decision-1',
    action: 'assign',
    sourcePartId: 'part-000001',
    chainId: 'chain-000002',
    supersedes: null,
    principal: 'reviewer@example',
    decidedAt: '2026-08-16T00:00:00.000Z',
    rationale: 'Same subject under a different spelling.',
    ...over,
  });

  it('an empty decision log reproduces the proposal', () => {
    const { proposal } = propose(text);
    const state = deriveEvidenceV2ChainState(proposal, []);

    expect(state.chains).toEqual(proposal.chains);
    expect(state.memberships).toEqual(proposal.memberships);
  });

  it('moves a part by appending a decision and mutates nothing', () => {
    const { structure, proposal } = propose(text);
    const frozenStructure = JSON.stringify(structure);
    const frozenProposal = JSON.stringify(proposal);

    const state = deriveEvidenceV2ChainState(proposal, [decision({})]);

    const moved = state.memberships.filter(
      (item) => item.sourcePartId === 'part-000001',
    );
    expect(moved).toHaveLength(1);
    expect(moved[0]?.chainId).toBe('chain-000002');
    expect(moved[0]?.origin).toBe('decided');
    expect(moved[0]?.primary).toBe(true);

    // The earlier state is evidence, not scratch space.
    expect(JSON.stringify(structure)).toBe(frozenStructure);
    expect(JSON.stringify(proposal)).toBe(frozenProposal);
  });

  it('refuses to pick a winner when two decisions both claim primary', () => {
    const { proposal } = propose(text);
    const state = deriveEvidenceV2ChainState(proposal, [
      decision({ decisionId: 'decision-1', chainId: 'chain-000002' }),
      decision({ decisionId: 'decision-2', chainId: 'chain-000001' }),
    ]);

    expect(state.diagnostics.map((item) => item.code)).toContain(
      'EVIDENCE_V2_CHAIN_PRIMARY_CONFLICT',
    );
    const memberships = state.memberships.filter(
      (item) => item.sourcePartId === 'part-000001',
    );
    expect(memberships.length).toBeGreaterThan(1);
    expect(memberships.every((item) => !item.primary)).toBe(true);
  });

  it('accepts a second decision that supersedes the first', () => {
    const { proposal } = propose(text);
    const state = deriveEvidenceV2ChainState(proposal, [
      decision({ decisionId: 'decision-1', chainId: 'chain-000002' }),
      decision({
        decisionId: 'decision-2',
        chainId: 'chain-000001',
        supersedes: 'decision-1',
      }),
    ]);

    expect(state.diagnostics.map((item) => item.code)).not.toContain(
      'EVIDENCE_V2_CHAIN_PRIMARY_CONFLICT',
    );
    const primary = state.memberships.filter(
      (item) => item.sourcePartId === 'part-000001' && item.primary,
    );
    expect(primary).toHaveLength(1);
    expect(primary[0]?.chainId).toBe('chain-000001');
  });

  it('unassigns a part without touching the rest', () => {
    const { proposal } = propose(text);
    const state = deriveEvidenceV2ChainState(proposal, [
      decision({ action: 'unassign', chainId: 'chain-000001' }),
    ]);

    expect(
      state.memberships.some((item) => item.sourcePartId === 'part-000001'),
    ).toBe(false);
    expect(state.unassignedPartIds).toContain('part-000001');
    expect(
      state.memberships.some((item) => item.sourcePartId === 'part-000002'),
    ).toBe(true);
  });
});
