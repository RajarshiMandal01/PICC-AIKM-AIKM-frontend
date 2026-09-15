# CoreComp Services — Design (v1 draft for tech-lead review)

**Date:** 2026-05-24
**Scope:** The CRUD service layer that sits in front of the CoreComp / NNP-RAG schema (`coreComp_schema.sql`). Four services, derived table-by-table from the schema, to back the Knowledge Management React UI.
**Companion docs:** `coreComp_schema.sql` (DDL, source of truth) · `databaseschema.md` (column rationale) · `CLAUDE.md` §10 (React↔Streamlit screen map), §11 (finalised schema).

> This document reflects the **implemented** design of `ai-km-service` (as of v1.2). Endpoints, SQL, validation rules, and decisions are as built and tested. Open decisions are noted where they remain.

---

## 1. The four services at a glance

| # | Service | Backing table(s) | Functions | Drives which UI surface (per `CLAUDE.md` §10) |
|---|---|---|---|---|
| 1 | **manageBucket** | `nnp_km_buckets` + `nnp_account_bucket_map` | `getDetails(account_id)`, `createBucket()`, `updateBucket(id)`, `deleteBucket(id)`, + `provisionCallback()` *(async)* | `/dashboard` configure — bucket + assigned accounts |
| 2 | **manageBucketDetails** | `nnp_bucket_details` | `getDetails(bucket_id)`, `createBucketDetails()`, `updateBucketDetails(id)`, `deleteBucketDetail(id)`, + `ingestionCallback()` *(async)* | `/dashboard` configure — document/source upload tabs |
| 3 | **manageQuestions** | `nnp_km_qa` | `getDetails(bucket_ids)`, `addQDetails()`, `updateQDetails(id)`, `deleteQDetail(id)` | `/dashboard` — curated Q&A management |
| 4 | **manageDataSql** | `nnp_km_database` + `nnp_database_q` | `getDetails(bucket_ids)`, `addDBDetails()`, `updateDBDetails(id)`, `deleteDBDetail(id)`, `addSQLDetails()`, `updateSQLDetails(id)`, `deleteSQLDetail(id)` | `/sql-query` configure — data sources + saved queries |

Two services span **two tables** (manageBucket and manageDataSql); the other two are single-table.

Note the deliberate asymmetry in the read keys: service 1 reads by **`account_id`**, service 2 by a **single `bucket_id`**, services 3 & 4 by a **list of `bucket_ids`** (the Q&A and SQL surfaces fan out across several selected buckets at once).

---

## 2. Architecture decisions (proposed)

| # | Decision | Recommendation | Status |
|---|---|---|---|
| **A1** | Language / framework | **FastAPI (Python)** — matches the three sibling services; reuses their deployment/CI patterns | Confirm |
| **A2** | One service or four? | **One deployable** ("coreComp-api") with four routers/modules. They share one DB, one connection pool, one auth path, one image. Four separate microservices would be over-engineering for a shared table set | Confirm |
| **A3** | Endpoint style | **Verb-based** (`/manageBucket/getDetails/{account_id}`) — matches the supplied function names *and* existing NNP house style (`/getGroups`, `/publish` in the LCNC services) | Confirm |
| **A4** | Identity | `created_by` / `updated_by` taken from the PORTAL `User` / `X-User-Name` header — never from the request body | Confirm |
| **A5** | Validation ownership | The **service is the gatekeeper**. v1 DB is permissive (no `NOT NULL`/`CHECK`/`UNIQUE`), so the service must enforce required fields, status vocabularies, ranges (rank 1–5, score 0–1), and the Milvus naming rules | Locked by schema |
| **A6** | Soft-delete | Writes set `status='DELETED'`; reads filter `status <> 'DELETED'` unless `?includeDeleted=true` | Confirm |
| **A7** | Error contract | HTTP status code + body `{ "detail": str, "request_id": str }` + `X-Request-ID` response header — mirrors the ingestion service so log correlation is uniform across all backends | Confirm |
| **A8** | Success contract | Return the resource directly (object for writes, array for list reads). Keeps the React `ApiService` simple (it already does `response.json()` and returns data) | Confirm |
| **A9** | Transactions | Any function touching two tables runs in a single DB transaction (createBucket; cascade-style operations) | Locked |

