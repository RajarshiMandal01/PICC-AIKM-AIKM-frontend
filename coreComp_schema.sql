-- =====================================================================
--  DB: CoreComp / NNP-RAG Schema  —  v1 creation script (PostgreSQL)
-- =====================================================================
--  Source ERD : D:\NNP\AI\DMS CoreComp Schema.pdf
--  Companion   : databaseschema.md  (column-by-column rationale)
--  Target      : PostgreSQL 13+  (built-in gen_random_uuid(); pgcrypto
--                extension also created for <13 compatibility)
--
-- ---------------------------------------------------------------------
--  V1 VALIDATION PHILOSOPHY  (read before editing)
-- ---------------------------------------------------------------------
--  This schema is intentionally PERMISSIVE. Data validation lives in the
--  UI / application layer, not the database, for v1. Concretely:
--
--    * NO  NOT NULL constraints on data columns.
--    * NO  CHECK constraints (status sets, rank ranges, score ranges,
--          database_type, etc. are all validated in the UI).
--    * NO  UNIQUE constraints. Where uniqueness matters (e.g. one row per
--          (bucket, database_name); one row per (bucket, milvus_source_id))
--          a PLAIN, non-unique index is provided for lookups, and the UI
--          is responsible for preventing duplicates.
--
--  The ONLY constraints retained are STRUCTURAL, not validation:
--    * PRIMARY KEY on each id (identity; also the FK target). By the SQL
--      standard a PK column is implicitly NOT NULL — this is the single
--      place NOT NULL is unavoidable.
--    * FOREIGN KEYs (referential integrity for the M:N + parent/child
--      relationships). All use ON DELETE CASCADE. FK columns are nullable
--      (a NULL FK simply means "unlinked").
--    * DEFAULTs are provided as conveniences (uuid generation, timestamps,
--      counters, status seed). A DEFAULT does not reject data — callers may
--      still insert NULL or any value.
--
--  When v1 stabilises, consider promoting the documented expectations
--  below (status value sets, rank 1..5, score 0..1, the dedup uniqueness)
--  into real DB constraints.
--
-- ---------------------------------------------------------------------
--  KEY DESIGN DECISIONS
-- ---------------------------------------------------------------------
--    * Primary keys : UUID via gen_random_uuid().
--    * VARCHAR(n)   : bounded fields keep an explicit length (data-shape
--                     documentation; in PostgreSQL there is no storage or
--                     speed difference vs TEXT). Free-form fields use TEXT.
--    * Account link : ACCOUNT_ID removed from nnp_km_buckets. Account<->bucket
--                     is many-to-many via nnp_account_bucket_map.
--    * Milvus name  : nnp_km_buckets.bucket_name DOUBLES AS the Milvus
--                     collection name (no separate column). See its comment
--                     for the naming rules the UI must enforce.
--    * SQL service  : nnp_km_database.connection_url replaces the ERD's
--                     SCHEMA_URL; the DATABESE_DESC typo is fixed to
--                     database_desc.
--    * updated_at   : maintained by the shared set_updated_at() trigger.
--
-- ---------------------------------------------------------------------
--  RESOLVED OPEN ITEMS (per stakeholder input)
-- ---------------------------------------------------------------------
--    * ACCOUNT_ID typed VARCHAR(64) (varchar, as requested).
--    * bucket_name holds the Milvus collection name.
--    * No CHECK on database_type.
--    * No NOT NULL / CHECK / UNIQUE constraints (UI-level validation).
--
--  STILL WORTH CONFIRMING LATER:
--    * Is PORTAL.NNP_ACCOUNT in the same Postgres DB? If yes, a real FK
--      could be added on nnp_account_bucket_map.account_id (currently none).
--    * Milvus collection naming/uniqueness is now UI-enforced — make sure
--      the UI validates the rules in bucket_name's comment.
--
-- ---------------------------------------------------------------------
--  CHANGELOG
-- ---------------------------------------------------------------------
--  v1.1 (2026-05-21, per Project_Input.txt — service design feedback):
--    * nnp_km_buckets    : added error_detail; status now created as
--                          PROVISIONING (async Milvus-provision callback
--                          flips it to ACTIVE/FAILED).
--    * nnp_bucket_details: added error_detail (async ingestion callback
--                          flips status PENDING -> INGESTED/FAILED).
--    * nnp_km_database   : added training_script (Vanna context); REMOVED
--                          credential_ref (credentials are supplied by the
--                          user at runtime, not stored).
--
--  v1.2 (2026-05-21):
--    * All objects moved into a dedicated schema "nnp-rag" (created up
--      front; set first on search_path). pgcrypto stays in public.
-- =====================================================================

