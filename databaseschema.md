# DMS CoreComp / NNP-RAG Schema — Working Draft

**Source diagram:** `D:\NNP\AI\DMS CoreComp Schema.pdf` (single-page ERD titled *DB: CoreComp / NNP-RAG Schema*).
**Status:** Working draft built from the diagram + observed usage in the three sibling Python services and the Knowledge Management UI. Take this to leadership for review.

The diagram only shows **column names and PK/FK markers**. Everything else in this document — types, lengths, descriptions, recommended additions — is a best-guess synthesis from how the columns are referenced elsewhere in the codebase. Items that need confirmation are flagged in the **Status** column as either:

- ✅ **Confirmed** — appears in the diagram with clear semantics
- 🟡 **Best guess** — type/length inferred from usage; reasonable default but worth a sanity check
- 🔴 **More info required** — semantics not derivable from any source; needs a product/architecture decision before CREATE TABLE
- 🆕 **Recommended addition** — not in the diagram; suggested based on integration needs

Type recommendations assume **PostgreSQL** (matches the other CoreComp / NNP backend stores per the SQL service's database routing in `ai-sql-query-observability-service`). Switch to your team's standard if different.

---

## Entity overview

```
ACCOUNT (external — PORTAL.NNP_ACCOUNT)
   │
   └── NNP_KM_BUCKETS                          per-account "buckets"
          ├── NNP_BUCKET_DETAILS               documents in a bucket (ingestion service)
          ├── NNP_KM_QA                        curated Q&A in a bucket (query service)
          └── NNP_KM_DATABASE                  databases registered in a bucket
                 └── NNP_DATABASE_Q            saved queries per registered DB (SQL service)
```

Cardinalities (best-guess from diagram arrows):

- `ACCOUNT` 1—N `NNP_KM_BUCKETS`
- `NNP_KM_BUCKETS` 1—N `NNP_BUCKET_DETAILS`
- `NNP_KM_BUCKETS` 1—N `NNP_KM_QA`
- `NNP_KM_BUCKETS` 1—N `NNP_KM_DATABASE`
- `NNP_KM_DATABASE` 1—N `NNP_DATABASE_Q`

---

## 1. `ACCOUNT` (external — not owned by CoreComp)

The diagram annotation reads: *"To be mapped against PORTAL.NNP_ACCOUNT"*. CoreComp does not own this table — it only references it by FK from `NNP_KM_BUCKETS.ACCOUNT_ID`.

| Column | Type (best guess) | Description | Status |
|---|---|---|---|
| (all columns) | (defined by PORTAL) | Owned by the PORTAL layer; structure not in scope of CoreComp | ✅ Confirmed (external) |

**Decisions needed:**

- **A1.** What is the data type of `PORTAL.NNP_ACCOUNT.ID`? `NNP_KM_BUCKETS.ACCOUNT_ID` must match it exactly (likely `VARCHAR` based on `js-cookie` patterns in the UI, but could be `BIGINT` or `UUID`). 🔴
- **A2.** Is CoreComp meant to JOIN against `PORTAL.NNP_ACCOUNT` directly (same DB / cross-schema FK) or call PORTAL via an API and store only the ID? 🔴

---

## 2. `NNP_KM_BUCKETS`

Top-level grouping of knowledge per Account. A bucket is the container that holds documents (`NNP_BUCKET_DETAILS`), curated Q&A (`NNP_KM_QA`), and registered databases (`NNP_KM_DATABASE`).

| Column | Type (best guess) | Description | Status |
|---|---|---|---|
| `ID` | `UUID` *(or `BIGSERIAL`)* | Primary key. UUID is recommended so the UI can allocate IDs client-side without a round-trip; `BIGSERIAL` is fine if the team prefers DB-generated IDs | 🟡 Best guess |
| `ACCOUNT_ID` | (match PORTAL.NNP_ACCOUNT.ID — see A1) | FK to PORTAL account that owns the bucket | 🟡 Best guess (depends on A1) |
| `BUCKET_CATEGORY` | `VARCHAR(64)` | Classification of the bucket — likely one of a small enumerated set (Engineering / Operations / Customer Support / etc.). Reflected in the UI as the "Bucket Category" dropdown on `/dashboard` configure view | 🔴 More info required — is this a free-text category or an enum? If enum, what are the values? |
| `BUCKET_NAME` | `VARCHAR(255)` | Human-readable bucket name. Should be unique within an account (recommend `UNIQUE (ACCOUNT_ID, BUCKET_NAME)`) | 🟡 Best guess |
| `BUCKET_DESC` | `TEXT` | Free-text description shown in the UI's "Description" textarea | 🟡 Best guess |
| `BUCKET_SIZE` | `BIGINT` *(bytes)* | Aggregate size of all documents in this bucket. Likely denormalized for display — needs an update path (trigger on `NNP_BUCKET_DETAILS` insert/delete, or recomputed on read) | 🔴 More info required — is this computed/maintained by CoreComp, or just a free-form field set by ingestion? |
| `BUCKET_SPEC` | `JSONB` | Free-form bucket configuration — could hold things like default `top_k`, default `similarity_threshold`, allowed source types, weighting per source | 🔴 More info required — what's the intended shape? Needs a schema-within-a-schema definition |
| `BUCKET_URL` | `VARCHAR(2048)` | Likely a pointer to the Milvus collection backing this bucket (e.g. `milvus://nnp_knowledge_vector/ai_knowledge_base_embeddings__<bucket_id>`) — supports the multi-tenant-Milvus Open Decision (§8.3 of `CLAUDE.md`). Could also be an external schema/doc URL | 🔴 More info required — Milvus collection pointer, external doc, or both? |
| `STATUS` | `VARCHAR(32)` *(or ENUM)* | Lifecycle state — likely one of `ACTIVE`, `INACTIVE`, `ARCHIVED`, `DELETED`. Recommend a `CHECK` constraint | 🟡 Best guess — confirm the value set |
| `CREATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Row creation timestamp | ✅ Confirmed |
| `UPDATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Last-modified timestamp. Maintain via `BEFORE UPDATE` trigger | ✅ Confirmed |

**Recommended additions:**

| Column | Type | Description | Status |
|---|---|---|---|
| `ERROR_DETAIL` | `TEXT` | **Resolved v1.1 (new column):** last error message on failure, primarily Milvus collection provisioning. Set by the async provision callback alongside `STATUS='FAILED'` | ✅ In v1 schema |
| ~~`MILVUS_COLLECTION`~~ | — | **Not added.** `BUCKET_NAME` doubles as the Milvus collection name (resolved §11). The UI enforces Milvus naming rules + global uniqueness | ❌ Dropped |
| `CREATED_BY` / `UPDATED_BY` | `VARCHAR(128)` | Audit columns — user identifier from the PORTAL session (`X-User-Name` cookie, see `src/services/api.service.tsx`) | ✅ In v1 schema |

> **v1.1 note:** `STATUS` is created as `PROVISIONING` (not `ACTIVE`); the async Milvus-provision callback flips it to `ACTIVE` (success) or `FAILED` (failure).

**Indexes:** `(ACCOUNT_ID)`, `(ACCOUNT_ID, STATUS)`, `UNIQUE (ACCOUNT_ID, BUCKET_NAME)`.

---

## 3. `NNP_BUCKET_DETAILS`

One row per document ingested into a bucket. Mirrors what the ingestion service has put into Milvus, with display metadata kept here for the UI to list / sort / paginate without hitting Milvus.

| Column | Type (best guess) | Description | Status |
|---|---|---|---|
| `ID` | `UUID` *(or `BIGSERIAL`)* | Primary key | 🟡 Best guess |
| `BUCKET_ID` | `UUID` *(matches `NNP_KM_BUCKETS.ID`)* | FK to parent bucket | ✅ Confirmed (column exists; type derived from PK choice) |
| `DOC_CATEGORY` | `VARCHAR(64)` | Document source type — best aligned to the ingestion service's loader types: `document` / `web` / `git` / `gdrive` / `redmine` / `argocd`. Recommend a `CHECK` constraint matching the `/ingest/*` endpoint set | 🟡 Best guess — confirm the value set; could also be a finer-grained business category (e.g. "Policy", "Runbook", "Architecture") |
| `DOC_NAME` | `VARCHAR(512)` | Display name — filename for uploads, URL for web pages, repo path for git, etc. | 🟡 Best guess |
| `DESCRIPTION` | `TEXT` | Optional human-written description / summary | 🟡 Best guess |
| `FORMAT` | `VARCHAR(32)` | File format extension — `pdf` / `docx` / `yaml` / `yml` / `json` per the ingestion service's accepted types, plus `html` / `md` / `txt` for web | 🟡 Best guess |
| `DOC_SIZE` | `BIGINT` *(bytes)* | Original document size before chunking | 🟡 Best guess |
| `STATUS` | `VARCHAR(32)` *(or ENUM)* | Likely `PENDING` / `INGESTED` / `FAILED` / `DELETED`. Mirrors the ingestion lifecycle | 🟡 Best guess — confirm the value set |
| `CREATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Row creation timestamp | ✅ Confirmed |
| `UPDATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Last-modified timestamp | ✅ Confirmed |

**Recommended additions:**

| Column | Type | Description | Status |
|---|---|---|---|
| `MILVUS_SOURCE_ID` | `VARCHAR(512)` | The ingestion service's `source_id` (e.g. `upload:<sha256>`, `google_drive://<file_id>`, `<repo>/<path>`, `<redmine_url>/issues/<id>`). **Required for round-tripping with `pipeline.vector_store.delete_by_source(source)`** — without this column, the UI cannot delete vectors for a document it deleted from `NNP_BUCKET_DETAILS`. Worth raising in the next schema review (already noted in `CLAUDE.md` §3 Open Question 6) | 🆕 Recommended addition |
| `MILVUS_CHUNKS_STORED` | `INTEGER` | Number of chunks actually written to Milvus (from `details.vectors_stored` in the ingest response). Lets the UI show "<doc_name> — 47 chunks" without hitting `/stats` | 🆕 Recommended addition |
| `MILVUS_CHUNKS_DUPLICATED` | `INTEGER` | From `details.duplicates_skipped` — useful for diagnosing why a re-uploaded file added zero new vectors | 🆕 Recommended addition |
| `INGEST_REQUEST_ID` | `VARCHAR(16)` | The ingestion service's `X-Request-ID` (8-char per its middleware). Critical for correlating UI-side records with backend logs | ✅ In v1 schema |
| `INGESTED_AT` | `TIMESTAMPTZ` | Timestamp of the successful ingest call — distinct from `CREATED_AT` if the row is created in `PENDING` state before being submitted | ✅ In v1 schema |
| `ERROR_DETAIL` | `TEXT` | **Resolved v1.1 (new column):** last error message on ingestion failure. Set by the async ingestion callback alongside `STATUS='FAILED'` | ✅ In v1 schema |
| `CREATED_BY` / `UPDATED_BY` | `VARCHAR(128)` | Audit columns | ✅ In v1 schema |

> **v1.1 note:** `createBucketDetails` inserts `STATUS='PENDING'` then calls ingestion **asynchronously**; the ingestion callback flips it to `INGESTED`/`FAILED` and fills the `MILVUS_*` / `INGEST_REQUEST_ID` / `INGESTED_AT` / `ERROR_DETAIL` columns.

**Indexes:** `(BUCKET_ID)`, `(BUCKET_ID, STATUS)`, `(BUCKET_ID, DOC_CATEGORY)`, `UNIQUE (BUCKET_ID, MILVUS_SOURCE_ID)` if `MILVUS_SOURCE_ID` is added.

**Decisions needed:**

- **D1.** Should this table own the source-of-truth for "document exists in this bucket", or is Milvus the source of truth and this table is a cache? Affects whether deleting a row here should cascade to Milvus. 🔴
- **D2.** If a re-upload of the same content lands as `duplicates_skipped > 0, vectors_stored == 0`, do we still create a new `NNP_BUCKET_DETAILS` row, or just update the existing one? 🔴

---

## 4. `NNP_KM_QA`

Curated Question/Answer pairs within a bucket. These are pre-vetted answers — distinct from Milvus-retrieved chunks and from auto-collected SQL exemplars.

| Column | Type (best guess) | Description | Status |
|---|---|---|---|
| `ID` | `UUID` *(or `BIGSERIAL`)* | Primary key | 🟡 Best guess |
| `BUCKET_ID` | `UUID` *(matches `NNP_KM_BUCKETS.ID`)* | FK to parent bucket | ✅ Confirmed (column exists) |
| `QUESTION` | `TEXT` | The canonical question text. Long-form OK | ✅ Confirmed (column exists) |
| `ANSWER` | `TEXT` | The curated answer text. Probably Markdown — but **must be sanitised** before any `dangerouslySetInnerHTML` in the React UI (same XSS class as the legacy Streamlit `unsafe_allow_html=True` issue noted in `CLAUDE.md` §2.2) | 🟡 Best guess — confirm whether plain text, Markdown, or HTML |
| `RANK` | `INTEGER` | Display / weighting rank. Lower = higher priority, or vice versa. Used to order Q&A within a bucket and likely to weight matches against retrieved chunks | 🔴 More info required — what's the rank scheme (1 = best, higher = better, percentile)? Is it user-set or computed? |
| `STATUS` | `VARCHAR(32)` *(or ENUM)* | Likely `DRAFT` / `PUBLISHED` / `ARCHIVED` — curated content tends to have a review lifecycle | 🟡 Best guess — confirm the value set |
| `CREATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Row creation timestamp | ✅ Confirmed |
| `UPDATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Last-modified timestamp | ✅ Confirmed |

**Recommended additions:**

| Column | Type | Description | Status |
|---|---|---|---|
| `QUESTION_EMBEDDING_ID` | `VARCHAR(128)` | If Q&A pairs are also embedded into Milvus for similarity matching (so a user question can short-circuit to a curated answer), store the Milvus PK here | 🆕 Recommended addition |
| `MATCH_THRESHOLD` | `NUMERIC(4,3)` | Per-row similarity threshold above which this curated answer should be auto-returned (overrides bucket / global default) | 🆕 Recommended addition |
| `TIMES_MATCHED` | `BIGINT DEFAULT 0` | Usage counter — increment when this Q&A short-circuits a query. Useful for "most asked" reports | 🆕 Recommended addition |
| `CREATED_BY` / `UPDATED_BY` | `VARCHAR(128)` | Audit columns | 🆕 Recommended addition |

**Indexes:** `(BUCKET_ID)`, `(BUCKET_ID, STATUS)`, `(BUCKET_ID, RANK)`.

**Decisions needed:**

- **D3.** Consumption model: (a) pre-LLM short-circuit when the question matches, (b) weighted exemplars in the hybrid query, or (c) both? Affects whether `QUESTION` needs to be embedded into Milvus. 🔴
- **D4.** Are Q&A rows scoped per-account-per-bucket, or per-bucket only? (Currently per-bucket via the FK; bucket already belongs to one account so this is implicit, but worth confirming there's no plan to share Q&A across buckets.) 🔴

---

## 5. `NNP_KM_DATABASE`

Per-bucket registry of databases the SQL service can query. Should eventually replace the hardcoded `DatabaseLoader.select_database` keyword routing in `ai-sql-query-observability-service` (per `CLAUDE.md` §2.3).

| Column | Type (best guess) | Description | Status |
|---|---|---|---|
| `ID` | `UUID` *(or `BIGSERIAL`)* | Primary key | 🟡 Best guess |
| `BUCKET_ID` | `UUID` *(matches `NNP_KM_BUCKETS.ID`)* | FK to parent bucket | ✅ Confirmed (column exists) |
| `DATABASE_NAME` | `VARCHAR(255)` | The logical database name as known to the SQL service — e.g. `nnp_devsecops`, `nnp_apiecosystem`, `signoz_nnp`. Should match the `metadata.database` value in `POST /query` responses | ✅ Confirmed (column exists; semantics derivable from SQL service) |
| `DATABASE_TYPE` | `VARCHAR(32)` *(or ENUM)* | Engine type — `postgres` / `clickhouse` / `mysql` / `mongodb` / `signoz`. Drives connection-string parsing and which `Vanna` flavour to use. Recommend a `CHECK` constraint matching the SQL service's supported set | 🟡 Best guess — confirm the value set |
| `DATABESE_DESC` | `TEXT` | Free-text description (e.g. "Main production DB", "API gateway metrics"). **⚠ Column name is misspelled in the diagram** — should be `DATABASE_DESC` | 🔴 More info required — **fix the typo** before CREATE TABLE; otherwise propagates into every ORM model and API field forever |
| `SCHEMA_URL` | `VARCHAR(2048)` | Pointer to an external schema reference — could be a JDBC URL, a Confluence/Notion page, a DBML file URL, or an introspection endpoint. Loaded by the SQL service to inject schema hints into the SQL-generation prompt | 🔴 More info required — what's the intended consumer? Is this used for connection (with credentials elsewhere) or just for documentation? |
| `STATUS` | `VARCHAR(32)` *(or ENUM)* | Likely `ACTIVE` / `INACTIVE` / `TEST` / `DELETED` | 🟡 Best guess |
| `CREATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Row creation timestamp | ✅ Confirmed |
| `UPDATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Last-modified timestamp | ✅ Confirmed |

**Recommended additions:**

| Column | Type | Description | Status |
|---|---|---|---|
| `CONNECTION_URL` | `VARCHAR(2048)` | Credential-LESS JDBC / DSN-style connection URL (replaces the ERD's `SCHEMA_URL`). **Resolved v1.1:** credentials are NOT stored — the user supplies them at connection time (runtime). The service rejects any `user:pass@` URL | ✅ In v1 schema |
| `TRAINING_SCRIPT` | `TEXT` | **Resolved v1.1 (new column):** script that provides schema/context to Vanna for NL→SQL. Consumed by the separate Vanna-interaction service, not by the CRUD service | ✅ In v1 schema |
| ~~`CREDENTIAL_REF`~~ | — | **Removed in v1.1.** Credentials are runtime-supplied, not stored, so no secret-reference column is needed | ❌ Dropped |
| `KEYWORDS` | `TEXT[]` | Routing keywords for `DatabaseLoader.select_database` — replaces the hardcoded mapping in the SQL service. Per `CLAUDE.md` §2.3, `signoz_nnp` triggers on `signoz, observability, metrics, traces, logs, monitoring, cpu, memory, disk, ...` — storing these per-row lets ops add new databases without a code change | ✅ In v1 schema |
| `CREATED_BY` / `UPDATED_BY` | `VARCHAR(128)` | Audit columns | 🆕 Recommended addition |

**Indexes:** `(BUCKET_ID)`, `(BUCKET_ID, STATUS)`, `UNIQUE (BUCKET_ID, DATABASE_NAME)`.

**Decisions needed:**

- **D5.** Confirm the typo fix: `DATABESE_DESC` → `DATABASE_DESC`. 🔴
- **D6.** Where do credentials live? (Secret store + reference column is the safe default. Anything else is a security smell.) 🔴
- **D7.** Does `SCHEMA_URL` serve documentation only, or is it parsed by the SQL service for schema-hinting? 🔴

---

## 6. `NNP_DATABASE_Q`

Saved / curated queries per registered database. Powers the "Manage Specific Data Queries" table on the React `/sql-query` configure view, and is the natural home for promoting Milvus-stored `(question, SQL)` exemplars (the SQL service writes those at `quality_score: 0.7` per `CLAUDE.md` §2.3) into a curated set.

| Column | Type (best guess) | Description | Status |
|---|---|---|---|
| `ID` | `UUID` *(or `BIGSERIAL`)* | Primary key | 🟡 Best guess |
| `DATABASE_ID` | `UUID` *(matches `NNP_KM_DATABASE.ID`)* | FK to parent database | ✅ Confirmed (column exists) |
| `QUERY_NAME` | `VARCHAR(255)` | Display name — e.g. "Daily Active Users" | ✅ Confirmed (column exists) |
| `QUERY_DESC` | `TEXT` | Free-text description | ✅ Confirmed (column exists) |
| `QUERY_CONTEXT` | `TEXT` | Context / scope hint — likely the natural-language question this SQL answers, OR a tag like "Incident Repo" / "User DB". The mock data in `sqlquery.tsx` uses both interpretations | 🔴 More info required — is this the NL question (used as a Vanna training pair) or just a free-text label? Pick one |
| `QUERY_TEXT` | `TEXT` | The SQL query text. Render with `react-ace` (mode=sql) on edit | ✅ Confirmed (column exists) |
| `STATUS` | `VARCHAR(32)` *(or ENUM)* | Likely `DRAFT` / `PUBLISHED` / `ARCHIVED` — same as `NNP_KM_QA` lifecycle | 🟡 Best guess |
| `RANK` | `INTEGER` | Display / weighting rank — same semantics as `NNP_KM_QA.RANK` | 🔴 More info required — same as Q&A: what's the rank scheme? |

**Recommended additions:**

| Column | Type | Description | Status |
|---|---|---|---|
| `CREATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Row creation timestamp. **Missing from the diagram — almost certainly an oversight** since every other table has it | 🆕 Recommended addition (already flagged in `CLAUDE.md` §3 Open Question 3) |
| `UPDATED_AT` | `TIMESTAMPTZ DEFAULT NOW()` | Last-modified timestamp. **Same oversight** | 🆕 Recommended addition |
| `MILVUS_EXEMPLAR_ID` | `VARCHAR(128)` | If this row was promoted from a SQL service auto-exemplar (one of the `quality_score: 0.7` rows in `ai_knowledge_base_embeddings`), record the source Milvus PK. Lets the curation flow show "promoted from auto-capture" and skip re-embedding | 🆕 Recommended addition |
| `QUALITY_SCORE` | `NUMERIC(3,2)` | Curated-quality score (recommend `1.00` for hand-curated to distinguish from `0.70` auto-captured exemplars). Mirrors the field the SQL service already writes to Milvus | 🆕 Recommended addition |
| `TIMES_USED` | `BIGINT DEFAULT 0` | Usage counter for "most-used saved query" reports | 🆕 Recommended addition |
| `CREATED_BY` / `UPDATED_BY` | `VARCHAR(128)` | Audit columns | 🆕 Recommended addition |

**Indexes:** `(DATABASE_ID)`, `(DATABASE_ID, STATUS)`, `(DATABASE_ID, RANK)`.

**Decisions needed:**

- **D8.** Add `CREATED_AT` / `UPDATED_AT` (the only table missing them). 🆕
- **D9.** Confirm `QUERY_CONTEXT` semantics — NL question for Vanna training, or free-text label for UI grouping? Affects how the SQL service consumes this table. 🔴
- **D10.** When the SQL service auto-captures a `(question, SQL)` exemplar to Milvus at `quality_score: 0.7`, should the curation UI:
  - (a) show those alongside `NNP_DATABASE_Q` rows for promotion, or
  - (b) treat the two stores as independent, with `NNP_DATABASE_Q` as the canonical curated set? 🔴

---

## 7. Cross-cutting questions for leadership

Beyond the per-table items above, these affect the whole schema and should be decided up-front:

### 7.1 Primary-key strategy

| Option | Pros | Cons |
|---|---|---|
| `UUID` everywhere | Client-allocatable (no round-trip), globally unique, safe to expose in URLs | 16 bytes; index size ~2× of `BIGINT`; less human-readable in logs |
| `BIGSERIAL` everywhere | Compact, fast, human-readable | DB-allocated only; needs a round-trip; can leak row counts when exposed in URLs |
| Mixed (UUID for user-facing, BIGSERIAL for internal) | Best of both | Two patterns to learn; more code |

**Recommendation:** UUID for `NNP_KM_BUCKETS.ID` (gets exposed in URLs and ingestion request bodies), at the team's discretion for the rest.

### 7.2 STATUS value sets (D-CHECK)

Every table has a `STATUS` column with no defined value set. Pick one consistent vocabulary across all five tables and add `CHECK` constraints. Suggested defaults:

- Buckets / databases: `ACTIVE` / `INACTIVE` / `ARCHIVED` / `DELETED`
- Documents: `PENDING` / `INGESTED` / `FAILED` / `DELETED`
- Q&A / saved queries: `DRAFT` / `PUBLISHED` / `ARCHIVED`

### 7.3 Soft-delete vs hard-delete

Most rows have downstream effects (Milvus vectors, in-flight queries). Recommend **soft-delete** (`STATUS='DELETED'` + `DELETED_AT` timestamp) for everything except in clear DBA contexts.

### 7.4 Multi-tenant Milvus isolation

Open Decision §8.3 in `CLAUDE.md` — today the ingestion service and SQL service both write to a single `ai_knowledge_base_embeddings` collection. With CoreComp introducing per-account buckets, the two reasonable models are:

- **Per-bucket collection:** `ai_knowledge_base_embeddings__<bucket_id>`. Clean isolation; cleanest delete-by-bucket; collection-count grows with bucket-count.
- **Single collection with `bucket_id` filter column:** simpler ops; cheaper for small buckets; relies on every search adding a `bucket_id=$X` filter.

Whichever is chosen, the schema needs a column to record it — see the `MILVUS_COLLECTION` recommended addition on `NNP_KM_BUCKETS`.

### 7.5 Audit columns

None of the tables in the diagram have `CREATED_BY` / `UPDATED_BY`. The UI already has the identity in cookies (`X-User-Name`, see `src/services/api.service.tsx`); recommend adding these uniformly so audit / compliance can answer "who created this bucket".

### 7.6 No users / permissions tables in scope

The diagram shows no RBAC tables — Open Question 4 in `CLAUDE.md` §3. Confirm with PORTAL team whether:

- (a) authorization is entirely PORTAL's responsibility (CoreComp just trusts the `X-User-*` headers it receives), or
- (b) CoreComp needs its own role/permission tables (e.g. who can edit which bucket).

---

## 8. Quick reference — every column we have today

For a one-glance review:

| Table | Column | PK/FK | In diagram |
|---|---|---|---|
| `NNP_KM_BUCKETS` | `ID` | PK | ✅ |
| `NNP_KM_BUCKETS` | `ACCOUNT_ID` | FK → ACCOUNT | ✅ |
| `NNP_KM_BUCKETS` | `BUCKET_CATEGORY` | | ✅ |
| `NNP_KM_BUCKETS` | `BUCKET_NAME` | | ✅ |
| `NNP_KM_BUCKETS` | `BUCKET_DESC` | | ✅ |
| `NNP_KM_BUCKETS` | `BUCKET_SIZE` | | ✅ |
| `NNP_KM_BUCKETS` | `BUCKET_SPEC` | | ✅ |
| `NNP_KM_BUCKETS` | `BUCKET_URL` | | ✅ |
| `NNP_KM_BUCKETS` | `STATUS` | | ✅ |
| `NNP_KM_BUCKETS` | `CREATED_AT` | | ✅ |
| `NNP_KM_BUCKETS` | `UPDATED_AT` | | ✅ |
| `NNP_BUCKET_DETAILS` | `ID` | PK | ✅ |
| `NNP_BUCKET_DETAILS` | `BUCKET_ID` | FK → NNP_KM_BUCKETS | ✅ |
| `NNP_BUCKET_DETAILS` | `DOC_CATEGORY` | | ✅ |
| `NNP_BUCKET_DETAILS` | `DOC_NAME` | | ✅ |
| `NNP_BUCKET_DETAILS` | `DESCRIPTION` | | ✅ |
| `NNP_BUCKET_DETAILS` | `FORMAT` | | ✅ |
| `NNP_BUCKET_DETAILS` | `DOC_SIZE` | | ✅ |
| `NNP_BUCKET_DETAILS` | `STATUS` | | ✅ |
| `NNP_BUCKET_DETAILS` | `CREATED_AT` | | ✅ |
| `NNP_BUCKET_DETAILS` | `UPDATED_AT` | | ✅ |
| `NNP_KM_QA` | `ID` | PK | ✅ |
| `NNP_KM_QA` | `BUCKET_ID` | FK → NNP_KM_BUCKETS | ✅ |
| `NNP_KM_QA` | `QUESTION` | | ✅ |
| `NNP_KM_QA` | `ANSWER` | | ✅ |
| `NNP_KM_QA` | `RANK` | | ✅ |
| `NNP_KM_QA` | `STATUS` | | ✅ |
| `NNP_KM_QA` | `CREATED_AT` | | ✅ |
| `NNP_KM_QA` | `UPDATED_AT` | | ✅ |
| `NNP_KM_DATABASE` | `ID` | PK | ✅ |
| `NNP_KM_DATABASE` | `BUCKET_ID` | FK → NNP_KM_BUCKETS | ✅ |
| `NNP_KM_DATABASE` | `DATABASE_NAME` | | ✅ |
| `NNP_KM_DATABASE` | `DATABASE_TYPE` | | ✅ |
| `NNP_KM_DATABASE` | `DATABESE_DESC` ⚠ typo | | ✅ |
| `NNP_KM_DATABASE` | `SCHEMA_URL` | | ✅ |
| `NNP_KM_DATABASE` | `STATUS` | | ✅ |
| `NNP_KM_DATABASE` | `CREATED_AT` | | ✅ |
| `NNP_KM_DATABASE` | `UPDATED_AT` | | ✅ |
| `NNP_DATABASE_Q` | `ID` | PK | ✅ |
| `NNP_DATABASE_Q` | `DATABASE_ID` | FK → NNP_KM_DATABASE | ✅ |
| `NNP_DATABASE_Q` | `QUERY_NAME` | | ✅ |
| `NNP_DATABASE_Q` | `QUERY_DESC` | | ✅ |
| `NNP_DATABASE_Q` | `QUERY_CONTEXT` | | ✅ |
| `NNP_DATABASE_Q` | `QUERY_TEXT` | | ✅ |
| `NNP_DATABASE_Q` | `STATUS` | | ✅ |
| `NNP_DATABASE_Q` | `RANK` | | ✅ |
| `NNP_DATABASE_Q` | `CREATED_AT` | | ❌ — recommend adding |
| `NNP_DATABASE_Q` | `UPDATED_AT` | | ❌ — recommend adding |

---

## 9. Summary of decisions needed (single list for the meeting)

| # | Decision | Table | Priority |
|---|---|---|---|
| A1 | Data type of `PORTAL.NNP_ACCOUNT.ID` (drives `NNP_KM_BUCKETS.ACCOUNT_ID`) | ACCOUNT / NNP_KM_BUCKETS | 🔴 Blocker |
| A2 | CoreComp ↔ PORTAL integration model (cross-schema FK vs API call) | ACCOUNT | 🔴 Blocker |
| 2a | `BUCKET_CATEGORY` — free-text or enum (and the value set) | NNP_KM_BUCKETS | 🟡 |
| 2b | `BUCKET_SIZE` — computed / maintained / free-form | NNP_KM_BUCKETS | 🟡 |
| 2c | `BUCKET_SPEC` — intended JSON shape | NNP_KM_BUCKETS | 🟡 |
| 2d | `BUCKET_URL` — Milvus pointer vs external doc | NNP_KM_BUCKETS | 🟡 |
| D1 | NNP_BUCKET_DETAILS as source-of-truth or cache? | NNP_BUCKET_DETAILS | 🟡 |
| D2 | Re-upload of duplicate content — new row or update? | NNP_BUCKET_DETAILS | 🟡 |
| D3 | NNP_KM_QA consumption model (short-circuit / weighted / both) | NNP_KM_QA | 🟡 |
| D4 | Scope of Q&A rows (per-bucket only?) | NNP_KM_QA | 🟢 |
| D5 | Fix `DATABESE_DESC` → `DATABASE_DESC` typo | NNP_KM_DATABASE | 🔴 Blocker |
| D6 | Credentials storage model (secret store + ref) | NNP_KM_DATABASE | 🔴 Blocker |
| D7 | `SCHEMA_URL` purpose (documentation vs SQL-gen hint) | NNP_KM_DATABASE | 🟡 |
| D8 | Add `CREATED_AT` / `UPDATED_AT` to NNP_DATABASE_Q | NNP_DATABASE_Q | 🟡 |
| D9 | `QUERY_CONTEXT` semantics (NL question vs free-text label) | NNP_DATABASE_Q | 🟡 |
| D10 | Promotion flow for Milvus auto-exemplars | NNP_DATABASE_Q | 🟢 |
| 7.1 | Primary-key strategy (UUID / BIGSERIAL / mixed) | All | 🔴 Blocker |
| 7.2 | STATUS value sets per table | All | 🟡 |
| 7.3 | Soft-delete vs hard-delete | All | 🟡 |
| 7.4 | Multi-tenant Milvus isolation model | NNP_KM_BUCKETS | 🔴 Blocker |
| 7.5 | Audit columns (CREATED_BY / UPDATED_BY) | All | 🟡 |
| 7.6 | RBAC ownership (PORTAL only vs CoreComp tables) | (new tables) | 🔴 Blocker |

🔴 Blocker = needed before CREATE TABLE.  🟡 = needed before exposing the table to feature work.  🟢 = can defer.

---

*Last updated: 2026-05-20. Source: `D:\NNP\AI\DMS CoreComp Schema.pdf` + cross-references in `CLAUDE.md` §2, §3, §4, §10.*
