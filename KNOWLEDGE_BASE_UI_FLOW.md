<h1 style="color:#1f4e79; border-bottom:3px solid #53a7ba; padding-bottom:8px;">
  Knowledge Base UI Flow
</h1>

<p>
  This document explains the <strong>Knowledge Base</strong> UI section by section.
  The current scope covers the listed Knowledge Base UI sections:
</p>

| # | UI Section | Purpose |
|---|------------|---------|
| 1 | <span style="color:#4a77b4;"><strong>New Query</strong></span> | Start a fresh Knowledge Base search |
| 2 | <span style="color:#4a77b4;"><strong>Recent Queries</strong></span> | Reopen or rerun earlier Knowledge Base questions |
| 3 | <span style="color:#4a77b4;"><strong>Query Settings</strong></span> | Control source count, similarity threshold, and public info extension |
| 4 | <span style="color:#4a77b4;"><strong>Configure Knowledge Base</strong></span> | Switch admin users into repository configuration mode |
| 5 | <span style="color:#4a77b4;"><strong>Select Buckets Dropdown</strong></span> | Choose active buckets used during Knowledge Base search |
| 6 | <span style="color:#4a77b4;"><strong>Search Repository</strong></span> | Run a Knowledge Base search and show results |
| 7 | <span style="color:#4a77b4;"><strong>Active Buckets Count</strong></span> | Show how many active buckets are available for search |
| 8 | <span style="color:#4a77b4;"><strong>Manage Knowledge Buckets</strong></span> | Create, update, and delete knowledge buckets |
| 9 | <span style="color:#4a77b4;"><strong>Assigned Accounts</strong></span> | Manage account access for selected buckets |
| 10 | <span style="color:#4a77b4;"><strong>Document / Web URL / Repository / Redmine Upload</strong></span> | Add source content into selected buckets |

> **Route Entry:** The Knowledge Base page is routed from `src/App.tsx` to `src/pages/dashboard.tsx` at `/dashboard`.

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  1. New Query
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>New Query</strong> button resets the Knowledge Base search area to a fresh query state.
  It switches the main panel back to the search view, clears the current query text, and clears the answer/result area.
</div>

This is useful when the user has already searched something or is inside the configure view and wants to return to a blank Knowledge Base query screen.

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/App.tsx` | Defines the `/dashboard` route and renders `DashboardComponent` for the Knowledge Base page. |
| `src/pages/dashboard.tsx` | Contains the Knowledge Base UI, state, sidebar button, and `handleNewQuery()` reset logic. |

Key state and handler locations in `src/pages/dashboard.tsx`:

- `currentView`: controls whether the page shows the search UI or configure UI.
- `searchQuery`: stores the text entered in the query textarea.
- `currentAnswer`: stores the answer shown in the result panel.
- `handleNewQuery()`: performs the reset.
- Sidebar button labelled **New Query**: calls `handleNewQuery()`.

### Complete Working Flow

1. **User opens the app**
   - `src/App.tsx` redirects `/` to `/dashboard`.
   - The `/dashboard` route renders `DashboardComponent`.

2. **Dashboard initializes Knowledge Base state**
   - `currentView` starts as `'search'`.
   - `searchQuery` starts as an empty string.
   - `currentAnswer` starts as an empty string.

3. **The left sidebar renders the New Query button**
   - The button is inside the sidebar section in `src/pages/dashboard.tsx`.
   - Its `onClick` handler is `handleNewQuery`.

4. **User clicks New Query**
   - `handleNewQuery()` runs.
   - It sets `currentView` to `'search'`.
   - It clears `searchQuery`.
   - It clears `currentAnswer`.

5. **UI updates immediately**
   - The main content area shows the search screen because `currentView === 'search'`.
   - The textarea becomes empty.
   - The result panel shows the placeholder text: `Results will appear here...`.

6. **Configure view fallback**
   - The same `handleNewQuery()` function is reused by the sidebar button and the back/search action in the configure view.

<h3 style="color:#4a77b4;">Related Code Flow</h3>

```text
src/App.tsx
  -> Route path="/dashboard"
  -> DashboardComponent