-- pgcrypto provides gen_random_uuid() on PostgreSQL < 13 (built-in on 13+).
-- Created BEFORE the search_path switch so it lands in public and stays
-- resolvable for the UUID DEFAULTs below.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
--  SCHEMA: all CoreComp objects live in the dedicated schema "nnp-rag".
-- ---------------------------------------------------------------------
--  NOTE: the name contains a hyphen, so it is NOT a valid unquoted
--  identifier — it MUST be double-quoted ("nnp-rag") everywhere it is
--  referenced. Rather than schema-qualify every table/index/trigger/FK/
--  comment, we create the schema and put it first on the search_path, so
--  every object created below lands inside "nnp-rag" automatically.
--  public is kept on the path so gen_random_uuid() (pgcrypto) resolves.
--
--  Indexes and triggers are always created in the same schema as their
--  table, so search_path only needs to govern the tables and the trigger
--  function — both of which are created after this SET.
--
--  RUNTIME: application/DB connections should also run
--      SET search_path TO "nnp-rag", public;
--  (or qualify objects as "nnp-rag".<object>) so they see these tables.
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS "nnp-rag";
SET search_path TO "nnp-rag", public;

-- Shared trigger: refresh updated_at on every UPDATE -------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_updated_at() IS
    'BEFORE UPDATE trigger function: sets NEW.updated_at = now(). Shared by all mutable CoreComp tables.';


-- =====================================================================
-- 1. NNP_KM_BUCKETS  — top-level knowledge bucket
-- ---------------------------------------------------------------------
--  A bucket groups documents (nnp_bucket_details), curated Q&A
--  (nnp_km_qa) and registered databases (nnp_km_database). Account
--  ownership is many-to-many via nnp_account_bucket_map.
-- =====================================================================
CREATE TABLE nnp_km_buckets (
    id              uuid          DEFAULT gen_random_uuid(),  -- PK; see below
    bucket_category varchar(64),                              -- classification/grouping label
    bucket_name     varchar(255),                             -- ALSO the Milvus collection name (see comment)
    bucket_desc     text,                                     -- free-form description
    bucket_size     bigint        DEFAULT 0,                  -- denormalised aggregate bytes
    bucket_spec     text,                                     -- free-form spec (JSON-as-text acceptable)
    bucket_url      varchar(2048),                            -- optional external/Milvus pointer
    status          varchar(20)   DEFAULT 'PROVISIONING',     -- PROVISIONING->ACTIVE/FAILED (set by Milvus-provision callback); also INACTIVE/ARCHIVED/DELETED
    error_detail    text,                                     -- last error message (e.g. Milvus collection provisioning failure)
    created_at      timestamptz   DEFAULT now(),
    updated_at      timestamptz   DEFAULT now(),
    created_by      varchar(128),                             -- PORTAL user id (X-User-Name)
    updated_by      varchar(128),
    CONSTRAINT pk_nnp_km_buckets PRIMARY KEY (id)
);

