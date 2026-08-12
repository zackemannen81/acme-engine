import { canonicalJson } from '@acme/core';
import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EvidenceCaseObjectBindingSchema,
  createEvidenceCaseObjectBindings,
  assertEvidenceCaseScopedReferences,
  scopeEvidenceProductSnapshotByCase,
  EvidenceProductCommandCollisionError,
  EvidenceProductSnapshotSchema,
  EvidenceProductChangeSetSchema,
  EvidenceReviewDecisionRecordSchema,
  EvidenceWorkspaceSchema,
  type EvidenceProductJob,
  type EvidenceProductRepository,
  type EvidenceProductSnapshot,
  type EvidenceCaseObjectBinding,
  type EvidenceCaseObjectKind,
  type EvidenceCaseObjectScope,
  type EvidenceReviewDecision,
  EvidenceRedactionDraftSchema,
  EvidenceRedactionLogSchema,
  EvidenceTextImportRecordSchema,
  EvidenceReviewActivitySchema,
  EvidenceReviewAssignmentSchema,
  EvidenceReviewCommentSchema,
  EvidenceExportAuditRecordSchema,
  EvidenceExportPolicySchema,
} from '@acme/evidence-product-contracts';
import {
  EvidenceAssessmentSchema,
  EvidenceObservationSchema,
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  SourceArtifactVersionSchema,
} from '@acme/module-evidence';
import type { Pool, PoolClient } from 'pg';
import {
  EvidenceArtifactLifecycleEventSchema,
  EvidenceArtifactObjectEnvelopeSchema,
  EvidenceArtifactRepresentationSchema,
  EvidenceArtifactStagingSchema,
  EvidenceSecurityAuditEventSchema,
} from '@acme/evidence-artifacts';

