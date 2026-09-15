<h1 style="color:#1f4e79; border-bottom:3px solid #53a7ba; padding-bottom:8px;">
  SQL Query UI Flow
</h1>

<p>
  This document explains the <strong>SQL Query</strong> UI and working flow based strictly on the current code files in the working tree.
</p>

> **Route Entry:** The SQL Query page is routed from `src/App.tsx` to `src/pages/sqlquery.tsx` at `/sql-query`.

| # | UI Section | Purpose |
|---|------------|---------|
| 1 | <span style="color:#4a77b4;"><strong>Page Initialization</strong></span> | Load buckets, data sources, and recent SQL history |
| 2 | <span style="color:#4a77b4;"><strong>New Query</strong></span> | Reset SQL search state |
| 3 | <span style="color:#4a77b4;"><strong>Recent Data Questions</strong></span> | Re-run previous SQL data questions |
| 4 | <span style="color:#4a77b4;"><strong>Query Settings</strong></span> | Toggle graph rendering |
| 5 | <span style="color:#4a77b4;"><strong>Database Selector</strong></span> | Choose a database or let backend auto-select |
| 6 | <span style="color:#4a77b4;"><strong>Show Result</strong></span> | Run natural-language SQL query |
| 7 | <span style="color:#4a77b4;"><strong>Result Display</strong></span> | Show answer, database info, SQL, errors, chart, and table |
| 8 | <span style="color:#4a77b4;"><strong>Export, Feedback, Promote</strong></span> | Download result data, submit feedback, promote generated SQL |
| 9 | <span style="color:#4a77b4;"><strong>Configure Data Sources</strong></span> | Manage databases and SQL training context |
| 10 | <span style="color:#4a77b4;"><strong>Training Data Modals</strong></span> | Add/edit training queries, DDL, rules, and view training data |

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  1. Page Initialization
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  Page initialization loads the current user's buckets, related SQL data sources, and recent SQL query history.
</div>

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/App.tsx` | Routes `/sql-query` to `SqlQuery`. |
| `src/pages/sqlquery.tsx` | Main SQL Query page state, loading, search, configure UI, and modal logic. |
| `src/services/kmApiService.ts` | Shared API wrapper used by SQL Query API calls. |
| `src/types/km.ts` | Defines `Bucket`, `KmDatabase`, `KmSqlQuery`, `KmDdl`, and `KmRule`. |
| `src/shared/utils.tsx` | Provides `getXUser()` and `getXuserType()` for user and role checks. |

### Complete Working Flow

1. **User opens SQL Query**
   - Top navigation can route to `/sql-query`.
   - `src/App.tsx` renders `SqlQuery` from `src/pages/sqlquery.tsx`.

2. **Loading state starts**
   - `loadingInit` is set to true.
   - `initError` is cleared.

3. **User and role are detected**
   - `getXUser()` gets the current user.
   - `getXuserType()` gets the current user type.
   - Super admin status is calculated.

4. **Buckets are loaded**

```text
GET /manageBucket/getDetails/{user}
```

5. **SQL data sources are loaded**
   - If buckets exist, their IDs are joined into a comma-separated list.

```text
GET /manageDataSql/getDetails?bucketIds={bucketIds}
```

6. **Databases are filtered**
   - Super admins can see all returned databases.
   - Non-super-admin users see only databases they created where they also own the bucket.

7. **Recent SQL history is loaded**

```text
GET /manageSqlQuery/getHistory?limit=30
```

   - SQL history keeps records where `sql_text` or `db_name` exists.
   - Duplicate questions are removed.

### Related Code Flow

```text
src/App.tsx
  -> /sql-query
  -> SqlQuery

src/pages/sqlquery.tsx
  -> useEffect on mount
  -> getXUser() / getXuserType()
  -> kmApi.get('/manageBucket/getDetails/' + user)
  -> kmApi.get('/manageDataSql/getDetails?bucketIds=' + ids)
  -> fetchQueryHistory()
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  2. New Query
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>New Query</strong> button resets the SQL query search screen.
</div>

### Complete Working Flow

1. **User clicks New Query**
   - The left sidebar button calls `handleNewQuery()`.

2. **State is reset**
   - `currentView` becomes `'search'`.
   - `searchQuery` becomes empty.
   - `result` becomes null.
   - `searchError` becomes null.