COMMENT ON TABLE  nnp_km_buckets                 IS 'Top-level knowledge bucket. Account linkage is via nnp_account_bucket_map (many-to-many).';
COMMENT ON COLUMN nnp_km_buckets.id              IS 'Primary key (UUID). Implicitly NOT NULL as a PK.';
COMMENT ON COLUMN nnp_km_buckets.bucket_category IS 'Classification/grouping label shown as the "Bucket Category" dropdown in the UI. Free text in v1.';
COMMENT ON COLUMN nnp_km_buckets.bucket_name     IS 'Display name AND the Milvus collection name for this bucket. Milvus rules the UI MUST enforce: only letters/digits/underscores, must start with a letter or underscore, max 255 chars, and globally unique within the Milvus database. No DB CHECK/UNIQUE in v1.';
COMMENT ON COLUMN nnp_km_buckets.bucket_desc     IS 'Free-form bucket description.';
COMMENT ON COLUMN nnp_km_buckets.bucket_size     IS 'Denormalised total size (bytes) of documents in the bucket. Maintenance strategy TBD (trigger vs recompute).';
COMMENT ON COLUMN nnp_km_buckets.bucket_spec     IS 'Free-form bucket configuration stored as text (e.g. default top_k / similarity_threshold / source weights). Concrete shape TBD.';
COMMENT ON COLUMN nnp_km_buckets.bucket_url      IS 'Optional pointer (external schema doc or Milvus reference). Semantics TBD.';
COMMENT ON COLUMN nnp_km_buckets.status          IS 'Lifecycle state. Created as PROVISIONING; the async Milvus-provision callback flips it to ACTIVE (success) or FAILED (failure). Also INACTIVE/ARCHIVED/DELETED. Soft-delete is the intended delete mechanism. Validated in UI.';
COMMENT ON COLUMN nnp_km_buckets.error_detail    IS 'Last error message captured on failure (primarily Milvus collection provisioning). NULL when healthy.';
COMMENT ON COLUMN nnp_km_buckets.created_by      IS 'PORTAL user identifier that created the row (from the X-User-Name cookie/header).';
COMMENT ON COLUMN nnp_km_buckets.updated_by      IS 'PORTAL user identifier that last updated the row.';

CREATE INDEX ix_bucket_status ON nnp_km_buckets (status);
CREATE INDEX ix_bucket_name   ON nnp_km_buckets (bucket_name);   -- lookup by collection/display name (non-unique in v1)

CREATE TRIGGER trg_bucket_updated_at
    BEFORE UPDATE ON nnp_km_buckets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 2. NNP_ACCOUNT_BUCKET_MAP  — M:N between PORTAL accounts and buckets
-- ---------------------------------------------------------------------
--  Pure junction table: only the two key columns. A composite PRIMARY
--  KEY (account_id, bucket_id) is the table's entire purpose — it gives
--  each pair identity and prevents duplicate mappings. PK columns are
--  inherently NOT NULL (the one unavoidable NOT NULL in this schema).
--  No FK on account_id: ACCOUNT is owned by the external PORTAL layer.
-- =====================================================================
CREATE TABLE nnp_account_bucket_map (
    account_id  varchar(64),    -- -> PORTAL.NNP_ACCOUNT.ID (external; no FK)
    bucket_id   uuid REFERENCES nnp_km_buckets (id) ON DELETE CASCADE,
    CONSTRAINT pk_account_bucket_map PRIMARY KEY (account_id, bucket_id)
);

COMMENT ON TABLE  nnp_account_bucket_map            IS 'Many-to-many mapping of PORTAL accounts to knowledge buckets. Composite PK prevents duplicate pairs.';
COMMENT ON COLUMN nnp_account_bucket_map.account_id IS 'PORTAL.NNP_ACCOUNT.ID (varchar). No FK because ACCOUNT lives in the external PORTAL layer. Implicitly NOT NULL as part of the PK.';
COMMENT ON COLUMN nnp_account_bucket_map.bucket_id  IS 'FK -> nnp_km_buckets.id (ON DELETE CASCADE). Implicitly NOT NULL as part of the PK.';

