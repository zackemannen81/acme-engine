import {
  assertSchemaName,
  qIdent,
  type Migration,
} from '@acme/adapter-postgres';

/**
 * V2 product schema.
 *
 * Proposed and effective memberships are separate tables on purpose. A
 * decision must leave the proposal exactly as it was written at import, and
 * two tables make that structurally true rather than a promise.
 */
export function buildEvidenceV2Migrations(
  schemaName: string,
): readonly Migration[] {
  const s = qIdent(assertSchemaName(schemaName));
  return Object.freeze([
    Object.freeze({
      version: 1,
      name: 'evidence-v2-baseline',
      statements: Object.freeze([
        `CREATE TABLE ${s}.cases (
          case_id text PRIMARY KEY,
          case_reference text NOT NULL,
          created_at text NOT NULL,
          record_json text NOT NULL
        )`,
        `CREATE TABLE ${s}.artifacts (
          artifact_id text PRIMARY KEY,
          case_id text NOT NULL REFERENCES ${s}.cases(case_id),
          canonical_sha256 text NOT NULL,
          imported_at text NOT NULL,
          record_json text NOT NULL
        )`,
        `CREATE INDEX artifacts_by_case ON ${s}.artifacts (case_id, imported_at)`,
        `CREATE TABLE ${s}.source_parts (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          part_id text NOT NULL,
          ordinal integer NOT NULL,
          start_line integer NOT NULL,
          end_line integer NOT NULL,
          content_character text NOT NULL,
          title_text text,
          title_source_line integer,
          PRIMARY KEY (artifact_id, part_id)
        )`,
        `CREATE INDEX source_parts_by_ordinal ON ${s}.source_parts (artifact_id, ordinal)`,
        `CREATE TABLE ${s}.citable_units (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          unit_id text NOT NULL,
          part_id text NOT NULL,
          ordinal integer NOT NULL,
          start_line integer NOT NULL,
          end_line integer NOT NULL,
          exact_quote text NOT NULL,
          PRIMARY KEY (artifact_id, unit_id)
        )`,
        `CREATE INDEX citable_units_by_part ON ${s}.citable_units (artifact_id, part_id, ordinal)`,
        `CREATE TABLE ${s}.chains (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          chain_id text NOT NULL,
          ordinal integer NOT NULL,
          subject_label text NOT NULL,
          case_file_ref text,
          instance_count integer NOT NULL,
          PRIMARY KEY (artifact_id, chain_id)
        )`,
        `CREATE INDEX chains_by_subject ON ${s}.chains (artifact_id, subject_label)`,
        `CREATE TABLE ${s}.chain_instances (
          artifact_id text NOT NULL,
          chain_id text NOT NULL,
          instance_key text NOT NULL,
          instance_ordinal integer NOT NULL,
          ordered boolean NOT NULL,
          source_time_json text NOT NULL,
          source_part_ids_json text NOT NULL,
          PRIMARY KEY (artifact_id, chain_id, instance_key),
          FOREIGN KEY (artifact_id, chain_id)
            REFERENCES ${s}.chains(artifact_id, chain_id)
        )`,
        `CREATE TABLE ${s}.proposed_memberships (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          chain_id text NOT NULL,
          part_id text NOT NULL,
          membership_json text NOT NULL,
          PRIMARY KEY (artifact_id, chain_id, part_id)
        )`,
        `CREATE TABLE ${s}.effective_memberships (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          chain_id text NOT NULL,
          part_id text NOT NULL,
          membership_json text NOT NULL,
          PRIMARY KEY (artifact_id, chain_id, part_id)
        )`,
        `CREATE INDEX effective_memberships_by_part ON ${s}.effective_memberships (artifact_id, part_id)`,
        `CREATE TABLE ${s}.chain_decisions (
          decision_id text PRIMARY KEY,
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          appended_seq bigint GENERATED ALWAYS AS IDENTITY,
          decision_json text NOT NULL
        )`,
        `CREATE INDEX chain_decisions_by_artifact ON ${s}.chain_decisions (artifact_id, appended_seq)`,
        `CREATE TABLE ${s}.chain_diagnostics (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          ordinal integer NOT NULL,
          diagnostic_json text NOT NULL,
          PRIMARY KEY (artifact_id, ordinal)
        )`,
      ]),
    }),
    Object.freeze({
      version: 2,
      name: 'evidence-v2-occurrences',
      statements: Object.freeze([
        `CREATE TABLE ${s}.occurrences (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          occurrence_id text NOT NULL,
          instance_key text NOT NULL,
          part_id text NOT NULL,
          unit_id text NOT NULL,
          start_line integer NOT NULL,
          end_line integer NOT NULL,
          window_id text NOT NULL,
          execution_id text NOT NULL,
          record_json text NOT NULL,
          PRIMARY KEY (artifact_id, occurrence_id)
        )`,
        `CREATE INDEX occurrences_by_instance ON ${s}.occurrences (artifact_id, instance_key, start_line)`,
        `CREATE TABLE ${s}.extraction_windows (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          instance_key text NOT NULL,
          window_id text NOT NULL,
          part_id text NOT NULL,
          status text NOT NULL,
          unit_count integer NOT NULL,
          occurrence_count integer NOT NULL,
          execution_id text,
          failure_code text,
          decided_at text NOT NULL,
          PRIMARY KEY (artifact_id, instance_key, window_id)
        )`,
      ]),
    }),
    Object.freeze({
      version: 3,
      name: 'evidence-v2-review-standing',
      statements: Object.freeze([
        // Append-only. No UPDATE and no DELETE is ever issued against this
        // table: a reversal is a further row that supersedes its predecessor,
        // and effective standing is folded from the log on read.
        `CREATE TABLE ${s}.review_decisions (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          decision_id text NOT NULL,
          appended_seq bigserial NOT NULL,
          instance_key text NOT NULL,
          occurrence_id text NOT NULL,
          action text NOT NULL,
          supersedes text,
          principal text NOT NULL,
          decided_at text NOT NULL,
          decision_json text NOT NULL,
          PRIMARY KEY (artifact_id, decision_id)
        )`,
        `CREATE INDEX review_decisions_by_instance
           ON ${s}.review_decisions (artifact_id, instance_key, appended_seq)`,
        `CREATE INDEX review_decisions_by_occurrence
           ON ${s}.review_decisions (artifact_id, occurrence_id, appended_seq)`,
        // Authorship provenance for occurrences written before it existed:
        // they were all model-produced, which is what the default states.
        `ALTER TABLE ${s}.occurrences
           ADD COLUMN authored_by text NOT NULL DEFAULT 'model'`,
      ]),
    }),
    Object.freeze({
      version: 4,
      name: 'evidence-v2-claims',
      statements: Object.freeze([
        `CREATE TABLE ${s}.claims (
          claim_id text PRIMARY KEY,
          case_id text NOT NULL REFERENCES ${s}.cases(case_id),
          label text NOT NULL,
          created_at text NOT NULL,
          record_json text NOT NULL
        )`,
        `CREATE INDEX claims_by_case ON ${s}.claims (case_id, created_at)`,
        // Append-only, like every other decision log in this schema. A claim
        // never owns an occurrence, so there is no foreign key from an
        // occurrence to a claim — only decisions pointing the other way.
        `CREATE TABLE ${s}.claim_groupings (
          claim_id text NOT NULL REFERENCES ${s}.claims(claim_id),
          decision_id text NOT NULL,
          appended_seq bigserial NOT NULL,
          case_id text NOT NULL,
          artifact_id text NOT NULL,
          instance_key text NOT NULL,
          occurrence_id text NOT NULL,
          action text NOT NULL,
          supersedes text,
          principal text NOT NULL,
          decided_at text NOT NULL,
          decision_json text NOT NULL,
          PRIMARY KEY (claim_id, decision_id)
        )`,
        `CREATE INDEX claim_groupings_by_claim
           ON ${s}.claim_groupings (claim_id, appended_seq)`,
        `CREATE INDEX claim_groupings_by_occurrence
           ON ${s}.claim_groupings (occurrence_id, appended_seq)`,
      ]),
    }),
    Object.freeze({
      version: 5,
      name: 'evidence-v2-relations',
      statements: Object.freeze([
        `CREATE TABLE ${s}.relations (
          relation_id text PRIMARY KEY,
          case_id text NOT NULL REFERENCES ${s}.cases(case_id),
          artifact_id text NOT NULL,
          chain_id text NOT NULL,
          from_kind text NOT NULL,
          from_id text NOT NULL,
          to_kind text NOT NULL,
          to_id text NOT NULL,
          type text NOT NULL,
          provenance text NOT NULL,
          created_at text NOT NULL,
          record_json text NOT NULL
        )`,
        `CREATE INDEX relations_by_case ON ${s}.relations (case_id, created_at)`,
        `CREATE INDEX relations_by_chain ON ${s}.relations (artifact_id, chain_id, created_at)`,
        // Append-only. A reversal is a further row, never an update.
        `CREATE TABLE ${s}.relation_reviews (
          relation_id text NOT NULL REFERENCES ${s}.relations(relation_id),
          decision_id text NOT NULL,
          appended_seq bigserial NOT NULL,
          case_id text NOT NULL,
          action text NOT NULL,
          supersedes text,
          principal text NOT NULL,
          decided_at text NOT NULL,
          decision_json text NOT NULL,
          PRIMARY KEY (relation_id, decision_id)
        )`,
        `CREATE INDEX relation_reviews_by_relation
           ON ${s}.relation_reviews (relation_id, appended_seq)`,
        `CREATE TABLE ${s}.comparison_windows (
          artifact_id text NOT NULL REFERENCES ${s}.artifacts(artifact_id),
          instance_key text NOT NULL,
          window_id text NOT NULL,
          prior_instance_key text NOT NULL,
          status text NOT NULL,
          current_count integer NOT NULL,
          prior_count integer NOT NULL,
          relation_count integer NOT NULL,
          execution_id text,
          failure_code text,
          decided_at text NOT NULL,
          PRIMARY KEY (artifact_id, instance_key, window_id)
        )`,
        `CREATE INDEX comparison_windows_by_instance
           ON ${s}.comparison_windows (artifact_id, instance_key, decided_at)`,
      ]),
    }),
  ]);
}
