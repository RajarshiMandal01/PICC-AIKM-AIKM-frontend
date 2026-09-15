# CLAUDE.md

Project context for the **Knowledge Management UI** — a React 19 + Vite + TypeScript + MUI 7 application being built as the single, unified front-end for three sibling Python services. Written so a future Claude session (or a human reader) can come back cold and immediately understand the scope, the contracts, and the integration constraints.

---

## 1. What this project is

**This repo is the new UI.** It replaces three independently-shipped Streamlit operator dashboards that currently live alongside each backend Python service. The end-state is one branded NNP portal where users manage their Knowledge Management "buckets" (documents, curated Q&A, and database registrations) per Account, and run queries that fan out across the three backends.

It is **not** a port of the Streamlit code — the design language is its own (NNP shared styles + MUI). Treat the existing Streamlit UIs as feature inventories, not as visual references.

### Repository state (as of 2026-05-19)

- Working directory: `D:\NNP\AI\knowledge-management`
- Git repo, branch `main`, origin `https://nnprepo.nubons.com/nnp-workzone/ai/knowledge-management.git` (per `README.md`). Files now live in their natural nested layout (`src/components/platform-spec.tsx` etc.) — the earlier `src_components_*.tsx` flattening from the upload-staging area is gone.
- `package.json` `name` is **`programado-portal-ui`** (not `knowledge-management`). The repo was clearly forked from the Programado / LCNC portal UI and partly re-skinned for KM; a lot of the code under `src/components/`, `src/widgets/`, `src/contexts/YamlTemplateContext.tsx`, and `src/assets/json/*.template.json` is LCNC wizard plumbing that the KM surfaces don't use. See §9 for the inventory.
- `.env` files are **checked in** (`.env`, `.env.dev`, `.env.production` are not in `.gitignore`). Don't put real secrets in them.

### Tech stack (from `package.json`)

| Layer | Choice |
|---|---|
| Build | Vite 7 + TypeScript 5.8 (`strict: false` in `tsconfig.app.json`; `@/*` path alias → `src/*` in both `vite.config.ts` and `tsconfig.app.json`) |
| UI | React 19, MUI 7 (`@mui/material`, `@mui/x-data-grid`, `@mui/x-date-pickers`, `@mui/icons-material`) |
| Styling | Tailwind (mixed — see warning below) + SCSS (`sass-embedded`) + private `nnp-shared-styles` package |
| Routing | `react-router-dom` 7 |
| Forms | `react-hook-form` |
| HTTP | bare `fetch` wrapped in `src/services/api.service.tsx`. No axios. No multipart helper — has to be added before wiring `/ingest/document/upload[/multiple]` |
| Charts | Chart.js + `react-chartjs-2`. No `plotly.js` — needs adding (or a Plotly→Chart.js shim) before the SQL service's `chart` field can render |
| Code editor | `react-ace` (ACE) |
| Alerts | `sweetalert2`, `react-confirm-alert` |
| Date | `dayjs` |
| Icons | `lucide-react`, `react-icons` |
| Auth/state | `js-cookie` (no Redux/Zustand pulled in yet) |

**Tailwind version mismatch.** `package.json` pins **both** `@tailwindcss/vite ^4.1.11` (loaded as a plugin in `vite.config.ts`) **and** `tailwindcss ^3.4.17` + `@tailwindcss/postcss ^4.1.11` + `autoprefixer` + `postcss.config.js` + `tailwind.config.js`. Tailwind v4 doesn't need `tailwind.config.js` / `postcss.config.js` / `autoprefixer`; the v3 dep + configs are leftovers. Confirm which version is actually in effect before adding anything Tailwind-feature-sensitive.

**Vite dev server runs on `:3007`** (`vite.config.ts`), not the default `:5173`.

### Security note: GitLab PAT committed in `package.json`

The `nnp-shared-styles` dependency line embeds a real-looking GitLab personal access token (`glpat-…`) directly in the git URL. This is a credential leak — treat as sensitive. Rotate before any external repo exposure and prefer a `.npmrc`/registry-auth approach instead.

### Existing routes (`src/App.tsx`)

| Path | Component | Purpose | Wired to backend? |
|---|---|---|---|
| `/` | redirect → `/dashboard` | — | n/a |
| `/dashboard` | `pages/dashboard` | Knowledge Base front-end (intended to consume ingestion + hybrid query services) | **No — mock-only.** `handleSearch` returns a hardcoded `"This is a simulated response for: ..."` string; accounts/documents are local-state arrays |
| `/sql-query` | `pages/sqlquery` | SQL Database Query (intended to consume the SQL/observability service) | **No — mock-only.** Same simulated-answer pattern; `dataSources` / `dataQueries` are seeded mock arrays |
| `/module/:id` | `pages/module` | Module shell — LCNC/Programado wizard surface, not KM | Yes — calls `ConfigurationService` / `ConfiguratorService` / `TransactionService` (LCNC backends, not the three Python services in §2) |
| `/module/:id/platform/:componentId` | `components/platform-spec` | Platform component spec — LCNC wizard | (as above) |
| `/module/:id/api/:componentId` | `components/api-spec` | API component spec — LCNC wizard | (as above) |
| `*` | `pages/not_found` | 404 | n/a |

Wrapped in `ToasterProvider` and `HeaderLayout`. Router `basename` comes from `VITE_BASE_URL` env (defaults to `/` in code; **set to `/nnp-km/` in every checked-in `.env*`** — production URL is `https://nnp.nubons.com/nnp-km/`).

`HeaderLayout` → `TopBar` (`src/shared/layout/topbar.tsx`) is the only nav: hardcoded title "SCIO BAZO", hardcoded username "nubodemo", a single toggle button between `/dashboard` ("KNOWLEDGE BASE") and `/sql-query` ("SQL QUERY"), and a logout icon that just `window.location.reload()`s. There is no real sidebar / `NavBar` route wired in (`src/shared/layout/navbar.tsx` exists but is unused by `App.tsx`). The bigger nested-module navigation that `navbar.tsx` implies isn't reachable.

---

## 2. The three sibling Python services (the backends this UI calls)

All three live as separate repos under `D:\NNP\AI\`. Each ships its own FastAPI on `:8000` plus a legacy Streamlit UI on `:8501`. The Streamlit UIs are what we're replacing.

| # | Repo | Role | Default port | Authoritative spec |
|---|---|---|---|---|
| 1 | `ai-data-ingestion-service` | Ingest content → chunk → embed → Milvus | API `:8000`, Streamlit `:8501` | `D:\NNP\AI\ai-data-ingestion-service\CLAUDE.md` |
| 2 | `ai-data-query-service` | Hybrid RAG: Milvus + GitLab MCP + OpenAI | API `:8000`, Streamlit `:8501` | `D:\NNP\AI\ai-data-query-service\CLAUDE.md` |
| 3 | `ai-sql-query-observability-service` | NL → SQL → Postgres / ClickHouse + Plotly | API `:8000`, Streamlit `:8501` | `D:\NNP\AI\ai-sql-query-observability-service\CLAUDE.md` |

**Always read the sibling CLAUDE.md files for ground truth.** This document summarises only what the UI needs to know.

### Shared cross-cutting facts

- **All three APIs default to port 8000.** In production they're on distinct K8s Services; for local dev they collide — pick distinct ports or run only one backend at a time.
- **CORS is `allow_origins=["*"]` everywhere.** Fine for local, must be locked down before production exposure of the React UI.
- **Zero authentication on any endpoint** across all three services. The new UI will need an auth gateway (or per-service auth middleware) before exposure beyond the `nnp-devsecops` namespace.
- **OpenAI API key is committed in `.env` and `k8s-manifest/secret.yaml` in all three sibling repos.** Same key reused for embeddings and chat. Rotate before exposing the integration externally. Never echo into UI builds, browser bundles, logs, or PR diffs.
- **Two services write to the same Milvus collection (`ai_knowledge_base_embeddings`)** — the ingestion service writes ingested documents, the SQL service writes successful `(question, SQL)` exemplars with `quality_score: 0.7`. Both are in `nnp_knowledge_vector` Milvus DB on host `milvus.nnp-devsecops` (in-cluster) or `10.26.143.28` (configured `.env`).
- **OpenAI embedding model: `text-embedding-3-large`, 3072 dimensions.** Hard-fixed in the Milvus schema at collection-creation time. Switching models requires recreating the collection.

---

### 2.1 `ai-data-ingestion-service` — RAG ingestion

**Purpose.** Pulls content from many sources (file uploads, Git repos, web pages, Google Drive, ArgoCD manifests, Redmine issues), chunks it with LangChain, embeds it with OpenAI, and upserts into Milvus. Designed for idempotent re-ingestion: the chunk primary key is `sha256(source_id | chunk_content)` so re-uploading the same file is a no-op.

**Key UI-facing endpoints** (`http://<host>:8000`):