-- PK indexes (account_id, bucket_id); add the reverse-direction lookup.
CREATE INDEX ix_abm_bucket ON nnp_account_bucket_map (bucket_id);


-- =====================================================================
-- 3. NNP_BUCKET_DETAILS  — one row per ingested document in a bucket
-- ---------------------------------------------------------------------
--  Display/metadata mirror of what the ingestion service wrote to Milvus.
--  The milvus_* columns enable round-tripping (delete_by_source) and
--  observability without querying Milvus directly.
-- =====================================================================
CREATE TABLE nnp_bucket_details (
    id                       uuid         DEFAULT gen_random_uuid(),
    bucket_id                uuid REFERENCES nnp_km_buckets (id) ON DELETE CASCADE,
    doc_category             varchar(32),                 -- document/web/git/gdrive/redmine/argocd
    doc_name                 varchar(512),                -- filename / URL / repo path
    description              text,
    format                   varchar(32),                 -- pdf/docx/yaml/json/html/...
    doc_size                 bigint,                      -- original bytes
    status                   varchar(20)  DEFAULT 'PENDING',  -- PENDING->INGESTED/FAILED (set by async ingestion callback); also DELETED
    error_detail             text,                            -- last error message (e.g. ingestion failure)
    -- Milvus round-trip / observability ------------------------------
    milvus_source_id         varchar(512),                -- ingestion service source_id
    milvus_chunks_stored     integer      DEFAULT 0,      -- details.vectors_stored
    milvus_chunks_duplicated integer      DEFAULT 0,      -- details.duplicates_skipped
    ingest_request_id        varchar(16),                 -- X-Request-ID (8 chars)
    ingested_at              timestamptz,                 -- successful ingest time
    -- audit ----------------------------------------------------------
    created_at               timestamptz  DEFAULT now(),
    updated_at               timestamptz  DEFAULT now(),
    created_by               varchar(128),
    updated_by               varchar(128),
    CONSTRAINT pk_nnp_bucket_details PRIMARY KEY (id)
);

COMMENT ON TABLE  nnp_bucket_details                          IS 'Display/metadata mirror of documents ingested into Milvus for a bucket.';
COMMENT ON COLUMN nnp_bucket_details.id                       IS 'Primary key (UUID).';
COMMENT ON COLUMN nnp_bucket_details.bucket_id                IS 'FK -> nnp_km_buckets.id (ON DELETE CASCADE).';
COMMENT ON COLUMN nnp_bucket_details.doc_category             IS 'Source type, aligned to the ingestion endpoints: document/web/git/gdrive/redmine/argocd. Free text in v1.';
COMMENT ON COLUMN nnp_bucket_details.doc_name                 IS 'Display name: filename for uploads, URL for web, repo path for git, etc.';
COMMENT ON COLUMN nnp_bucket_details.description              IS 'Optional human description/summary.';
COMMENT ON COLUMN nnp_bucket_details.format                  IS 'File format/extension (pdf/docx/yaml/yml/json/html/md/txt).';
COMMENT ON COLUMN nnp_bucket_details.doc_size                IS 'Original document size in bytes (pre-chunking).';
COMMENT ON COLUMN nnp_bucket_details.status                  IS 'Ingestion lifecycle. Created as PENDING; the async ingestion callback flips it to INGESTED (success) or FAILED (failure). Also DELETED. Validated in UI.';
COMMENT ON COLUMN nnp_bucket_details.error_detail            IS 'Last error message captured on ingestion failure. NULL when healthy.';
COMMENT ON COLUMN nnp_bucket_details.milvus_source_id        IS 'Ingestion service source_id (e.g. upload:<sha256>, google_drive://<id>, <repo>/<path>, <redmine_url>/issues/<id>). Enables delete_by_source round-trip.';
COMMENT ON COLUMN nnp_bucket_details.milvus_chunks_stored    IS 'Vectors actually written to Milvus (details.vectors_stored).';
COMMENT ON COLUMN nnp_bucket_details.milvus_chunks_duplicated IS 'Chunks skipped as duplicates (details.duplicates_skipped).';
COMMENT ON COLUMN nnp_bucket_details.ingest_request_id       IS 'Ingestion service X-Request-ID (8 chars) for backend log correlation.';
COMMENT ON COLUMN nnp_bucket_details.ingested_at             IS 'Timestamp of the successful ingest call (distinct from created_at if row created PENDING first).';

