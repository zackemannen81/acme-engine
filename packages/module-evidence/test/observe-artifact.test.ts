import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  computeModelRequestHash,
  sha256,
  type ExecutionReadContext,
  type StateProjectionInput,
} from '@acme/core';

import {
  EVIDENCE_DELTA_SCHEMA_VERSION,
  deriveEvidenceArtifactVersionId,
  deriveEvidenceContentHash,
  evidenceLineCount,
  evidenceModule,
  evidenceObserveArtifactContract,
  evidenceObserveArtifactContractV1,
  evidenceObserveArtifactTask,
  evidenceStateInvariants,
  initialEvidenceState,
  reduceEvidenceState,
  type EvidenceDelta,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
  type EvidenceState,
} from '../src/index.js';

const text = [
  'Synthetic development transcript — Rillford Annex',
  'Incident: greenhouse supply-hatch check in the development partition.',
  'Interviewer: When did you reach the greenhouse hatch?',
  'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.',
  'Interviewer: What did the indicator and hatch show?',
  'Nera Sol: The indicator showed amber while the hatch was open.',
].join('\n');
const contentHash = deriveEvidenceContentHash(text);
const artifactIdentity = {
  corpusId: 'rillford-annex-review-1',
  logicalArtifactId: 'DEV-T01',
  versionOrdinal: 1,
  kind: 'interview-transcript' as const,
  contentHash,
  locatorScheme: 'line-range-1' as const,
  predecessorVersionId: null,
};
const input: EvidenceObserveArtifactInput = {
  schemaVersion: 'evidence-observe-artifact-input/1',
  artifactVersion: {
    schemaVersion: 'evidence-source-artifact-version/1',
    ...artifactIdentity,
    artifactVersionId: deriveEvidenceArtifactVersionId(artifactIdentity),
    title: 'Synthetic development transcript — Rillford Annex',
    lineCount: evidenceLineCount(text),
    correctionReason: null,
    text,
  },
  actorRoster: [
    {
      actorKey: 'development-actor-nera-sol',
      allowedSourceLabels: ['Nera Sol'],
    },
  ],
};
const output: EvidenceObserveArtifactOutput = {
  schemaVersion: 'evidence-observe-artifact-output/1',
  observations: [
    {
      kind: 'statement-occurrence',
      startLine: 4,
      endLine: 4,
      exactQuote:
        'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.',
      actorReference: {
        status: 'resolved',
        sourceLabel: 'Nera Sol',
        sourceRole: 'speaker',
        actorKey: 'development-actor-nera-sol',
      },
      temporalBound: {
        kind: 'range',
        role: 'claimed-event-time',
        from: '2026-03-12T14:00:00Z',
        to: '2026-03-12T14:10:00Z',
      },
    },
    {
      kind: 'statement-occurrence',
      startLine: 6,
      endLine: 6,
      exactQuote:
        'Nera Sol: The indicator showed amber while the hatch was open.',
      actorReference: {
        status: 'resolved',
        sourceLabel: 'Nera Sol',
        sourceRole: 'speaker',
        actorKey: 'development-actor-nera-sol',
      },
      temporalBound: {
        kind: 'unknown',
        role: 'claimed-event-time',
        reason:
          'The statement gives no exact time for the simultaneous indicator and hatch state.',
      },
    },
  ],
};

function context(
  state: EvidenceState | null = null,
): ExecutionReadContext<EvidenceState> {
  return {
    executionId: 'execution-evidence-development-1',
    entityId: 'workspace-development-1',
    now: '2026-08-11T10:00:00.000Z',
    state:
      state === null
        ? null
        : {
            namespace: 'evidence',
            entityId: 'workspace-development-1',
            revision: state.evidenceRevision,
            schemaVersion: 'evidence-state/1',
            value: state,
            valueHash: sha256(canonicalJson(state)),
            createdAt: '2026-08-11T10:00:00.000Z',
            executionId: 'execution-evidence-development-previous',
          },
    memories: [],
    documents: [],
  };
}

function projection(
  result: Awaited<ReturnType<typeof evidenceObserveArtifactTask.interpret>>,
): StateProjectionInput<EvidenceDelta> {
  if (result.stateIntent === undefined)
    throw new Error('Missing state intent.');
  return {
    stateIntent: result.stateIntent,
    memory: result.memories.map((candidate, index) => ({
      candidate,
      identityKey: evidenceModule.memoryPolicy.identity(candidate),
      resolution: {
        candidateKey: candidate.key,
        action: 'create',
        value: candidate.value,
        strength: 1,
      },
      affectedMemoryIds: [`memory-${String(index + 1)}`],
    })),
  };
}

