import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  computeModelRequestHash,
  createContractRegistry,
  sha256,
  type ExecutionReadContext,
  type StateProjectionInput,
} from '@acme/core';

import {
  EVIDENCE_DELTA_SCHEMA_VERSION,
  deriveEvidenceArtifactVersionId,
  deriveEvidenceContentHash,
  buildEvidenceSourceSegments,
  evidenceLineCount,
  locateUniqueEvidenceQuote,
  evidenceModule,
  evidenceObserveArtifactContract,
  evidenceObserveArtifactContractV1,
  evidenceObserveArtifactContractV2,
  evidenceObserveArtifactContractV3,
  evidenceObserveArtifactContractV4,
  evidenceObserveArtifactContractV5,
  evidenceObserveArtifactContractV6,
  evidenceObserveArtifactTask,
  evidenceStateInvariants,
  initialEvidenceState,
  reduceEvidenceState,
  type EvidenceDelta,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
  type EvidenceObserveArtifactOutputV1,
  type EvidenceObserveArtifactOutputV3,
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
  schemaVersion: 'evidence-observe-artifact-output/4',
  observations: [
    {
      kind: 'statement-occurrence',
      sourceSegmentId: 'line-000004-segment-0001',
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
      sourceSegmentId: 'line-000006-segment-0001',
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
const historicalOutputV3: EvidenceObserveArtifactOutputV3 = {
  schemaVersion: 'evidence-observe-artifact-output/3',
  observations: output.observations.map((candidate, index) => {
    const { sourceSegmentId: _sourceSegmentId, ...domainCandidate } = candidate;
    void _sourceSegmentId;
    return {
      ...domainCandidate,
      exactQuote:
        index === 0
          ? 'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.'
          : 'Nera Sol: The indicator showed amber while the hatch was open.',
    };
  }),
};
const legacyOutput: EvidenceObserveArtifactOutputV1 = {
  schemaVersion: 'evidence-observe-artifact-output/1',
  observations: historicalOutputV3.observations.map((candidate, index) => ({
    ...candidate,
    startLine: index === 0 ? 4 : 6,
    endLine: index === 0 ? 4 : 6,
  })),
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
      'f86982f1506410426b0a3b86f59fc90ade36c2b3f389428d083d6078c6a2ab3d',
    );
    expect(
      computeModelRequestHash(
        evidenceObserveArtifactContractV6.buildRequest(projected, {
          executionId: 'execution-evidence-observe-segment-legacy',
          now: '2026-08-11T11:00:00.000Z',
        }),
      ),
    ).toBe('827587d11888c53edeef458499ce6c2a409b611f9be9cd10f706512654c11081');
    expect(
      computeModelRequestHash(
        evidenceObserveArtifactContractV5.buildRequest(projected, {
          executionId: 'execution-evidence-observe-single-line-legacy',
          now: '2026-08-11T11:00:00.000Z',
        }),
      ),
    ).toBe('f99652e8d7eee64f02ad931ecfc0ba34543a12aa38d8ef2aef6a8eb4a589314f');
    expect(
      computeModelRequestHash(
        evidenceObserveArtifactContractV4.buildRequest(projected, {
          executionId: 'execution-evidence-observe-runtime-locator-legacy',
          now: '2026-08-11T11:00:00.000Z',
        }),
      ),
    ).toBe('44164c736c8882f8a4218c9f833abb703bcdd1346e2a653e10cb1f4011b8bb47');
    expect(
      computeModelRequestHash(
        evidenceObserveArtifactContractV3.buildRequest(projected, {
          executionId: 'execution-evidence-observe-bounded-legacy',
          now: '2026-08-11T11:00:00.000Z',
        }),
      ),
    ).toBe('50a18aa90d3f50ce82902642262731596bcf9eeb9e4e83ba1de65355be3e3db6');
    expect(
      computeModelRequestHash(
        evidenceObserveArtifactContractV2.buildRequest(projected, {
          executionId: 'execution-evidence-observe-source-neutral-legacy',
          now: '2026-08-11T11:00:00.000Z',
        }),
      ),
    ).toBe('29cdf2eebf1f5c51c5dc618aac573a10f6eea8d526e9f40d6a8621a31bd871ae');
    expect(
      computeModelRequestHash(
        evidenceObserveArtifactContractV1.buildRequest(projected, {
          executionId: 'execution-evidence-observe-legacy',
          now: '2026-08-11T11:00:00.000Z',
        }),
      ),
    ).toBe('743b53be2522deae2f2507ca9f153e4b0ecdb9f2af1693288713ee1689449004');
    expect(request.output.mode).toBe('json');
    expect(request.maxOutputTokens).toBe(8192);
    expect(request.messages[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('non-exhaustive reviewer candidate batch'),
    });
    expect(request.messages[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Select one supplied sourceSegmentId'),
    });
    expect(request.messages[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('shows only a clock time'),
    });
    expect(request.messages[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('never join segments'),
    });
    expect(request.messages[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('YYYY-MM-DDTHH:MM:SSZ'),
    });
    const jsonSchema = request.output.jsonSchema as {
      readonly properties?: {
        readonly observations?: {
          readonly minItems?: number;
          readonly maxItems?: number;
        };
      };
    };
    expect(jsonSchema.properties?.observations).toMatchObject({
      minItems: 1,
      maxItems: 8,
    });
    expect(JSON.stringify(request.output.jsonSchema)).not.toMatch(
      /startLine|endLine|exactQuote/u,
    );
    expect(request.messages[1]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('line-000004-segment-0001'),
    });
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('accepts one through eight candidates and refuses a ninth', () => {
    const candidate = output.observations[0];
    if (candidate === undefined) throw new Error('Missing fixture candidate.');
    const legacyCandidate = legacyOutput.observations[0];
    if (legacyCandidate === undefined)
      throw new Error('Missing legacy fixture candidate.');
    for (const count of [1, 8]) {
      expect(
        evidenceObserveArtifactContract.outputSchema.safeParse({
          schemaVersion: 'evidence-observe-artifact-output/4',
          observations: Array.from({ length: count }, () => candidate),
        }).success,
      ).toBe(true);
    }
    expect(
      evidenceObserveArtifactContract.outputSchema.safeParse({
        schemaVersion: 'evidence-observe-artifact-output/4',
        observations: Array.from({ length: 9 }, () => candidate),
      }).success,
    ).toBe(false);
    expect(
      evidenceObserveArtifactContractV2.outputSchema.safeParse({
        schemaVersion: 'evidence-observe-artifact-output/1',
        observations: Array.from({ length: 9 }, () => legacyCandidate),
      }).success,
    ).toBe(true);
    expect(
      evidenceObserveArtifactContractV3.outputSchema.safeParse({
        schemaVersion: 'evidence-observe-artifact-output/1',
        observations: Array.from({ length: 9 }, () => legacyCandidate),
      }).success,
    ).toBe(false);
    expect(
      evidenceObserveArtifactContract.outputSchema.safeParse({
        schemaVersion: 'evidence-observe-artifact-output/4',
        observations: [legacyCandidate],
      }).success,
    ).toBe(false);
  });

  it('rejects active quote authorship and malformed segment ids while historical v5 remains replayable', () => {
    const candidate = output.observations[0];
    if (candidate === undefined) throw new Error('Missing fixture candidate.');
    for (const sourceSegmentId of ['missing', 'line-1-segment-1']) {
      expect(
        evidenceObserveArtifactContract.outputSchema.safeParse({
          schemaVersion: 'evidence-observe-artifact-output/4',
          observations: [{ ...candidate, sourceSegmentId }],
        }).success,
      ).toBe(false);
    }
    expect(
      evidenceObserveArtifactContract.outputSchema.safeParse({
        schemaVersion: 'evidence-observe-artifact-output/4',
        observations: [{ ...candidate, exactQuote: 'provider text' }],
      }).success,
    ).toBe(false);
    const historical = historicalOutputV3.observations[0];
    expect(
      evidenceObserveArtifactContractV5.outputSchema.safeParse({
        schemaVersion: 'evidence-observe-artifact-output/3',
        observations: [{ ...historical, exactQuote: 'first line' }],
      }).success,
    ).toBe(true);
  });

  it('keeps all seven observation contract versions resolvable for replay', () => {
    const registry = createContractRegistry([
      evidenceObserveArtifactContractV1,
      evidenceObserveArtifactContractV2,
      evidenceObserveArtifactContractV3,
      evidenceObserveArtifactContractV4,
      evidenceObserveArtifactContractV5,
      evidenceObserveArtifactContractV6,
      evidenceObserveArtifactContract,
    ]);
    expect(
      registry
        .list()
        .filter(({ id }) => id === 'evidence.observe-artifact')
        .map(({ version }) => version),
    ).toEqual(['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0']);
    for (const contract of [
      evidenceObserveArtifactContractV1,
      evidenceObserveArtifactContractV2,
      evidenceObserveArtifactContractV3,
      evidenceObserveArtifactContractV4,
      evidenceObserveArtifactContractV5,
      evidenceObserveArtifactContractV6,
      evidenceObserveArtifactContract,
    ]) {
      expect(registry.get(contract.ref)).toBe(contract);
    }
  });

  it('accepts the two source-bound development observations', () => {
    expect(
      evidenceObserveArtifactContract.validateSemantics(output, input),
    ).toEqual([]);
  });

  it('keeps historical locator-bearing output interpretable for replay', async () => {
    const result = await evidenceObserveArtifactTask.interpret(
      legacyOutput,
      input,
      context(),
    );
    expect(
      result.memories.map(({ value }) => {
        const candidate = value as {
          locator: { startLine: number; endLine: number };
        };
        return candidate.locator;
      }),
    ).toEqual([
      expect.objectContaining({ startLine: 4, endLine: 4 }),
      expect.objectContaining({ startLine: 6, endLine: 6 }),
    ]);
  });

  it('builds stable bounded single-line segments and retains historical quote lookup', () => {
    expect(buildEvidenceSourceSegments(text)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSegmentId: 'line-000004-segment-0001',
          exactQuote:
            'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.',
          startLine: 4,
          endLine: 4,
        }),
      ]),
    );
    const long = buildEvidenceSourceSegments(`a\n${'😀'.repeat(501)}\n   `);
    expect(
      long.map(({ sourceSegmentId, exactQuote }) => ({
        sourceSegmentId,
        length: [...exactQuote].length,
      })),
    ).toEqual([
      { sourceSegmentId: 'line-000001-segment-0001', length: 1 },
      { sourceSegmentId: 'line-000002-segment-0001', length: 500 },
      { sourceSegmentId: 'line-000002-segment-0002', length: 1 },
    ]);
    expect(
      locateUniqueEvidenceQuote(
        text,
        'Interviewer: What did the indicator and hatch show?',
      ),
    ).toEqual({
      status: 'unique',
      startLine: 5,
      endLine: 5,
    });
    expect(
      locateUniqueEvidenceQuote(
        text,
        'Interviewer: What did the indicator and hatch show?\nNera Sol: The indicator showed amber while the hatch was open.',
      ),
    ).toEqual({ status: 'unique', startLine: 5, endLine: 6 });
    expect(locateUniqueEvidenceQuote(text, 'not present')).toEqual({
      status: 'absent',
    });
    expect(locateUniqueEvidenceQuote('same\nsame', 'same')).toEqual({
      status: 'ambiguous',
      occurrenceCount: 2,
    });
  });

  it('rejects unknown segments, kind, actor merge, invented time and prohibited conclusions', () => {
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
      schemaVersion: 'evidence-observe-artifact-output/4',
      observations: [
        {
          kind: 'exhibit-assertion',
          sourceSegmentId: first.sourceSegmentId,
          sourceActorReference: first.actorReference,
          temporalBound: {
            kind: 'exact',
            role: 'claimed-event-time',
            at: '2026-03-12T14:11:00Z',
          },
        },
        {
          ...first,
          sourceSegmentId: 'line-999999-segment-0001',
          temporalBound: null,
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
        'EVIDENCE_SOURCE_SEGMENT_NOT_FOUND',
        'EVIDENCE_ACTOR_AMBIGUITY_MUST_REMAIN_UNRESOLVED',
        'EVIDENCE_TEMPORAL_VALUE_NOT_SOURCE_BOUND',
        'EVIDENCE_PROHIBITED_CONCLUSION',
      ]),
    );
    const repeatedInput: EvidenceObserveArtifactInput = {
      ...input,
      artifactVersion: {
        ...input.artifactVersion,
        text: `${input.artifactVersion.text}\nNera Sol: I reached the greenhouse hatch between 14:00 and 14:10.`,
        lineCount: input.artifactVersion.lineCount + 1,
      },
    };
    expect(
      evidenceObserveArtifactContract.validateSemantics(output, repeatedInput),
    ).toEqual([]);
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
    expect(
      result.memories.map(({ value }) => {
        const candidate = value as {
          locator: { startLine: number; endLine: number };
        };
        return candidate.locator;
      }),
    ).toEqual([
      expect.objectContaining({ startLine: 4, endLine: 4 }),
      expect.objectContaining({ startLine: 6, endLine: 6 }),
    ]);
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