CREATE INDEX ix_bd_bucket        ON nnp_bucket_details (bucket_id);
CREATE INDEX ix_bd_bucket_status ON nnp_bucket_details (bucket_id, status);
CREATE INDEX ix_bd_bucket_cat    ON nnp_bucket_details (bucket_id, doc_category);
-- Dedup lookup helper (NON-unique in v1; UI prevents duplicate sources).
CREATE INDEX ix_bd_bucket_source ON nnp_bucket_details (bucket_id, milvus_source_id);

CREATE TRIGGER trg_bd_updated_at
    BEFORE UPDATE ON nnp_bucket_details
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 4. NNP_KM_QA  — curated Q&A pairs in a bucket
-- ---------------------------------------------------------------------
--  Pre-vetted answers. answer is PLAIN TEXT. rank is a user-supplied
--  1..5 (validated in UI).
-- =====================================================================
CREATE TABLE nnp_km_qa (
    id                    uuid        DEFAULT gen_random_uuid(),
    bucket_id             uuid REFERENCES nnp_km_buckets (id) ON DELETE CASCADE,
    question              text,
    answer                text,                            -- plain text
    rank                  smallint,                        -- user-supplied 1..5 (UI-validated)
    status                varchar(20) DEFAULT 'DRAFT',     -- expected DRAFT/PUBLISHED/ARCHIVED (UI-validated)
    -- optional matching / usage --------------------------------------
    question_embedding_id varchar(128),                    -- Milvus PK if the question is embedded
    match_threshold       numeric(4,3),                    -- expected 0..1 (UI-validated)
    times_matched         bigint      DEFAULT 0,
    -- audit ----------------------------------------------------------
    created_at            timestamptz DEFAULT now(),
    updated_at            timestamptz DEFAULT now(),
    created_by            varchar(128),
    updated_by            varchar(128),
    CONSTRAINT pk_nnp_km_qa PRIMARY KEY (id)
);

COMMENT ON TABLE  nnp_km_qa                       IS 'Curated, pre-vetted Q&A pairs scoped to a bucket.';
COMMENT ON COLUMN nnp_km_qa.id                    IS 'Primary key (UUID).';
COMMENT ON COLUMN nnp_km_qa.bucket_id             IS 'FK -> nnp_km_buckets.id (ON DELETE CASCADE).';
COMMENT ON COLUMN nnp_km_qa.question              IS 'Canonical question text.';
COMMENT ON COLUMN nnp_km_qa.answer                IS 'Curated answer, PLAIN TEXT (no HTML/Markdown rendering assumed).';
COMMENT ON COLUMN nnp_km_qa.rank                  IS 'User-supplied priority, expected 1..5. Validated in UI (no DB CHECK in v1).';
COMMENT ON COLUMN nnp_km_qa.status                IS 'Curation lifecycle. Expected DRAFT/PUBLISHED/ARCHIVED. Validated in UI.';
COMMENT ON COLUMN nnp_km_qa.question_embedding_id IS 'Milvus primary key if the question is also embedded for similarity short-circuiting.';
COMMENT ON COLUMN nnp_km_qa.match_threshold       IS 'Optional per-row similarity threshold (expected 0..1) above which this answer auto-returns.';
COMMENT ON COLUMN nnp_km_qa.times_matched         IS 'Usage counter: increment when this Q&A short-circuits a query.';