| Method | Path | Purpose |
|---|---|---|
| POST | `/ingest/document` (path) | Ingest a file by server-side path |
| POST | `/ingest/document/upload` | Multipart single-file upload |
| POST | `/ingest/document/upload/multiple` | Multipart multi-file upload |
| POST | `/ingest/git` | Clone + ingest a git repo |
| POST | `/ingest/argocd` | Parse ArgoCD application manifests |
| POST | `/ingest/redmine` | Pull Redmine issues |
| POST | `/ingest/gdrive` | Pull a Google Drive folder or file |
| POST | `/ingest/web` | Single URL |
| POST | `/ingest/web/multiple` | Batch URLs |
| GET | `/stats` | Milvus `row_count` (current vectors) |
| GET | `/metrics/ingestion` | In-process counters (chunks/docs/duplicates since process start; **resets on restart**) |
| GET | `/health` / `/health/deep` | Liveness / Milvus-touching readiness |
| POST | `/admin/reset_collection` | **Destructive**, drops + recreates collection. Requires `{"confirm": true}` |
| GET | `/debug/check-duplicate?file_hash=<sha256>` | Confirm an upload landed (returns up to 5 matching chunks) |
| GET | `/docs` | OpenAPI / Swagger |

**Response envelope** (every `/ingest/*` success):
```jsonc
{
  "status": "success",
  "message": "<human-readable>",
  "details": {
    "status": "success",
    "documents_processed": int,   // raw input doc count (pre-chunking)
    "chunks_created": int,        // post-splitting
    "vectors_stored": int,        // post-dedup (only new chunks)
    "duplicates_skipped": int,
    "embedding_batches": int,
    "insert_batches": int
  }
}
```

`/ingest/git` adds top-level `files_processed`; `/ingest/document/upload/multiple` adds `processed_files` + `failed_files` arrays.

**Errors** return HTTP 500 `{"detail": str, "request_id": str}` + an `X-Request-ID` header.

**Request-ID contract.** Every non-`/health` request is assigned an 8-char `X-Request-ID` by middleware and the same ID is on the response header. **Surface it in error toasts** — the Streamlit UI does this and it's load-bearing for backend log correlation.

**Dedup model the UI must understand.**
- `chunk_id = sha256(source_id | chunk_content)` → Milvus primary key.
- `source_id` conventions:
  - File upload: `"upload:<sha256-of-bytes>"`
  - Web page: the URL itself (canonicalise — trailing slashes, query strings, fragments all change the ID)
  - Git file: cloned file path (⚠ NOT stable across `GIT_CLONE_BASE_PATH` changes — open bug in the ingestion repo)
  - Redmine issue: `"<redmine_url>/issues/<issue_id>"`
  - Google Drive: `"google_drive://<file_id>"`
  - ArgoCD manifest: filesystem path
- Re-uploading the same bytes ⇒ `duplicates_skipped > 0`, `vectors_stored == 0`. The UI's "you already uploaded this" copy should be driven by these counters, not by a separate pre-check.

**Known bugs to design around** (from the sibling CLAUDE.md §12):
- **`web_loader.py` and `gdrive_loader.py` emit `metadata["doc_type"]` instead of `metadata["type"]`.** Result: every web page and Google Drive file lands as `doc_type="unknown"` in Milvus. Any UI filter by source type will miss them until the loaders are fixed.
- **Git ingestion has no stable `source_id`.** If anyone changes the clone base path or the repo name, dedup breaks and the next ingest produces duplicates.
- **`INGESTION_METRICS` is in-process and not shared across replicas.** "Total Chunks" appears to reset on every rolling deploy.

