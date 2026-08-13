/**
 * `aal-acme-adapter/2` driven end to end through a real `ExecutionEngine`.
 *
 * `seam-gap-inventory.test.ts` answers "what do the two type definitions say".
 * This file answers the different and harder question: "what does a seam
 * request actually survive against today's engine". Every case here builds an
 * `AcmeAdapterRequest` by hand, translates it, executes the translation
 * against an engine assembled the way `apps/cli/src/composition.ts` assembles
 * one (in-memory repository, module registry, contract registry, response
 * pipeline, memory and state engines), and translates the real
 * `ExecutionResult` back into an `AcmeAdapterResult`.
 *
 * No provider is contacted and no credential is read. The gateway is the
 * deterministic `packages/adapter-model-mock` script, which fails loudly on
 * any call it was not scripted for, so an accidental extra model call is a
 * test failure rather than a silent cost.
 */
import { describe, expect, it } from 'vitest';

import {
  deriveExecutionId,
  type ExecutionPolicy,
  type ExecutionResult,
  type ModelSelection,
} from '../../packages/core/src/index.js';

import {
  ACME_ADAPTER_CONTRACT_VERSION,
  type AcmeAdapterResult,
} from './aal-acme-adapter-2.js';
import {
  SEAM_REQUEST_GAP_FLOOR,
  SeamDocumentKeysDroppedError,
  SeamErrorStageDroppedError,
  SeamExecutionPolicyAbsentError,
  SeamExpectedRevisionAbsentError,
  SeamModelSelectionAbsentError,
  SeamSuggestionSetUnproducedError,
} from './seam-gaps.js';
import {
  inventoryRequestGaps,
  inventoryResultGaps,
  toAcmeAdapterResult,
  toExecutionRequest,
  type SeamRequestSupplements,
} from './seam-translation.js';
import {
  alternateSelection,
  createSeamHarness,
  neutralInput,
  neutralSelection,
  seamRequest,
  REQUEST_DROPS,
  RESULT_DROPS,
} from './seam-fixtures.js';

/* -------------------------------------------------------------------------
 * The three values that cannot come from the seam.
 *
 * They are written out here, in the test, rather than defaulted inside the
 * translation, because that is the whole point: an application speaking
 * `aal-acme-adapter/2` has no field for any of them, so somebody outside the
 * seam has to decide each one. Making that decision visible is the finding.
 * ---------------------------------------------------------------------- */

/** Which model runs the task. The seam names a task, never a model. */
const SUPPLIED_MODEL: ModelSelection = neutralSelection;

/** How the engine retains payloads. The seam has no policy field at all. */
const SUPPLIED_POLICY: Partial<ExecutionPolicy> = Object.freeze({
  retention: 'hash-only',
});

/**
 * The engine revision this request expects. It is 0 because the entity is new
 * in each harness. It is emphatically *not*
 * `subject.expectedApplicationVersion`; the conflict case below executes that
 * mistake against the engine to show what it costs.
 */
const SUPPLIED_EXPECTED_REVISION = 0;

const OUT_OF_BAND: SeamRequestSupplements = Object.freeze({
  model: SUPPLIED_MODEL,
  policy: SUPPLIED_POLICY,
  expectedRevision: SUPPLIED_EXPECTED_REVISION,
});

/* -------------------------------------------------------------------------
 * Narrowing helpers. ESLint forbids non-null assertions, so each one throws
 * rather than asserting, and the thrown message names what was seen instead.
 * ---------------------------------------------------------------------- */

type CommittedExecution = Extract<ExecutionResult, { status: 'committed' }>;
type FailedExecution = Exclude<ExecutionResult, CommittedExecution>;
type CommittedSeamResult = Extract<AcmeAdapterResult, { status: 'committed' }>;
type FailedSeamResult = Extract<
  AcmeAdapterResult,
  { status: 'blocked' | 'conflicted' | 'cancelled' | 'failed' }
>;

function committedExecution(result: ExecutionResult): CommittedExecution {
  if (result.status !== 'committed') {
    throw new Error(
      `Expected a committed execution, got ${result.status} (${result.error.code}).`,
    );
  }
  return result;
}

function failedExecution(result: ExecutionResult): FailedExecution {
  if (result.status === 'committed') {
    throw new Error('Expected a terminal failure, got a committed execution.');
  }
  return result;
}

function committedSeamResult(result: AcmeAdapterResult): CommittedSeamResult {
  if (result.status !== 'committed') {
    throw new Error(`Expected a committed seam result, got ${result.status}.`);
  }
  return result;
}