CREATE INDEX ix_qa_bucket        ON nnp_km_qa (bucket_id);
CREATE INDEX ix_qa_bucket_status ON nnp_km_qa (bucket_id, status);
CREATE INDEX ix_qa_bucket_rank   ON nnp_km_qa (bucket_id, rank);

CREATE TRIGGER trg_qa_updated_at
    BEFORE UPDATE ON nnp_km_qa
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 5. NNP_KM_DATABASE  — databases registered in a bucket
-- ---------------------------------------------------------------------
--  Per-bucket registry the SQL service can query. Replaces (eventually)
--  the hardcoded keyword routing in the SQL/observability service.
--  ERD's SCHEMA_URL dropped in favour of connection_url; DATABESE_DESC
--  typo fixed to database_desc.
-- =====================================================================
CREATE TABLE nnp_km_database (
    id             uuid         DEFAULT gen_random_uuid(),
    bucket_id      uuid REFERENCES nnp_km_buckets (id) ON DELETE CASCADE,
    database_name  varchar(255),                           -- logical name (matches metadata.database)
    database_type  varchar(32),                            -- postgres/clickhouse/mysql/... (no CHECK)
    database_desc  text,                                   -- (ERD typo DATABESE_DESC corrected)
    connection_url varchar(2048),                          -- credential-LESS; credentials supplied at runtime by the user
    training_script text,                                  -- Vanna context/training script for this database
    keywords       text[],                                 -- NL routing keywords
    status         varchar(20)  DEFAULT 'ACTIVE',          -- expected ACTIVE/INACTIVE/ARCHIVED/DELETED (UI-validated)
    created_at     timestamptz  DEFAULT now(),
    updated_at     timestamptz  DEFAULT now(),
    created_by     varchar(128),
    updated_by     varchar(128),
    CONSTRAINT pk_nnp_km_database PRIMARY KEY (id)
);

COMMENT ON TABLE  nnp_km_database                IS 'Per-bucket registry of databases the SQL/observability service can query.';
COMMENT ON COLUMN nnp_km_database.id             IS 'Primary key (UUID).';
COMMENT ON COLUMN nnp_km_database.bucket_id      IS 'FK -> nnp_km_buckets.id (ON DELETE CASCADE).';
COMMENT ON COLUMN nnp_km_database.database_name  IS 'Logical database name as known to the SQL service (e.g. nnp_devsecops, signoz_nnp). Matches metadata.database in query responses. Uniqueness per bucket is a UI responsibility in v1.';
COMMENT ON COLUMN nnp_km_database.database_type  IS 'Engine type (postgres/clickhouse/mysql/mongodb/signoz). No DB CHECK in v1; validated in UI.';
COMMENT ON COLUMN nnp_km_database.database_desc  IS 'Free-text description. (Corrects the ERD typo DATABESE_DESC.)';
COMMENT ON COLUMN nnp_km_database.connection_url  IS 'Credential-LESS connection/DSN/JDBC URL used to connect programmatically. NEVER embed username/password here (the service rejects user:pass@ URLs). Credentials are supplied by the user at connection time, not stored.';
COMMENT ON COLUMN nnp_km_database.training_script IS 'Script that provides schema/context to Vanna for NL->SQL generation. Consumed by the separate Vanna-interaction service, not by this CRUD service.';
COMMENT ON COLUMN nnp_km_database.keywords        IS 'Natural-language routing keywords; intended to replace DatabaseLoader.select_database hardcoding in the SQL service. GIN-indexed.';
COMMENT ON COLUMN nnp_km_database.status         IS 'Lifecycle state. Expected ACTIVE/INACTIVE/ARCHIVED/DELETED. Validated in UI.';

