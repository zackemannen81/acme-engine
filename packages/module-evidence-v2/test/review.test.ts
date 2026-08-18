import { describe, expect, it } from 'vitest';

import {
  EvidenceV2ReviewDecisionSchema,
  deriveEvidenceV2ChainCompletion,
  deriveEvidenceV2InstanceCompletion,
  deriveEvidenceV2ReviewDecisionId,
  deriveEvidenceV2Standings,
  type EvidenceV2ReviewAction,
  type EvidenceV2ReviewDecision,
} from '../src/review.js';

function decision(
  occurrenceId: string,
  action: EvidenceV2ReviewAction,
  overrides: Partial<EvidenceV2ReviewDecision> = {},
): EvidenceV2ReviewDecision {
  const base = {
    schemaVersion: 'evidence-v2-review/1' as const,
    artifactId: 'artifact-1',
    instanceKey: 'instance-1',
    occurrenceId,
    action,
    supersedes: null,
    principal: 'principal-a',
    decidedAt: '2026-08-18T10:00:00.000Z',
    rationale: 'Reviewed against the source lines.',
  };
  return {
    ...base,
    decisionId: deriveEvidenceV2ReviewDecisionId({
      occurrenceId,
      action,
      principal: base.principal,
      decidedAt: base.decidedAt,
      rationale: base.rationale,
    }),
    ...overrides,
  };
}