function failedSeamResult(result: AcmeAdapterResult): FailedSeamResult {
  if (result.status === 'committed' || result.status === 'unavailable') {
    throw new Error(`Expected a failed seam result, got ${result.status}.`);
  }
  return result;
}

/** Serialized form, used to assert that a value is nowhere in a result. */
function wire(value: unknown): string {
  return JSON.stringify(value);
}

describe('a committed execution, end to end through the seam', () => {
  it('translates, runs, and round-trips, losing what it wrote', async () => {
    const request = seamRequest({
      requestKey: 'seam-committed-1',
      sourceArtifactIds: ['artifact-1', 'artifact-2'],
    });

    // Only the losses the seam cannot avoid remain: the caller supplied all
    // three values the engine requires, and still cannot carry seven fields.
    expect(
      inventoryRequestGaps(request, OUT_OF_BAND).map((gap) => gap.code),
    ).toEqual([
      ...SEAM_REQUEST_GAP_FLOOR,
      'SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE',
    ]);

    const engineRequest = toExecutionRequest(request, OUT_OF_BAND, [
      ...REQUEST_DROPS,
    ]);
    expect(engineRequest).toEqual({
      requestKey: 'seam-committed-1',
      namespace: 'neutral',
      task: 'observe',
      entityId: 'neutral-entity-1',
      expectedRevision: SUPPLIED_EXPECTED_REVISION,
      input: neutralInput,
      model: SUPPLIED_MODEL,
      policy: SUPPLIED_POLICY,
    });

    // What the application sent and the engine will never see. This is the
    // provenance chain the application believes it is establishing.
    const sent = wire(engineRequest);
    expect(sent).not.toContain('workspace-a');
    expect(sent).not.toContain('correlation-1');
    expect(sent).not.toContain('artifact-1');
    expect(sent).not.toContain('observation');
    expect(sent).not.toContain('neutral.observe@1.0.0');

    const harness = createSeamHarness([{ requestKey: 'seam-committed-1' }]);
    const executed = committedExecution(
      await harness.engine.execute(engineRequest),
    );
    expect(executed).toEqual({
      status: 'committed',
      executionId: deriveExecutionId('neutral', 'seam-committed-1'),
      replayed: false,
      revision: 1,
      documentKeys: ['neutral-document-1'],
      eventIds: [],
    });
    expect(harness.gateway.invocations()).toHaveLength(1);
    harness.gateway.assertAllConsumed();

    // The engine really did write. The seam result below carries none of it.
    const snapshot = harness.repository.snapshot();
    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.memoryRecords).toHaveLength(1);

    // The translation back refuses until the caller says, by code, which
    // losses it accepts. Acknowledging one does not acknowledge the rest.
    expect(() => toAcmeAdapterResult(executed)).toThrow(
      SeamDocumentKeysDroppedError,
    );
    expect(() =>
      toAcmeAdapterResult(executed, ['SEAM_DOCUMENT_KEYS_DROPPED']),
    ).toThrow(SeamSuggestionSetUnproducedError);
    expect(inventoryResultGaps(executed).map((gap) => gap.code)).toEqual([
      'SEAM_DOCUMENT_KEYS_DROPPED',
      'SEAM_SUGGESTION_SET_UNPRODUCED',
    ]);

    const seamResult = committedSeamResult(
      toAcmeAdapterResult(executed, [...RESULT_DROPS]),
    );
    expect(seamResult).toEqual({
      contractVersion: ACME_ADAPTER_CONTRACT_VERSION,
      status: 'committed',
      executionId: deriveExecutionId('neutral', 'seam-committed-1'),
      replayed: false,
      engineRevision: 1,
      suggestionSetRef: null,
    });

    // The loss, stated as an assertion rather than a comment: the document
    // the engine wrote cannot be named by anything the application receives.
    expect(Object.keys(seamResult).sort()).toEqual([
      'contractVersion',
      'engineRevision',
      'executionId',
      'replayed',
      'status',
      'suggestionSetRef',
    ]);
    expect(wire(seamResult)).not.toContain('neutral-document-1');

    // A memory record was committed, yet `suggestionSetRef` is null: the
    // engine produces no suggestion set, so `AcmeSuggestionEnvelope` can
    // never be built from a real run of today's engine.
    expect(seamResult.suggestionSetRef).toBeNull();
  });

  it('refuses the two supplements no acknowledgement can replace', async () => {
    const request = seamRequest({ requestKey: 'seam-unsupplied-1' });
    const harness = createSeamHarness([]);

    // `REQUEST_DROPS` acknowledges every acknowledgeable gap there is, and
    // these two still refuse: a model and an expected revision cannot be
    // conjured by accepting a loss, only supplied.
    expect(() =>
      toExecutionRequest(
        request,
        { policy: SUPPLIED_POLICY, expectedRevision: 0 },
        [...REQUEST_DROPS],
      ),
    ).toThrow(SeamModelSelectionAbsentError);
    expect(() =>
      toExecutionRequest(
        request,
        { model: SUPPLIED_MODEL, policy: SUPPLIED_POLICY },
        [...REQUEST_DROPS],
      ),
    ).toThrow(SeamExpectedRevisionAbsentError);

    // Nothing reached the engine: no execution was accepted and no default
    // was quietly chosen between the seam and the repository.
    expect(harness.gateway.invocations()).toEqual([]);
    expect(harness.repository.snapshot().executions).toEqual([]);
    await expect(
      harness.engine.replayVerify(
        deriveExecutionId('neutral', 'seam-unsupplied-1'),
      ),
    ).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('runs without a policy only if the caller accepts the engine default', async () => {
    const request = seamRequest({ requestKey: 'seam-defaulted-policy-1' });
    const unsupplied = { model: SUPPLIED_MODEL, expectedRevision: 0 };

    // Unacknowledged, the missing policy refuses like any other gap. Every
    // other acknowledgeable loss is accepted here so the policy gap is the
    // only one left to raise.
    expect(() =>
      toExecutionRequest(
        request,
        unsupplied,
        REQUEST_DROPS.filter((code) => code !== 'SEAM_EXECUTION_POLICY_ABSENT'),
      ),
    ).toThrow(SeamExecutionPolicyAbsentError);

    // Acknowledged, it translates: unlike model and revision, the engine has
    // a documented default, so accepting the loss is a real choice rather
    // than a fabrication. The engine then applies DEFAULT_EXECUTION_POLICY.
    const engineRequest = toExecutionRequest(request, unsupplied, [
      ...REQUEST_DROPS,
    ]);
    expect(Object.hasOwn(engineRequest, 'policy')).toBe(false);

    const harness = createSeamHarness([
      { requestKey: 'seam-defaulted-policy-1' },
    ]);
    const executed = committedExecution(
      await harness.engine.execute(engineRequest),
    );
    const accepted = harness.repository.snapshot().executions[0];
    expect(accepted).toMatchObject({
      policy: { retention: 'hash-only', maxModelCalls: 1, timeoutMs: 30_000 },
    });

    // The engine recorded a retention decision the application never made
    // and, having no policy field either way, can never read back.
    const seamResult = committedSeamResult(
      toAcmeAdapterResult(executed, [...RESULT_DROPS]),
    );
    expect(wire(seamResult)).not.toContain('hash-only');
  });

  it('lets the seam supply the engine revision when the application knows it', async () => {
    const request = seamRequest({
      requestKey: 'seam-revision-1',
      expectedEngineRevision: 0,
    });
    // The supplement says 9; the seam field says 0 and wins, because a value
    // the application actually sent is never overridden out of band.
    const engineRequest = toExecutionRequest(
      request,
      { ...OUT_OF_BAND, expectedRevision: 9 },
      [...REQUEST_DROPS],
    );
    expect(engineRequest.expectedRevision).toBe(0);

    const harness = createSeamHarness([{ requestKey: 'seam-revision-1' }]);
    const executed = committedExecution(
      await harness.engine.execute(engineRequest),
    );
    expect(executed.revision).toBe(1);
  });
});

describe('a replayed execution, end to end through the seam', () => {
  it('replays on requestKey alone and hides which policy actually applied', async () => {
    const request = seamRequest({ requestKey: 'seam-replay-1' });
    const harness = createSeamHarness([{ requestKey: 'seam-replay-1' }]);

    const first = committedExecution(
      await harness.engine.execute(
        toExecutionRequest(
          request,
          { ...OUT_OF_BAND, policy: { retention: 'encrypted-payload' } },
          [...REQUEST_DROPS],
        ),
      ),
    );
    expect(first.replayed).toBe(false);

    // The identical seam request, translated a second time with a different
    // retention policy. `policy` is not part of the engine's request
    // fingerprint, so this replays rather than conflicting.
    const replayRequest = toExecutionRequest(
      request,
      { ...OUT_OF_BAND, policy: { retention: 'none' } },
      [...REQUEST_DROPS],
    );
    expect(replayRequest.policy).toEqual({ retention: 'none' });

    const second = committedExecution(
      await harness.engine.execute(replayRequest),
    );
    expect(second).toEqual({ ...first, replayed: true });
    expect(harness.gateway.invocations()).toHaveLength(1);
    harness.gateway.assertAllConsumed();

    const firstSeam = committedSeamResult(
      toAcmeAdapterResult(first, [...RESULT_DROPS]),
    );
    const secondSeam = committedSeamResult(
      toAcmeAdapterResult(second, [...RESULT_DROPS]),
    );
    expect(secondSeam).toEqual({ ...firstSeam, replayed: true });

    // `replayed` is the one operational fact the seam does carry. What it
    // does not carry is which retention the payload was actually stored
    // under: the second caller asked for 'none' and got
    // 'encrypted-payload', and the result it receives cannot say so.
    expect(wire(secondSeam)).not.toContain('retention');
    expect(wire(secondSeam)).not.toContain('encrypted-payload');
  });
});

describe('a conflicted execution, end to end through the seam', () => {
  it('conflicts when the application version is used as the engine revision', async () => {
    const request = seamRequest({
      requestKey: 'seam-conflict-1',
      expectedApplicationVersion: 7,
    });
    const harness = createSeamHarness([]);

    // The tempting mistake, executed rather than argued about: reuse the
    // application's optimistic version as the engine revision. The seam
    // header calls this out; here is the engine's answer.
    const engineRequest = toExecutionRequest(
      request,
      {
        ...OUT_OF_BAND,
        expectedRevision: request.subject.expectedApplicationVersion,
      },
      [...REQUEST_DROPS],
    );
    expect(engineRequest.expectedRevision).toBe(7);

    const executed = failedExecution(
      await harness.engine.execute(engineRequest),
    );
    expect(executed.status).toBe('conflicted');
    expect(executed.error.code).toBe('CONFLICT_STATE_REVISION');
    expect(executed.error.stage).toBe('preparing-commit');
    expect(executed.error.details).toEqual({
      expectedRevision: 7,
      actualRevision: 0,
    });
    // The repository adapter enforces the revision when it loads context, so
    // the mistake costs nothing at the provider: no model call was made.
    expect(harness.gateway.invocations()).toEqual([]);

    expect(() => toAcmeAdapterResult(executed)).toThrow(
      SeamErrorStageDroppedError,
    );
    const seamResult = failedSeamResult(
      toAcmeAdapterResult(executed, [...RESULT_DROPS]),
    );
    expect(seamResult).toEqual({
      contractVersion: ACME_ADAPTER_CONTRACT_VERSION,
      status: 'conflicted',
      executionId: deriveExecutionId('neutral', 'seam-conflict-1'),
      error: {
        code: 'CONFLICT_STATE_REVISION',
        message: 'Expected state revision 7, found 0.',
        retryable: false,
      },
    });

    // The engine said exactly what the application needs in order to retry:
    // the actual revision is 0. It survives, but only as prose inside a
    // message no part of `aal-acme-adapter/2` gives a format to. The
    // structured `details` the engine returned is gone, so recovering the
    // revision means a regular expression over an error message rather than
    // reading a field. That is a coincidence of wording, not a contract.
    expect(Object.keys(seamResult.error).sort()).toEqual([
      'code',
      'message',
      'retryable',
    ]);
    expect(seamResult.error.message).toBe(executed.error.message);
    expect(wire(seamResult)).not.toContain('actualRevision');
    expect(wire(seamResult)).not.toContain('preparing-commit');
  });

  it('collapses an identity conflict onto the same shape as a state conflict', async () => {
    const request = seamRequest({ requestKey: 'seam-conflict-2' });
    const harness = createSeamHarness([{ requestKey: 'seam-conflict-2' }]);

    const committed = committedExecution(
      await harness.engine.execute(
        toExecutionRequest(request, OUT_OF_BAND, [...REQUEST_DROPS]),
      ),
    );
    expect(committed.replayed).toBe(false);

    // The same seam request, translated by a caller that chose a different
    // model out of band. The engine fingerprints the model, so this is an
    // identity conflict rather than a replay: the engine defends itself
    // against the seam's inability to carry a model.
    const rerouted = toExecutionRequest(
      request,
      { ...OUT_OF_BAND, model: alternateSelection },
      [...REQUEST_DROPS],
    );
    const executed = failedExecution(await harness.engine.execute(rerouted));
    expect(executed.status).toBe('conflicted');
    expect(executed.error.code).toBe('CONFLICT_IDEMPOTENCY_KEY');
    expect(executed.error.stage).toBe('accepted');
    expect(harness.gateway.invocations()).toHaveLength(1);

    const seamResult = failedSeamResult(
      toAcmeAdapterResult(executed, [...RESULT_DROPS]),
    );
    expect(seamResult.status).toBe('conflicted');
    expect(wire(seamResult)).not.toContain('neutral-offline-alternate');

    // The same seam translation applied to a state-revision conflict, for
    // comparison. In the engine the two are different events at different
    // stages; across the seam they become the same shape.
    const otherHarness = createSeamHarness([]);
    const stateConflict = failedExecution(
      await otherHarness.engine.execute(
        toExecutionRequest(
          seamRequest({ requestKey: 'seam-conflict-3' }),
          { ...OUT_OF_BAND, expectedRevision: 4 },
          [...REQUEST_DROPS],
        ),
      ),
    );
    const otherSeamResult = failedSeamResult(
      toAcmeAdapterResult(stateConflict, [...RESULT_DROPS]),
    );

    // Different in the engine.
    expect(executed.error.stage).not.toBe(stateConflict.error.stage);
    expect(Object.hasOwn(stateConflict.error, 'details')).toBe(true);

    // Indistinguishable across the seam: same status, same key set, and
    // neither carries the stage or the details that separate them. One says
    // "your entity moved on"; the other says "your model supplement
    // disagreed with an earlier caller's". The application receives one
    // word - conflicted - and an opaque code string.
    expect(otherSeamResult.status).toBe(seamResult.status);
    expect(Object.keys(otherSeamResult).sort()).toEqual(
      Object.keys(seamResult).sort(),
    );
    expect(Object.keys(seamResult).sort()).toEqual([
      'contractVersion',
      'error',
      'executionId',
      'status',
    ]);
    for (const carried of [seamResult.error, otherSeamResult.error]) {
      expect(Object.hasOwn(carried, 'stage')).toBe(false);
      expect(Object.hasOwn(carried, 'details')).toBe(false);
    }
  });
});

describe('a failed execution, end to end through the seam', () => {
  it('drops the stage, the details, and the cause of a provider failure', async () => {
    const request = seamRequest({ requestKey: 'seam-failed-1' });
    const harness = createSeamHarness([
      {
        requestKey: 'seam-failed-1',
        error: {
          code: 'MODEL_UNAVAILABLE',
          message: 'fixture provider outage',
          stage: 'calling-model',
          retryable: true,
          details: { provider: 'fixture', attempt: 1 },
          causeRef: 'model-call-evidence-1',
        },
      },
    ]);

    const executed = failedExecution(
      await harness.engine.execute(
        toExecutionRequest(request, OUT_OF_BAND, [...REQUEST_DROPS]),
      ),
    );
    expect(executed.status).toBe('failed');
    expect(executed.error).toMatchObject({
      code: 'MODEL_UNAVAILABLE',
      stage: 'calling-model',
      retryable: true,
      details: { provider: 'fixture', attempt: 1 },
      causeRef: 'model-call-evidence-1',
    });
    expect(harness.gateway.invocations()).toHaveLength(1);

    expect(inventoryResultGaps(executed).map((gap) => gap.code)).toEqual([
      'SEAM_ERROR_STAGE_DROPPED',
      'SEAM_ERROR_DETAILS_DROPPED',
      'SEAM_ERROR_CAUSE_REF_DROPPED',
    ]);

    const seamResult = failedSeamResult(
      toAcmeAdapterResult(executed, [...RESULT_DROPS]),
    );
    expect(seamResult).toEqual({
      contractVersion: ACME_ADAPTER_CONTRACT_VERSION,
      status: 'failed',
      executionId: deriveExecutionId('neutral', 'seam-failed-1'),
      error: {
        code: 'MODEL_UNAVAILABLE',
        message: 'fixture provider outage',
        retryable: true,
      },
    });

    // `retryable` survives, so the application can decide whether to try
    // again. Where the failure happened, what the provider said, and the
    // recorded evidence it said it under do not survive, so the application
    // cannot tell a provider outage from a validation failure except by
    // pattern-matching on the code string.
    const onTheWire = wire(seamResult);
    expect(onTheWire).not.toContain('calling-model');
    expect(onTheWire).not.toContain('attempt');
    expect(onTheWire).not.toContain('model-call-evidence-1');
    expect(Object.hasOwn(seamResult.error, 'stage')).toBe(false);
    expect(Object.hasOwn(seamResult.error, 'details')).toBe(false);
    expect(Object.hasOwn(seamResult.error, 'causeRef')).toBe(false);
  });
});
