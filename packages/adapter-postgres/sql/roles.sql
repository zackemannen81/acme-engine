-- ACME PostgreSQL roles and browser isolation (ADR-0033 sections 2–3).
-- Apply as a superuser / owner after migratePostgresSchema for both schemas.
-- Safe to re-run: uses IF NOT EXISTS / conditional grants where possible.

-- Engine role: owns/writes the acme schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acme_engine') THEN
    CREATE ROLE acme_engine NOINHERIT LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evidence_app') THEN
    CREATE ROLE evidence_app NOINHERIT LOGIN;
  END IF;
  -- Local/ephemeral gate role that stands in for the platform anon key.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOINHERIT NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOINHERIT NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA acme TO acme_engine;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA acme TO acme_engine;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA acme TO acme_engine;
ALTER DEFAULT PRIVILEGES IN SCHEMA acme
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO acme_engine;
ALTER DEFAULT PRIVILEGES IN SCHEMA acme
  GRANT USAGE, SELECT ON SEQUENCES TO acme_engine;

GRANT USAGE ON SCHEMA evidence TO evidence_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA evidence TO evidence_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA evidence TO evidence_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA evidence
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO evidence_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA evidence
  GRANT USAGE, SELECT ON SEQUENCES TO evidence_app;

-- Browser isolation: revoke from platform-facing roles and PUBLIC.
REVOKE ALL ON SCHEMA acme FROM PUBLIC;
REVOKE ALL ON SCHEMA evidence FROM PUBLIC;
REVOKE ALL ON SCHEMA acme FROM anon;
REVOKE ALL ON SCHEMA evidence FROM anon;
REVOKE ALL ON SCHEMA acme FROM authenticated;
REVOKE ALL ON SCHEMA evidence FROM authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA acme FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA evidence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA acme FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA evidence FROM PUBLIC, anon, authenticated;