3. **Search view is displayed**
   - Main content returns to the query textarea and result area.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> New Query button
  -> handleNewQuery()
  -> setCurrentView('search')
  -> setSearchQuery('')
  -> setResult(null)
  -> setSearchError(null)
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  3. Recent Data Questions
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  <strong>Recent Data Questions</strong> lists recent SQL-related questions and lets the user re-run them.
</div>

### Complete Working Flow

1. **History is loaded on page initialization**

```text
GET /manageSqlQuery/getHistory?limit=30
```

2. **SQL history is filtered**
   - Records are kept when `sql_text` or `db_name` exists.
   - This separates SQL Query history from Knowledge Base history.

3. **Duplicate questions are removed**
   - A `Set` tracks question text.
   - Only the first instance of each question is kept.

4. **Sidebar renders history**
   - If `history.length === 0`, the UI shows `No recent questions`.
   - Each history item shows the question.
   - If `db_name` exists, it is shown below the question.
   - If `has_error` is true, an error marker is rendered.

5. **User clicks a history item**
   - `handleHistoryClick(item)` runs.
   - It switches to search view.
   - It clears search error.
   - It calls `handleSearch(item.query, true)`.

6. **Duplicate save is skipped**
   - The second argument, `true`, means `skipSaveHistory`.
   - The clicked history item is re-run without saving another history entry.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> fetchQueryHistory()
  -> filter h.sql_text || h.db_name
  -> setHistory(...)
  -> Recent Data Questions list
  -> handleHistoryClick(item)
  -> handleSearch(item.query, true)
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  4. Query Settings
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The SQL Query page currently has one visible query setting: <strong>Show Graph</strong>.
</div>

### Complete Working Flow

1. **Show Graph checkbox renders**
   - It is stored in `showGraph`.

2. **User toggles Show Graph**
   - `setShowGraph(e.target.checked)` updates state.

3. **Chart rendering depends on Show Graph**
   - Chart appears only when:
     - `showGraph` is true.
     - `result.sql_data` exists.
     - `result.sql_data.row_count > 0`.

4. **Chart type is inferred**
   - Single-cell result renders a stat card.
   - One text column plus one numeric column renders bar chart or line chart.
   - Date/time labels use line chart.
   - Multiple numeric columns render grouped bar chart.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> showGraph state
  -> Query Settings checkbox
  -> ResultChart
  -> Recharts components
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  5. Database Selector
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Database</strong> selector lets the user choose a specific database for the natural-language query,
  or use <strong>Auto-select</strong>.
</div>

### Complete Working Flow

1. **Databases are loaded during initialization**
   - Databases are stored in `databases`.

2. **Selector renders above the textarea**
   - Default option is `Auto-select`.
   - Each loaded database appears as an option.

3. **User selects a database**
   - `selectedDbId` is updated.

4. **Search payload includes selected database**
   - If selected, `db_id` is sent as `selectedDbId`.
   - If not selected, `db_id` is sent as null.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> selectedDbId state
  -> Database select
  -> handleSearch()
  -> db_id: selectedDbId || null
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  6. Show Result
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Show Result</strong> button sends the natural-language question to the SQL query backend and stores the returned answer,
  generated SQL, database metadata, and result rows.
</div>

### Complete Working Flow

1. **User enters a question**
   - Textarea value is stored in `searchQuery`.
   - Ctrl+Enter also calls `handleSearch()`.

2. **Button state is calculated**
   - Disabled when `searching` is true.
   - Disabled when `searchQuery.trim()` is empty.

3. **User clicks Show Result**
   - `handleSearch()` runs.
   - Empty question returns early.
   - If no buckets are loaded, `searchError` is set to `No buckets loaded — please refresh the page.`

4. **Search state is prepared**
   - `searching` becomes true.
   - `searchError` is cleared.
   - `result` is cleared.
   - `feedback` is reset.
   - `submittingFeedback` is reset.

5. **Backend query is called**

```text
POST /manageSqlQuery/query
```

Payload:

| Field | Value |
|-------|-------|
| `question` | User-entered or overridden question |
| `bucket_ids` | All loaded bucket IDs |
| `db_id` | Selected DB ID, or null |
| `area` | null |

6. **Result is stored**
   - Response is stored in `result`.
   - Local history is updated and capped to 20 items.

7. **History is saved**
   - Unless `skipSaveHistory` is true, history is saved with:

```text
POST /manageSqlQuery/saveHistory
```

Saved fields include `question`, `sql_text`, `db_id`, `db_name`, `area`, `row_count`, and `has_error`.