function assertSchemaName(name: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Invalid schema name ${JSON.stringify(name)}.`);
  }
  return name;
}

function qIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJson(left as never) === canonicalJson(right as never);
}

function sameSourceMetadata(
  left: import('@acme/module-evidence').SourceArtifactVersion,
  right: import('@acme/module-evidence').SourceArtifactVersion,
): boolean {
  return same({ ...left, text: '' }, { ...right, text: '' });
}

async function insertImmutableRecord(input: {
  readonly client: PoolClient;
  readonly schema: string;
  readonly table: string;
  readonly keyColumn: string;
  readonly key: string;
  readonly value: unknown;
  readonly extraColumns?: readonly [string, unknown][];
}): Promise<void> {
  const extras = input.extraColumns ?? [];
  const columns = [
    input.keyColumn,
    ...extras.map(([name]) => name),
    'record_json',
  ];
  const values = [
    input.key,
    ...extras.map(([, value]) => value),
    canonicalJson(input.value as never),
  ];
  const parameters = values.map((_, index) => `$${index + 1}`).join(',');
  const result = await input.client.query<{ record_json: string }>(
    `INSERT INTO ${input.schema}.${input.table} (${columns.join(',')})
     VALUES (${parameters})
     ON CONFLICT (${input.keyColumn}) DO NOTHING
     RETURNING record_json`,
    values,
  );
  if (result.rowCount === 1) return;
  const existing = await input.client.query<{ record_json: string }>(
    `SELECT record_json FROM ${input.schema}.${input.table} WHERE ${input.keyColumn}=$1`,
    [input.key],
  );
  if (!same(JSON.parse(existing.rows[0]?.record_json ?? 'null'), input.value))
    throw new EvidenceProductCommandCollisionError(input.key);
}

function decisionCommand(value: EvidenceReviewDecision): unknown {
  return {
    workspaceId: value.workspaceId,
    targetKind: value.targetKind,
    targetVersionId: value.targetVersionId,
    action: value.action,
    actorRef:
      value.schemaVersion === 'evidence-review-decision/1'
        ? value.reviewerRef
        : value.principalRef,
    rationale: value.rationale,
    commandKey: value.commandKey,
    basisEvidenceRevision: value.basisEvidenceRevision,
  };
}

async function insertCaseObjectBindings(
  client: PoolClient,
  schema: string,
  values: readonly EvidenceCaseObjectBinding[],
): Promise<void> {
  for (const input of values) {
    const value = EvidenceCaseObjectBindingSchema.parse(input);
    await client.query(
      `INSERT INTO ${schema}.case_object_bindings
       (case_id, workspace_id, object_kind, object_id, bound_at, record_json)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (case_id, workspace_id, object_kind, object_id) DO NOTHING`,
      [
        value.caseId,
        value.workspaceId,
        value.objectKind,
        value.objectId,
        value.boundAt,
        canonicalJson(value as never),
      ],
    );
  }
}

function bindingsFor(
  scope: EvidenceCaseObjectScope | undefined,
  kind: EvidenceCaseObjectKind,
  values: readonly Record<string, unknown>[],
): readonly EvidenceCaseObjectBinding[] {
  return scope === undefined
    ? []
    : createEvidenceCaseObjectBindings(scope, kind, values);
}

async function withWrite<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // prefer original
      }
      throw error;
    }
  } finally {
    client.release();
  }
}

export function createPostgresEvidenceProductRepository(options: {
  readonly pool: Pool;
  readonly schema?: string;
}): EvidenceProductRepository {
  const schema = assertSchemaName(options.schema ?? 'evidence');
  const s = qIdent(schema);
  const pool = options.pool;

  async function loadSnapshot(
    client: PoolClient | Pool,
  ): Promise<EvidenceProductSnapshot> {
    const [
      workspaces,
      sources,
      observations,
      relations,
      openQuestions,
      assessments,
      changeSets,
      jobs,
      reviewDecisions,
      objectBindings,
      artifactRepresentations,
      artifactEnvelopes,
      artifactStaging,
      artifactLifecycle,
      securityAudit,
      textImports,
      redactionDrafts,
      redactionLogs,
      reviewAssignments,
      reviewComments,
      reviewActivity,
      exportPolicies,
      exportAuditRecords,
    ] = await Promise.all([
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.workspaces ORDER BY workspace_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.sources ORDER BY artifact_version_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.observations ORDER BY observation_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.relations ORDER BY relation_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.open_questions ORDER BY open_question_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.assessments ORDER BY assessment_version_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.change_sets
          ORDER BY workspace_id, to_evidence_revision, command_key`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.jobs ORDER BY job_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.review_decisions
           ORDER BY decided_at, review_decision_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.case_object_bindings
           ORDER BY case_id, workspace_id, object_kind, object_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.artifact_representations ORDER BY representation_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.artifact_envelopes ORDER BY representation_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.artifact_staging ORDER BY staging_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.artifact_lifecycle
          ORDER BY occurred_at, lifecycle_event_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.security_audit
          ORDER BY occurred_at, audit_event_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.text_imports ORDER BY import_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.redaction_drafts ORDER BY draft_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.redaction_logs ORDER BY applied_at, redaction_log_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.review_assignments ORDER BY assignment_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.review_comments ORDER BY created_at, comment_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.review_activity ORDER BY occurred_at, activity_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.export_policies ORDER BY case_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.export_audit_records ORDER BY occurred_at, export_audit_id`,
      ),
    ]);

    return EvidenceProductSnapshotSchema.parse({
      schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
      workspaces: workspaces.rows.map((row) => JSON.parse(row.record_json)),
      sources: sources.rows.map((row) => JSON.parse(row.record_json)),
      observations: observations.rows.map((row) => JSON.parse(row.record_json)),
      relations: relations.rows.map((row) => JSON.parse(row.record_json)),
      openQuestions: openQuestions.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      assessments: assessments.rows.map((row) => JSON.parse(row.record_json)),
      changeSets: changeSets.rows.map((row) => JSON.parse(row.record_json)),
      jobs: jobs.rows.map((row) => JSON.parse(row.record_json)),
      reviewDecisions: reviewDecisions.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      objectBindings: objectBindings.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      artifactRepresentations: artifactRepresentations.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      artifactEnvelopes: artifactEnvelopes.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      artifactStaging: artifactStaging.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      artifactLifecycle: artifactLifecycle.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      securityAudit: securityAudit.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      textImports: textImports.rows.map((row) => JSON.parse(row.record_json)),
      redactionDrafts: redactionDrafts.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      redactionLogs: redactionLogs.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      reviewAssignments: reviewAssignments.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      reviewComments: reviewComments.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      reviewActivity: reviewActivity.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      exportPolicies: exportPolicies.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      exportAuditRecords: exportAuditRecords.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
    });
  }

  async function validateCaseScope(
    client: PoolClient,
    scope: EvidenceCaseObjectScope | undefined,
  ): Promise<void> {
    if (scope === undefined) return;
    assertEvidenceCaseScopedReferences(
      await loadSnapshot(client),
      scope.caseId,
      scope.workspaceId,
    );
  }

  return {
    async snapshot() {
      return clone(await loadSnapshot(pool));
    },

    async caseSnapshot(caseId, workspaceId) {
      const snapshot = await loadSnapshot(pool);
      assertEvidenceCaseScopedReferences(snapshot, caseId, workspaceId);
      return clone(
        scopeEvidenceProductSnapshotByCase(snapshot, caseId, workspaceId),
      );
    },

    async bindCaseObjects(inputs) {
      const values = inputs.map((input) =>
        EvidenceCaseObjectBindingSchema.parse(input),
      );
      await withWrite(pool, async (client) => {
        await insertCaseObjectBindings(client, s, values);
        for (const value of values) {
          await validateCaseScope(client, {
            caseId: value.caseId,
            workspaceId: value.workspaceId,
            boundAt: value.boundAt,
          });
        }
      });
      return clone(values);
    },

    async putTextImport(record, scope) {
      const value = EvidenceTextImportRecordSchema.parse(record);
      return withWrite(pool, async (client) => {
        const priorResult = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.text_imports WHERE case_id=$1 AND command_key=$2 FOR UPDATE`,
          [value.caseId, value.commandKey],
        );
        const prior =
          priorResult.rows[0] === undefined
            ? undefined
            : EvidenceTextImportRecordSchema.parse(
                JSON.parse(priorResult.rows[0].record_json),
              );
        if (prior !== undefined && prior.commandDigest !== value.commandDigest)
          throw new EvidenceProductCommandCollisionError(value.commandKey);
        await client.query(
          `INSERT INTO ${s}.text_imports (import_id,case_id,workspace_id,command_key,record_json)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (import_id) DO UPDATE SET record_json=EXCLUDED.record_json`,
          [
            value.importId,
            value.caseId,
            value.workspaceId,
            value.commandKey,
            canonicalJson(value as never),
          ],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'text-import', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async putRedactionDraft(draft, scope) {
      const value = EvidenceRedactionDraftSchema.parse(draft);
      return withWrite(pool, async (client) => {
        const result = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.redaction_drafts WHERE draft_id=$1 FOR UPDATE`,
          [value.draftId],
        );
        const prior =
          result.rows[0] === undefined
            ? undefined
            : EvidenceRedactionDraftSchema.parse(
                JSON.parse(result.rows[0].record_json),
              );
        if (
          prior !== undefined &&
          (prior.caseId !== value.caseId ||
            (value.revision !== prior.revision &&
              value.revision !== prior.revision + 1))
        )
          throw new EvidenceProductCommandCollisionError(
            `redaction-revision:${value.draftId}`,
          );
        await client.query(
          `INSERT INTO ${s}.redaction_drafts (draft_id,case_id,workspace_id,revision,record_json)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (draft_id) DO UPDATE SET revision=EXCLUDED.revision, record_json=EXCLUDED.record_json`,
          [
            value.draftId,
            value.caseId,
            value.workspaceId,
            value.revision,
            canonicalJson(value as never),
          ],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'redaction-draft', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async applyRedaction(draft, log, scope) {
      const draftValue = EvidenceRedactionDraftSchema.parse(draft);
      const logValue = EvidenceRedactionLogSchema.parse(log);
      return withWrite(pool, async (client) => {
        const result = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.redaction_drafts WHERE draft_id=$1 FOR UPDATE`,
          [draftValue.draftId],
        );
        const current =
          result.rows[0] === undefined
            ? undefined
            : EvidenceRedactionDraftSchema.parse(
                JSON.parse(result.rows[0].record_json),
              );
        if (
          current === undefined ||
          current.state !== 'draft' ||
          draftValue.state !== 'applied' ||
          current.revision + 1 !== draftValue.revision
        )
          throw new EvidenceProductCommandCollisionError(
            `redaction-apply:${draftValue.draftId}`,
          );
        if (
          logValue.caseId !== scope.caseId ||
          logValue.draftId !== draftValue.draftId ||
          !same(current.operations, logValue.operations)
        )
          throw new Error(
            'Applied redaction must use the frozen same-case operation list.',
          );
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'redaction_logs',
          keyColumn: 'redaction_log_id',
          key: logValue.redactionLogId,
          value: logValue,
          extraColumns: [
            ['case_id', logValue.caseId],
            ['workspace_id', logValue.workspaceId],
            ['command_key', logValue.commandKey],
            ['applied_at', logValue.appliedAt],
          ],
        });
        await client.query(
          `UPDATE ${s}.redaction_drafts SET revision=$2,record_json=$3 WHERE draft_id=$1`,
          [
            draftValue.draftId,
            draftValue.revision,
            canonicalJson(draftValue as never),
          ],
        );
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'redaction-draft', [
            draftValue as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'redaction-log', [
            logValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(logValue);
      });
    },

    async putReviewAssignment(assignment, activity, scope) {
      const value = EvidenceReviewAssignmentSchema.parse(assignment);
      const activityValue = EvidenceReviewActivitySchema.parse(activity);
      return withWrite(pool, async (client) => {
        const result = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.review_assignments WHERE assignment_id=$1 FOR UPDATE`,
          [value.assignmentId],
        );
        const current =
          result.rows[0] === undefined
            ? undefined
            : EvidenceReviewAssignmentSchema.parse(
                JSON.parse(result.rows[0].record_json),
              );
        if (
          current !== undefined &&
          (current.caseId !== value.caseId ||
            current.targetKind !== value.targetKind ||
            current.targetVersionId !== value.targetVersionId ||
            value.revision !== current.revision + 1)
        )
          throw new EvidenceProductCommandCollisionError(value.commandKey);
        await client.query(
          `INSERT INTO ${s}.review_assignments
           (assignment_id,case_id,workspace_id,target_kind,target_version_id,revision,record_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (assignment_id) DO UPDATE SET revision=EXCLUDED.revision,record_json=EXCLUDED.record_json`,
          [
            value.assignmentId,
            value.caseId,
            value.workspaceId,
            value.targetKind,
            value.targetVersionId,
            value.revision,
            canonicalJson(value as never),
          ],
        );
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'review_activity',
          keyColumn: 'activity_id',
          key: activityValue.activityId,
          value: activityValue,
          extraColumns: [
            ['case_id', activityValue.caseId],
            ['workspace_id', activityValue.workspaceId],
            ['target_version_id', activityValue.targetVersionId],
            ['occurred_at', activityValue.occurredAt],
          ],
        });
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'review-assignment', [
            value as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'review-activity', [
            activityValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async appendReviewComment(comment, activity, scope) {
      const value = EvidenceReviewCommentSchema.parse(comment);
      const activityValue = EvidenceReviewActivitySchema.parse(activity);
      return withWrite(pool, async (client) => {
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'review_comments',
          keyColumn: 'comment_id',
          key: value.commentId,
          value,
          extraColumns: [
            ['case_id', value.caseId],
            ['workspace_id', value.workspaceId],
            ['target_version_id', value.targetVersionId],
            ['created_at', value.createdAt],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'review_activity',
          keyColumn: 'activity_id',
          key: activityValue.activityId,
          value: activityValue,
          extraColumns: [
            ['case_id', activityValue.caseId],
            ['workspace_id', activityValue.workspaceId],
            ['target_version_id', activityValue.targetVersionId],
            ['occurred_at', activityValue.occurredAt],
          ],
        });
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'review-comment', [
            value as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'review-activity', [
            activityValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async appendReviewActivity(activity, scope) {
      const value = EvidenceReviewActivitySchema.parse(activity);
      return withWrite(pool, async (client) => {
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'review_activity',
          keyColumn: 'activity_id',
          key: value.activityId,
          value,
          extraColumns: [
            ['case_id', value.caseId],
            ['workspace_id', value.workspaceId],
            ['target_version_id', value.targetVersionId],
            ['occurred_at', value.occurredAt],
          ],
        });
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'review-activity', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async putExportPolicy(policy, scope) {
      const value = EvidenceExportPolicySchema.parse(policy);
      return withWrite(pool, async (client) => {
        const result = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.export_policies WHERE case_id=$1 FOR UPDATE`,
          [value.caseId],
        );
        const current =
          result.rows[0] === undefined
            ? undefined
            : EvidenceExportPolicySchema.parse(
                JSON.parse(result.rows[0].record_json),
              );
        if (
          current === undefined
            ? value.revision !== 1
            : current.workspaceId !== value.workspaceId ||
              value.revision !== current.revision + 1
        )
          throw new EvidenceProductCommandCollisionError(
            `export-policy:${value.caseId}`,
          );
        await client.query(
          `INSERT INTO ${s}.export_policies (case_id,workspace_id,revision,record_json)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (case_id) DO UPDATE SET revision=EXCLUDED.revision,record_json=EXCLUDED.record_json`,
          [
            value.caseId,
            value.workspaceId,
            value.revision,
            canonicalJson(value as never),
          ],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'export-policy', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async appendExportAuditRecord(record, scope) {
      const value = EvidenceExportAuditRecordSchema.parse(record);
      return withWrite(pool, async (client) => {
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'export_audit_records',
          keyColumn: 'export_audit_id',
          key: value.exportAuditId,
          value,
          extraColumns: [
            ['case_id', value.caseId],
            ['workspace_id', value.workspaceId],
            ['assessment_version_id', value.assessmentVersionId],
            ['occurred_at', value.occurredAt],
          ],
        });
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'export-audit-record', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async appendReviewDecisions(decisions, activities, scope) {
      const values = decisions.map((item) =>
        EvidenceReviewDecisionRecordSchema.parse(item),
      );
      const activityValues = activities.map((item) =>
        EvidenceReviewActivitySchema.parse(item),
      );
      if (values.length !== activityValues.length)
        throw new Error('Bulk decisions and activities must align.');
      return withWrite(pool, async (client) => {
        for (let index = 0; index < values.length; index += 1) {
          const value = values[index] as EvidenceReviewDecision;
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.review_decisions WHERE workspace_id=$1 AND command_key=$2 FOR UPDATE`,
            [value.workspaceId, value.commandKey],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceReviewDecisionRecordSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(decisionCommand(stored), decisionCommand(value)))
              throw new EvidenceProductCommandCollisionError(value.commandKey);
          } else {
            await client.query(
              `INSERT INTO ${s}.review_decisions (review_decision_id,workspace_id,command_key,decided_at,record_json) VALUES ($1,$2,$3,$4,$5)`,
              [
                value.reviewDecisionId,
                value.workspaceId,
                value.commandKey,
                value.decidedAt,
                canonicalJson(value as never),
              ],
            );
          }
          const activity = activityValues[
            index
          ] as (typeof activityValues)[number];
          await insertImmutableRecord({
            client,
            schema: s,
            table: 'review_activity',
            keyColumn: 'activity_id',
            key: activity.activityId,
            value: activity,
            extraColumns: [
              ['case_id', activity.caseId],
              ['workspace_id', activity.workspaceId],
              ['target_version_id', activity.targetVersionId],
              ['occurred_at', activity.occurredAt],
            ],
          });
        }
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(
            scope,
            'review-decision',
            values as unknown as Record<string, unknown>[],
          ),
          ...bindingsFor(
            scope,
            'review-activity',
            activityValues as unknown as Record<string, unknown>[],
          ),
        ]);
        await validateCaseScope(client, scope);
        return clone(values);
      });
    },

    async stageArtifact(staging, audit, scope) {
      const value = EvidenceArtifactStagingSchema.parse(staging);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return withWrite(pool, async (client) => {
        const commandResult = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.artifact_staging WHERE case_id=$1 AND command_key=$2 FOR UPDATE`,
          [value.caseId, value.commandKey],
        );
        const commandRow = commandResult.rows[0];
        if (commandRow !== undefined) {
          const prior = EvidenceArtifactStagingSchema.parse(
            JSON.parse(commandRow.record_json),
          );
          if (
            prior.representationId !== value.representationId ||
            prior.plaintextSha256 !== value.plaintextSha256
          )
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          return clone(prior);
        }
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'artifact_staging',
          keyColumn: 'staging_id',
          key: value.stagingId,
          value,
          extraColumns: [
            ['case_id', value.caseId],
            ['workspace_id', value.workspaceId],
            ['representation_id', value.representationId],
            ['command_key', value.commandKey],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'security_audit',
          keyColumn: 'audit_event_id',
          key: auditValue.auditEventId,
          value: auditValue,
          extraColumns: [
            ['organization_id', auditValue.organizationId],
            ['case_id', auditValue.caseId],
            ['principal_ref', auditValue.principalRef],
            ['occurred_at', auditValue.occurredAt],
          ],
        });
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'artifact-staging', [
            value as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'security-audit', [
            auditValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async activateArtifactSource(
      source,
      representation,
      envelope,
      lifecycle,
      audit,
      scope,
    ) {
      const sourceValue = SourceArtifactVersionSchema.parse(source);
      const representationValue =
        EvidenceArtifactRepresentationSchema.parse(representation);
      const envelopeValue =
        EvidenceArtifactObjectEnvelopeSchema.parse(envelope);
      const lifecycleValue =
        EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return withWrite(pool, async (client) => {
        const stagingResult = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.artifact_staging WHERE representation_id=$1 FOR UPDATE`,
          [representationValue.representationId],
        );
        const matchingStaging = stagingResult.rows
          .map((row) =>
            EvidenceArtifactStagingSchema.parse(JSON.parse(row.record_json)),
          )
          .find((staged) => {
            return (
              canonicalJson(staged.representation as never) ===
                canonicalJson(representationValue as never) &&
              canonicalJson(staged.pendingEnvelope as never) ===
                canonicalJson(envelopeValue as never)
            );
          });
        if (matchingStaging === undefined)
          throw new Error(
            'Artifact activation requires matching staged metadata.',
          );
        if (matchingStaging.state === 'activated') {
          const [sourceResult, representationResult, envelopeResult] =
            await Promise.all([
              client.query<{ record_json: string }>(
                `SELECT record_json FROM ${s}.sources WHERE artifact_version_id=$1`,
                [sourceValue.artifactVersionId],
              ),
              client.query<{ record_json: string }>(
                `SELECT record_json FROM ${s}.artifact_representations WHERE representation_id=$1`,
                [representationValue.representationId],
              ),
              client.query<{ record_json: string }>(
                `SELECT record_json FROM ${s}.artifact_envelopes WHERE representation_id=$1`,
                [envelopeValue.representationId],
              ),
            ]);
          const activeSource = sourceResult.rows[0]?.record_json;
          const activeRepresentation =
            representationResult.rows[0]?.record_json;
          const activeEnvelope = envelopeResult.rows[0]?.record_json;
          if (
            activeSource === undefined ||
            activeRepresentation === undefined ||
            activeEnvelope === undefined ||
            canonicalJson(JSON.parse(activeSource) as never) !==
              canonicalJson(sourceValue as never) ||
            canonicalJson(JSON.parse(activeRepresentation) as never) !==
              canonicalJson(representationValue as never) ||
            canonicalJson(JSON.parse(activeEnvelope) as never) !==
              canonicalJson(envelopeValue as never)
          )
            throw new Error('Activated artifact metadata is inconsistent.');
          return clone(sourceValue);
        }
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          sourceValue.logicalArtifactId,
        ]);
        const ordinalRows = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.sources FOR UPDATE`,
        );
        const ordinalCollision = ordinalRows.rows
          .map((row) =>
            SourceArtifactVersionSchema.parse(JSON.parse(row.record_json)),
          )
          .find(
            (item) =>
              item.logicalArtifactId === sourceValue.logicalArtifactId &&
              item.versionOrdinal === sourceValue.versionOrdinal &&
              item.artifactVersionId !== sourceValue.artifactVersionId,
          );
        if (ordinalCollision !== undefined)
          throw new EvidenceProductCommandCollisionError(
            `artifact-ordinal:${sourceValue.logicalArtifactId}:${String(sourceValue.versionOrdinal)}`,
          );
        const sourceResult = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.sources WHERE artifact_version_id=$1 FOR UPDATE`,
          [sourceValue.artifactVersionId],
        );
        const sourceRow = sourceResult.rows[0];
        if (sourceRow !== undefined) {
          const existing = SourceArtifactVersionSchema.parse(
            JSON.parse(sourceRow.record_json),
          );
          if (!sameSourceMetadata(existing, sourceValue))
            throw new EvidenceProductCommandCollisionError(
              sourceValue.artifactVersionId,
            );
          await client.query(
            `UPDATE ${s}.sources SET record_json=$2 WHERE artifact_version_id=$1`,
            [
              sourceValue.artifactVersionId,
              canonicalJson(sourceValue as never),
            ],
          );
        } else {
          await client.query(
            `INSERT INTO ${s}.sources (artifact_version_id, record_json) VALUES ($1,$2)`,
            [
              sourceValue.artifactVersionId,
              canonicalJson(sourceValue as never),
            ],
          );
        }
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'artifact_representations',
          keyColumn: 'representation_id',
          key: representationValue.representationId,
          value: representationValue,
          extraColumns: [
            ['case_id', representationValue.caseId],
            ['workspace_id', representationValue.workspaceId],
            ['artifact_version_id', representationValue.artifactVersionId],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'artifact_envelopes',
          keyColumn: 'representation_id',
          key: envelopeValue.representationId,
          value: envelopeValue,
          extraColumns: [
            ['case_id', envelopeValue.caseId],
            ['workspace_id', envelopeValue.workspaceId],
            ['object_key', envelopeValue.objectKey],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'artifact_lifecycle',
          keyColumn: 'lifecycle_event_id',
          key: lifecycleValue.lifecycleEventId,
          value: lifecycleValue,
          extraColumns: [
            ['case_id', lifecycleValue.caseId],
            ['workspace_id', lifecycleValue.workspaceId],
            ['representation_id', lifecycleValue.representationId],
            ['occurred_at', lifecycleValue.occurredAt],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'security_audit',
          keyColumn: 'audit_event_id',
          key: auditValue.auditEventId,
          value: auditValue,
          extraColumns: [
            ['organization_id', auditValue.organizationId],
            ['case_id', auditValue.caseId],
            ['principal_ref', auditValue.principalRef],
            ['occurred_at', auditValue.occurredAt],
          ],
        });
        const staged = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.artifact_staging WHERE representation_id=$1`,
          [representationValue.representationId],
        );
        for (const row of staged.rows) {
          const current = EvidenceArtifactStagingSchema.parse(
            JSON.parse(row.record_json),
          );
          await client.query(
            `UPDATE ${s}.artifact_staging SET record_json=$2 WHERE staging_id=$1`,
            [
              current.stagingId,
              canonicalJson(
                EvidenceArtifactStagingSchema.parse({
                  ...current,
                  state: 'activated',
                }) as never,
              ),
            ],
          );
        }
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'source', [
            sourceValue as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'artifact-representation', [
            representationValue as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'artifact-envelope', [
            envelopeValue as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'artifact-lifecycle', [
            lifecycleValue as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'security-audit', [
            auditValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(sourceValue);
      });
    },

    async appendSecurityAudit(audit, scope) {
      const value = EvidenceSecurityAuditEventSchema.parse(audit);
      return withWrite(pool, async (client) => {
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'security_audit',
          keyColumn: 'audit_event_id',
          key: value.auditEventId,
          value,
          extraColumns: [
            ['organization_id', value.organizationId],
            ['case_id', value.caseId],
            ['principal_ref', value.principalRef],
            ['occurred_at', value.occurredAt],
          ],
        });
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'security-audit', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async updateArtifactEnvelope(envelope, lifecycle, audit, scope) {
      const value = EvidenceArtifactObjectEnvelopeSchema.parse(envelope);
      const lifecycleValue =
        EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return withWrite(pool, async (client) => {
        const existingResult = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.artifact_envelopes WHERE representation_id=$1 FOR UPDATE`,
          [value.representationId],
        );
        const existing = EvidenceArtifactObjectEnvelopeSchema.parse(
          JSON.parse(existingResult.rows[0]?.record_json ?? 'null'),
        );
        if (
          existing.caseId !== value.caseId ||
          existing.workspaceId !== value.workspaceId ||
          existing.objectKey !== value.objectKey ||
          existing.ciphertextSha256 !== value.ciphertextSha256
        )
          throw new Error(
            'Artifact envelope re-wrap changed immutable content.',
          );
        await client.query(
          `UPDATE ${s}.artifact_envelopes SET record_json=$2 WHERE representation_id=$1`,
          [value.representationId, canonicalJson(value as never)],
        );
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'artifact_lifecycle',
          keyColumn: 'lifecycle_event_id',
          key: lifecycleValue.lifecycleEventId,
          value: lifecycleValue,
          extraColumns: [
            ['case_id', lifecycleValue.caseId],
            ['workspace_id', lifecycleValue.workspaceId],
            ['representation_id', lifecycleValue.representationId],
            ['occurred_at', lifecycleValue.occurredAt],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'security_audit',
          keyColumn: 'audit_event_id',
          key: auditValue.auditEventId,
          value: auditValue,
          extraColumns: [
            ['organization_id', auditValue.organizationId],
            ['case_id', auditValue.caseId],
            ['principal_ref', auditValue.principalRef],
            ['occurred_at', auditValue.occurredAt],
          ],
        });
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'artifact-lifecycle', [
            lifecycleValue as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'security-audit', [
            auditValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async appendArtifactLifecycle(lifecycle, audit, scope) {
      const value = EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return withWrite(pool, async (client) => {
        await client.query(
          `SELECT representation_id FROM ${s}.artifact_representations WHERE representation_id=$1 FOR UPDATE`,
          [value.representationId],
        );
        if (value.expectedRevision !== null) {
          const revisionResult = await client.query<{ revision: string }>(
            `SELECT count(*)::text AS revision FROM ${s}.artifact_lifecycle WHERE representation_id=$1`,
            [value.representationId],
          );
          if (
            Number(revisionResult.rows[0]?.revision ?? '-1') !==
            value.expectedRevision
          )
            throw new Error('Artifact lifecycle revision conflict.');
        }
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'artifact_lifecycle',
          keyColumn: 'lifecycle_event_id',
          key: value.lifecycleEventId,
          value,
          extraColumns: [
            ['case_id', value.caseId],
            ['workspace_id', value.workspaceId],
            ['representation_id', value.representationId],
            ['occurred_at', value.occurredAt],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'security_audit',
          keyColumn: 'audit_event_id',
          key: auditValue.auditEventId,
          value: auditValue,
          extraColumns: [
            ['organization_id', auditValue.organizationId],
            ['case_id', auditValue.caseId],
            ['principal_ref', auditValue.principalRef],
            ['occurred_at', auditValue.occurredAt],
          ],
        });
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'artifact-lifecycle', [
            value as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'security-audit', [
            auditValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async quarantineArtifactStaging(stagingId, lifecycle, audit, scope) {
      const lifecycleValue =
        EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return withWrite(pool, async (client) => {
        const result = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.artifact_staging WHERE staging_id=$1 FOR UPDATE`,
          [stagingId],
        );
        const row = result.rows[0];
        if (row === undefined)
          throw new Error('Artifact staging record is unavailable.');
        const existing = EvidenceArtifactStagingSchema.parse(
          JSON.parse(row.record_json),
        );
        if (
          existing.caseId !== scope.caseId ||
          existing.workspaceId !== scope.workspaceId ||
          existing.representationId !== lifecycleValue.representationId
        )
          throw new Error('Artifact staging record is unavailable.');
        const value = EvidenceArtifactStagingSchema.parse({
          ...existing,
          state: 'quarantined',
        });
        await client.query(
          `UPDATE ${s}.artifact_staging SET record_json=$2 WHERE staging_id=$1`,
          [stagingId, canonicalJson(value as never)],
        );
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'artifact_lifecycle',
          keyColumn: 'lifecycle_event_id',
          key: lifecycleValue.lifecycleEventId,
          value: lifecycleValue,
          extraColumns: [
            ['case_id', lifecycleValue.caseId],
            ['workspace_id', lifecycleValue.workspaceId],
            ['representation_id', lifecycleValue.representationId],
            ['occurred_at', lifecycleValue.occurredAt],
          ],
        });
        await insertImmutableRecord({
          client,
          schema: s,
          table: 'security_audit',
          keyColumn: 'audit_event_id',
          key: auditValue.auditEventId,
          value: auditValue,
          extraColumns: [
            ['organization_id', auditValue.organizationId],
            ['case_id', auditValue.caseId],
            ['principal_ref', auditValue.principalRef],
            ['occurred_at', auditValue.occurredAt],
          ],
        });
        await insertCaseObjectBindings(client, s, [
          ...bindingsFor(scope, 'artifact-lifecycle', [
            lifecycleValue as unknown as Record<string, unknown>,
          ]),
          ...bindingsFor(scope, 'security-audit', [
            auditValue as unknown as Record<string, unknown>,
          ]),
        ]);
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async putWorkspace(workspace, scope) {
      const value = EvidenceWorkspaceSchema.parse(workspace);
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.workspaces WHERE workspace_id = $1`,
          [value.workspaceId],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = EvidenceWorkspaceSchema.parse(
            JSON.parse(row.record_json),
          );
          if (!same(stored, value)) {
            throw new EvidenceProductCommandCollisionError(value.workspaceId);
          }
          await insertCaseObjectBindings(
            client,
            s,
            bindingsFor(scope, 'workspace', [
              value as unknown as Record<string, unknown>,
            ]),
          );
          await validateCaseScope(client, scope);
          return clone(stored);
        }
        await client.query(
          `INSERT INTO ${s}.workspaces (workspace_id, record_json)
           VALUES ($1, $2)`,
          [value.workspaceId, canonicalJson(value as never)],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'workspace', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async putSource(source, scope) {
      const value = SourceArtifactVersionSchema.parse(source);
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.sources WHERE artifact_version_id = $1`,
          [value.artifactVersionId],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = SourceArtifactVersionSchema.parse(
            JSON.parse(row.record_json),
          );
          if (!same(stored, value)) {
            throw new EvidenceProductCommandCollisionError(
              value.artifactVersionId,
            );
          }
          await insertCaseObjectBindings(
            client,
            s,
            bindingsFor(scope, 'source', [
              value as unknown as Record<string, unknown>,
            ]),
          );
          await validateCaseScope(client, scope);
          return clone(stored);
        }
        await client.query(
          `INSERT INTO ${s}.sources (artifact_version_id, record_json)
           VALUES ($1, $2)`,
          [value.artifactVersionId, canonicalJson(value as never)],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'source', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async putObservations(observations, scope) {
      const values = observations.map((value) =>
        EvidenceObservationSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.observations WHERE observation_id = $1`,
            [value.observationId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceObservationSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(
                value.observationId,
              );
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.observations (observation_id, record_json)
             VALUES ($1, $2)`,
            [value.observationId, canonicalJson(value as never)],
          );
        }
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(
            scope,
            'observation',
            values as unknown as Record<string, unknown>[],
          ),
        );
        await validateCaseScope(client, scope);
        return clone(values);
      });
    },

    async putRelations(relations, scope) {
      const values = relations.map((value) =>
        EvidenceRelationSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.relations WHERE relation_id = $1`,
            [value.relationId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceRelationSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(value.relationId);
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.relations (relation_id, record_json)
             VALUES ($1, $2)`,
            [value.relationId, canonicalJson(value as never)],
          );
        }
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(
            scope,
            'relation',
            values as unknown as Record<string, unknown>[],
          ),
        );
        await validateCaseScope(client, scope);
        return clone(values);
      });
    },

    async putOpenQuestions(openQuestions, scope) {
      const values = openQuestions.map((value) =>
        EvidenceOpenQuestionSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.open_questions WHERE open_question_id = $1`,
            [value.openQuestionId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceOpenQuestionSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(
                value.openQuestionId,
              );
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.open_questions (open_question_id, record_json)
             VALUES ($1, $2)`,
            [value.openQuestionId, canonicalJson(value as never)],
          );
        }
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(
            scope,
            'open-question',
            values as unknown as Record<string, unknown>[],
          ),
        );
        await validateCaseScope(client, scope);
        return clone(values);
      });
    },

    async putAssessments(assessments, scope) {
      const values = assessments.map((value) =>
        EvidenceAssessmentSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.assessments WHERE assessment_version_id = $1`,
            [value.assessmentVersionId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceAssessmentSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(
                value.assessmentVersionId,
              );
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.assessments (assessment_version_id, record_json)
             VALUES ($1, $2)`,
            [value.assessmentVersionId, canonicalJson(value as never)],
          );
        }
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(
            scope,
            'assessment',
            values as unknown as Record<string, unknown>[],
          ),
        );
        await validateCaseScope(client, scope);
        return clone(values);
      });
    },

    async putChangeSet(changeSet, scope) {
      const value = EvidenceProductChangeSetSchema.parse(changeSet);
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.change_sets
            WHERE workspace_id = $1 AND command_key = $2`,
          [value.workspaceId, value.commandKey],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = EvidenceProductChangeSetSchema.parse(
            JSON.parse(row.record_json),
          );
          if (!same(stored, value))
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          await insertCaseObjectBindings(
            client,
            s,
            bindingsFor(scope, 'change-set', [
              value as unknown as Record<string, unknown>,
            ]),
          );
          await validateCaseScope(client, scope);
          return clone(stored);
        }
        await client.query(
          `INSERT INTO ${s}.change_sets (
             workspace_id, command_key, to_evidence_revision, record_json
           ) VALUES ($1, $2, $3, $4)`,
          [
            value.workspaceId,
            value.commandKey,
            value.changeSet.toEvidenceRevision,
            canonicalJson(value as never),
          ],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'change-set', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async putJob(job: EvidenceProductJob, scope) {
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.jobs WHERE job_id = $1`,
          [job.jobId],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = JSON.parse(row.record_json) as EvidenceProductJob;
          if (
            stored.workspaceId !== job.workspaceId ||
            stored.commandKey !== job.commandKey ||
            stored.artifactVersionId !== job.artifactVersionId
          ) {
            throw new EvidenceProductCommandCollisionError(job.commandKey);
          }
        }
        await client.query(
          `INSERT INTO ${s}.jobs (
             job_id, workspace_id, command_key, artifact_version_id, record_json
           ) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (job_id) DO UPDATE SET
             workspace_id = EXCLUDED.workspace_id,
             command_key = EXCLUDED.command_key,
             artifact_version_id = EXCLUDED.artifact_version_id,
             record_json = EXCLUDED.record_json`,
          [
            job.jobId,
            job.workspaceId,
            job.commandKey,
            job.artifactVersionId,
            canonicalJson(job as never),
          ],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'job', [
            job as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(job);
      });
    },

    async appendReviewDecision(decision, scope) {
      const value = EvidenceReviewDecisionRecordSchema.parse(decision);
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.review_decisions
            WHERE workspace_id = $1 AND command_key = $2`,
          [value.workspaceId, value.commandKey],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = EvidenceReviewDecisionRecordSchema.parse(
            JSON.parse(row.record_json),
          );
          if (!same(decisionCommand(stored), decisionCommand(value))) {
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          }
          await insertCaseObjectBindings(
            client,
            s,
            bindingsFor(scope, 'review-decision', [
              value as unknown as Record<string, unknown>,
            ]),
          );
          await validateCaseScope(client, scope);
          return clone(stored);
        }
        await client.query(
          `INSERT INTO ${s}.review_decisions (
             review_decision_id, workspace_id, command_key, decided_at, record_json
           ) VALUES ($1, $2, $3, $4, $5)`,
          [
            value.reviewDecisionId,
            value.workspaceId,
            value.commandKey,
            value.decidedAt,
            canonicalJson(value as never),
          ],
        );
        await insertCaseObjectBindings(
          client,
          s,
          bindingsFor(scope, 'review-decision', [
            value as unknown as Record<string, unknown>,
          ]),
        );
        await validateCaseScope(client, scope);
        return clone(value);
      });
    },

    async advanceEvidenceRevision(workspaceId, expectedRevision, nextRevision) {
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.workspaces WHERE workspace_id = $1 FOR UPDATE`,
          [workspaceId],
        );
        const row = existing.rows[0];
        if (row === undefined) {
          throw new RangeError(`Unknown workspace ${workspaceId}.`);
        }
        const current = EvidenceWorkspaceSchema.parse(
          JSON.parse(row.record_json),
        );
        if (
          current.evidenceRevision !== expectedRevision ||
          nextRevision < expectedRevision ||
          nextRevision > expectedRevision + 1
        ) {
          throw new EvidenceProductCommandCollisionError(
            `revision:${workspaceId}`,
          );
        }
        const value = EvidenceWorkspaceSchema.parse({
          ...current,
          evidenceRevision: nextRevision,
        });
        await client.query(
          `UPDATE ${s}.workspaces SET record_json = $2 WHERE workspace_id = $1`,
          [workspaceId, canonicalJson(value as never)],
        );
        return clone(value);
      });
    },
  };
}