describe('evidence v2 review and standing', () => {
  it('reports an undecided occurrence as pending rather than as nothing', () => {
    const [standing] = deriveEvidenceV2Standings(['occurrence-1'], []);
    expect(standing?.standing).toBe('pending');
    expect(standing?.decisionId).toBeNull();
    expect(standing?.decisionCount).toBe(0);
  });

  it('maps each action onto its standing', () => {
    const standings = deriveEvidenceV2Standings(
      ['a', 'b', 'c'],
      [
        decision('a', 'accept'),
        decision('b', 'reject'),
        decision('c', 'revise'),
      ],
    );
    expect(standings.map((item) => item.standing)).toEqual([
      'accepted',
      'rejected',
      'needs-revision',
    ]);
  });

  it('lets the latest decision win while keeping the earlier one in the log', () => {
    const first = decision('a', 'accept');
    const second = decision('a', 'reject', {
      decisionId: 'review-second',
      supersedes: first.decisionId,
      decidedAt: '2026-08-18T11:00:00.000Z',
      rationale: 'The quote is from the index, not the body.',
    });
    const log = [first, second];

    const [standing] = deriveEvidenceV2Standings(['a'], log);
    expect(standing?.standing).toBe('rejected');
    expect(standing?.decisionId).toBe('review-second');
    // Superseding replaces the standing, never the history.
    expect(standing?.decisionCount).toBe(2);
    expect(log[0]).toEqual(first);
    expect(log[0]?.action).toBe('accept');
  });

  it('reverses a rejection without deleting anything', () => {
    const standings = deriveEvidenceV2Standings(
      ['a'],
      [
        decision('a', 'reject'),
        decision('a', 'accept', {
          decisionId: 'review-third',
          decidedAt: '2026-08-18T12:00:00.000Z',
        }),
      ],
    );
    expect(standings[0]?.standing).toBe('accepted');
    expect(standings[0]?.decisionCount).toBe(2);
  });

  it('ignores decisions for occurrences it was not asked about', () => {
    const standings = deriveEvidenceV2Standings(
      ['a'],
      [decision('a', 'accept'), decision('unrelated', 'reject')],
    );
    expect(standings).toHaveLength(1);
    expect(standings[0]?.standing).toBe('accepted');
  });

  it('derives the same id for an identical decision and a different one otherwise', () => {
    const input = {
      occurrenceId: 'a',
      action: 'accept' as const,
      principal: 'principal-a',
      decidedAt: '2026-08-18T10:00:00.000Z',
      rationale: 'Same.',
    };
    expect(deriveEvidenceV2ReviewDecisionId(input)).toBe(
      deriveEvidenceV2ReviewDecisionId(input),
    );
    expect(deriveEvidenceV2ReviewDecisionId(input)).not.toBe(
      deriveEvidenceV2ReviewDecisionId({ ...input, action: 'reject' }),
    );
  });

  it('refuses a decision without a rationale, a principal or a known action', () => {
    const valid = decision('a', 'accept');
    expect(EvidenceV2ReviewDecisionSchema.safeParse(valid).success).toBe(true);
    for (const broken of [
      { ...valid, rationale: '' },
      { ...valid, principal: '' },
      { ...valid, action: 'move' },
      { ...valid, action: 'delete' },
      { ...valid, extra: true },
    ])
      expect(
        EvidenceV2ReviewDecisionSchema.safeParse(broken).success,
        JSON.stringify(broken.action ?? broken),
      ).toBe(false);
  });

  it('separates "nothing extracted" from "everything decided"', () => {
    const notExtracted = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i1',
      hasCommittedWindow: false,
      standings: [],
    });
    expect(notExtracted.state).toBe('not-extracted');

    // A window may legitimately state nothing. That instance is reviewed, not
    // un-extracted: the difference is whether the work was done.
    const extractedButEmpty = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i2',
      hasCommittedWindow: true,
      standings: [],
    });
    expect(extractedButEmpty.state).toBe('reviewed');
    expect(extractedButEmpty.occurrenceCount).toBe(0);
  });

  it('holds an instance pending while one occurrence is undecided', () => {
    const completion = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i1',
      hasCommittedWindow: true,
      standings: deriveEvidenceV2Standings(
        ['a', 'b', 'c'],
        [decision('a', 'accept'), decision('b', 'reject')],
      ),
    });
    expect(completion.state).toBe('pending-review');
    expect(completion.pendingCount).toBe(1);
    expect(completion.acceptedCount).toBe(1);
    expect(completion.rejectedCount).toBe(1);
  });

  it('counts a rejected occurrence as decided', () => {
    // Rejection is a review outcome, not unfinished work.
    const completion = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i1',
      hasCommittedWindow: true,
      standings: deriveEvidenceV2Standings(['a'], [decision('a', 'reject')]),
    });
    expect(completion.state).toBe('reviewed');
  });

  it('treats needs-revision as decided but visible', () => {
    const completion = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i1',
      hasCommittedWindow: true,
      standings: deriveEvidenceV2Standings(['a'], [decision('a', 'revise')]),
    });
    expect(completion.state).toBe('reviewed');
    expect(completion.needsRevisionCount).toBe(1);
  });

  it('completes a chain only when every instance is reviewed', () => {
    const reviewed = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i1',
      hasCommittedWindow: true,
      standings: deriveEvidenceV2Standings(['a'], [decision('a', 'accept')]),
    });
    const pending = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i2',
      hasCommittedWindow: true,
      standings: deriveEvidenceV2Standings(['b'], []),
    });
    const notExtracted = deriveEvidenceV2InstanceCompletion({
      instanceKey: 'i3',
      hasCommittedWindow: false,
      standings: [],
    });

    expect(deriveEvidenceV2ChainCompletion([reviewed]).complete).toBe(true);
    expect(deriveEvidenceV2ChainCompletion([reviewed, pending]).complete).toBe(
      false,
    );
    // An un-extracted instance blocks completion too: a chain is not finished
    // because nobody started one of its documents.
    const mixed = deriveEvidenceV2ChainCompletion([reviewed, notExtracted]);
    expect(mixed.complete).toBe(false);
    expect(mixed.notExtractedCount).toBe(1);
    expect(mixed.reviewedCount).toBe(1);
  });

  it('does not call a chain with no instances complete', () => {
    // Vacuous truth would report an empty chain as finished work.
    expect(deriveEvidenceV2ChainCompletion([]).complete).toBe(false);
  });
});