8. **Error path**
   - `KmApiError` sets `searchError.msg` and `searchError.requestId`.
   - Other errors are stringified into `searchError.msg`.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> searchQuery textarea
  -> Show Result button
  -> handleSearch()
  -> kmApi.post('/manageSqlQuery/query', payload)
  -> setResult(res)
  -> setHistory(...)
  -> kmApi.post('/manageSqlQuery/saveHistory', payload)
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  7. Result Display
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The result display shows the backend response for a SQL data question.
</div>

### Displayed Result Parts

| Result Part | Condition |
|-------------|-----------|
| Placeholder | No result and not searching |
| Answer | `result` exists and `showSqlQuery` is true |
| Database info bar | `result.database_name` exists and `showSqlQuery` is true |
| Generated SQL | `result.sql` exists and `showSqlQuery` is true |
| Service error | `result.error` exists |
| Chart | `showGraph` is true and result rows exist |
| Data table | `result.sql_data.row_count > 0`, except single-cell stat hidden when graph is shown |
| No rows text | `result.sql_data.row_count === 0` |

### Access Rule for SQL Visibility

`showSqlQuery` is true when:

- User is super admin.
- Or the user owns the bucket associated with the selected/result database.

If `showSqlQuery` is false, the answer and generated SQL sections do not render.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> dbIdForOwnership
  -> queryDb
  -> queryBucket
  -> isQueryBucketOwner
  -> showSqlQuery
  -> conditional result rendering
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  8. Export, Feedback, Promote
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  After a result is shown, the UI can export rows, collect feedback, or promote generated SQL into training data.
</div>

### CSV Export Flow

1. Enabled only when `result.sql_data` exists and `row_count > 0`.
2. `handleDownloadCSV()` builds CSV from `columns` and `rows`.
3. Browser downloads `query_result.csv`.

### Excel Export Flow

1. Enabled only when `result.sql_data` exists and `row_count > 0`.
2. `handleDownloadExcel()` uses `xlsx`.
3. Browser downloads `query_result.xlsx`.

### Feedback Flow

1. Feedback controls render when `result.sql` exists and `showSqlQuery` is true.
2. User clicks thumbs up or thumbs down.
3. `handleFeedback(1)` or `handleFeedback(-1)` posts:

```text
POST /manageSqlQuery/submitFeedback
```

Payload includes `question`, `sql_text`, `db_id`, and `feedback`.

### Promote Flow

1. `Promote to Training` renders when `result.sql` exists and `showSqlQuery` is true.
2. `handleOpenPromote()` opens the promote modal.
3. User selects database and optionally enters query name/description.
4. `handlePromote()` posts:

```text
POST /manageSqlQuery/promoteQuery
```

Payload includes `database_id`, `question`, `sql`, `query_name`, and `query_desc`.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> handleDownloadCSV()
  -> handleDownloadExcel()
  -> handleFeedback(value)
  -> handleOpenPromote()
  -> handlePromote()
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  9. Configure Data Sources
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Configure Data Sources</strong> view lets admin users manage SQL data sources connected to buckets.
</div>

This button appears only when `canConfigure` is true.

### Complete Working Flow

1. **Permission is calculated**
   - Super admin and admin role users can configure.

2. **User opens configure mode**
   - Sidebar button calls `setCurrentView('configure')`.
   - Main panel changes to `Manage Data Sources`.

3. **Database rows render**
   - Columns are Name, Type, Area, Description, Status, and Actions.
   - Empty list shows `No databases found`.

4. **Add Data Source**
   - User clicks `Add Data Source`.
   - Add form opens.
   - Bucket dropdown includes owned buckets, or all buckets for super admin.
   - Form fields include name, type, area, description, keywords, connection URL, and credentials.
   - If connection URL contains credentials, validation asks user to remove credentials and use the Credentials field.
   - Save calls:

```text
POST /manageDataSql/addDBDetails
```

5. **Edit Data Source**
   - `E` opens inline edit mode.
   - Save calls:

```text
PUT /manageDataSql/updateDBDetails/{databaseId}
```

6. **Delete Data Source**
   - `X` opens confirm delete modal.
   - Confirming calls:

```text
DELETE /manageDataSql/deleteDBDetail/{databaseId}
```

7. **Other row actions**
   - `S` expands Schema / DDL entries.
   - `R` expands Business Rules.
   - `Q` expands Training Queries.
   - `V` opens View All Training Data modal.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> canConfigure
  -> Configure Data Sources button
  -> databases rows
  -> handleAddDb()
  -> handleStartEditDb()
  -> handleSaveEditDb()
  -> handleConfirmDelete()
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  10. Training Data Modals
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  Training data modals manage examples and context used by the SQL query system.
</div>