src/pages/dashboard.tsx
  -> Dashboard()
  -> currentView/searchQuery/currentAnswer state
  -> handleNewQuery()
  -> New Query button onClick
  -> Search UI textarea and Query Performance result panel
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  2. Recent Queries
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Recent Queries</strong> section shows the user's recent Knowledge Base questions in the left sidebar.
  In the current code, the visible heading is <strong>Recent Questions</strong>.
</div>

It allows users to quickly reopen a previous Knowledge Base query. When a user clicks a recent item, the app loads that question back into the search box. If the answer already exists in local state, it shows the saved answer immediately. If only the question came from backend history, it reruns the search without saving a duplicate history item.

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Defines `HistoryItem`, stores `history`, loads history, renders recent items, and handles recent-query clicks. |
| `src/services/kmApiService.ts` | Provides the shared `kmApi` wrapper, request headers, JSON parsing, and API error handling. |
| `src/services/queryApiService.ts` | Provides `searchKnowledgeBase()` and posts Knowledge Base search requests to `/manageKnowledge/search`. |

Key functions in `src/pages/dashboard.tsx`:

- `fetchQueryHistory()`: loads persisted Knowledge Base history from the backend.
- `handleSearch()`: runs a search, updates local history, and saves history to the backend.
- `handleHistoryClick()`: restores or reruns a selected historical query.
- `history.map(...)`: renders the sidebar list.

### Complete Working Flow

1. **Dashboard page loads**
   - The `useEffect` on initial mount runs in `src/pages/dashboard.tsx`.
   - It loads active buckets for search context.
   - It also calls `fetchQueryHistory()`.

2. **Saved history is requested**
   - `fetchQueryHistory()` calls:

```text
GET /manageSqlQuery/getHistory?limit=30
```

   - The request goes through `kmApi.get()` from `src/services/kmApiService.ts`.

3. **History records are filtered for Knowledge Base queries**
   - Records with `sql_text` or `db_name` are excluded.
   - This prevents SQL Query page history from appearing in the Knowledge Base recent list.

4. **Duplicate questions are removed**
   - The function tracks seen question text with a `Set`.
   - Only the first occurrence of each unique question is kept.

5. **The filtered history is stored in state**
   - `setHistory(...)` maps backend records into `HistoryItem`.
   - Each item includes fields such as `id`, `query`, `has_error`, and `created_at`.

6. **The sidebar renders recent items**
   - If `history.length === 0`, the UI shows `No recent questions`.
   - Otherwise, each history item is shown as a clickable list item.
   - Items with `has_error` display a red marker.

7. **User performs a new search**
   - User enters text in the textarea.
   - User clicks **Search Repository**.
   - `handleSearch()` calls `searchKnowledgeBase()` from `src/services/queryApiService.ts`.
   - `searchKnowledgeBase()` posts to:

```text
POST /manageKnowledge/search
```

   - Request payload includes:
     - `question`
     - `limit`
     - `similarity_threshold`
     - `extend_public`
     - `bucket_names`

8. **Search result is added to recent history**
   - Successful searches add a new `HistoryItem` with the generated answer.
   - Failed searches also add a history item, marked with `has_error: true`.
   - Local history is de-duplicated by question and capped to 30 items.

9. **Search history is saved to backend**
   - Unless the search was triggered from a history click with `skipSaveHistory = true`, `handleSearch()` calls:

```text
POST /manageSqlQuery/saveHistory
```

   - Payload contains:
     - `question`
     - `has_error`

10. **Backend history is refreshed**
    - After saving history, the code calls `fetchQueryHistory()` again.
    - This syncs the sidebar with persisted backend history.