describe('evidence.observe-artifact', () => {
  it('builds a deterministic strict request with a frozen request hash', async () => {
    const projected = await evidenceObserveArtifactTask.project(
      input,
      context(),
    );
    const request = evidenceObserveArtifactContract.buildRequest(projected, {
      executionId: 'ignored-by-contract',
      now: '2026-08-11T11:00:00.000Z',
    });
    expect(computeModelRequestHash(request)).toBe(
      '29cdf2eebf1f5c51c5dc618aac573a10f6eea8d526e9f40d6a8621a31bd871ae',
    );
    expect(
      computeModelRequestHash(
        evidenceObserveArtifactContractV1.buildRequest(projected, {
          executionId: 'execution-evidence-observe-legacy',
          now: '2026-08-11T11:00:00.000Z',
        }),
      ),
    ).toBe('743b53be2522deae2f2507ca9f153e4b0ecdb9f2af1693288713ee1689449004');
    expect(request.output.mode).toBe('json');
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('accepts the two source-bound development observations', () => {
    expect(
      evidenceObserveArtifactContract.validateSemantics(output, input),
    ).toEqual([]);
  });

  it('rejects quote, kind, actor merge, invented time and prohibited conclusions', () => {
    const ambiguousInput: EvidenceObserveArtifactInput = {
      ...input,
      actorRoster: [
        ...input.actorRoster,
        {
          actorKey: 'development-actor-other-nera',
          allowedSourceLabels: ['Nera Sol'],
        },
      ],
    };
    const first = output.observations[0];
    if (first?.kind !== 'statement-occurrence') {
      throw new Error(
        'Expected the first fixture observation to be a statement.',
      );
    }
    const second = output.observations[1];
    if (second?.kind !== 'statement-occurrence') {
      throw new Error(
        'Expected the second fixture observation to be a statement.',
      );
    }
    const bad: EvidenceObserveArtifactOutput = {
      schemaVersion: 'evidence-observe-artifact-output/1',
      observations: [
        {
          ...first,
          kind: 'exhibit-assertion',
          exactQuote: 'Nera Sol: quote not present',
          sourceActorReference: first.actorReference,
          temporalBound: {
            kind: 'exact',
            role: 'claimed-event-time',
            at: '2026-03-12T14:11:00Z',
          },
        },
        {
          ...second,
          temporalBound: {
            kind: 'unknown',
            role: 'claimed-event-time',
            reason: 'The source is truthful and the actor is guilty.',
          },
        },
      ],
    };
    const codes = evidenceObserveArtifactContract
      .validateSemantics(bad, ambiguousInput)
      .map(({ code }) => code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'EVIDENCE_OBSERVATION_KIND_MISMATCH',
        'EVIDENCE_QUOTE_BINDING_FAILED',
        'EVIDENCE_ACTOR_AMBIGUITY_MUST_REMAIN_UNRESOLVED',
        'EVIDENCE_TEMPORAL_VALUE_NOT_SOURCE_BOUND',
        'EVIDENCE_PROHIBITED_CONCLUSION',
      ]),
    );
  });

  it('commits a source plus two observations in one evidence revision', async () => {
    const before = initialEvidenceState();
    const result = await evidenceObserveArtifactTask.interpret(
      output,
      input,
      context(),
    );
    const delta = evidenceObserveArtifactTask.projectState(
      projection(result),
      context(),
    );
    expect(delta?.schemaVersion).toBe(EVIDENCE_DELTA_SCHEMA_VERSION);
    expect(delta?.value.addSourceDocumentIds).toEqual([
      input.artifactVersion.artifactVersionId,
    ]);
    expect(delta?.value.addMemoryIds).toHaveLength(2);
    expect(delta?.value.nextEvidenceRevision).toBe(1);
    if (delta === undefined) throw new Error('Missing evidence delta.');
    const next = reduceEvidenceState(before, delta.value);
    expect(next.evidenceRevision).toBe(1);
    expect(next.standings.map(({ standing }) => standing)).toEqual([
      'current',
      'current',
    ]);
    expect(evidenceStateInvariants(next, before)).toEqual([]);
  });

  it('keeps a duplicate replay at the same evidence revision', async () => {
    const firstResult = await evidenceObserveArtifactTask.interpret(
      output,
      input,
      context(),
    );
    const firstDelta = evidenceObserveArtifactTask.projectState(
      projection(firstResult),
      context(),
    );
    if (firstDelta === undefined)
      throw new Error('Missing first evidence delta.');
    const state = reduceEvidenceState(initialEvidenceState(), firstDelta.value);
    const replayResult = await evidenceObserveArtifactTask.interpret(
      output,
      input,
      context(state),
    );
    if (replayResult.stateIntent === undefined)
      throw new Error('Missing replay state intent.');
    const replayProjection: StateProjectionInput<EvidenceDelta> = {
      stateIntent: replayResult.stateIntent,
      memory: [],
    };
    const replayDelta = evidenceObserveArtifactTask.projectState(
      replayProjection,
      context(state),
    );
    expect(replayDelta?.value).toMatchObject({
      nextEvidenceRevision: 1,
      addSourceDocumentIds: [],
      addMemoryIds: [],
      standingChanges: [],
    });
  });
});