CREATE INDEX ix_db_bucket        ON nnp_km_database (bucket_id);
CREATE INDEX ix_db_bucket_status ON nnp_km_database (bucket_id, status);
CREATE INDEX ix_db_bucket_name   ON nnp_km_database (bucket_id, database_name);  -- non-unique in v1
CREATE INDEX ix_db_keywords      ON nnp_km_database USING gin (keywords);

CREATE TRIGGER trg_db_updated_at
    BEFORE UPDATE ON nnp_km_database
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 6. NNP_DATABASE_Q  — saved/curated queries per registered database
-- ---------------------------------------------------------------------
--  Powers the "Manage Specific Data Queries" UI and is the promotion
--  target for Milvus (question, SQL) exemplars. created_at/updated_at
--  added (absent from the ERD).
-- =====================================================================
CREATE TABLE nnp_database_q (
    id                 uuid         DEFAULT gen_random_uuid(),
    database_id        uuid REFERENCES nnp_km_database (id) ON DELETE CASCADE,
    query_name         varchar(255),
    query_desc         text,
    query_context      text,                               -- NL question or label (semantics TBD)
    query_text         text,                               -- the SQL
    status             varchar(20)  DEFAULT 'DRAFT',        -- expected DRAFT/PUBLISHED/ARCHIVED (UI-validated)
    rank               smallint,                            -- expected 1..5 (UI-validated)
    -- promotion / usage ----------------------------------------------
    milvus_exemplar_id varchar(128),                        -- source Milvus PK if promoted
    quality_score      numeric(3,2) DEFAULT 1.00,           -- expected 0..1 (UI-validated)
    times_used         bigint       DEFAULT 0,
    -- audit ----------------------------------------------------------
    created_at         timestamptz  DEFAULT now(),
    updated_at         timestamptz  DEFAULT now(),
    created_by         varchar(128),
    updated_by         varchar(128),
    CONSTRAINT pk_nnp_database_q PRIMARY KEY (id)
);

COMMENT ON TABLE  nnp_database_q                    IS 'Curated SQL queries per registered database; also the promotion target for Milvus (question,SQL) exemplars.';
COMMENT ON COLUMN nnp_database_q.id                 IS 'Primary key (UUID).';
COMMENT ON COLUMN nnp_database_q.database_id        IS 'FK -> nnp_km_database.id (ON DELETE CASCADE).';
COMMENT ON COLUMN nnp_database_q.query_name         IS 'Display name of the saved query.';
COMMENT ON COLUMN nnp_database_q.query_desc         IS 'Free-text description.';
COMMENT ON COLUMN nnp_database_q.query_context      IS 'Either the natural-language question (Vanna training pair) or a free-text label/grouping. Semantics to be finalised.';
COMMENT ON COLUMN nnp_database_q.query_text         IS 'The SQL query text.';
COMMENT ON COLUMN nnp_database_q.status             IS 'Curation lifecycle. Expected DRAFT/PUBLISHED/ARCHIVED. Validated in UI.';
COMMENT ON COLUMN nnp_database_q.rank               IS 'User-supplied priority, expected 1..5 (same scale as nnp_km_qa.rank). Validated in UI.';
COMMENT ON COLUMN nnp_database_q.milvus_exemplar_id IS 'If promoted from a SQL-service auto-exemplar, the source Milvus primary key.';
COMMENT ON COLUMN nnp_database_q.quality_score      IS 'Curated quality, expected 0..1. Default 1.00 distinguishes hand-curated from the 0.70 auto-captured exemplars in Milvus.';
COMMENT ON COLUMN nnp_database_q.times_used         IS 'Usage counter for most-used saved-query reporting.';

CREATE INDEX ix_dq_database        ON nnp_database_q (database_id);
CREATE INDEX ix_dq_database_status ON nnp_database_q (database_id, status);
CREATE INDEX ix_dq_database_rank   ON nnp_database_q (database_id, rank);

CREATE TRIGGER trg_dq_updated_at
    BEFORE UPDATE ON nnp_database_q
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
--  End of v1 schema.
-- =====================================================================