**What the new UI's Knowledge Base section needs:**
- Multi-source upload forms (Document / Git / ArgoCD / Redmine / GDrive / Web — Streamlit had a tab per source; React equivalent is up to the design).
- A way to inspect ingestion history (`/metrics/ingestion`) and total vectors (`/stats`).
- Error toasts surfacing `request_id`.
- A delete-by-source admin (Streamlit doesn't have this but the service exposes `pipeline.vector_store.delete_by_source(source)` Python API — would need a new HTTP endpoint).

---

### 2.2 `ai-data-query-service` — Hybrid RAG (Milvus + GitLab MCP + OpenAI)

**Purpose.** Answers natural-language questions by retrieving from multiple sources in parallel, combining results by weighted score, and asking an LLM to answer **strictly grounded in the retrieved documents**. When no docs match, falls back to general LLM knowledge with a `⚠️ **Note: No matching information was found...**` prefix.

**Sources and weights:**
- Milvus company KB — weight `0.6`
- GitLab (via MCP server `@modelcontextprotocol/server-gitlab` over `npx`) — weight `0.4`
- OpenAI — fallback only when no docs match

**Endpoints** (`http://<host>:8000`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Per-service health (milvus, gitlab_mcp, openai, mcp_client) |
| POST | `/query` | Main RAG endpoint |
| POST | `/query/stream` | **Simulated** streaming (50-char slices of the completed answer — real streaming is not wired) |
| GET | `/query/modes` | Static list of supported modes |
| GET | `/mcp/status` | Registered MCP servers + tool catalog |
| GET | `/collection/stats` | Milvus `num_entities` + schema |

**`POST /query` request** (`QueryRequest`):

| Field | Type | Default | Notes |
|---|---|---|---|
| `query` | str | required | NL question |
| `top_k` | int? | settings.top_k = 5 | |
| `similarity_threshold` | float? | settings.similarity_threshold = 0.4 (in `.env`) | Applied in Python after the Milvus search |
| `include_sources` | bool | true | |
| `mode` | enum | `auto` | One of `milvus_only`, `gitlab_only`, `hybrid`, `auto` (auto == hybrid) |
| `search_gitlab` | bool | true | Disables GitLab branch even in hybrid |
| `gitlab_projects` | str[]? | null | Specific GitLab project IDs to scope the search |
| `file_extensions` | str[]? | null | e.g. `[".yaml", ".yml"]` |

**`QueryResponse` — fields the UI can actually rely on** (per sibling CLAUDE.md §11):

| Field | Set by API? | Notes |
|---|---|---|
| `query`, `answer`, `documents`, `total_results`, `search_time`, `mode`, `sources_used` | ✅ | Use these |
| `sources` (alias of `documents`) | ❌ | Model has the field; endpoint does not set it. **Bind to `documents`, not `sources`.** |
| `total_sources` (alias of `total_results`) | ❌ | Same — endpoint doesn't set it |
| `metadata.embedding_time`, `metadata.search_time` | ❌ | Never built — performance cards read `0.00s` |
| `processing_time` | ❌ | Never built — "Total Time" reads `0.00s` |
| `query_type`, `query_mode`, `source_breakdown` | ❌ | Default values only |
| `sql_query`, `sql_data`, `chart` | n/a | Reserved hooks for a future SQL path — actually implemented in the SQL/observability service, **not here** |

**`SourceDocument` shape (what each result looks like):**
```jsonc
{
  "id": "<milvus pk>",
  "content": "<chunk text>",
  "similarity_score": 0.81,
  "metadata": { "source": "...", "type": "...", "...": "..." },
  "source_type": "milvus" | "git" | "redmine" | "openai" | ...,
  "source_origin": "company_knowledge_base" | "gitlab_mcp" | "openai" | ...
}
```

**Backend quirks relevant to the UI:**
- **No real streaming** — `/query/stream` slices the final answer. Don't promise streaming in the UX yet.
- **First MCP call is slow** because `npx @modelcontextprotocol/server-gitlab` spawns per call (no session pool). Show a longer loading state.
- **XSS sink in the legacy Streamlit UI**: it rendered `response["answer"]` with `unsafe_allow_html=True`. The React UI **must** escape / sanitise before any `dangerouslySetInnerHTML` use (or just render as plain text / safe markdown).

**What the new UI's query section needs:**
- A query input that supports the four modes plus the optional GitLab filters (the Streamlit UI doesn't expose any of these — they're a feature gain).
- Result list bound to `documents` (not `sources`).
- Performance cards: don't promise `embedding_time` / `search_time` / `processing_time` until the backend is fixed (open issue in sibling repo).

---

### 2.3 `ai-sql-query-observability-service` — NL → SQL → Postgres/ClickHouse

**Purpose.** Translates a natural-language question to SQL via OpenAI, routes it to the right database via keyword matching, executes it, and returns the rows + an optional Plotly chart + an LLM-written summary.

**Endpoints** (`http://<host>:8000`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | `{status, vanna_connected, databases, version}`. UI calls this every rerun in the Streamlit version |
| GET | `/clickhouse/health` | ClickHouse probe |
| GET | `/postgres/health` | Per-DB reachability + 5 sample tables |
| POST | `/query` | Main NL→SQL endpoint |

**`POST /query` request** (`QueryRequest`):
```jsonc
{
  "query": "Show me daily signups last 30 days",
  "include_chart": true,                           // optional, default true
  "chart_type": "auto"                              // optional: auto | bar | line | pie | scatter | table
}
```

**`QueryResponse`:**
```jsonc
{
  "query": "Show me daily signups last 30 days",
  "answer": "Found 30 records from database 'nnp_devsecops'. Columns: day, count.",
  "processing_time": 4.21,
  "timestamp": "2026-05-19T12:00:00Z",
  "sql_query": "SELECT day, count(*) FROM ...",
  "sql_data": {
    "columns": ["day", "count"],
    "rows": [["2026-04-19", "12"], ...],           // ⚠ every cell coerced to str via df.astype(str)
    "row_count": 30,
    "summary": {}
  },
  "chart": { /* Plotly figure JSON, or null */ },
  "query_type": "sql",
  "metadata": {
    "database": "nnp_devsecops",
    "retrieval": { "retrieval_source": "milvus", "retrieval_hits": 3, "retrieval_top_score": 0.81 },
    "error": null
  }
}
```

**Error shape.** On failure, `answer` becomes `"Error: <reason>"` and `metadata.error` holds the same reason. **`sql_query` may still be populated** if SQL generation succeeded but execution failed — render it for debugging.

**All `sql_data.rows` cells are strings.** Number formatting, alignment, and aggregation are the UI's responsibility (`@mui/x-data-grid` `valueFormatter` is the right place).

**Production database routing** (keyword-based, defined in `DatabaseLoader.select_database`):

| Database | Type | Trigger keywords (excerpt) |
|---|---|---|
| `nnp-enterprise-lowcode` | Postgres | `lcnc, lowcode, nocode, lowcode template` |
| `nnp_apiecosystem` | Postgres | `api, apigw, api gateway, rate limiting, endpoint, route, proxy` |
| `nnp_devsecops` | Postgres | `devsecops, devops, pipeline, deployment, build, ci, cd, jenkins, gitlab, security scan` |
| `signoz_nnp` | ClickHouse | observability terms: `signoz, observability, metrics, traces, logs, monitoring, cpu, memory, disk, ...` |

**Hardcoded SigNoz/ClickHouse table assumptions** (in the SQL gen prompt at `sql_generator.py:128-155`):
- `signoz_traces.signoz_index_v3` — spans
- `signoz_logs.logs_v2` — logs. `timestamp` is **Unix UInt64**; use `toDateTime(timestamp)` to display.
- `signoz_metrics.time_series_v2` — metrics. Value column is **`metric_value_num`** (NOT `value_double` / `value`). Identifiers (`pod_name`, `service_name`, `host_name`) live in the `labels` Map.

**Continuous learning.** Every successful `(question, SQL)` pair is upserted to the **same Milvus collection used by the ingestion service** (`ai_knowledge_base_embeddings`) with `quality_score: 0.7`. They're retrieved as in-context examples for future SQL generations.

**Open issues from sibling CLAUDE.md:**
- §7.1: `ApiSettings` fails to instantiate locally because of pydantic `extra=forbid` plus several `chunk_*` keys in `.env`. The API can't start locally without the fix; current dev hits a deployed API.
- §7.2: `sql_generator.py:196-198` swallows the real OpenAI exception; "Failed to generate SQL" arrives without context. Real error is only in API logs.
- §15a: real-looking OpenAI key + Postgres/ClickHouse passwords committed in `k8s-manifest/secret.yaml`.

**What the new UI's `/sql-query` page needs:**
- NL question input → POST `/query`.
- Result table bound to `sql_data.columns` + `sql_data.rows` (strings).
- Generated SQL panel (read-only ACE editor with SQL mode — `react-ace` is already a dep).
- Plotly chart render (need to add `react-plotly.js` / `plotly.js` — not currently a dep; alternative: render via Chart.js after a Plotly→Chart.js conversion).
- Chart-type selector matching the backend enum.
- "Database used" indicator from `metadata.database`.
- Saved queries list (drawn from `NNP_DATABASE_Q` in the CoreComp schema — see §3).

---

## 3. CoreComp / NNP-RAG database schema (the new RDBMS backing this UI)

**Source:** `D:\NNP\AI\DMS CoreComp Schema.pdf` — a single-page ERD titled "DB: CoreComp / NNP-RAG Schema". **It's a draft** — only column names and PK/FK markers are shown; column types and lengths are not.

### Entity overview

```
ACCOUNT (external — mapped to PORTAL.NNP_ACCOUNT)
   │
   └── NNP_KM_BUCKETS                          ← per-account "buckets"
          ├── NNP_BUCKET_DETAILS               ← documents in a bucket   (ingestion service backs this)
          ├── NNP_KM_QA                        ← curated Q&A in a bucket (query service uses these)
          └── NNP_KM_DATABASE                  ← databases registered in a bucket
                 └── NNP_DATABASE_Q            ← saved queries per registered DB (SQL service uses these)
```

### Columns (from the diagram)

**ACCOUNT** — external; not owned by CoreComp. Mapped to `PORTAL.NNP_ACCOUNT`. All KM bucket rows reference one Account.

**NNP_KM_BUCKETS** — top-level grouping per Account
- `ID` (PK), `ACCOUNT_ID` (FK → ACCOUNT)
- `BUCKET_CATEGORY`, `BUCKET_NAME`, `BUCKET_DESC`
- `BUCKET_SIZE`, `BUCKET_SPEC`, `BUCKET_URL`
- `STATUS`, `CREATED_AT`, `UPDATED_AT`

**NNP_BUCKET_DETAILS** — documents within a bucket
- `ID` (PK), `BUCKET_ID` (FK)
- `DOC_CATEGORY`, `DOC_NAME`, `DESCRIPTION`, `FORMAT`, `DOC_SIZE`
- `STATUS`, `CREATED_AT`, `UPDATED_AT`
- Likely mirrors what the ingestion service has put into Milvus, with display metadata kept here for the UI.

**NNP_KM_QA** — curated Q&A within a bucket
- `ID` (PK), `BUCKET_ID` (FK)
- `QUESTION`, `ANSWER`, `RANK`
- `STATUS`, `CREATED_AT`, `UPDATED_AT`
- These are pre-vetted answers. Two reasonable consumption patterns: (a) pre-LLM short-circuit when the question matches; (b) weighted exemplars in the hybrid query.

**NNP_KM_DATABASE** — databases registered in a bucket
- `ID` (PK), `BUCKET_ID` (FK)
- `DATABASE_NAME`, `DATABASE_TYPE`, `DATABESE_DESC` (sic — typo "DATABESE" in the diagram), `SCHEMA_URL`
- `STATUS`, `CREATED_AT`, `UPDATED_AT`
- Per-bucket registry of databases the SQL service can query. Should eventually replace the hardcoded `DatabaseLoader.select_database` keyword routing in the SQL service.

**NNP_DATABASE_Q** — saved queries per registered DB
- `ID` (PK), `DATABASE_ID` (FK → NNP_KM_DATABASE)
- `QUERY_NAME`, `QUERY_DESC`, `QUERY_CONTEXT`, `QUERY_TEXT`
- `STATUS`, `RANK`
- (No CREATED_AT / UPDATED_AT in the diagram — likely an oversight.)
- Powers the "Saved queries" list on the `/sql-query` page.

### Open questions on the schema (confirm with the author before CREATE TABLE work)

> **⚠ Mostly resolved as of 2026-05-21.** A v1 schema has been finalised with stakeholder input and committed as `coreComp_schema.sql` (+ rationale in `databaseschema.md`). See **§11** for the as-built decisions. The original open questions are kept below for history; their resolutions are noted inline.

1. **Column types and lengths** — entirely missing from the diagram. → **Resolved (§11):** UUID PKs, `VARCHAR(n)` for bounded fields, `TEXT` for free-form.
2. **`DATABESE_DESC` typo** in `NNP_KM_DATABASE` — assume it's meant to be `DATABASE_DESC`; confirm before propagating into ORM/code. → **Resolved:** corrected to `database_desc`.
3. **Missing timestamps on `NNP_DATABASE_Q`** — likely an oversight; recommend adding. → **Resolved:** `created_at` / `updated_at` added.
4. **No users / permissions tables shown.** RBAC is presumably handled by the PORTAL layer that owns `NNP_ACCOUNT`. Confirm whether the UI gets identity via PORTAL session or must check separately. → **Still open** (see §8.6). v1 adds `created_by`/`updated_by` audit columns sourced from the PORTAL `X-User-Name`.
5. **Semantics of `BUCKET_URL` and `SCHEMA_URL`** are not stated. → **Partially resolved:** `SCHEMA_URL` dropped in favour of `connection_url` (a credential-less DB connection URL) + `credential_ref`. `BUCKET_URL` retained but its semantics are still TBD.
6. **No explicit link between `NNP_BUCKET_DETAILS` and Milvus source IDs.** → **Resolved:** `milvus_source_id` column added (plus `milvus_chunks_stored` / `milvus_chunks_duplicated` / `ingest_request_id` / `ingested_at`).

---

## 4. How the UI maps onto backends and schema

This is the "who owns what" view — useful when sizing features.

| UI surface | Backend(s) called | CoreComp table(s) involved |
|---|---|---|
| Account / bucket list | (UI-internal CRUD on CoreComp) | `ACCOUNT`, `NNP_KM_BUCKETS` |
| Knowledge Base — upload tab | `POST /ingest/*` (ingestion service) | `NNP_BUCKET_DETAILS` (insert row per uploaded doc) |
| Knowledge Base — sources list | `GET /stats`, `/metrics/ingestion`; CoreComp read | `NNP_BUCKET_DETAILS` |
| Knowledge Base — Q&A management | (UI-internal CRUD on CoreComp) | `NNP_KM_QA` |
| Knowledge Base — query | `POST /query` (hybrid query service) | (optionally pre-check `NNP_KM_QA` for an exact match before calling the API) |
| `/sql-query` — registered DBs | (UI-internal CRUD on CoreComp); `GET /postgres/health`, `/clickhouse/health` | `NNP_KM_DATABASE` |
| `/sql-query` — saved queries | (UI-internal CRUD on CoreComp) | `NNP_DATABASE_Q` |
| `/sql-query` — ask a question | `POST /query` (SQL service) | (saved successful queries could go back into `NNP_DATABASE_Q`) |
| Module / Platform-spec / API-spec | (existing UI flows — not part of this integration) | n/a |

> The CoreComp tables currently have **no service of their own** — the UI will need an API layer in front of them (REST or GraphQL). That layer doesn't exist yet and isn't in any of the three sibling repos. Building it (or extending one of the sibling services to host CoreComp CRUD) is an open architectural decision.

---

## 5. Local dev (today)

```powershell
# Install
npm install

# Dev server (Vite)
npm run dev

# Type-check + build
npm run build

# Lint
npm run lint

# Preview the production build locally
npm run preview
```

### Environment

Three env files are checked in: `.env`, `.env.dev`, `.env.production`. **`.env` is not in `.gitignore`** — don't put secrets in them.

Vars actually defined (across the three files):

- `VITE_BASE_URL` — router basename + Vite `base`. Set to `/nnp-km/` everywhere.
- `VITE_COOKIE_DOMAIN` — `.localhost` (dev) / `.nnp.nubons.com` (prod). Used when reading PORTAL-issued cookies.
- `VITE_PRODUCTION` / `PRODUCTION` — boolean flag; the dev/prod files use the unprefixed `PRODUCTION` form, which Vite **won't expose to client code** (only `VITE_*` is exposed). Only `.env` uses `VITE_PRODUCTION=false`.
- `VITE_TRANSACTION_BASE_URL`, `VITE_PROGRAMADO_CONFIGURATOR_BASE_URL`, `VITE_CONFIGURATION_BASE_URL` — LCNC backends. Read by `configuration.service.ts`, `configurator.service.ts`, `transation.service.tsx` (sic).
- `VITE_JOB_BASE_URL` — used by `transation.service.tsx`; falls back to `http://10.26.143.21:32192` if unset.
- `VITE_DND_URL`, `VITE_ATT_DND_URL`, `VITE_SRC_NODE_RED_URL` — older LCNC/edge tooling URLs.

**Two real bugs in the env files:**

1. **`.env.dev` and `.env.production` use YAML-style colons** for the LCNC URLs (`VITE_TRANSACTION_BASE_URL: 'https://...'`) instead of dotenv-style `=`. Vite's `loadEnv` will skip those lines → `import.meta.env.VITE_TRANSACTION_BASE_URL` is `undefined` when building for `dev` or `production` modes. Only `.env` (loaded for every mode) is correctly formatted, so the dev defaults bleed into production builds. Fix to `KEY=value`.
2. **No env vars yet for the three Python services.** Add `VITE_INGESTION_API_URL`, `VITE_QUERY_API_URL`, `VITE_SQL_API_URL` (or whatever the team standardizes on) when wiring `/dashboard` and `/sql-query` to real backends.

`default.conf` (nginx) and `Dockerfile` are the container deployment artefacts. Nginx listens on `:8080`, serves the SPA from `/nnp-km/` with `try_files ... /nnp-km/index.html` as the SPA fallback. The image is built FROM an internal NNP nginx base (`<CI-REGISTRY>/lifecycle-automation/.../nginx:1.24.0-v1`) and is deployed by `.gitlab-ci.yml` into Kubernetes namespace **`nnp-core-components`** (note: not `nnp-devsecops` like the three Python services) via the shared `devops-templates/k8s-deployment-template.yaml`. Container resource defaults: 100Mi request / 1Gi limit, 50m / 500m CPU.

### Backend connectivity (todo)

`src/services/api.service.tsx` exists as a generic `fetch` wrapper — used by the LCNC services, but **none of the three Python services from §2 are wired in yet**. When adding them, the contract to mirror is:

- One base URL per backend, from `import.meta.env.VITE_INGESTION_API_URL` / `VITE_QUERY_API_URL` / `VITE_SQL_API_URL`. All three Python services default to `:8000` in dev (so distinct ports or only-one-at-a-time locally); production gets distinct in-cluster URLs (`http://ai-data-ingestion-service-api:8000`, `http://ai-data-query-service-api:8000`, `http://ai-sql-query-api:8000`).
- The existing `ApiService` automatically attaches `X-Env-Code`, `X-User-Type`, and `User` headers from cookies (see §9.2). The Python services don't read those; they'll be ignored. Fine to leave.
- The existing `ApiService` **on HTTP 401 redirects to `${origin}/nnp-login/continue=${currentUrl}`** — that's the PORTAL login. The Python services don't return 401 (they have no auth), so this branch won't fire for them today; but it's the auth model the rest of the UI assumes (informs Open Decision §8.2).
- Surface `X-Request-ID` in errors — the ingestion service sets it on every non-`/health` response. The current `handleResponse` ignores response headers; needs to be extended.
- Long-running calls (`/ingest/document/upload/multiple`, `/query` with cold MCP) need extended timeouts — `fetch` has no timeout; add an `AbortController` per request. Streamlit reference used 120 s.
- **Add a multipart helper** — `ApiService` only does JSON `Content-Type: application/json`; `/ingest/document/upload` and `/ingest/document/upload/multiple` need `multipart/form-data` (let `fetch` set the boundary by passing a `FormData` body and stripping the JSON `Content-Type`).

---

## 6. Integration gotchas summary (read before building)

The full lists live in the sibling CLAUDE.md files; these are the ones that bite the UI specifically.

1. **Hybrid query response shape.** Bind to `documents` (not `sources`); don't display `processing_time` / `metadata.embedding_time` / `metadata.search_time` until the backend is fixed — they're always 0/null.
2. **All `sql_data.rows` cells are strings.** Number formatting is the UI's job.
3. **Ingestion's `doc_type=unknown` bug for web + GDrive.** Any UI filter by source type misses those.
4. **No auth, CORS `*` everywhere.** Add a gateway before going beyond `nnp-devsecops`.
5. **OpenAI keys + GitLab PATs committed in sibling repos and in this repo's `package.json`.** Don't propagate to UI bundles / logs / PR diffs.
6. **Real streaming is not wired** in the hybrid query service. Don't show a "typewriter" effect that implies it.
7. **Two services write to the same Milvus collection.** If the UI ever displays "what's in this collection", expect a mix of ingested docs and (question, SQL) exemplars.
8. **MCP GitLab calls are slow on cold start** (`npx` per call). First query post-deploy needs a longer loading state.
9. **`INGESTION_METRICS` resets on restart.** "Total Chunks" can drop on rolling deploys — explain it or hide it.
10. **XSS sink** in the Streamlit query UI was a real risk because `unsafe_allow_html=True` rendered the LLM's answer raw. In React: never `dangerouslySetInnerHTML` on `answer` without sanitising (`DOMPurify` or treat as plain text / safe markdown).

---

## 7. Reading map (where to dig deeper)

| Topic | File |
|---|---|
| Ingestion API surface, Milvus schema, loader → pipeline → Milvus contract | `D:\NNP\AI\ai-data-ingestion-service\CLAUDE.md` §1, §3, §5, §11 |
| Ingestion known bugs | `D:\NNP\AI\ai-data-ingestion-service\CLAUDE.md` §12 |
| Hybrid query architecture, async/sync mix | `D:\NNP\AI\ai-data-query-service\CLAUDE.md` §3 |
| Hybrid query endpoints + response shape mismatches | `D:\NNP\AI\ai-data-query-service\CLAUDE.md` §5, §6, §11 |
| Adding a new MCP knowledge source | `D:\NNP\AI\ai-data-query-service\CLAUDE.md` §12 |
| SQL service API contract | `D:\NNP\AI\ai-sql-query-observability-service\CLAUDE.md` §12 |
| SQL service backend architecture + dataflow | `D:\NNP\AI\ai-sql-query-observability-service\CLAUDE.md` §13 |
| SQL service env vars | `D:\NNP\AI\ai-sql-query-observability-service\CLAUDE.md` §14 |
| SigNoz / ClickHouse schema assumptions | `D:\NNP\AI\ai-sql-query-observability-service\CLAUDE.md` §16 |
| Streamlit-UI patterns the new React UI is replacing | `D:\NNP\AI\ai-sql-query-observability-service\CLAUDE.md` §3–§5b |
| Draft CoreComp ERD | `D:\NNP\AI\DMS CoreComp Schema.pdf` |

---

## 8. Open decisions

These need product / architecture input before they can be resolved in code:

1. **Where does CoreComp CRUD live?** New service, or extend one of the existing three? Recommended: new lightweight FastAPI in its own repo, since the table set is shared across all three feature areas and none of the existing services own it.
2. **Auth model.** PORTAL-issued session cookie? OIDC? API gateway with mTLS? Need a decision before the React UI can stop being open.
3. **Multi-tenant Milvus.** Today the ingestion and SQL services share one collection. Per-Account isolation likely needs a per-Account collection or a filter column — flag during the schema review. → **Direction set (§11):** isolation is now **per-bucket, not per-account** — `nnp_km_buckets.bucket_name` doubles as the Milvus collection name. Each bucket maps to its own Milvus collection; accounts reach buckets via the M:N map. Backends still need to be updated to honour per-bucket collections (they currently hardcode one shared collection).
4. **Streaming.** Worth investing in real streaming on `/query/stream`? Or commit to non-streaming and design the UX accordingly?
5. **CoreComp draft schema fixes.** → **Resolved (§11):** v1 schema committed as `coreComp_schema.sql`. Remaining schema-adjacent confirmations are listed in §11.
6. **RBAC ownership.** Is authorization entirely PORTAL's responsibility (CoreComp trusts the `X-User-*` headers), or does CoreComp need its own role/permission tables? Still open; v1 only adds `created_by`/`updated_by` audit columns.

---

---

## 9. Post-clone snapshot of `src/` (what's actually in the repo today)

Added after cloning the real repo. This is purely the *as-built* state — §1–§4 describe what the UI is *meant* to become.

### 9.1 Directory layout

```
src/
  App.tsx                  routes (see §1 routes table)
  App.scss                 global styles
  main.tsx                 entry — wraps <App/> in <StrictMode> + MUI <ThemeProvider createTheme({})>
  index.css                Tailwind directives
  vite-env.d.ts
  assets/                  NNP_logo.png, logonnp.png, user-icon.png, react.svg
    json/                  ~30 LCNC building-block templates (AMQPConsumer, KafkaPublisher, JMSConsumer, RestPublisher, Entity, Assembler, ...) + partials/. Used by the wizard flow under /module/:id, NOT by the KM surfaces.
  components/              LCNC wizard UI — platform-spec, api-spec, api-spec-table, add-new-component, component-card, wizard-modal, wizard-elements, tree-table-example. None of these are used by /dashboard or /sql-query.
  contexts/
    ToasterContext.tsx     toast/snackbar provider, wraps the app
    YamlTemplateContext.tsx LCNC-only — tracks YAML repositories/exceptions/models/topics/brokerType + a provider-registry pattern; not used by KM
  guards/
    protected_routes.guard.tsx   EMPTY FILE (0 bytes) — placeholder
  pages/
    dashboard.tsx          KM home — mock-only (see §1 table)
    sqlquery.tsx           SQL Query — mock-only
    module.tsx             LCNC module shell
    not_found.tsx          404
  services/
    api.service.tsx        fetch wrapper — see §9.2
    configuration.service.ts LCNC — /getGroups, /getCompSpecOnCamp, /getCodeGenStatus, /getApi, /getYamlMap, /publish
    configurator.service.ts LCNC — /lcncconfig/bb/getBB
    transation.service.tsx (sic) LCNC — /jobs/by-user/:user, /generateRequest, /validateAppName
    toaster.service.ts     toast helpers
    logger.service.ts      console wrapper
  shared/
    utils.tsx              formatSelectOptions, alertAction, getEnvCode, getXUser, getXuserType, convertDateNative, getFormattedDateTime
    config/                grid.config.tsx, input.cofig.tsx (sic), theme.tsx
    layout/                header.tsx (used), topbar.tsx (used), navbar.tsx (UNUSED by App.tsx), navItem.tsx, loader.tsx
    types/                 building-block, api, api-status, component-stats, component-status, customAccordionOption, general-section-form, group, inputconfig, modal, module, nav, yaml-info — all LCNC types; nothing KM-specific yet
  widgets/                 reusable MUI widgets: accordionComponent, confirmDialog, dataGrid (MUI X DataGrid wrapper), dynamicChart (Chart.js wrapper), dynamicForm (large react-hook-form-driven form generator), editor (react-ace), modal, tree-table
public/
  vite.svg
  logo/                    logo.png, logonnp1.png, nnp-logo.png
```

**Implication for KM work.** The Knowledge Management features (Dashboard, SQL Query) are bolted onto an existing LCNC/Programado portal codebase. Most of `src/components/`, `src/widgets/dynamicForm.tsx`, `src/contexts/YamlTemplateContext.tsx`, and `src/assets/json/*.template.json` is LCNC machinery. When sizing KM work, don't assume those files are reusable — they may be deletable once the `/module/*` routes are migrated out of this repo, and they're not the right starting point for KM forms.

### 9.2 What `ApiService` already does (and doesn't)

`src/services/api.service.tsx`:

- Wraps `fetch` with `get` / `post` / `put` / `delete`, JSON-only.
- Auto-sets headers `Content-Type: application/json`, `X-Env-Code` (from cookie `X-Env`, defaulting to `{envCode: 'REL-V2023.01'}`), `X-User-Type` (cookie `X-User-Type`, defaulting to `'pgadmin'`), `User` (cookie `X-User-Name`, defaulting to `'pgadmin'`). Confirms the auth model: **PORTAL sets these cookies before redirecting to the KM UI.**
- On HTTP 401: redirects browser to `${window.location.origin}/nnp-login/continue=${currentUrl}`. So the implicit answer to "Auth model" (§8.2) is "PORTAL-issued session cookies + a `/nnp-login` page handles SSO". Confirm with the platform team before locking that in.
- On non-2xx (non-401): throws `new Error(response.statusText)` — loses the response body, loses the `X-Request-ID` header. **Both need fixing before wiring the ingestion service**, whose error contract is `{detail, request_id}` + `X-Request-ID` header.
- Returns `null` for 204 / non-JSON responses.
- No timeout, no retry, no multipart, no streaming, no abort. Add per call site.

**Defaults that are foot-guns in dev:**

- `getXuserType()` defaulting to `'pgadmin'` means "if no cookie, claim superadmin". Set the cookie in dev or change the default to `'guest'`.
- `getXUser()` similarly defaults to `'pgadmin'`.
- `TopBar` hardcodes `const username = "nubodemo"` (`src/shared/layout/topbar.tsx:12`) — the displayed user is not from the cookie at all. Fix before non-local use.
- `TopBar` logout (`handleLogout`) does `window.location.reload()` — does not call PORTAL logout, does not clear cookies.

### 9.3 GitLab CI / deploy summary

`.gitlab-ci.yml` includes shared `devops-templates`:

- `node-package-build-template.yml` (build stage)
- `sast-template.yaml` (security-tests stage)
- `container-build-template.yml` (publish stage)
- `k8s-deployment-template.yaml` (deploy stage)

Stages: `build → security-tests → publish → test → deploy → post-deploy`.

Variables set in `.gitlab-ci.yml`: namespace `nnp-core-components`, service type `NodePort`, port `8080`, replicas `1`, request 100Mi/50m, limit 1Gi/500m. `APP_NAME` / `APP_LABEL` = `$CI_PROJECT_NAME` (so `knowledge-management`).

Dockerfile: NNP-internal nginx 1.24 base, `dist/` copied to `/srv/www/htdocs/nnp-km/`, `default.conf` is the SPA-fallback nginx config.

### 9.4 Resolved / refined items from earlier sections

| Earlier note | What the code now tells us |
|---|---|
| §1 "no Redux/Zustand pulled in yet" | Still true — state lives in component-local `useState` and two `useContext` providers (`ToasterContext`, `YamlTemplateContext`) |
| §5 "axios (or fetch) instance per backend" | The codebase has already chosen `fetch` (no axios). Match that. |
| §5 "Sample envs: `dot_env.dev`, `dot_env.production`" | Already renamed to `.env`, `.env.dev`, `.env.production`. Two of them have broken syntax (see §5). |
| §8.2 "Auth model" | Strongly implied to be **PORTAL-issued cookies + redirect-to-`/nnp-login` on 401** (`ApiService` + cookie reads in `shared/utils.tsx`). Confirm with the team. |

### 9.5 New items to raise

1. **`src/guards/protected_routes.guard.tsx` is empty (0 bytes).** Either remove it or implement the guard — currently it just confuses readers.
2. **`shared/layout/navbar.tsx` is not wired into `App.tsx`** but is fully written. Either delete it or mount it somewhere.
3. **Hardcoded JSON imports.** `src/assets/json/*.template.json` is imported by the LCNC wizard at build time. KM features should NOT extend this pattern — bucket / Q&A / database configs need to come from the CoreComp API layer (§4) at runtime, not from bundled JSON.
4. **`input.cofig.tsx` typo** in `src/shared/config/`. Cosmetic but propagates if anyone autocompletes it.
5. **`transation.service.tsx` typo** (should be `transaction.service.tsx`). Again cosmetic — fine to leave until a broader cleanup.

---

---

## 10. React ↔ Streamlit screen mapping

Cross-walk between the four React surfaces and the three Streamlit apps, by **inputs → outputs → displays**. Treat this as a working hypothesis to cross-verify with the product owner — naming is inconsistent between sides and a couple of mappings are best-guess (flagged inline).

The React `/module/*` routes are LCNC wizard code (see §9.1) and have no Streamlit equivalent in any of the three sibling services; they're omitted from this map.

### 10.0 Screen-level map

| React surface | File | Closest Streamlit surface | Strength |
|---|---|---|---|
| `/dashboard` — **search view** | `src/pages/dashboard.tsx` (`currentView === 'search'`) | `ai-data-query-service/src/ui/app.py` (whole page) | **Strong (1:1 concept)** |
| `/dashboard` — **configure view** | `src/pages/dashboard.tsx` (`currentView === 'configure'`) | `ai-data-ingestion-service/src/ui/streamlit_app.py` (the 6 tabs) | **Partial (4 of 6 tabs align; bucket/account panels are new)** |
| `/sql-query` — **search view** | `src/pages/sqlquery.tsx` (`currentView === 'search'`) | `ai-sql-query-observability-service/src/ui/app.py` (top half) | **Partial (inputs match, outputs almost entirely missing)** |
| `/sql-query` — **configure view** | `src/pages/sqlquery.tsx` (`currentView === 'configure'`) | *None* | **No counterpart — pure CoreComp CRUD** |

### 10.1 `/dashboard` search view ↔ `ai-data-query-service` Streamlit

**File on the Streamlit side:** `D:\NNP\AI\ai-data-query-service\src\ui\app.py` (entire `main()`).

**Inputs**

| React control (`dashboard.tsx`) | Streamlit control | Maps to `POST /query` field |
|---|---|---|
| Sidebar range slider "No of Sources" | `st.slider("Number of sources", 1, 20, value=5)` | `top_k` |
| Sidebar range slider "Similarity Threshold" | `st.slider("Similarity threshold", 0.0, 1.0, value=0.4, step=0.05)` | `similarity_threshold` |
| Sidebar checkbox "Show Source Document" | `st.checkbox("Show source documents", value=True)` | `include_sources` |
| Sidebar checkbox "Extend with public information" | *No equivalent* | **Best guess:** toggles `mode` between `milvus_only` and `auto`/`hybrid` (which already falls back to OpenAI when nothing matches). Confirm with product before wiring |
| Main `<textarea>` "Type your query here..." | `st.text_area("Enter your query:")` | `query` |
| "Search Repository" button | "Search" button (`type="primary"`) | submit |
| *Missing from both:* mode selector, `search_gitlab`, `gitlab_projects`, `file_extensions` | (also missing from Streamlit) | `mode`, `search_gitlab`, `gitlab_projects`, `file_extensions` from `QueryRequest` — feature gain opportunity |

**Outputs / displays**

| React display | Streamlit display | Backend field |
|---|---|---|
| "Query Performance" answer panel | `<div class="answer-box">{response["answer"]}</div>` | `response.answer` |
| **Missing in React:** 4-card Performance row (Embedding / Search / Total Time / Sources) | `st.metric`-card × 4 | `metadata.embedding_time`, `metadata.search_time`, `processing_time`, `total_sources` — per §2.2 the first three are **always 0** (endpoint never sets them); render only `total_sources` until backend fixed |
| **Missing in React:** per-source expander list (content preview + similarity score + metadata JSON) | `st.expander(f"Source {i} — {source_type.title()} — Score: {similarity:.1%}")` with nested `st.text_area(content)` + `st.json(metadata)` | `response.documents[]` (NOT `response.sources` — see §2.2 binding warning) |
| Sidebar "Recent Questions" (dynamic list, full history) | Sidebar "Recent Queries" (last 5 buttons) | `st.session_state.query_history` (client-only) |
| "Copy Answer" button | "Copy Answer" + "Export JSON" download | client-only |
| **Missing in React:** Export JSON | `st.download_button("Export JSON", json.dumps(response, indent=2))` | client-only |

**Surfaces unique to React**

- "NEW QUERY" reset button (Streamlit has no explicit reset — just refresh).
- "CONFIGURE KNOWLEDGE BASE" mode switch → goes to surface 10.2 (no Streamlit equivalent).

---

### 10.2 `/dashboard` configure view ↔ `ai-data-ingestion-service` Streamlit (6 tabs)

**File on the Streamlit side:** `D:\NNP\AI\ai-data-ingestion-service\src\ui\streamlit_app.py` — single-page with 6 `st.tabs`.

The React upload tabs are a subset of the ingestion tabs. The Bucket/Accounts panels above the tabs are entirely new (CoreComp-driven, no Streamlit counterpart).

**Tab mapping**

| React tab (`TabState`) | Streamlit tab | Backend endpoint | Inputs match? |
|---|---|---|---|
| **Documents** | **Document Upload** | `POST /ingest/document/upload` (single) + `POST /ingest/document/upload/multiple` | Streamlit: `st.radio("Upload Mode", ["Single File", "Multiple Files"])` + `st.file_uploader(type=["pdf","docx","yaml","yml","json"])`. React: placeholder "Select Documents" pill + "Upload Document" button — no file picker wired, no single/multi toggle |
| **Web Pages** | **Web Pages** | `POST /ingest/web` + `POST /ingest/web/multiple` | Streamlit: `st.radio("Select Mode", ["Single URL","Multiple URLs"])` + URL `text_input` / batch `text_area` + delay `st.slider`. React: tab exists but content not rendered |
| **Google Drive** | **Google Drive** | `POST /ingest/gdrive` | Streamlit: folder/file mode `radio` + auth method `radio` (service_account JSON `file_uploader` OR credentials.json `file_uploader`) + folder_id / file_id `text_input`. React: tab exists, no UI |
| **Code Repository** | **Git Repository** | `POST /ingest/git` | Streamlit: git URL + branch + expander with username + PAT, "Clone & Ingest". React: tab exists, no UI. **Suggest renaming React tab to "Git Repository"** to match backend wording |
| **Incident Repo** | **Redmine** | `POST /ingest/redmine` | Streamlit: redmine URL + API key + project ID `text_input`. React: tab exists, no UI. **"Incident Repo" is a vague label** — pick "Redmine" or "Issue Tracker" |
| *(none — missing tab)* | **ArgoCD** | `POST /ingest/argocd` | Streamlit: `argocd_server` + `argocd_token` + `argocd_app` `text_input`. **Add an ArgoCD tab to React, or de-scope explicitly** |

**Outputs (per upload)**

| React display | Streamlit display | Backend field |
|---|---|---|
| List of uploaded doc names (local-state only) | Success-box with `chunks_created` / `documents_processed` / `vectors_stored` / `duplicates_skipped` + timestamp; branches: "Already Exists" when `duplicates>0 && vectors==0`, "Partial" when `duplicates>0 && vectors>0`, "Success" otherwise | `details.chunks_created`, `details.documents_processed`, `details.vectors_stored`, `details.duplicates_skipped` |
| **No error display** | Error-box: `parse_error_response()` text + HTTP code + `X-Request-ID` (loaded via `get_request_id()` which checks response headers AND `payload.request_id` fallback) | `detail` body + `X-Request-ID` response header. **`ApiService` must be extended to surface this** (§5 Backend connectivity todo) |
| **No header metrics** | Header strip "Total Vectors: N \| Total Chunks: M" pulled from `GET /stats` + `GET /metrics/ingestion` on every page render | `stats.row_count`, `metrics.total_chunks`. Note §2.1: `INGESTION_METRICS` resets on restart — "Total Chunks" can drop unexpectedly |
| **No multi-file summary** | "Files Summary" panel with total size + expander "View files"; "Processed Files" expander + "Failed Files" expander for `/upload/multiple` | `processed_files[]`, `failed_files[]` arrays from the multi-upload response envelope |

**Surfaces unique to React (CoreComp-driven, no Streamlit equivalent)**

- **"Manage Knowledge Buckets" panel** — Select Bucket dropdown, Bucket Category dropdown, Description textarea. Maps to `NNP_KM_BUCKETS` (ID, BUCKET_NAME, BUCKET_CATEGORY, BUCKET_DESC).
- **"Assigned Accounts" panel** — list with Edit (E) / Remove (⊗) buttons, "Assigned Account to Bucket +" button. Maps to `ACCOUNT` ↔ `NNP_KM_BUCKETS.ACCOUNT_ID` relationship.
- Both need a CoreComp CRUD API that doesn't exist yet (§8.1 open decision).

---

### 10.3 `/sql-query` search view ↔ `ai-sql-query-observability-service` Streamlit

**File on the Streamlit side:** `D:\NNP\AI\ai-sql-query-observability-service\src\ui\app.py` (entire `main()`, top half).

**Inputs**

| React control (`sqlquery.tsx`) | Streamlit control | Maps to `POST /query` field |
|---|---|---|
| Main `<textarea>` (NL question) | `st.text_area("Enter your query:")` inside `st.form` (Enter-to-submit) | `query` |
| Sidebar checkbox "Show Graph" | Top-of-page `st.checkbox("Generate chart if possible", value=True)` (centered in narrow column) | `include_chart` |
| **Missing in React:** chart type selector | `st.selectbox("Chart type", options=["auto","bar","line","pie","scatter","table"], index=0)` | `chart_type` |
| "Show Result" button | "Query" `st.form_submit_button(type="primary")` | submit |
| **Missing in React:** Clear button | `st.form_submit_button("Clear")` → resets `current_response` + `query_input` + `st.rerun()` | client-only |
| Sidebar "Recent Data Questions" (full history, dynamic) | "Recent Queries" expander (last 5 `st.button`s) | `st.session_state.query_history` |

**Outputs / displays**

| React display | Streamlit display | Backend field |
|---|---|---|
| Single answer text box ("Data results will appear here...") | "Summary" section: `<div class="answer-box">{response.answer}</div>` | `response.answer` |
| **Missing in React:** Generated SQL panel (read-only) | `st.code(response["sql_query"], language="sql")` | `response.sql_query` — **render even on execution failure** per §2.3 (SQL gen can succeed even when execution fails) |
| **Missing in React:** Plotly chart | `st.plotly_chart(plotly.graph_objects.Figure(response["chart"]))` | `response.chart` (Plotly figure JSON). **Needs `plotly.js` added to `package.json`** (Chart.js is the current chart lib but Plotly JSON isn't directly convertible) |
| **Missing in React:** Result table | `st.dataframe(pd.DataFrame(rows, columns=cols))` | `response.sql_data.columns` + `.rows`. Every cell is a **string** per §2.3 — format with MUI X DataGrid `valueFormatter` |
| **Missing in React:** "Database used: …" caption | `st.caption(f"Database used: {meta['database']}")` | `response.metadata.database` |
| **Missing in React:** Performance side-column (Processing Time + Rows) | `st.metric("Processing Time", f"{...:.2f}s")` + `st.metric("Rows", row_count)` | `response.processing_time`, `response.sql_data.row_count` |
| "Download CSV" button (currently just `alert("Downloading CSV...")`, not implemented) | `st.download_button("Download JSON")` + "Show Answer Text" button | client-side: CSV from `sql_data.rows`, JSON from whole response |

**Layout suggestion for the React surface** to absorb the missing displays:

```
[ NL question textarea + Show Result button ]
[ Summary  (response.answer) ]
[ Generated SQL — react-ace (mode=sql, readOnly) ]      ← dep already present
[ Visualization — Plotly chart ]                         ← needs plotly.js dep
[ Result Rows — @mui/x-data-grid (valueFormatter) ]     ← dep already present
[ Database used: <metadata.database>   |   Processing time: Xs  |  Rows: N ]
```

The React side is essentially **one display surface short** here — it shows the chat-style answer but throws away `sql_query`, `chart`, `sql_data`, and `metadata.database`. The Streamlit page renders all four.

---

### 10.4 `/sql-query` configure view ↔ *(nothing on the Streamlit side)*

**No equivalent in any sibling Streamlit UI.** Pure CoreComp CRUD over `NNP_KM_DATABASE` + `NNP_DATABASE_Q`. Backed by an API layer that doesn't exist yet (§8.1 open decision).

**Column mapping — "Manage Data Sources" table ↔ `NNP_KM_DATABASE`**

| React table column | CoreComp column (`NNP_KM_DATABASE`) | Notes |
|---|---|---|
| DATABASE URL | likely `SCHEMA_URL` *or* a new `CONNECTION_URL` column | Diagram shows only `SCHEMA_URL`; semantics unclear (§8.5 open). Confirm |
| DATABASE TYPE | `DATABASE_TYPE` | |
| DESCRIPTION | `DATABESE_DESC` (sic — typo in diagram) | §8.5 open |
| ACCOUNT | derived from parent bucket → `NNP_KM_BUCKETS.ACCOUNT_ID` → `ACCOUNT` | Not stored on `NNP_KM_DATABASE` directly |
| STATUS | `STATUS` | |
| ACTIONS (E / X) | UI-only | edit / soft-delete |

**Column mapping — "Manage Specific Data Queries" table ↔ `NNP_DATABASE_Q`**

| React table column | CoreComp column (`NNP_DATABASE_Q`) | Notes |
|---|---|---|
| NAME | `QUERY_NAME` | |
| DESCRIPTION | `QUERY_DESC` | |
| CONTEXT | `QUERY_CONTEXT` | |
| QUERY | `QUERY_TEXT` | Render with `react-ace` (mode=sql) on edit |
| ACCOUNT | via `NNP_DATABASE_Q.DATABASE_ID → NNP_KM_DATABASE.BUCKET_ID → NNP_KM_BUCKETS.ACCOUNT_ID` | Two-hop derivation |
| STATUS | `STATUS` | |
| ACTIONS (E / X) | UI-only | |

**Cross-link with the SQL service that should exist but doesn't yet:**

- When `POST /query` succeeds, the SQL service writes the `(question, SQL)` pair to Milvus with `quality_score: 0.7` (per §2.3 — continuous-learning loop). These exemplars are invisible today. The configure view should let users **see** them and **promote** ones they like into `NNP_DATABASE_Q` (giving them a `QUERY_NAME` + curated `QUERY_DESC`), so curated queries get more weight than auto-collected ones.
- Diagram has no `CREATED_AT`/`UPDATED_AT` on `NNP_DATABASE_Q` (§8.5 open) — recommend adding before locking the table.

---

### 10.5 What only Streamlit has (gaps to close in React)

- Ingestion: live header metrics (`/stats` + `/metrics/ingestion`)
- Ingestion: ArgoCD tab
- Ingestion: error display surfacing `X-Request-ID` (load-bearing for backend log correlation per §2.1)
- Ingestion: per-tab Multi-file "Processed/Failed Files" expanders
- Query: per-source expander list (`documents[]` content + metadata viewer + similarity score)
- Query: Performance cards (only `total_sources` is real — the other three are always 0 per §2.2; render conditionally)
- Query: Export JSON download
- SQL: Generated SQL code panel
- SQL: Plotly visualization
- SQL: result-rows DataFrame
- SQL: chart-type selector
- SQL: "Database used" caption + Performance side-column
- SQL: Download JSON

### 10.6 What only React has (new product scope — no Streamlit equivalent)

- Single unified topbar that toggles between Knowledge Base and SQL Query (Streamlit ships three separate apps on three separate ports)
- "NEW QUERY" reset buttons on both pages
- Knowledge Base **Bucket** selector + Description (→ `NNP_KM_BUCKETS`)
- Knowledge Base **Assigned Accounts** panel (→ `ACCOUNT` ↔ `NNP_KM_BUCKETS`)
- SQL Query **Manage Data Sources** table (→ `NNP_KM_DATABASE`)
- SQL Query **Manage Specific Data Queries** table (→ `NNP_DATABASE_Q`)
- Per-account multi-tenant scoping (implied by `ACCOUNT` FK — see Open Decision §8.3 for Milvus implications)

### 10.7 Naming inconsistencies to reconcile

These will trip people up. Pick one term per concept and use it consistently across React, the CoreComp schema, and the Streamlit-replacement docs:

| Concept | React label | Streamlit label | Backend / schema term |
|---|---|---|---|
| Git source | "Code Repository" | "Git Repository" | `POST /ingest/git` |
| Issue tracker | "Incident Repo" | "Redmine" | `POST /ingest/redmine` |
| KB query result list | "Sources" (implied) | "Source Documents" | `documents` (NOT `sources` — §2.2 binding warning) |
| NL data question | "Data Question" | "Data Question" | `query` |
| Chart-on/off | "Show Graph" | "Generate chart if possible" | `include_chart` |
| KB question history | "Recent Questions" | "Recent Queries" | client-side `query_history` |
| SQL question history | "Recent Data Questions" | "Recent Queries" | client-side `query_history` |

---

---

## 11. CoreComp schema — v1 finalised (2026-05-21)

The draft ERD (§3) has been turned into a concrete v1 PostgreSQL schema, agreed with the stakeholder. Two new files in the repo root are the authoritative artefacts:

| File | Purpose |
|---|---|
| `coreComp_schema.sql` | **Runnable** v1 DDL (PostgreSQL). Tables, indexes, the shared `set_updated_at()` trigger, and full `COMMENT ON` documentation queryable via `\d+`. See its CHANGELOG header for v1.1 tweaks. |
| `databaseschema.md` | Column-by-column rationale, type best-guesses, recommended additions, and the decision list taken to leadership. Reference doc — the SQL file is the source of truth for what was actually built. |
| `services-design.md` | The four CoreComp CRUD services (`manageBucket`, `manageBucketDetails`, `manageQuestions`, `manageDataSql`) — endpoints, request/response shapes, SQL, and the decision log (D1–D14). Driven by `Project_Input.txt`. |
| `Project_Input.txt` | Raw tech-lead direction that resolved the service-design decisions. |

### 11.1 Tables in v1

```
PORTAL.NNP_ACCOUNT  (external)
   │  (M:N)
   └── nnp_account_bucket_map (account_id, bucket_id)   ← NEW junction table
          │
          └── nnp_km_buckets
                 ├── nnp_bucket_details
                 ├── nnp_km_qa
                 └── nnp_km_database
                        └── nnp_database_q
```

### 11.2 Key decisions baked into v1 (differs from the draft ERD)

1. **Primary keys are `UUID`** (`gen_random_uuid()`), not BIGSERIAL — IDs cross service boundaries and appear in URLs; non-enumerable + client-allocatable.
2. **`ACCOUNT_ID` removed from `nnp_km_buckets`.** Account↔bucket is now **many-to-many** via the new `nnp_account_bucket_map` (two columns only: `account_id`, `bucket_id`; composite PK). This is a deliberate change from the draft's 1:N.
3. **`account_id` is `VARCHAR(64)`**, treated as **external** (PORTAL-owned) — **no FK** on it. Its exact type still needs to be confirmed against `PORTAL.NNP_ACCOUNT.ID`.
4. **`bucket_name` doubles as the Milvus collection name** — no separate `MILVUS_COLLECTION` column. ⚠ This means the **UI must enforce Milvus naming rules** on `bucket_name`: letters/digits/underscores only, start with a letter or underscore, ≤255 chars, **globally unique** within the Milvus DB. There is no DB-level CHECK/UNIQUE guarding this. This also sets the multi-tenant-Milvus direction to **per-bucket collections** (see §8.3).
5. **`SCHEMA_URL` dropped → `connection_url`** (a credential-less programmatic DB connection URL) + **`credential_ref`** (name of the secret holding credentials). Credentials must never be inlined into `connection_url`.
6. **`DATABESE_DESC` typo fixed → `database_desc`.**
7. **`nnp_database_q` gained `created_at` / `updated_at`** (missing from the ERD).
8. **All recommended-addition columns from `databaseschema.md` were accepted** across every table (Milvus round-trip columns on `nnp_bucket_details`; `question_embedding_id` / `match_threshold` / `times_matched` on `nnp_km_qa`; `keywords` / `credential_ref` on `nnp_km_database`; `milvus_exemplar_id` / `quality_score` / `times_used` on `nnp_database_q`; `created_by` / `updated_by` audit columns everywhere). These are kept for now and may be pruned later once usage is validated.
9. **`nnp_km_qa.answer` is plain text**; **`rank` is a user-supplied 1..5** (validated in the UI).

### 11.3 v1 validation philosophy — PERMISSIVE (important for anyone writing the CRUD API)

The schema intentionally pushes **all data validation to the UI / application layer**:

- **No `NOT NULL`** on data columns. The only `NOT NULL` is the implicit one on PK columns (`id`; and the mapping table's `account_id` + `bucket_id` via its composite PK).
- **No `CHECK` constraints.** Status value sets, `rank` 1..5, `quality_score` / `match_threshold` 0..1, and `database_type` are *not* enforced by the DB — only documented as the expected vocabulary in column comments. The CRUD API/UI is responsible for enforcing them.
- **No `UNIQUE` constraints.** Where uniqueness matters — `(bucket_id, database_name)`, `(bucket_id, milvus_source_id)`, and `bucket_name`-as-Milvus-collection — there is only a plain index for lookup speed; the UI must prevent duplicates.
- **Retained (structural, not validation):** PKs (identity), FKs (`ON DELETE CASCADE` for the M:N + parent/child links), `DEFAULT`s (uuid/timestamps/counters/status seed), and the `set_updated_at()` trigger on all five mutable tables.
- **Implication:** do not assume the DB will reject bad data. When building the CoreComp CRUD service, replicate the documented value sets / ranges / uniqueness in the API layer. When v1 stabilises, consider promoting these into real DB constraints.

### 11.3a v1.1 schema tweaks (2026-05-21, from service design — see `services-design.md` / `Project_Input.txt`)

- **`nnp_km_buckets`** — added `error_detail`; `status` now created as `PROVISIONING`. Milvus collection creation is done by a **separate async provisioning service** (collection name = `bucket_name`) whose callback flips status to `ACTIVE`/`FAILED` and writes `error_detail`. `updateBucket` now also manages the M:N account mapping (multi-account).
- **`nnp_bucket_details`** — added `error_detail`. `createBucketDetails` calls the ingestion service **async**; an ingestion callback finalises `status` + the `milvus_*` columns. Soft-delete must call `delete_by_source(milvus_source_id)` (ingestion HTTP endpoint still missing).
- **`nnp_km_database`** — added `training_script` (Vanna context, read by a separate Vanna service); **removed `credential_ref`** (DB credentials are supplied by the user at runtime, never stored; the service rejects `user:pass@` URLs). This service does **no** Milvus interaction.
- **`nnp_km_qa`** — unchanged; question embedding is handled by a separate process, so `question_embedding_id` is populated out-of-band.

### 11.4 Still to confirm (carried forward)

- Exact type of `PORTAL.NNP_ACCOUNT.ID` (drives `account_id`); and whether PORTAL lives in the **same** Postgres DB (would allow a real FK on the mapping table).
- That the UI enforces the Milvus naming rules on `bucket_name` (§11.2 item 4).
- `database_type` allowed-value set (currently unconstrained).
- `query_context` semantics on `nnp_database_q` (NL question for Vanna training vs free-text label).
- RBAC ownership (§8.6).
- ~~No CoreComp CRUD service exists yet~~ → **Resolved (§12):** the CRUD service `ai-km-service` has been built in its own repo.

---

## 12. Service backend — `ai-km-service` (separate repo)

The CoreComp CRUD backend has been built as its own repo (not in this UI repo):

- **Location:** `D:\NNP\AI\ai-km-service` · **Git:** `https://nnprepo.nubons.com/nnp-workzone/ai/nnp-ai-km/ai-km-service.git` (branch `main`, pushed).
- **Stack:** FastAPI (Python 3.13), one deployable, four routers — `manageBucket`, `manageBucketDetails`, `manageQuestions`, `manageDataSql` — over the `nnp-rag` Postgres schema. Inherits config/logger/app-bootstrap/Docker/k8s/CI conventions from the three sibling Python services.
- **Status:** code complete and runnable (flags for the not-yet-existing Milvus-provision / async-ingest / Vanna services are OFF by default); not yet deployed; tests + soft-delete endpoints still to do.
- **Authoritative docs (in that repo):** `ai-km-service/CLAUDE.md` (full service context + roadmap), `ai-km-service/ARTIFACTS.md` (file-by-file new-vs-inherited inventory), `ai-km-service/README.md`.

**This UI's job later** (per §10): wire the `/dashboard` and `/sql-query` configure screens to these endpoints. The React `ApiService` already sends the `User` header this service reads for `created_by`/`updated_by`. That integration work is tracked separately and will happen in this repo.

---

*Last updated: 2026-05-22. §1/§5 reflect the cloned repo state; §9 is the as-built UI snapshot; §10 is the React-↔-Streamlit screen mapping; §11 is the finalised v1 CoreComp schema (`coreComp_schema.sql` is the source of truth); §12 points to the `ai-km-service` backend repo. When the LCNC wizard code under `/module/*` is migrated out, delete the corresponding rows from §9.1.*