---

## 3. Cross-cutting field conventions

For every table, these fields are **server-controlled** and must be ignored if sent by the client:

| Field | Source |
|---|---|
| `id` | DB default `gen_random_uuid()` |
| `created_at` | DB default `now()` |
| `updated_at` | DB default `now()` + `set_updated_at()` trigger |
| `created_by` | Auth header (on create) |
| `updated_by` | Auth header (on create and every update) |
| `status` (on create) | Defaults from schema (`ACTIVE` / `PENDING` / `DRAFT`); client may override only with a valid value |

All other columns are client-supplied. Status vocabularies the service must enforce (documented only as comments in the DB):

- **Buckets:** `PROVISIONING` / `ACTIVE` / `INACTIVE` / `ARCHIVED` / `FAILED` / `DELETED`
- **Databases:** `ACTIVE` / `INACTIVE` / `ARCHIVED` / `DELETED`
- **Documents:** `PENDING` / `INGESTED` / `FAILED` / `DELETED`
- **Q&A, saved queries:** `DRAFT` / `PUBLISHED` / `ARCHIVED` / `DELETED`

Note: buckets carry `PROVISIONING` and `FAILED` states (from the async provision flow) that databases do not. These are distinct vocabularies enforced separately in the service validators.

---

## 4. Service 1 — `manageBucket`

**Tables:** `nnp_km_buckets`, `nnp_account_bucket_map`.

### 4.1 `getDetails(account_id)` — all buckets for an account
```
GET /manageBucket/getDetails/{account_id}?includeDeleted=false
```
```sql
SELECT b.*
FROM   nnp_km_buckets b
JOIN   nnp_account_bucket_map m ON m.bucket_id = b.id
WHERE  m.account_id = :account_id
  AND  (:include_deleted OR b.status <> 'DELETED')
ORDER BY b.created_at DESC;
```
- Returns `200` + array (empty array, not 404, when none).
- A bucket may be shared across accounts (M:N) — expected.

### 4.2 `createBucket()` — create bucket **and** account link
```
POST /manageBucket/createBucket
```
Request:
```jsonc
{
  "account_id": "ACC123",          // required (for the map row)
  "bucket_name": "ops_runbooks",   // required; MUST pass Milvus-name validation
  "bucket_category": "Operations",
  "bucket_desc": "...",
  "bucket_spec": "...",            // free-form text
  "bucket_url": null
}
```
Logic — single transaction, then fire an **async** Milvus-provision call (createBucket is for **one** account):
```sql
BEGIN;
  INSERT INTO nnp_km_buckets
    (bucket_name, bucket_category, bucket_desc, bucket_spec, bucket_url,
     status, created_by, updated_by)
  VALUES (:bucket_name, :bucket_category, :bucket_desc, :bucket_spec, :bucket_url,
     'PROVISIONING', :user, :user)              -- NOT ACTIVE yet
  RETURNING id;
  INSERT INTO nnp_account_bucket_map (account_id, bucket_id)
  VALUES (:account_id, :new_id);
COMMIT;
-- then, fire-and-forget: call the Milvus-provision service with
-- {bucket_id, collection_name = bucket_name, callbackUrl}. Do NOT block.
```
- **Milvus provisioning is asynchronous (resolved):** a **separate provisioning service** creates the Milvus collection named after `bucket_name`. The bucket is inserted as `status='PROVISIONING'`; the provision service calls back (§4.5) to flip it to `ACTIVE` or `FAILED`, writing any error to `error_detail`.
- Validation: `bucket_name` non-empty + matches `^[A-Za-z_][A-Za-z0-9_]{0,254}$` + globally unique (it IS the Milvus collection name). `account_id` present.
- Responses: `202 Accepted` (created, provisioning in flight) · `409` (name clash) · `422` (bad name). Use `202` rather than `201` to signal the bucket isn't usable until the callback lands.