11. **User clicks a recent query**
    - The clicked list item calls `handleHistoryClick(item)`.
    - `currentView` is set back to `'search'`.
    - `searchQuery` is set to the clicked query text.

12. **The app either restores or reruns the answer**
    - If the clicked item already has `answer` in local state, `currentAnswer` is filled immediately.
    - If it does not have an answer, the app calls `handleSearch(item.query, true)`.
    - The second argument, `true`, skips saving duplicate history for that click.

<h3 style="color:#4a77b4;">API Summary</h3>

| Action | Method | Endpoint | Trigger |
|--------|--------|----------|---------|
| Load recent history | `GET` | `/manageSqlQuery/getHistory?limit=30` | Dashboard initial load |
| Search repository | `POST` | `/manageKnowledge/search` | User clicks **Search Repository** |
| Save history | `POST` | `/manageSqlQuery/saveHistory` | Search completes successfully or with error |

<h3 style="color:#4a77b4;">Related Code Flow</h3>

```text
src/pages/dashboard.tsx
  -> useEffect on mount
  -> fetchQueryHistory()
  -> kmApi.get('/manageSqlQuery/getHistory?limit=30')
  -> filter out SQL history
  -> setHistory(...)
  -> sidebar renders history list

User search:
src/pages/dashboard.tsx
  -> handleSearch()
  -> searchKnowledgeBase(...)
  -> kmApi.post('/manageKnowledge/search', payload)
  -> setHistory(...)
  -> kmApi.post('/manageSqlQuery/saveHistory', payload)
  -> fetchQueryHistory()

User clicks recent item:
src/pages/dashboard.tsx
  -> handleHistoryClick(item)
  -> setCurrentView('search')
  -> setSearchQuery(item.query)
  -> setCurrentAnswer(item.answer) OR handleSearch(item.query, true)
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  3. Query Settings
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Query Settings</strong> section lets the user control how the Knowledge Base search behaves before clicking
  <strong>Search Repository</strong>.
</div>

It currently includes:

| Setting | State | Purpose |
|---------|-------|---------|
| No of Sources | `noOfSources` | Sets the maximum number of source chunks/results to return. |
| Similarity Threshold | `similarityThreshold` | Filters out search results below the selected relevance percentage. |
| Extend with public information | `extendPublic` | Sends a flag that allows the backend to extend results with public information. |

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Holds settings state, renders sliders/checkbox, and passes values into `handleSearch()`. |
| `src/services/queryApiService.ts` | Converts `similarityThreshold` from percentage to decimal and posts it to `/manageKnowledge/search`. |

### Complete Working Flow

1. **Settings render in the left sidebar**
   - `No of Sources` slider reads and updates `noOfSources`.
   - `Similarity Threshold` slider reads and updates `similarityThreshold`.
   - `Extend with public information` checkbox reads and updates `extendPublic`.

2. **User changes any setting**
   - React state updates immediately in `src/pages/dashboard.tsx`.
   - The visible numeric value beside the slider updates from the same state.

3. **User runs a search**
   - `handleSearch()` reads `noOfSources`, `similarityThreshold`, and `extendPublic`.
   - These values are passed into `searchKnowledgeBase(...)`.

4. **Search API payload is prepared**
   - `limit` receives `noOfSources`.
   - `similarity_threshold` receives `similarityThreshold / 100`.
   - `extend_public` receives `extendPublic`.

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> noOfSources / similarityThreshold / extendPublic state
  -> Query Settings sidebar controls
  -> handleSearch()
  -> searchKnowledgeBase(question, noOfSources, similarityThreshold, extendPublic, selectedBucketNames)

src/services/queryApiService.ts
  -> POST /manageKnowledge/search
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  4. Configure Knowledge Base
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Configure Knowledge Base</strong> button switches the page from search mode to repository management mode.
</div>

This button is only shown to users who are allowed to configure Knowledge Base content.

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Calculates permissions, renders the button, switches `currentView`, and loads buckets. |
| `src/shared/utils.tsx` | Provides `getXUser()` and `getXuserType()` used for permission checks. |
| `src/services/kmApiService.ts` | Loads bucket data for the configure view. |

### Complete Working Flow

1. **Dashboard determines user permissions**
   - `currentUser` comes from `getXUser()`.
   - `currentUserType` comes from `getXuserType()`.
   - `canConfigure` is true for super admin or admin role users.

2. **Configure button is conditionally shown**
   - If `canConfigure` is false, the button is hidden and the user remains in search mode.
   - If `canConfigure` is true, the button appears in the left sidebar.

3. **User clicks Configure Knowledge Base**
   - The button calls `setCurrentView('configure')`.

4. **Configure view loads**
   - Main content switches to `Manage Knowledge Repository`.
   - A `useEffect` detects `currentView === 'configure'` and calls `fetchBuckets()`.

5. **Bucket data is requested**
   - `fetchBuckets()` calls:

```text
GET /manageBucket/getDetails/{currentUser}
```

6. **Back to Search returns to query mode**
   - The configure screen has a `Back to Search` button.
   - It calls `handleNewQuery()`, returning to search view and clearing query/result state.

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> getXUser() / getXuserType()
  -> canConfigure
  -> Configure Knowledge Base button
  -> setCurrentView('configure')
  -> useEffect([currentView])
  -> fetchBuckets()
  -> kmApi.get('/manageBucket/getDetails/{user}')
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  5. Select Buckets Dropdown
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Select Buckets</strong> dropdown lets the user restrict a search to one or more active knowledge buckets.
</div>

If no bucket is selected, the backend receives an empty `bucket_names` array and decides the default search scope.

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Loads active buckets, renders dropdown, tracks selected bucket names, and passes them into search. |
| `src/services/kmApiService.ts` | Calls the bucket details endpoint. |
| `src/services/queryApiService.ts` | Sends selected `bucket_names` to `/manageKnowledge/search`. |

### Complete Working Flow

1. **Dashboard loads buckets on mount**
   - The initial `useEffect` calls `loadBuckets()`.
   - It requests buckets for the current user.

```text
GET /manageBucket/getDetails/{currentUser}
```

2. **Only active buckets are kept**
   - The response is filtered with `b.status === 'ACTIVE'`.
   - Filtered buckets are stored in `activeBuckets`.

3. **Dropdown button renders**
   - If no bucket is selected, the button text is `Select Buckets`.
   - If one or more are selected, the button shows `{count} Selected`.

4. **User opens the dropdown**
   - `dropdownOpen` toggles between true and false.
   - A backdrop is rendered so clicking outside closes the dropdown.

5. **User selects buckets**
   - Each active bucket is rendered as a checkbox.
   - Checking a bucket adds `bucket_name` to `selectedBucketNames`.
   - Unchecking removes that `bucket_name`.

6. **Select All / Clear All shortcuts**
   - `Select All` sets all active bucket names.
   - `Clear All` resets `selectedBucketNames` to an empty array.

7. **Selected buckets affect search**
   - `handleSearch()` passes `selectedBucketNames` to `searchKnowledgeBase()`.
   - API payload includes `bucket_names`.

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> loadBuckets()
  -> activeBuckets = buckets.filter(status === 'ACTIVE')
  -> dropdownOpen
  -> selectedBucketNames
  -> Select All / Clear All / checkbox onChange
  -> handleSearch()

src/services/queryApiService.ts
  -> bucket_names: bucketNames
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  6. Search Repository
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Search Repository</strong> button sends the user's question and query settings to the Knowledge Base backend,
  then renders matching content in the Query Performance panel.
</div>

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Renders textarea/button/result panel, runs `handleSearch()`, formats answer text, updates history. |
| `src/services/queryApiService.ts` | Sends the search request to `/manageKnowledge/search`. |
| `src/services/kmApiService.ts` | Performs the actual `fetch` and response handling. |

### Complete Working Flow

1. **User types a question**
   - Textarea value is stored in `searchQuery`.

2. **Search button state is calculated**
   - Button is disabled when `searching` is true.
   - Button is also disabled when `searchQuery.trim()` is empty.

3. **User clicks Search Repository**
   - `handleSearch()` runs.
   - It uses `searchQuery` unless an override question is passed.
   - It sets `searching` to true and clears `currentAnswer`.

4. **Search API is called**
   - `handleSearch()` calls `searchKnowledgeBase(...)`.

```text
POST /manageKnowledge/search
```

5. **Results are filtered and formatted**
   - Empty text results are removed.
   - Results below `similarityThreshold` are removed.
   - Duplicate text chunks are removed using the first 100 characters as a key.
   - Results are limited to `noOfSources`.
   - Cleaned text is joined with separators.

6. **Answer is displayed**
   - If results exist, `currentAnswer` receives the formatted answer.
   - If no result exists, the user sees: `No relevant results found for your question...`.
   - The Query Performance panel renders `currentAnswer`.

7. **History is updated**
   - New searches are added to local history.
   - Search history is saved through `/manageSqlQuery/saveHistory`.

8. **Error path**
   - If search fails, the error message is written into `currentAnswer`.
   - The failed question is added to history with `has_error: true`.

9. **Copy Answer**
   - If `currentAnswer` exists, the user can click `Copy Answer`.
   - `handleCopyAnswer()` writes the answer to the clipboard.

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> searchQuery textarea
  -> Search Repository button
  -> handleSearch()
  -> searchKnowledgeBase(...)
  -> filter / deduplicate / slice results
  -> setCurrentAnswer(...)
  -> setHistory(...)
  -> saveHistory
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  7. Active Buckets Count
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Active Buckets Count</strong> text tells the user how many active buckets are available for Knowledge Base search.
</div>

It appears above the search actions only when at least one active bucket is available.

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Loads buckets, filters active buckets, renders the count text. |
| `src/services/kmApiService.ts` | Calls `/manageBucket/getDetails/{currentUser}`. |

### Complete Working Flow

1. **Dashboard loads bucket list**
   - On initial mount, `loadBuckets()` requests the current user's buckets.

2. **Active buckets are filtered**
   - Only buckets where `status === 'ACTIVE'` are stored in `activeBuckets`.

3. **Count text is conditionally displayed**
   - If `activeBuckets.length > 0`, UI displays:

```text
{activeBuckets.length} active bucket(s) available
```

4. **Count stays aligned with search dropdown**
   - The same `activeBuckets` state is used for both the count and the bucket dropdown options.

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> useEffect on mount
  -> kmApi.get('/manageBucket/getDetails/{user}')
  -> filter ACTIVE buckets
  -> setActiveBuckets(active)
  -> render activeBuckets.length
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  8. Manage Knowledge Buckets
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Manage Knowledge Buckets</strong> section lets admin users select an existing bucket,
  create a new bucket, edit category/description, and delete buckets they own.
</div>

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Renders bucket selector/form, manages bucket state, create/update/delete handlers, and status badges. |
| `src/types/km.ts` | Defines `Bucket` and `BucketStatus`. |
| `src/services/kmApiService.ts` | Calls bucket management endpoints. |

### Complete Working Flow

1. **Configure view opens**
   - `fetchBuckets()` loads all buckets available to the current user.

```text
GET /manageBucket/getDetails/{currentUser}
```

2. **User selects a bucket**
   - `selectedBucketId` updates from the dropdown.
   - The selected bucket is found from `buckets`.
   - `selectedBucket`, `formCategory`, and `formDesc` are synced.

3. **Bucket status is displayed**
   - `statusBadge(selectedBucket.status)` shows status like `ACTIVE`, `FAILED`, or `PROVISIONING`.
   - If `error_detail` exists, it is shown beside the status.

4. **Create New Bucket**
   - User selects `+ Create New Bucket`.
   - Bucket name input appears.
   - `accountIds` defaults to the current user.
   - Clicking `Create Bucket` calls:

```text
POST /manageBucket/createBucket
```

   - Payload includes `account_id`, `bucket_name`, `bucket_category`, and `bucket_desc`.

5. **Update Existing Bucket**
   - For an existing bucket, the user can edit category and description.
   - Super admins can also send `account_ids`.
   - Clicking `Save Changes` calls:

```text
PUT /manageBucket/updateBucket/{selectedBucketId}
```

6. **Delete Bucket**
   - Clicking `Delete` opens a confirmation modal.
   - Confirming calls:

```text
DELETE /manageBucket/deleteBucket/{bucketId}
```

   - Deleted bucket is removed from active search selections and the bucket selector is reset.

7. **Ownership rules**
   - `isOwnerOfSelected` controls whether fields/actions are editable.
   - Non-owners see a restricted upload/details area for that bucket.

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> currentView === 'configure'
  -> fetchBuckets()
  -> selectedBucketId
  -> sync selected bucket form fields
  -> handleSaveBucket()
  -> handleDeleteClick()
  -> handleConfirmDelete()
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  9. Assigned Accounts
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  The <strong>Assigned Accounts</strong> section lets super admins view, add, and remove account IDs associated with a selected bucket.
</div>

This section is visible only for super admin users.

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Renders account list/input, controls super-admin visibility, and includes add/remove handlers. |
| `src/services/kmApiService.ts` | Loads assigned account IDs and sends bucket updates with account assignments. |

### Complete Working Flow

1. **Super admin check runs**
   - `isSuperAdmin` is true when user is `nnpsuper` or has a super admin user type.
   - The section is rendered only when `isSuperAdmin` is true.

2. **Bucket selection loads assigned accounts**
   - When `selectedBucketId` changes, `syncSelectedBucket()` runs.
   - For an existing bucket, it calls:

```text
GET /manageBucket/getAccountIds/{selectedBucketId}
```

3. **Account list renders**
   - `accountIds` is shown as a list.
   - If empty, the UI shows `No accounts assigned`.

4. **Add Account**
   - User enters an account ID and clicks `Add`, or presses Enter.
   - `handleAddAccountId()` trims the value.
   - Empty and duplicate values are ignored.
   - Valid values are appended to `accountIds`.

5. **Remove Account**
   - Clicking remove calls `handleRemoveAccountId(id)`.
   - The last remaining account cannot be removed.
   - Non-owners cannot remove accounts.

6. **Save account changes**
   - Account changes are persisted when the bucket is saved.
   - For super admins, `handleSaveBucket()` includes `account_ids` in the update payload.

```text
PUT /manageBucket/updateBucket/{selectedBucketId}
```

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> isSuperAdmin
  -> fetchAssociatedAccountIdsByBucketId()
  -> accountIds state
  -> handleAddAccountId()
  -> handleRemoveAccountId()
  -> handleSaveBucket()
```

