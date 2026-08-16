import {
  assertSchemaName,
  qIdent,
  withPostgresDriverErrors,
  withWriteTransaction,
} from '@acme/adapter-postgres';
import type {
  EvidenceV2ArtifactRecord,
  EvidenceV2CaseRecord,
  EvidenceV2ChainDetail,
  EvidenceV2ImportWrite,
  EvidenceV2Page,
  EvidenceV2PageRequest,
  EvidenceV2Repository,
} from '@acme/evidence-v2-contracts';
import {
  deriveEvidenceV2ChainState,
  type EvidenceV2Chain,
  type EvidenceV2ChainDecision,
  type EvidenceV2ChainMembership,
  type EvidenceV2ChainProposal,
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
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
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
  };
}