### 4.3 `updateBucket(id)` — update attributes **and** account mapping
```
PUT /manageBucket/updateBucket/{id}
```
Request (any subset; `account_ids` optional):
```jsonc
{
  "bucket_category": "...", "bucket_desc": "...", "bucket_spec": "...",
  "bucket_url": null, "status": "ACTIVE",
  "account_ids": ["ACC123", "ACC777"]   // if present, REPLACE the bucket's account set
}
```
Attribute update:
```sql
UPDATE nnp_km_buckets
SET bucket_category=:c, bucket_desc=:d, bucket_spec=:s,
    bucket_url=:u, status=:st, updated_by=:user
WHERE id=:id;            -- updated_at handled by trigger
```
Account remap (**resolved** — updateBucket maps one bucket to many accounts / changes existing mappings). When `account_ids` is supplied, sync the M:N map in the same transaction:
```sql
-- add the new ones
INSERT INTO nnp_account_bucket_map (account_id, bucket_id)
SELECT unnest(:account_ids), :id
ON CONFLICT (account_id, bucket_id) DO NOTHING;
-- remove the ones no longer listed
DELETE FROM nnp_account_bucket_map
WHERE bucket_id = :id AND account_id <> ALL(:account_ids);
```
- **`bucket_name` is immutable** — it's the live Milvus collection name; renaming would orphan vectors. `updateBucket` ignores any `bucket_name` in the body. → Decision **D3** (locked).
- `200` + updated row; `404` if missing.

### 4.4 `deleteBucket(id)` — soft-delete a bucket
```
DELETE /manageBucket/deleteBucket/{id}
```
```sql
UPDATE nnp_km_buckets SET status = 'DELETED' WHERE id = :id RETURNING *;
```
- `200` + deleted row; `404` if not found.
- When `PROVISION_ENABLED` (and `PROVISION_DELETE_URL` is set), fires an async background task calling the provision service to remove the Milvus collection named `bucket_name`. With the flag off, the bucket row is soft-deleted in Postgres only (the Milvus collection must be cleaned up manually).
- The `nnp_account_bucket_map` rows are **not** removed — account→bucket history is preserved. The bucket simply filters out of `getDetails` reads (`status <> 'DELETED'`).

### 4.5 `provisionCallback()` — receive the Milvus-provision result *(supports the async flow)*
```
POST /manageBucket/provisionCallback
```
```jsonc
{ "bucket_id": "<uuid>", "status": "ACTIVE",  "error_detail": null }
// or
{ "bucket_id": "<uuid>", "status": "FAILED", "error_detail": "milvus: collection exists" }
```
```sql
UPDATE nnp_km_buckets
SET status = :status, error_detail = :error_detail
WHERE id = :bucket_id;
```
Called by the provisioning service. Secure it (shared secret / internal-only network) since it mutates status.

---

## 5. Service 2 — `manageBucketDetails`

**Table:** `nnp_bucket_details` (FK `bucket_id` → `nnp_km_buckets`). This table is the display/metadata mirror of what the **ingestion service** writes to Milvus.

### 5.1 `getDetails(bucket_id)` — all documents in a bucket
```
GET /manageBucketDetails/getDetails/{bucket_id}?includeDeleted=false&category=&status=
```
```sql
SELECT *
FROM   nnp_bucket_details
WHERE  bucket_id = :bucket_id
  AND  (:include_deleted OR status <> 'DELETED')
  AND  (:category IS NULL OR doc_category = :category)
  AND  (:status   IS NULL OR status = :status)
ORDER BY created_at DESC;
```
Optional `category` / `status` filters back the per-tab document lists (Documents / Web / Git / GDrive / Redmine).