---

<h2 style="color:#375623; border-left:5px solid #70ad47; padding-left:10px;">
  10. Document / Web URL / Repository / Redmine Upload Section
</h2>

<h3 style="color:#4a77b4;">Function</h3>

<div style="border-left:4px solid #4a77b4; background:#f3f8fc; padding:10px 14px; margin:10px 0;">
  This section lets bucket owners add source material into a selected bucket.
  The source can be a document file, web URL, Git repository, or Redmine issue set.
</div>

The visible tab controls which upload form appears.

<h3 style="color:#4a77b4;">File Navigation</h3>

| File | Role in Flow |
|------|--------------|
| `src/pages/dashboard.tsx` | Renders tabs, loads bucket details, lists documents, deletes details, and handles document/web uploads. |
| `src/components/git-repository-form.tsx` | Handles Git repository URL, branch, username, and token submission. |
| `src/components/redmine-bucket-details-form.tsx` | Handles Redmine URL, API key, project ID, status, and limit submission. |
| `src/types/km.ts` | Defines `BucketDetail` and `DocStatus`. |
| `src/services/kmApiService.ts` | Sends multipart and JSON upload/detail requests. |

### Complete Working Flow

1. **User selects a bucket**
   - Upload/details area requires an existing selected bucket.
   - If no bucket is selected, UI shows `Select a bucket to view documents`.
   - If the selected bucket is `new`, upload actions stay disabled.

