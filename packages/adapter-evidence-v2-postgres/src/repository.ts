import {
  assertSchemaName,
  qIdent,
  withPostgresDriverErrors,
  withWriteTransaction,
} from '@acme/adapter-postgres';
import {
  EVIDENCE_V2_SURFACE_GAPS,
  type EvidenceV2Claim,
  type EvidenceV2ClaimGroupingDecision,
  type EvidenceV2ReviewDecision,
  type EvidenceV2ArtifactRecord,
  type EvidenceV2CaseOverview,
  type EvidenceV2ExtractionWindowState,
  type EvidenceV2CaseRecord,
  type EvidenceV2ChainDetail,
  type EvidenceV2ImportWrite,
  type EvidenceV2Page,
  type EvidenceV2PageRequest,
  type EvidenceV2Repository,
} from '@acme/evidence-v2-contracts';
import {
  deriveEvidenceV2ChainState,
  type EvidenceV2Chain,
  type EvidenceV2ChainDecision,
  type EvidenceV2ChainMembership,
  type EvidenceV2ChainProposal,
  type EvidenceV2Occurrence,
  type EvidenceV2SourcePart,
} from '@acme/module-evidence-v2';
import type { Pool, QueryResultRow } from 'pg';

/** The subset of `pg` this adapter needs: a pool or a transaction client. */
type Sql = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: T[] }>;
};

type Row = Record<string, unknown>;

async function rowsOf(
  client: Sql,
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  const result = await client.query<Row>(text, values);
  return result.rows;
}

async function rowOf(
  client: Sql,
  text: string,
  values: readonly unknown[] = [],
): Promise<Row | undefined> {
  return (await rowsOf(client, text, values))[0];
}

/** Rows are inserted in batches so a 30,000-unit artifact is one round trip per batch. */
const INSERT_BATCH = 500;

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

async function insertBatched(
  client: Sql,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly (string | number | boolean | null)[])[],
  onConflict = '',
): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_BATCH) {
    const batch = rows.slice(start, start + INSERT_BATCH);
    const values: (string | number | boolean | null)[] = [];
    const tuples = batch.map((row, rowIndex) => {
      const placeholders = row.map(
        (_, columnIndex) =>
          `$${String(rowIndex * columns.length + columnIndex + 1)}`,
      );
      values.push(...row);
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')} ${onConflict}`,
      values,
    );
  }
}

export interface EvidenceV2PostgresRepositoryOptions {
  readonly pool: Pool;
  readonly schema?: string;
}