### 5.2 `createBucketDetails()` — register a document row
```
POST /manageBucketDetails/createBucketDetails
```
Request:
```jsonc
{
  "bucket_id": "<uuid>",           // required
  "doc_category": "document",      // document/web/git/gdrive/redmine/argocd
  "doc_name": "runbook.pdf",
  "description": "...",
  "format": "pdf",
  "doc_size": 51234,
  "status": "PENDING",
  // populated from the ingestion response when available:
  "milvus_source_id": "upload:<sha256>",
  "milvus_chunks_stored": 0,
  "milvus_chunks_duplicated": 0,
  "ingest_request_id": "a1b2c3d4",
  "ingested_at": null
}
```
- **Resolved (async, Pattern B):** `createBucketDetails` inserts the row as `status='PENDING'` and then calls the **ingestion API asynchronously**. The ingestion side calls back (§5.5) to flip `status` → `INGESTED` / `FAILED`, populate the `milvus_*` columns + `ingest_request_id`, and write `error_detail` on failure.
```sql
INSERT INTO nnp_bucket_details
  (bucket_id, doc_category, doc_name, description, format, doc_size,
   status, created_by, updated_by)
VALUES (:bucket_id, :doc_category, :doc_name, :description, :format, :doc_size,
   'PENDING', :user, :user)
RETURNING id;
-- then fire-and-forget the ingestion call with {detail_id, source params, callbackUrl}
```
- Response: `202 Accepted` (row created, ingestion in flight).

### 5.3 `updateBucketDetails(id)` — update / re-ingest a document row
```
PUT /manageBucketDetails/updateBucketDetails/{id}
```
- Edits `description` / `status`, or re-runs ingestion. **Resolved:** must support **updating vectors** — on a re-ingest (`reingest=true`), fire the ingestion call again (async + callback) and refresh the `milvus_*` columns.
- Setting `status='DELETED'` via this endpoint also triggers the Milvus vector removal (same side-effect as the dedicated `deleteBucketDetail` endpoint below). Prefer the explicit DELETE verb for soft-deletes.

### 5.4 `deleteBucketDetail(id)` — soft-delete a document row
```
DELETE /manageBucketDetails/deleteBucketDetail/{id}
```
```sql
UPDATE nnp_bucket_details SET status = 'DELETED' WHERE id = :id RETURNING *;
```
- `200` + deleted row; `404` if not found.
- When `INGESTION_ENABLED` and the row has a non-null `milvus_source_id`, fires an async background task calling `delete_by_source(milvus_source_id)` on the ingestion service to remove the vectors from Milvus. The client side (`INGESTION_DELETE_URL`) is implemented; the ingestion service must expose this as an HTTP endpoint (see §8).

### 5.5 `ingestionCallback()` — receive the ingestion result *(supports the async flow)*
```
POST /manageBucketDetails/ingestionCallback
```
```jsonc
{
  "id": "<detail-uuid>", "status": "INGESTED",
  "milvus_source_id": "upload:<sha256>",
  "milvus_chunks_stored": 47, "milvus_chunks_duplicated": 3,
  "ingest_request_id": "a1b2c3d4", "ingested_at": "2026-05-21T10:00:00Z",
  "error_detail": null
}
```
```sql
UPDATE nnp_bucket_details
SET status=:status, milvus_source_id=:src, milvus_chunks_stored=:stored,
    milvus_chunks_duplicated=:dups, ingest_request_id=:rid,
    ingested_at=:ts, error_detail=:err
WHERE id=:id;
```

---

## 6. Service 3 — `manageQuestions`

**Table:** `nnp_km_qa` (FK `bucket_id` → `nnp_km_buckets`). Curated, pre-vetted Q&A. `answer` is plain text; `rank` is 1–5.

### 6.1 `getDetails(bucket_ids)` — Q&A across one or more buckets
```
GET /manageQuestions/getDetails?bucketIds=<uuid1>,<uuid2>&includeDeleted=false
```
```sql
SELECT *
FROM   nnp_km_qa
WHERE  bucket_id = ANY(:bucket_ids)
  AND  (:include_deleted OR status <> 'DELETED')
ORDER BY bucket_id, rank;
```
- `bucketIds` is a comma-separated list → `bucket_id = ANY(...)`.
- Plural because the KB query surface can span multiple selected buckets.

### 6.2 `addQDetails()` — create a Q&A pair
```
POST /manageQuestions/addQDetails
```
Request:
```jsonc
{
  "bucket_id": "<uuid>",   // required
  "question": "...",       // required
  "answer": "...",         // required, plain text
  "rank": 3,               // 1..5 (service-validated)
  "status": "DRAFT",
  "match_threshold": 0.85  // optional, 0..1
}
```
- Validation: `rank` ∈ 1..5; `match_threshold` ∈ 0..1 if present; `status` in vocabulary.
- **Embedding (resolved):** this service does **not** embed questions. Embedding into Milvus is handled by a **separate process**, so `question_embedding_id` stays `null` at creation time and is populated later by that process. No coupling to an embedding step here.