2. **Ownership is checked**
   - If the user is not the bucket owner, an `Access Restricted` panel is shown.
   - If the user is the owner, tabs and upload controls are shown.

3. **User changes source tab**
   - Tabs are `Documents`, `Web Pages`, `Code Repository`, and `Incident Repo`.
   - `activeTab` stores the current tab.
   - Each tab maps to a backend category through `TAB_CATEGORY`:

| Tab | Backend Category |
|-----|------------------|
| Documents | `document` |
| Web Pages | `web` |
| Code Repository | `git` |
| Incident Repo | `redmine` |

4. **Existing bucket details load**
   - When `activeTab` or `selectedBucketId` changes, `fetchDetails()` runs.

```text
GET /manageBucketDetails/getDetails/{bucketId}?category={category}
```

5. **Details list renders**
   - Each item shows document/source name and ingestion status.
   - `INGESTED` items show chunk count and ingestion date.
   - `FAILED` items show error detail.

6. **Delete source detail**
   - Clicking delete opens the confirmation modal.
   - Confirming calls:

```text
DELETE /manageBucketDetails/deleteBucketDetail/{detailId}
```

   - Details are reloaded after deletion.

7. **Add Document**
   - In `Documents` tab, user clicks `Add Document`.
   - File input accepts `.pdf`, `.docx`, `.txt`, and `.md`.
   - Browser builds `FormData` with `bucket_id`, `doc_category`, `file`, and `doc_name`.
   - Submission calls:

```text
POST /manageBucketDetails/createBucketDetails
```

8. **Add Web URL**
   - In `Web Pages` tab, user clicks `Add URL`.
   - User enters a URL and optional document name.
   - Browser builds `FormData` with `bucket_id`, `doc_category`, `url`, and `doc_name`.
   - Submission calls:

```text
POST /manageBucketDetails/createBucketDetails
```

9. **Add Code Repository**
   - In `Code Repository` tab, user clicks `Add Repository`.
   - `GitRepositoryForm` renders.
   - User enters repository URL and optional branch, username, and personal access token.
   - Submission calls:

```text
POST /manageBucketDetails/createGitBucketDetails
```

10. **Add Redmine Issues**
    - In `Incident Repo` tab, user clicks `Add Redmine Issues`.
    - `RedmineBucketDetailsForm` renders.
    - User enters Redmine URL, API key, optional project ID/status, and limit.
    - Submission calls:

```text
POST /manageBucketDetails/createRedmineBucketDetails
```

11. **After successful upload**
    - Success toast is shown.
    - Add form closes.
    - `fetchDetails(selectedBucketId, activeTab)` reloads the list.
    - Backend ingestion begins asynchronously.

### Related Code Flow

```text
src/pages/dashboard.tsx
  -> activeTab / selectedBucketId
  -> fetchDetails(bucketId, activeTab)
  -> render details list
  -> handleOpenAddForm()
  -> handleSubmitAddForm() for Documents/Web Pages
  -> GitRepositoryForm for Code Repository
  -> RedmineBucketDetailsForm for Incident Repo
  -> refresh details after success
```

<div style="border-left:4px solid #70ad47; background:#f6fbf3; padding:10px 14px; margin-top:16px;">
  <strong>Review Point:</strong> This file now covers all listed Knowledge Base UI sections.
  SQL query flow can be added later as a separate section.
</div>