export function createEvidenceV2PostgresRepository(
  options: EvidenceV2PostgresRepositoryOptions,
): EvidenceV2Repository {
  const schema = qIdent(assertSchemaName(options.schema ?? 'evidence_v2'));
  const pool = options.pool;

  async function page<T>(
    table: string,
    where: string,
    parameters: readonly (string | number)[],
    order: string,
    request: EvidenceV2PageRequest,
    map: (row: Record<string, unknown>) => T,
  ): Promise<EvidenceV2Page<T>> {
    const countRow = await rowOf(
      pool,
      `SELECT count(*)::text AS total FROM ${table} ${where}`,
      [...parameters],
    );
    const rows = await rowsOf(
      pool,
      `SELECT * FROM ${table} ${where} ORDER BY ${order} LIMIT $${String(parameters.length + 1)} OFFSET $${String(parameters.length + 2)}`,
      [...parameters, request.limit, request.offset],
    );
    return {
      items: rows.map(map),
      total: toNumber(countRow?.total ?? 0),
      offset: request.offset,
      limit: request.limit,
    };
  }

  function partOf(row: Record<string, unknown>): EvidenceV2SourcePart {
    const titleText = row['title_text'];
    return {
      partId: String(row['part_id']),
      startLine: toNumber(row['start_line']),
      endLine: toNumber(row['end_line']),
      contentCharacter:
        row['content_character'] === 'index-or-front-matter'
          ? 'index-or-front-matter'
          : 'substantive',
      title:
        typeof titleText === 'string'
          ? {
              text: titleText,
              sourceLine: toNumber(row['title_source_line']),
            }
          : null,
      // Units are stored separately and are not part of a list projection.
      units: [],
    };
  }

  async function readEffective(
    artifactId: string,
  ): Promise<readonly EvidenceV2ChainMembership[]> {
    const rows = await rowsOf(
      pool,
      `SELECT membership_json FROM ${schema}.effective_memberships
       WHERE artifact_id = $1 ORDER BY chain_id, part_id`,
      [artifactId],
    );
    return rows.map(
      (row) =>
        JSON.parse(String(row['membership_json'])) as EvidenceV2ChainMembership,
    );
  }

  async function readProposal(
    client: Sql,
    artifactId: string,
  ): Promise<EvidenceV2ChainProposal> {
    const chainRows = await rowsOf(
      client,
      `SELECT * FROM ${schema}.chains WHERE artifact_id = $1 ORDER BY ordinal`,
      [artifactId],
    );
    const instanceRows = await rowsOf(
      client,
      `SELECT * FROM ${schema}.chain_instances WHERE artifact_id = $1
       ORDER BY chain_id, instance_ordinal`,
      [artifactId],
    );
    const membershipRows = await rowsOf(
      client,
      `SELECT membership_json FROM ${schema}.proposed_memberships
       WHERE artifact_id = $1 ORDER BY chain_id, part_id`,
      [artifactId],
    );

    const chains: EvidenceV2Chain[] = chainRows.map((row) => {
      const chainId = String(row['chain_id']);
      const caseFileRef = row['case_file_ref'];
      return {
        chainId,
        subjectLabel: String(row['subject_label']),
        caseFileRef: typeof caseFileRef === 'string' ? caseFileRef : null,
        instances: instanceRows
          .filter((item) => String(item['chain_id']) === chainId)
          .map((item) => ({
            instanceKey: String(item['instance_key']),
            instanceOrdinal: toNumber(item['instance_ordinal']),
            sourcePartIds: JSON.parse(
              String(item['source_part_ids_json']),
            ) as string[],
            instanceSourceTime: JSON.parse(
              String(item['source_time_json']),
            ) as EvidenceV2Chain['instances'][number]['instanceSourceTime'],
            ordered: Boolean(item['ordered']),
          })),
      };
    });

    return {
      schemaVersion: 'evidence-v2-chain/1',
      ruleVersion: 'evidence-v2-chain-rules/1',
      chains,
      memberships: membershipRows.map(
        (row) =>
          JSON.parse(
            String(row['membership_json']),
          ) as EvidenceV2ChainMembership,
      ),
      unassignedPartIds: [],
      identities: [],
      diagnostics: [],
    };
  }

  return {
    async createCase(record: EvidenceV2CaseRecord): Promise<void> {
      await withPostgresDriverErrors(async () => {
        await pool.query(
          `INSERT INTO ${schema}.cases (case_id, case_reference, created_at, record_json)
           VALUES ($1, $2, $3, $4)`,
          [
            record.caseId,
            record.caseReference,
            record.createdAt,
            JSON.stringify(record),
          ],
        );
      });
    },

    async listCases(request) {
      return page(
        `${schema}.cases`,
        '',
        [],
        'created_at, case_id',
        request,
        (row) => JSON.parse(String(row['record_json'])) as EvidenceV2CaseRecord,
      );
    },

    async readCase(caseId) {
      const row = await rowOf(
        pool,
        `SELECT record_json FROM ${schema}.cases WHERE case_id = $1`,
        [caseId],
      );
      return row === undefined
        ? undefined
        : (JSON.parse(String(row['record_json'])) as EvidenceV2CaseRecord);
    },

    async writeImport(write: EvidenceV2ImportWrite): Promise<void> {
      const { artifact, structure, proposal } = write;
      await withPostgresDriverErrors(async () => {
        await withWriteTransaction(pool, async (client) => {
          await client.query(
            `INSERT INTO ${schema}.artifacts
               (artifact_id, case_id, canonical_sha256, imported_at, record_json)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              artifact.artifactId,
              artifact.caseId,
              artifact.canonicalSha256,
              artifact.importedAt,
              JSON.stringify(artifact),
            ],
          );

          await insertBatched(
            client,
            `${schema}.source_parts`,
            [
              'artifact_id',
              'part_id',
              'ordinal',
              'start_line',
              'end_line',
              'content_character',
              'title_text',
              'title_source_line',
            ],
            structure.parts.map((part, index) => [
              artifact.artifactId,
              part.partId,
              index,
              part.startLine,
              part.endLine,
              part.contentCharacter,
              part.title?.text ?? null,
              part.title?.sourceLine ?? null,
            ]),
          );

          await insertBatched(
            client,
            `${schema}.citable_units`,
            [
              'artifact_id',
              'unit_id',
              'part_id',
              'ordinal',
              'start_line',
              'end_line',
              'exact_quote',
            ],
            structure.parts.flatMap((part) =>
              part.units.map((unit, index) => [
                artifact.artifactId,
                unit.unitId,
                part.partId,
                index,
                unit.startLine,
                unit.endLine,
                unit.exactQuote,
              ]),
            ),
          );

          await insertBatched(
            client,
            `${schema}.chains`,
            [
              'artifact_id',
              'chain_id',
              'ordinal',
              'subject_label',
              'case_file_ref',
              'instance_count',
            ],
            proposal.chains.map((chain, index) => [
              artifact.artifactId,
              chain.chainId,
              index,
              chain.subjectLabel,
              chain.caseFileRef,
              chain.instances.length,
            ]),
          );

          await insertBatched(
            client,
            `${schema}.chain_instances`,
            [
              'artifact_id',
              'chain_id',
              'instance_key',
              'instance_ordinal',
              'ordered',
              'source_time_json',
              'source_part_ids_json',
            ],
            proposal.chains.flatMap((chain) =>
              chain.instances.map((instance) => [
                artifact.artifactId,
                chain.chainId,
                instance.instanceKey,
                instance.instanceOrdinal,
                instance.ordered,
                JSON.stringify(instance.instanceSourceTime),
                JSON.stringify(instance.sourcePartIds),
              ]),
            ),
          );

          const membershipRows = proposal.memberships.map((membership) => [
            artifact.artifactId,
            membership.chainId,
            membership.sourcePartId,
            JSON.stringify(membership),
          ]);
          await insertBatched(
            client,
            `${schema}.proposed_memberships`,
            ['artifact_id', 'chain_id', 'part_id', 'membership_json'],
            membershipRows,
          );
          await insertBatched(
            client,
            `${schema}.effective_memberships`,
            ['artifact_id', 'chain_id', 'part_id', 'membership_json'],
            membershipRows,
          );

          await insertBatched(
            client,
            `${schema}.chain_diagnostics`,
            ['artifact_id', 'ordinal', 'diagnostic_json'],
            proposal.diagnostics.map((diagnostic, index) => [
              artifact.artifactId,
              index,
              JSON.stringify(diagnostic),
            ]),
          );
        });
      });
    },

    async listArtifacts(caseId, request) {
      return page(
        `${schema}.artifacts`,
        'WHERE case_id = $1',
        [caseId],
        'imported_at, artifact_id',
        request,
        (row) =>
          JSON.parse(String(row['record_json'])) as EvidenceV2ArtifactRecord,
      );
    },

    async readArtifact(artifactId) {
      const row = await rowOf(
        pool,
        `SELECT record_json FROM ${schema}.artifacts WHERE artifact_id = $1`,
        [artifactId],
      );
      return row === undefined
        ? undefined
        : (JSON.parse(String(row['record_json'])) as EvidenceV2ArtifactRecord);
    },

    async listParts(artifactId, request) {
      return page(
        `${schema}.source_parts`,
        'WHERE artifact_id = $1',
        [artifactId],
        'ordinal',
        request,
        partOf,
      );
    },

    async readPart(artifactId, partId) {
      const row = await rowOf(
        pool,
        `SELECT * FROM ${schema}.source_parts WHERE artifact_id = $1 AND part_id = $2`,
        [artifactId, partId],
      );
      if (row === undefined) return undefined;
      const units = await rowsOf(
        pool,
        `SELECT * FROM ${schema}.citable_units
         WHERE artifact_id = $1 AND part_id = $2 ORDER BY ordinal`,
        [artifactId, partId],
      );
      return {
        ...partOf(row),
        units: units.map((unit) => ({
          unitId: String(unit['unit_id']),
          startLine: toNumber(unit['start_line']),
          endLine: toNumber(unit['end_line']),
          exactQuote: String(unit['exact_quote']),
        })),
      };
    },

    async listChains(artifactId, request) {
      return page(
        `${schema}.chains`,
        'WHERE artifact_id = $1',
        [artifactId],
        'ordinal',
        request,
        (row) => ({
          chainId: String(row['chain_id']),
          subjectLabel: String(row['subject_label']),
          caseFileRef:
            typeof row['case_file_ref'] === 'string'
              ? row['case_file_ref']
              : null,
          instanceCount: toNumber(row['instance_count']),
        }),
      );
    },

    async readChain(
      artifactId,
      chainId,
    ): Promise<EvidenceV2ChainDetail | undefined> {
      const proposal = await readProposal(pool, artifactId);
      const chain = proposal.chains.find((item) => item.chainId === chainId);
      if (chain === undefined) return undefined;
      const effective = await readEffective(artifactId);
      const memberships = effective.filter((item) => item.chainId === chainId);
      // Instances are the proposal's, but membership is the reviewer's. A part
      // moved to another chain must leave this one's instances, or a
      // correction would be invisible on the surface where it was made.
      const held = new Set(memberships.map((item) => item.sourcePartId));
      return {
        chain: {
          ...chain,
          instances: chain.instances
            .map((instance) => ({
              ...instance,
              sourcePartIds: instance.sourcePartIds.filter((partId) =>
                held.has(partId),
              ),
            }))
            .filter((instance) => instance.sourcePartIds.length > 0),
        },
        memberships,
      };
    },

    async readProposedMemberships(artifactId) {
      const rows = await rowsOf(
        pool,
        `SELECT membership_json FROM ${schema}.proposed_memberships
         WHERE artifact_id = $1 ORDER BY chain_id, part_id`,
        [artifactId],
      );
      return rows.map(
        (row) =>
          JSON.parse(
            String(row['membership_json']),
          ) as EvidenceV2ChainMembership,
      );
    },

    readEffectiveMemberships: readEffective,

    async putOccurrences(artifactId, instanceKey, occurrences) {
      if (occurrences.length === 0) return;
      await withPostgresDriverErrors(async () => {
        await withWriteTransaction(pool, async (client) => {
          // An occurrence is content-identified and immutable, so re-seeing one
          // is the same record rather than an update.
          await insertBatched(
            client,
            `${schema}.occurrences`,
            [
              'artifact_id',
              'occurrence_id',
              'instance_key',
              'part_id',
              'unit_id',
              'start_line',
              'end_line',
              'window_id',
              'execution_id',
              'authored_by',
              'record_json',
            ],
            occurrences.map((occurrence) => [
              artifactId,
              occurrence.occurrenceId,
              instanceKey,
              occurrence.partId,
              occurrence.unitId,
              occurrence.startLine,
              occurrence.endLine,
              occurrence.windowId,
              occurrence.executionId,
              occurrence.authoredBy ?? 'model',
              JSON.stringify(occurrence),
            ]),
            'ON CONFLICT (artifact_id, occurrence_id) DO NOTHING',
          );
        });
      });
    },

    async listOccurrences(artifactId, instanceKey, request) {
      return page(
        `${schema}.occurrences`,
        'WHERE artifact_id = $1 AND instance_key = $2',
        [artifactId, instanceKey],
        'start_line, occurrence_id',
        request,
        (row) => JSON.parse(String(row['record_json'])) as EvidenceV2Occurrence,
      );
    },

    async putExtractionWindow(state: EvidenceV2ExtractionWindowState) {
      await withPostgresDriverErrors(async () => {
        await pool.query(
          `INSERT INTO ${schema}.extraction_windows
             (artifact_id, instance_key, window_id, part_id, status,
              unit_count, occurrence_count, execution_id, failure_code, decided_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (artifact_id, instance_key, window_id) DO UPDATE SET
             status = EXCLUDED.status,
             occurrence_count = EXCLUDED.occurrence_count,
             execution_id = EXCLUDED.execution_id,
             failure_code = EXCLUDED.failure_code,
             decided_at = EXCLUDED.decided_at`,
          [
            state.artifactId,
            state.instanceKey,
            state.windowId,
            state.partId,
            state.status,
            state.unitCount,
            state.occurrenceCount,
            state.executionId,
            state.failureCode,
            state.decidedAt,
          ],
        );
      });
    },

    async readExtractionWindows(artifactId, instanceKey) {
      const rows = await rowsOf(
        pool,
        `SELECT * FROM ${schema}.extraction_windows
         WHERE artifact_id = $1 AND instance_key = $2 ORDER BY window_id`,
        [artifactId, instanceKey],
      );
      return rows.map((row) => ({
        artifactId: String(row['artifact_id']),
        instanceKey: String(row['instance_key']),
        windowId: String(row['window_id']),
        partId: String(row['part_id']),
        status: row['status'] === 'committed' ? 'committed' : 'failed',
        unitCount: toNumber(row['unit_count']),
        occurrenceCount: toNumber(row['occurrence_count']),
        executionId:
          typeof row['execution_id'] === 'string' ? row['execution_id'] : null,
        failureCode:
          typeof row['failure_code'] === 'string' ? row['failure_code'] : null,
        decidedAt: String(row['decided_at']),
      }));
    },

    async appendChainDecision(artifactId, decision: EvidenceV2ChainDecision) {
      await withPostgresDriverErrors(async () => {
        await withWriteTransaction(pool, async (client) => {
          await client.query(
            `INSERT INTO ${schema}.chain_decisions (decision_id, artifact_id, decision_json)
             VALUES ($1, $2, $3)`,
            [decision.decisionId, artifactId, JSON.stringify(decision)],
          );
          const decisionRows = await rowsOf(
            client,
            `SELECT decision_json FROM ${schema}.chain_decisions
             WHERE artifact_id = $1 ORDER BY appended_seq`,
            [artifactId],
          );
          const decisions = decisionRows.map(
            (row) =>
              JSON.parse(
                String(row['decision_json']),
              ) as EvidenceV2ChainDecision,
          );
          // The proposal is read, never written. The fold is the append-only
          // model's semantics, not a re-derivation of the structure.
          const proposal = await readProposal(client, artifactId);
          const state = deriveEvidenceV2ChainState(proposal, decisions);

          await client.query(
            `DELETE FROM ${schema}.effective_memberships WHERE artifact_id = $1`,
            [artifactId],
          );
          await insertBatched(
            client,
            `${schema}.effective_memberships`,
            ['artifact_id', 'chain_id', 'part_id', 'membership_json'],
            state.memberships.map((membership) => [
              artifactId,
              membership.chainId,
              membership.sourcePartId,
              JSON.stringify(membership),
            ]),
          );
        });
      });
    },

    async listChainDecisions(artifactId) {
      const rows = await rowsOf(
        pool,
        `SELECT decision_json FROM ${schema}.chain_decisions
         WHERE artifact_id = $1 ORDER BY appended_seq`,
        [artifactId],
      );
      return rows.map(
        (row) =>
          JSON.parse(String(row['decision_json'])) as EvidenceV2ChainDecision,
      );
    },

    /**
     * Append a review decision.
     *
     * INSERT only. The table takes no UPDATE and no DELETE anywhere in this
     * adapter, which is what makes "append-only" a property of the code rather
     * than a convention. An identical retry collides on the content-derived
     * decision id and is ignored, so a repeated submit does not double the log.
     */
    async appendReviewDecision(decision) {
      await withPostgresDriverErrors(async () => {
        await pool.query(
          `INSERT INTO ${schema}.review_decisions
             (artifact_id, decision_id, instance_key, occurrence_id, action,
              supersedes, principal, decided_at, decision_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (artifact_id, decision_id) DO NOTHING`,
          [
            decision.artifactId,
            decision.decisionId,
            decision.instanceKey,
            decision.occurrenceId,
            decision.action,
            decision.supersedes,
            decision.principal,
            decision.decidedAt,
            JSON.stringify(decision),
          ],
        );
      });
    },

    async listReviewDecisions(artifactId, instanceKey) {
      const rows = await rowsOf(
        pool,
        `SELECT decision_json FROM ${schema}.review_decisions
          WHERE artifact_id = $1 AND instance_key = $2
          ORDER BY appended_seq`,
        [artifactId, instanceKey],
      );
      return rows.map(
        (row) =>
          JSON.parse(String(row['decision_json'])) as EvidenceV2ReviewDecision,
      );
    },

    async readOccurrenceReviewHistory(artifactId, occurrenceId) {
      const rows = await rowsOf(
        pool,
        `SELECT decision_json FROM ${schema}.review_decisions
          WHERE artifact_id = $1 AND occurrence_id = $2
          ORDER BY appended_seq`,
        [artifactId, occurrenceId],
      );
      return rows.map(
        (row) =>
          JSON.parse(String(row['decision_json'])) as EvidenceV2ReviewDecision,
      );
    },

    async readExtractedInstanceKeys(artifactId) {
      const rows = await rowsOf(
        pool,
        `SELECT DISTINCT instance_key FROM ${schema}.extraction_windows
          WHERE artifact_id = $1 AND status = 'committed'
          ORDER BY instance_key`,
        [artifactId],
      );
      return rows.map((row) => String(row['instance_key']));
    },

    async createClaim(claim) {
      await withPostgresDriverErrors(async () => {
        await pool.query(
          `INSERT INTO ${schema}.claims
             (claim_id, case_id, label, created_at, record_json)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (claim_id) DO NOTHING`,
          [
            claim.claimId,
            claim.caseId,
            claim.label,
            claim.createdAt,
            JSON.stringify(claim),
          ],
        );
      });
    },

    async listClaims(caseId, page) {
      const rows = await rowsOf(
        pool,
        `SELECT record_json, count(*) OVER () AS total
           FROM ${schema}.claims
          WHERE case_id = $1
          ORDER BY created_at, claim_id
          OFFSET $2 LIMIT $3`,
        [caseId, page.offset, page.limit],
      );
      return {
        items: rows.map(
          (row) => JSON.parse(String(row['record_json'])) as EvidenceV2Claim,
        ),
        total: Number(rows[0]?.['total'] ?? 0),
        offset: page.offset,
        limit: page.limit,
      };
    },

    async readClaim(claimId) {
      const [row] = await rowsOf(
        pool,
        `SELECT record_json FROM ${schema}.claims WHERE claim_id = $1`,
        [claimId],
      );
      return row === undefined
        ? undefined
        : (JSON.parse(String(row['record_json'])) as EvidenceV2Claim);
    },

    /**
     * Append a grouping decision. INSERT only, like every decision log here:
     * an exclusion is a further row, never an update or a delete.
     */
    async appendClaimGrouping(decision) {
      await withPostgresDriverErrors(async () => {
        await pool.query(
          `INSERT INTO ${schema}.claim_groupings
             (claim_id, decision_id, case_id, artifact_id, instance_key,
              occurrence_id, action, supersedes, principal, decided_at,
              decision_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (claim_id, decision_id) DO NOTHING`,
          [
            decision.claimId,
            decision.decisionId,
            decision.caseId,
            decision.artifactId,
            decision.instanceKey,
            decision.occurrenceId,
            decision.action,
            decision.supersedes,
            decision.principal,
            decision.decidedAt,
            JSON.stringify(decision),
          ],
        );
      });
    },

    async listClaimGroupings(claimId) {
      const rows = await rowsOf(
        pool,
        `SELECT decision_json FROM ${schema}.claim_groupings
          WHERE claim_id = $1 ORDER BY appended_seq`,
        [claimId],
      );
      return rows.map(
        (row) =>
          JSON.parse(
            String(row['decision_json']),
          ) as EvidenceV2ClaimGroupingDecision,
      );
    },

    async readOccurrenceClaimIds(occurrenceId) {
      const rows = await rowsOf(
        pool,
        `SELECT decision_json FROM ${schema}.claim_groupings
          WHERE occurrence_id = $1 ORDER BY appended_seq`,
        [occurrenceId],
      );
      return rows.map(
        (row) =>
          JSON.parse(
            String(row['decision_json']),
          ) as EvidenceV2ClaimGroupingDecision,
      );
    },

    async readOccurrencesById(ids) {
      if (ids.length === 0) return [];
      const rows = await rowsOf(
        pool,
        `SELECT record_json FROM ${schema}.occurrences
          WHERE occurrence_id = ANY($1::text[])
          ORDER BY occurrence_id`,
        [[...ids]],
      );
      return rows.map(
        (row) => JSON.parse(String(row['record_json'])) as EvidenceV2Occurrence,
      );
    },

    /**
     * The case overview.
     *
     * Two statements: one aggregate pass over the case's stored rows, and one
     * bounded lookup for the resume pointer. Nothing is re-derived and no
     * snapshot is cloned (R-10). Every count is a `COUNT` over rows that exist,
     * not a sum of denormalized totals, so the surface reports what is
     * persisted rather than what an import once claimed.
     */
    async readCaseOverview(caseId) {
      const artifactIds = `SELECT artifact_id FROM ${schema}.artifacts WHERE case_id = $1`;
      const [totals] = await rowsOf(
        pool,
        `WITH scoped AS (${artifactIds}),
              latest AS (
                SELECT DISTINCT ON (artifact_id, occurrence_id) action
                  FROM ${schema}.review_decisions
                 WHERE artifact_id IN (SELECT artifact_id FROM scoped)
                 ORDER BY artifact_id, occurrence_id, appended_seq DESC
              ),
              current_grouping AS (
                SELECT DISTINCT ON (claim_id, occurrence_id)
                       claim_id, occurrence_id, instance_key, action
                  FROM ${schema}.claim_groupings
                 WHERE case_id = $1
                 ORDER BY claim_id, occurrence_id, appended_seq DESC
              )
         SELECT
           (SELECT count(*) FROM scoped) AS artifacts,
           (SELECT coalesce(sum(max_line), 0) FROM (
              SELECT max(end_line) AS max_line FROM ${schema}.source_parts
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)
              GROUP BY artifact_id) lines) AS lines,
           (SELECT count(*) FROM ${schema}.source_parts
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)) AS parts,
           (SELECT count(*) FROM ${schema}.citable_units
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)) AS citable_units,
           (SELECT count(*) FROM ${schema}.chains
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)) AS chains,
           (SELECT count(*) FROM ${schema}.chain_instances
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)) AS instances,
           (SELECT count(*) FROM ${schema}.occurrences
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)) AS occurrences,
           (SELECT count(*) FROM ${schema}.extraction_windows
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)
                AND status = 'committed') AS committed_windows,
           (SELECT count(*) FROM ${schema}.extraction_windows
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)
                AND status = 'failed') AS failed_windows,
           (SELECT count(*) FROM ${schema}.chain_decisions
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)) AS chain_decisions,
           (SELECT count(*) FROM ${schema}.review_decisions
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)) AS review_decisions,
           (SELECT count(*) FROM ${schema}.claims WHERE case_id = $1) AS claims,
           (SELECT count(*) FROM ${schema}.claim_groupings
              WHERE case_id = $1) AS claim_grouping_decisions,
           -- Grouped means currently included: the latest decision per
           -- (claim, occurrence) wins, exactly as the module folds it.
           (SELECT count(*) FROM current_grouping WHERE action = 'include')
             AS grouped_occurrences,
           (SELECT count(*) FROM (
              SELECT claim_id FROM current_grouping
               WHERE action = 'include'
               GROUP BY claim_id
              HAVING count(DISTINCT instance_key) > 1) spread)
             AS cross_instance_claims,
           (SELECT count(*) FROM ${schema}.occurrences
              WHERE artifact_id IN (SELECT artifact_id FROM scoped)
                AND authored_by = 'reviewer') AS reviewer_authored,
           -- Standing is folded from the log: the latest decision per
           -- occurrence wins, and an occurrence with none is pending.
           (SELECT count(*) FROM ${schema}.occurrences o
              WHERE o.artifact_id IN (SELECT artifact_id FROM scoped)
                AND NOT EXISTS (
                  SELECT 1 FROM ${schema}.review_decisions r
                  WHERE r.artifact_id = o.artifact_id
                    AND r.occurrence_id = o.occurrence_id)) AS pending,
           (SELECT count(*) FROM latest WHERE action = 'accept') AS accepted,
           (SELECT count(*) FROM latest WHERE action = 'reject') AS rejected,
           (SELECT count(*) FROM latest WHERE action = 'revise') AS needs_revision,
           (SELECT count(*) FROM ${schema}.chain_instances i
              WHERE i.artifact_id IN (SELECT artifact_id FROM scoped)
                AND EXISTS (
                  SELECT 1 FROM ${schema}.extraction_windows w
                  WHERE w.artifact_id = i.artifact_id
                    AND w.instance_key = i.instance_key
                    AND w.status = 'committed')
                AND EXISTS (
                  SELECT 1 FROM ${schema}.occurrences o
                  WHERE o.artifact_id = i.artifact_id
                    AND o.instance_key = i.instance_key
                    AND NOT EXISTS (
                      SELECT 1 FROM ${schema}.review_decisions r
                      WHERE r.artifact_id = o.artifact_id
                        AND r.occurrence_id = o.occurrence_id))) AS instances_pending_review,
           (SELECT count(*) FROM ${schema}.chain_instances i
              WHERE i.artifact_id IN (SELECT artifact_id FROM scoped)
                AND NOT EXISTS (
                  SELECT 1 FROM ${schema}.extraction_windows w
                  WHERE w.artifact_id = i.artifact_id
                    AND w.instance_key = i.instance_key
                    AND w.status = 'committed')) AS instances_without_extraction`,
        [caseId],
      );

      const [resume] = await rowsOf(
        pool,
        `WITH scoped AS (${artifactIds})
         SELECT i.artifact_id, i.chain_id, i.instance_key, i.instance_ordinal,
                c.subject_label
           FROM ${schema}.chain_instances i
           JOIN ${schema}.chains c
             ON c.artifact_id = i.artifact_id AND c.chain_id = i.chain_id
          WHERE i.artifact_id IN (SELECT artifact_id FROM scoped)
            AND NOT EXISTS (
              SELECT 1 FROM ${schema}.extraction_windows w
              WHERE w.artifact_id = i.artifact_id
                AND w.instance_key = i.instance_key
                AND w.status = 'committed')
          ORDER BY c.ordinal, i.instance_ordinal
          LIMIT 1`,
        [caseId],
      );

      const count = (name: string): number => Number(totals?.[name] ?? 0);
      const overview: EvidenceV2CaseOverview = {
        caseId,
        counts: {
          artifacts: count('artifacts'),
          lines: count('lines'),
          parts: count('parts'),
          citableUnits: count('citable_units'),
          chains: count('chains'),
          instances: count('instances'),
          occurrences: count('occurrences'),
          committedWindows: count('committed_windows'),
          failedWindows: count('failed_windows'),
          chainDecisions: count('chain_decisions'),
          reviewDecisions: count('review_decisions'),
          pending: count('pending'),
          accepted: count('accepted'),
          rejected: count('rejected'),
          needsRevision: count('needs_revision'),
          reviewerAuthored: count('reviewer_authored'),
          claims: count('claims'),
          claimGroupingDecisions: count('claim_grouping_decisions'),
          groupedOccurrences: count('grouped_occurrences'),
          crossInstanceClaims: count('cross_instance_claims'),
        },
        instancesWithoutExtraction: count('instances_without_extraction'),
        instancesPendingReview: count('instances_pending_review'),
        resumeAt:
          resume === undefined
            ? null
            : {
                artifactId: String(resume['artifact_id']),
                chainId: String(resume['chain_id']),
                instanceKey: String(resume['instance_key']),
                subjectLabel: String(resume['subject_label']),
                instanceOrdinal: Number(resume['instance_ordinal']),
              },
        unavailable: EVIDENCE_V2_SURFACE_GAPS,
      };
      return overview;
    },
  };
}