### 6.3 `updateQDetails(id)` — update a Q&A pair
```
PUT /manageQuestions/updateQDetails/{id}
```
- Updates `question` / `answer` / `rank` / `status` / `match_threshold`.
- Re-embedding on question change is **not** this service's concern — the separate embedding process owns `question_embedding_id`.
- `times_matched` is a counter — incremented by the query path, not by this update.

### 6.4 `deleteQDetail(id)` — soft-delete a Q&A pair
```
DELETE /manageQuestions/deleteQDetail/{id}
```
```sql
UPDATE nnp_km_qa SET status = 'DELETED' WHERE id = :id RETURNING *;
```
- `200` + deleted row; `404` if not found. No Milvus side-effect — embedding clean-up is the separate embedding process's concern.

---

## 7. Service 4 — `manageDataSql`

**Tables:** `nnp_km_database` (parent) + `nnp_database_q` (child, FK `database_id`). This service manages **both** registered databases and their saved queries, hence five functions. **This service does NOT interact with Milvus.** Vanna context lives in `nnp_km_database.training_script` and is consumed by a separate Vanna-interaction service (which will need updating to read it).

### 7.1 `getDetails(bucket_ids)` — databases **with** their saved queries
```
GET /manageDataSql/getDetails?bucketIds=<uuid1>,<uuid2>&includeDeleted=false
```
Two-step (or join + assemble), returning databases each with a nested `queries[]`:
```sql
-- databases in the selected buckets
SELECT * FROM nnp_km_database
WHERE bucket_id = ANY(:bucket_ids)
  AND (:include_deleted OR status <> 'DELETED');

-- their saved queries
SELECT * FROM nnp_database_q
WHERE database_id = ANY(:db_ids)
  AND (:include_deleted OR status <> 'DELETED')
ORDER BY database_id, rank;
```
Response shape:
```jsonc
[
  {
    "id": "<db-uuid>", "database_name": "nnp_devsecops", "database_type": "postgres",
    "database_desc": "...", "connection_url": "...", "training_script": "...",
    "keywords": ["devsecops","pipeline"], "status": "ACTIVE",
    "queries": [
      { "id": "<q-uuid>", "query_name": "Daily signups", "query_text": "SELECT ...",
        "query_context": "...", "rank": 2, "status": "PUBLISHED", "quality_score": 1.00 }
    ]
  }
]
```

### 7.2 `addDBDetails()` — register a database
```
POST /manageDataSql/addDBDetails
```
Request:
```jsonc
{
  "bucket_id": "<uuid>",          // required
  "database_name": "nnp_devsecops",
  "database_type": "postgres",    // no DB CHECK; service validates if A-list agreed
  "database_desc": "...",
  "connection_url": "postgresql://host:5432/db",  // credential-LESS (no user:pass@)
  "training_script": "-- Vanna context for this DB ...",
  "keywords": ["devsecops","pipeline","ci","cd"],
  "status": "ACTIVE"
}
```
- **Security (resolved):** the service **rejects** any `connection_url` containing inline credentials (`user:pass@`) → `422`. Credentials are **not stored** at all — the user supplies them at connection time, at runtime. (The `credential_ref` column has been removed from the schema.)
- `training_script` holds the Vanna context for this database; written here, consumed by the separate Vanna service.
- `keywords` feeds future routing (replaces hardcoded `DatabaseLoader.select_database` in the SQL service).

### 7.3 `updateDBDetails(id)` — update a database registration
```
PUT /manageDataSql/updateDBDetails/{id}
```
- Updates name/type/desc/connection_url/training_script/keywords/status. Same inline-credential rejection rule as 7.2.

