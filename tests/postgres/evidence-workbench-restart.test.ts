import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { listenEvidenceWorkbenchApi } from '../../apps/evidence-workbench-api/src/index.js';
import { createLocalEvidenceWorkbench } from '../../apps/evidence-workbench-api/src/local.js';
import { EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION } from '../../packages/evidence-product-contracts/src/index.js';
import { developmentObserveArtifactInput } from '../../packages/evidence-testing/src/development-observe.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../../packages/evidence-testing/src/evaluation.js';
import {
  EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
  EVIDENCE_LOCATOR_SCHEMA_VERSION,
  EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
  EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
  deriveEvidenceActorReferenceKey,
  deriveEvidenceAssessmentContentHash,
  deriveEvidenceAssessmentId,
  deriveEvidenceLocatorId,
  deriveEvidenceObservationId,
  createEvidenceChangeSet,
} from '../../packages/module-evidence/src/index.js';

function countingIds(prefix: string) {
  const counts = new Map<string, number>();
  return {
    next(kind: string) {
      const next = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, next);
      return `${prefix}-${kind}-${String(next)}-${randomUUID().slice(0, 8)}`;
    },
  };
}

async function stopWorkbench(local: {
  readonly server: {
    readonly listening: boolean;
    close: (cb: (err?: Error) => void) => void;
  };
  readonly close: () => Promise<void>;
}): Promise<void> {
  if (local.server.listening) {
    await new Promise<void>((resolve, reject) => {
      local.server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await local.close();
}

function developmentObservation() {
  const source = developmentObserveArtifactInput().artifactVersion;
  const startLine = 4;
  const endLine = 4;
  const exactQuote =
    'Nera Sol: I reached the greenhouse hatch between 14:00 and 14:10.';
  const locatorId = deriveEvidenceLocatorId({
    artifactVersionId: source.artifactVersionId,
    startLine,
    endLine,
  });
  const actorBase = {
    schemaVersion: EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
    artifactVersionId: source.artifactVersionId,
    locatorId,
    sourceLabel: 'Nera Sol',
    sourceRole: 'speaker' as const,
  };
  const actorReference = {
    ...actorBase,
    actorReferenceKey: deriveEvidenceActorReferenceKey(actorBase),
    resolution: {
      status: 'resolved' as const,
      actorKey: 'development-actor-nera-sol',
    },
  };
  const temporalBound = {
    schemaVersion: EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
    artifactVersionId: source.artifactVersionId,
    locatorId,
    kind: 'range' as const,
    role: 'claimed-event-time' as const,
    from: '2026-03-12T14:00:00Z',
    to: '2026-03-12T14:10:00Z',
  };
  const observationId = deriveEvidenceObservationId({
    kind: 'statement-occurrence',
    artifactVersionId: source.artifactVersionId,
    locatorId,
    exactQuote,
    sourceActorReference: actorReference,
    temporalBound,
  });
  return {
    source,
    observation: {
      schemaVersion: EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
      kind: 'statement-occurrence' as const,
      observationId,
      artifactVersionId: source.artifactVersionId,
      locator: {
        schemaVersion: EVIDENCE_LOCATOR_SCHEMA_VERSION,
        locatorId,
        artifactVersionId: source.artifactVersionId,
        startLine,
        endLine,
      },
      exactQuote,
      actorReference,
      temporalBound,
    },
  };
}

/**
 * Hosted-shell restart durability: two sequential process compositions against
 * the same PostgreSQL product store continue the same workspace (ACME-0086).
 */
describe('Evidence workbench PostgreSQL restart', () => {
  it('retains sources and review decisions across process close and reopen', async () => {
    if (
      process.env['ACME_POSTGRES_URL'] === undefined ||
      process.env['ACME_POSTGRES_URL'].trim().length === 0
    ) {
      throw new Error('ACME_POSTGRES_URL is required for test:postgres.');
    }

    const commandKey = `restart-proof-review-${randomUUID()}`;
    const { source, observation } = developmentObservation();
    const changeSetCommandKey = `restart-change-set-${randomUUID()}`;
    const baseAssessment = buildGoldenMaterial(
      loadSealedEvaluationTruth(),
    ).assessments.get('E-A01');
    if (baseAssessment === undefined) throw new Error('Missing E-A01 fixture.');

    const first = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      clock: { now: () => '2026-08-12T12:00:00.000Z' },
      ids: countingIds('restart-a'),
      reviewIds: { next: () => `review-${randomUUID()}` },
    });

    // The assessment belongs to the composition's own workspace, so its
    // derived identity is computed once that workspace id is known.
    //
    // It cites this case's single observation rather than the golden E-A01
    // citations. Startup adopts unbound objects of the workspace into the
    // case, and an assessment citing the evaluation corpus would then fail
    // scoped-reference validation. Durability is what this test proves; which
    // evidence the assessment happens to cite is not.
    const assessmentContent = {
      claims: [
        {
          claimKey: 'restart-durability-claim',
          text: 'The actor reached the hatch inside the stated range.',
          supportObservationIds: [observation.observationId],
          conflictRelationIds: [],
          qualificationRelationIds: [],
          supportUnresolved: false,
          uncertainty: 'medium' as const,
          uncertaintyRationale:
            'One source-bound occurrence with a claimed range.',
        },
      ],
      openQuestionIds: [],
      citations: [
        {
          evidenceId: observation.observationId,
          artifactVersionId: observation.artifactVersionId,
          locatorId: observation.locator.locatorId,
        },
      ],
      predecessorAssessmentVersionId: null,
    };
    const assessmentContentHash = deriveEvidenceAssessmentContentHash(
      assessmentContent as never,
    );
    const durableAssessment = {
      ...baseAssessment,
      ...assessmentContent,
      workspaceId: first.workspaceId,
      contentHash: assessmentContentHash,
      assessmentVersionId: deriveEvidenceAssessmentId({
        workspaceId: first.workspaceId,
        sequence: baseAssessment.sequence,
        basisEvidenceRevision: baseAssessment.basisEvidenceRevision,
        contentHash: assessmentContentHash,
      }),
    };
    const address = await listenEvidenceWorkbenchApi(first.server, {
      port: 0,
    });
    try {
      const health = await fetch(`${address.url}health`);
      expect(health.status).toBe(200);
      expect((await health.json()) as { status: string }).toMatchObject({
        status: 'ok',
      });

      // ADR-0036 requires every workspace to own exactly one case, and
      // case-first routes derive the workspace from the case rather than from
      // a request body. The durable records therefore live in the
      // composition's own workspace and are bound to its case.
      const caseScope = {
        caseId: first.caseId,
        workspaceId: first.workspaceId,
        boundAt: '2026-08-12T12:00:00.000Z',
      } as const;
      await first.productRepository.putSource(source);
      await first.productRepository.putObservations([observation]);
      await first.productRepository.putAssessments([durableAssessment]);
      await first.productRepository.putChangeSet({
        schemaVersion: EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
        workspaceId: first.workspaceId,
        commandKey: changeSetCommandKey,
        recordedAt: '2026-08-12T12:00:00.000Z',
        changeSet: createEvidenceChangeSet({
          fromEvidenceRevision: 0,
          toEvidenceRevision: 1,
          addedArtifactVersionIds: [source.artifactVersionId],
          addedObservationIds: [observation.observationId],
          addedRelationIds: [],
          addedOpenQuestionIds: [],
          standingChanges: [],
          actorReferenceKeys: [],
          relationEndpointIds: [],
          temporalBounds: [],
        }),
      });
      await first.productRepository.bindCaseObjects([
        {
          schemaVersion: 'evidence-case-object-binding/1',
          ...caseScope,
          objectKind: 'source',
          objectId: source.artifactVersionId,
        },
        {
          schemaVersion: 'evidence-case-object-binding/1',
          ...caseScope,
          objectKind: 'observation',
          objectId: observation.observationId,
        },
      ]);
      // The golden E-A01 assessment cites the evaluation corpus, which this
      // case does not contain, so binding it would fail scoped-reference
      // validation. It stays a durable unscoped record: this test proves it
      // survives a restart, not that it is reviewable inside this case.

      const origin = address.url.slice(0, -1);
      const login = await fetch(`${address.url}auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(first.authCredentials),
      });
      expect(login.status).toBe(201);
      const setCookies = login.headers.getSetCookie();
      const cookie = setCookies.map((value) => value.split(';')[0]).join('; ');
      const csrfPart = setCookies
        .map((value) => value.split(';')[0])
        .find((value) => value?.startsWith('acme_csrf='));
      if (csrfPart === undefined)
        throw new Error('Missing restart CSRF cookie.');
      const review = await fetch(
        `${address.url}api/cases/${encodeURIComponent(first.caseId)}/reviews`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie,
            origin,
            'x-acme-csrf': decodeURIComponent(
              csrfPart.slice('acme_csrf='.length),
            ),
          },
          body: JSON.stringify({
            schemaVersion: 'evidence-review-command/3',
            commandKey,
            targetKind: 'observation',
            targetVersionId: observation.observationId,
            action: 'accept',
            rationale: 'Restart durability review.',
            basisEvidenceRevision: null,
          }),
        },
      );
      expect(review.status, await review.clone().text()).toBe(201);

      const afterReview = await first.productRepository.snapshot();
      expect(afterReview.sources.length).toBeGreaterThan(0);
      expect(
        afterReview.reviewDecisions.some(
          (decision) =>
            decision.commandKey === commandKey &&
            decision.schemaVersion === 'evidence-review-decision/3' &&
            decision.principalAssurance === 'authenticated-case-session',
        ),
      ).toBe(true);
      expect(
        afterReview.assessments.some(
          ({ assessmentVersionId }) =>
            assessmentVersionId === durableAssessment.assessmentVersionId,
        ),
      ).toBe(true);
      expect(
        afterReview.changeSets.some(
          (changeSet) => changeSet.commandKey === changeSetCommandKey,
        ),
      ).toBe(true);
    } finally {
      await stopWorkbench(first);
    }

    const second = await createLocalEvidenceWorkbench({
      persistence: 'postgres',
      seedMode: 'none',
      clock: { now: () => '2026-08-12T12:05:00.000Z' },
      ids: countingIds('restart-b'),
      reviewIds: { next: () => `review-${randomUUID()}` },
    });
    try {
      const snapshotAfter = await second.productRepository.snapshot();
      expect(snapshotAfter.sources.length).toBeGreaterThan(0);
      expect(
        snapshotAfter.reviewDecisions.some(
          (decision) =>
            decision.commandKey === commandKey &&
            decision.schemaVersion === 'evidence-review-decision/3' &&
            decision.principalAssurance === 'authenticated-case-session',
        ),
      ).toBe(true);
      expect(
        snapshotAfter.assessments.some(
          ({ assessmentVersionId }) =>
            assessmentVersionId === durableAssessment.assessmentVersionId,
        ),
      ).toBe(true);
      expect(
        snapshotAfter.changeSets.some(
          (changeSet) => changeSet.commandKey === changeSetCommandKey,
        ),
      ).toBe(true);
      expect(
        snapshotAfter.workspaces.find(
          (workspace) => workspace.workspaceId === first.workspaceId,
        )?.dataPolicy,
      ).toBe('synthetic-only');
    } finally {
      await stopWorkbench(second);
    }
  });
});