### Training Queries

1. User expands `Q` on a database row.
2. Existing training queries are listed with Name, Context, Query Text, Rank, and Actions.
3. `Add Training Query` opens a modal.
4. Required fields are natural-language question, SQL answer, and query name.
5. Rank must be between 1 and 5.
6. Save calls:

```text
POST /manageDataSql/addSQLDetails
```

7. Editing an existing query calls:

```text
PUT /manageDataSql/updateSQLDetails/{queryId}
```

8. Deleting a query calls:

```text
DELETE /manageDataSql/deleteSQLDetail/{queryId}
```

### Schema / DDL

1. User expands `S` on a database row.
2. Existing DDL entries are listed.
3. `Add DDL Entry` opens a modal.
4. `ddl_text` is required.
5. Add calls:

```text
POST /manageDataSql/addDDLDetails
```

6. Edit calls:

```text
PUT /manageDataSql/updateDDLDetails/{ddlId}
```

7. Delete calls:

```text
DELETE /manageDataSql/deleteDDLDetail/{ddlId}
```

### Business Rules

1. User expands `R` on a database row.
2. Existing rules are listed.
3. `Add Rule` opens a modal.
4. `rule_text` is required.
5. Add calls:

```text
POST /manageDataSql/addRuleDetails
```

6. Edit calls:

```text
PUT /manageDataSql/updateRuleDetails/{ruleId}
```

7. Delete calls:

```text
DELETE /manageDataSql/deleteRuleDetail/{ruleId}
```

### Training Script Modal

The code includes a `trainingModal` flow for editing `training_script` on a database through:

```text
PUT /manageDataSql/updateDBDetails/{databaseId}
```

The modal counts Q/A examples by scanning for lines starting with `-- Q:` in SECTION 3. In the current visible database row action buttons, there is no button wired to open `trainingModal`.

### View All Training Data

1. User clicks `V` on a database row.
2. Modal opens with all training data for that database.
3. It shows:
   - Schema / DDL entries.
   - Business Rules.
   - Training Queries.
4. Fullscreen toggle is available.

### Related Code Flow

```text
src/pages/sqlquery.tsx
  -> expandedDbId / ddlExpandedDbId / ruleExpandedDbId
  -> addQueryModal / ddlModal / ruleModal / viewModal
  -> handleAddQuery()
  -> handleSaveEditQuery()
  -> handleSaveDdl()
  -> handleSaveRule()
  -> handleConfirmDelete()
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  API Summary
</h2>

| Action | Method | Endpoint |
|--------|--------|----------|
| Load buckets | `GET` | `/manageBucket/getDetails/{user}` |
| Load data sources | `GET` | `/manageDataSql/getDetails?bucketIds={bucketIds}` |
| Load SQL history | `GET` | `/manageSqlQuery/getHistory?limit=30` |
| Run SQL query | `POST` | `/manageSqlQuery/query` |
| Save SQL history | `POST` | `/manageSqlQuery/saveHistory` |
| Submit feedback | `POST` | `/manageSqlQuery/submitFeedback` |
| Promote query | `POST` | `/manageSqlQuery/promoteQuery` |
| Add DB details | `POST` | `/manageDataSql/addDBDetails` |
| Update DB details | `PUT` | `/manageDataSql/updateDBDetails/{databaseId}` |
| Delete DB detail | `DELETE` | `/manageDataSql/deleteDBDetail/{databaseId}` |
| Add SQL training query | `POST` | `/manageDataSql/addSQLDetails` |
| Update SQL training query | `PUT` | `/manageDataSql/updateSQLDetails/{queryId}` |
| Delete SQL training query | `DELETE` | `/manageDataSql/deleteSQLDetail/{queryId}` |
| Add DDL | `POST` | `/manageDataSql/addDDLDetails` |
| Update DDL | `PUT` | `/manageDataSql/updateDDLDetails/{ddlId}` |
| Delete DDL | `DELETE` | `/manageDataSql/deleteDDLDetail/{ddlId}` |
| Add rule | `POST` | `/manageDataSql/addRuleDetails` |
| Update rule | `PUT` | `/manageDataSql/updateRuleDetails/{ruleId}` |
| Delete rule | `DELETE` | `/manageDataSql/deleteRuleDetail/{ruleId}` |