### 7.4 `addSQLDetails()` — create a saved query under a database
```
POST /manageDataSql/addSQLDetails
```
Request:
```jsonc
{
  "database_id": "<db-uuid>",     // required — FK to nnp_km_database, NOT bucket_id
  "query_name": "Daily signups",
  "query_desc": "...",
  "query_context": "...",         // NL question or label (semantics TBD — D10)
  "query_text": "SELECT ...",
  "rank": 2,                      // 1..5
  "status": "DRAFT",
  "milvus_exemplar_id": null,     // set if promoted from a SQL-service auto-exemplar
  "quality_score": 1.00           // 0..1; 1.00 = hand-curated
}
```
- Note the parent key here is **`database_id`**, not `bucket_id`.
- **Promotion flow (Decision D11):** the SQL service auto-saves successful `(question, SQL)` pairs to Milvus at `quality_score 0.7`. This function is the promotion target — when a user promotes one, pass its Milvus PK as `milvus_exemplar_id` and `quality_score 1.00`.

### 7.5 `updateSQLDetails(id)` — update a saved query
```
PUT /manageDataSql/updateSQLDetails/{id}
```
- Updates name/desc/context/text/rank/status/quality_score.
- `times_used` is incremented by the query path, not here.

### 7.6 `deleteDBDetail(id)` — soft-delete a registered database
```
DELETE /manageDataSql/deleteDBDetail/{id}
```
```sql
UPDATE nnp_km_database SET status = 'DELETED' WHERE id = :id RETURNING *;
```
- `200` + deleted row; `404` if not found. No Milvus side-effect. Child `nnp_database_q` rows are not cascade-deleted; they remain queryable (with `includeDeleted=true`) and should be managed separately if clean-up is needed.

### 7.7 `deleteSQLDetail(id)` — soft-delete a saved query
```
DELETE /manageDataSql/deleteSQLDetail/{id}
```
```sql
UPDATE nnp_database_q SET status = 'DELETED' WHERE id = :id RETURNING *;
```
- `200` + deleted row; `404` if not found. No Milvus side-effect.

---

## 8. Integration touchpoints with the three existing backends

The CoreComp services are CRUD over Postgres, but three of them coordinate with the existing Python services:

| CoreComp service | Talks to | For what | Mode |
|---|---|---|---|
| manageBucket | **separate Milvus-provision service** | create the collection on `createBucket` (result via `provisionCallback` §4.5); remove the collection on `deleteBucket` (`PROVISION_DELETE_URL`) | **async + callback** |
| manageBucketDetails | ingestion service | `createBucketDetails` / re-ingest fire the ingest call; result via `ingestionCallback` (§5.5). `deleteBucketDetail` (§5.4) fires `delete_by_source(milvus_source_id)` — **ingestion service must expose this as an HTTP endpoint** (`INGESTION_DELETE_URL`); our client side is ready | **async + callback** |
| manageQuestions | — | none. Question embedding is done by a **separate process**, not this service | n/a |
| manageDataSql | **separate Vanna-interaction service** | that service reads `training_script` for NL→SQL context. manageDataSql itself does **no** Milvus and **no** Vanna calls — it only persists | n/a (decoupled) |

