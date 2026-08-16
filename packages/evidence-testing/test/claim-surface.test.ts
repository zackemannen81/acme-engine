import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EVIDENCE_WORKSPACE_SCHEMA_VERSION,
  EvidenceProductSnapshotSchema,
} from '@acme/evidence-product-contracts';
import { buildEvidenceClaimSurfaceView } from '@acme/evidence-views';
import { EvidenceStateSchema } from '@acme/module-evidence';

import { evaluationObserveCases } from '../src/evaluation-candidates.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';

describe('buildEvidenceClaimSurfaceView', () => {
  it('lists three unmerged cards in one relation-scope group from two sources', () => {
    const cases = evaluationObserveCases();
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const observations = [...material.observations.values()].sort(
      (left, right) => left.observationId.localeCompare(right.observationId),
    );
    const sources = cases
      .map(({ input }) => input.artifactVersion)
      .sort((left, right) =>
        left.artifactVersionId.localeCompare(right.artifactVersionId),
      );
    const current = observations.filter(
      (observation) => observation.kind === 'statement-occurrence',
    );
    const first = current[0];
    const second = current.find(
      (observation) =>
        observation.artifactVersionId !== first?.artifactVersionId,
    );
    const third = current.find(
      (observation) =>
        observation.observationId !== first?.observationId &&
        observation.observationId !== second?.observationId,
    );
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Expected three statement occurrences from two sources.');
    }
    const hex = (label: string) =>
      `${label}${'a'.repeat(64)}`.replaceAll(/[^0-9a-f]/gu, 'a').slice(0, 64);
    const relation = (id: string, left: string, right: string) => ({
      schemaVersion: 'evidence-relation/1' as const,
      kind: 'evidence-relation' as const,
      relationId: `evidence_relation_${hex(id)}`,
      relationKind: 'unresolved' as const,
      endpoints: [
        { kind: 'observation' as const, id: left },
        { kind: 'observation' as const, id: right },
      ].sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
      ),
      comparableScope: {
        subject: 'red Volvo',
        aspect: 'vehicle',
        actorReferenceKeys: [],
        temporalBounds: [],
      },
      rationaleCode: 'SCOPE_OVERLAP_VISIBLE',
      rationale: 'Shared vehicle aspect; corroboration is a human judgement.',
      predecessorRelationId: null,
    });
    const relations = [
      relation('volvo-ab', first.observationId, second.observationId),
      relation('volvo-bc', second.observationId, third.observationId),
    ];
    const state = EvidenceStateSchema.parse({
      schemaVersion: 'evidence-state/1',
      evidenceRevision: 1,
      sourceDocumentIds: sources
        .map(({ artifactVersionId }) => artifactVersionId)
        .sort(),
      assessmentDocumentIds: [],
      memoryIds: observations.map(({ observationId }) => observationId).sort(),
      standings: observations
        .map((observation) => ({
          objectKind: observation.kind,
          objectId: observation.observationId,
          standing: 'current' as const,
        }))
        .sort((left, right) =>
          `${left.objectKind}:${left.objectId}`.localeCompare(
            `${right.objectKind}:${right.objectId}`,
          ),
        ),
      currentRelationVersionIds: relations
        .map(({ relationId }) => relationId)
        .sort(),
      currentOpenQuestionIds: [],
    });
    const snapshot = EvidenceProductSnapshotSchema.parse({
      schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
      workspaces: [
        {
          schemaVersion: EVIDENCE_WORKSPACE_SCHEMA_VERSION,
          workspaceId: 'workspace-claim',
          label: 'Claim surface',
          dataPolicy: 'synthetic-only',
          evidenceRevision: 1,
          createdAt: '2026-08-16T00:00:00.000Z',
        },
      ],
      sources,
      observations,
      relations,
      openQuestions: [],
      assessments: [],
      jobs: [],
      reviewDecisions: [],
    });
    const view = buildEvidenceClaimSurfaceView({
      workspaceId: 'workspace-claim',
      snapshot,
      evidenceState: state,
    });
    const volvo = view.groups.find(
      (group) =>
        group.kind === 'relation-scope' && group.subject === 'red Volvo',
    );
    expect(volvo?.cards).toHaveLength(3);
    expect(
      new Set(volvo?.cards.map((card) => card.citation.artifactVersionId) ?? [])
        .size,
    ).toBeGreaterThanOrEqual(2);
    expect(
      new Set(volvo?.cards.map((card) => card.observationVersionId)),
    ).toEqual(
      new Set([first.observationId, second.observationId, third.observationId]),
    );
    expect(view.explanation).toContain('not a stored merge');
  });
});