Gaps to flag to the sibling-repo owners:
- The **Milvus-provision service** and its callback contract need to exist (new).
- The ingestion service needs an **async ingest + callback** path and a **`delete_by_source` HTTP endpoint** (today it's a Python API only — `CLAUDE.md` §2.1).
- The **Vanna-interaction service** needs updating to read `training_script` from `nnp_km_database`.
- A **separate embedding process** owns populating `nnp_km_qa.question_embedding_id`.

---

## 9. Consolidated decisions for the tech-lead meeting

| # | Decision | Service | Recommendation |
|---|---|---|---|
| A1 | FastAPI (Python)? | all | Yes — match siblings |
| A2 | One service with four routers vs four services | all | One deployable |
| A3 | Verb-based endpoints | all | Yes — matches names + house style |
| A6 | Soft-delete + `includeDeleted` reads | all | Yes |
| A7 | Error body `{detail, request_id}` + `X-Request-ID` | all | Yes — match ingestion |
| D1 | Provision Milvus collection on `createBucket`? | manageBucket | ✅ **RESOLVED:** yes, via a separate **async** provision service + `provisionCallback`; status starts `PROVISIONING` |
| D2 | Enforce `bucket_name` global uniqueness how (no DB UNIQUE in v1)? | manageBucket | **Still recommend** a single `UNIQUE` index on `bucket_name` (it's the Milvus collection name); confirm |
| D3 | Is `bucket_name` immutable after create? | manageBucket | ✅ **RESOLVED:** yes — `updateBucket` ignores `bucket_name` |
| D4 | Verify `account_id` against PORTAL on create? | manageBucket | Trust header for v1 (open) |
| D5 | Account assign/unassign + multi-account mapping | manageBucket | ✅ **RESOLVED:** folded into `updateBucket` (`account_ids` replace-set). `deleteBucket` implemented (§4.4) |
| D6 | Who calls ingestion + when is the doc row written? | manageBucketDetails | ✅ **RESOLVED:** Pattern B — service inserts PENDING then ingests **async**; `ingestionCallback` finalises |
| D7 | Cascade Milvus delete on document delete? | manageBucketDetails | ✅ **RESOLVED:** yes (+ vector update on re-ingest); needs ingestion `delete_by_source` HTTP endpoint |
| D8 | Embed curated questions into Milvus? | manageQuestions | ✅ **RESOLVED:** not here — a separate process does it; `question_embedding_id` stays null |
| D9 | Reject inline credentials in `connection_url`? | manageDataSql | ✅ **RESOLVED:** yes; credentials supplied at runtime, not stored; `credential_ref` removed |
| D10 | `query_context` = NL question (Vanna training) or label? | manageDataSql | Still open — note Vanna context now lives in `training_script` |
| D11 | Wire the exemplar-promotion flow now or later? | manageDataSql | Later; manageDataSql does no Milvus. Columns ready (`milvus_exemplar_id`, `quality_score`) |
| D12 | Standard list pagination/sorting? | all | Add `?limit/&offset` + `sort` when lists grow; skip for v1 |
| D13 | Secure the callback endpoints (`provisionCallback`, `ingestionCallback`) | manageBucket / manageBucketDetails | Internal-only network or shared secret — they mutate status |
| D14 | Add `training_script` to schema; update Vanna service to read it | manageDataSql | ✅ Column added; Vanna service update is a separate task |

---

## 10. Remaining gaps / future additions

- **Read-by-id** variants (`getById`) — handy for edit-form pre-population, though list payloads can serve edits for now.
- A **bulk** `getDetails` for documents across buckets — service 2 currently keys on a single `bucket_id` while services 3 & 4 take comma-separated lists. Confirm whether the asymmetry is intentional or should be unified.
- Standard list **pagination / sorting** (`?limit&offset&sort`) — deferred to v2 when lists grow large enough to need it.
- **Cascade delete** for `deleteDBDetail` — child `nnp_database_q` rows are not soft-deleted automatically; decide whether deleting a database should cascade to its saved queries.

---

---

## 11. Changelog

- **v1.2 (2026-05-24):** §8.2 soft-delete endpoints implemented for all four services — `deleteBucket` (§4.4), `deleteBucketDetail` (§5.4), `deleteQDetail` (§6.4), `deleteDBDetail` (§7.6), `deleteSQLDetail` (§7.7). Status vocabulary table corrected: buckets and databases are now separate sets; `PROVISIONING` / `FAILED` are bucket-only; `DELETED` added to Q&A / saved-query set. §9 D5 marked resolved. §10 updated to remove now-implemented items. `PROVISION_DELETE_URL` and `INGESTION_DELETE_URL` env vars documented. Header updated to reflect this is an implemented design, not a draft.
- **v1.1 (2026-05-21, per `Project_Input.txt`):** resolved D1, D3, D5, D6, D7, D8, D9. Milvus provisioning and ingestion are now **async + callback** (added `provisionCallback` / `ingestionCallback`). `updateBucket` now manages multi-account mapping. manageQuestions does no embedding (separate process). manageDataSql rejects inline-credential URLs (credentials supplied at runtime), does no Milvus, and gains a `training_script` column for the separate Vanna service. Schema updated accordingly: `+error_detail` on `nnp_km_buckets` and `nnp_bucket_details`, `+training_script` and `−credential_ref` on `nnp_km_database`.

*Source of truth for the schema is `coreComp_schema.sql`. Open decisions: D2, D4, D10, D12, D13.*
