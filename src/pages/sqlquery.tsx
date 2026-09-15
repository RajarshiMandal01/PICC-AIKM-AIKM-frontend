import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import kmApi, { KmApiError } from '../services/kmApiService';
import { getXUser, getXuserType } from '../shared/utils';
import type { Bucket, KmDatabase, KmDdl, KmRule, KmSqlQuery } from '../types/km';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';

type ViewState = 'search' | 'configure';

interface SqlQueryResult {
  question: string;
  sql: string | null;
  sql_data: { columns: string[]; rows: any[][]; row_count: number } | null;
  database_name: string | null;
  database_type: string | null;
  db_id: string | null;
  area: string | null;
  rag_matches: number;
  curated_matches: number;
  error: string | null;
  answer: string;
}

interface HistoryItem {
  id: number;
  query: string;
  result?: SqlQueryResult;
  db_name?: string;
  sql_text?: string;
  has_error?: boolean;
  created_at?: string;
}

const AREA_OPTIONS = ['Infra', 'DevOps', 'Security', 'Application', 'Business', 'Analytics', 'Other'];

const EMPTY_DB_FORM = {
  bucket_id: '',
  database_name: '',
  database_type: '',
  database_desc: '',
  connection_url: '',
  area: '',
  connection_credential: '',
  keywords: '',
};

const EMPTY_QUERY_FORM = {
  query_name: '',
  query_desc: '',
  query_context: '',
  query_text: '',
  rank: '3',
};

type DbFormState = typeof EMPTY_DB_FORM;
type QueryFormState = typeof EMPTY_QUERY_FORM;

const inp = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#4a77b4] w-full';
const sel = `${inp} bg-white`;

const DbFormFields = ({
  form,
  setForm,
  urlError,
  onUrlChange,
}: {
  form: DbFormState;
  setForm: (f: DbFormState) => void;
  urlError?: string;
  onUrlChange?: (value: string) => void;
}) => (
  <div className="space-y-2">
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Name <span className="text-red-500">*</span></label>
        <input value={form.database_name} onChange={e => setForm({ ...form, database_name: e.target.value })} className={inp} placeholder="Database name" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Type <span className="text-red-500">*</span></label>
        <input value={form.database_type} onChange={e => setForm({ ...form, database_type: e.target.value })} className={inp} placeholder="postgres, mysql…" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Area</label>
        <select value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className={sel}>
          <option value="">Area</option>
          {AREA_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Description</label>
        <input value={form.database_desc} onChange={e => setForm({ ...form, database_desc: e.target.value })} className={inp} placeholder="Description" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Keywords (comma separated)</label>
        <input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} className={inp} placeholder="e.g. builds, pipelines, security (comma separated)" />
      </div>
    </div>
    <div>
      <label className="text-xs text-gray-500 mb-0.5 block">Connection URL <span className="text-red-500">*</span></label>
      <input
        value={form.connection_url}
        onChange={e => {
          const value = e.target.value;
          if (onUrlChange) {
            onUrlChange(value);
          } else {
            setForm({ ...form, connection_url: value });
          }
        }}
        className={inp}
        placeholder="Connection URL (no credentials)"
      />
      {urlError && <p className="text-red-500 text-xs mt-1">{urlError}</p>}
    </div>
    <div>
      <label className="text-xs text-gray-500 mb-0.5 block">Credentials <span className="text-red-500">*</span></label>
      <input
        value={form.connection_credential}
        onChange={e => setForm({ ...form, connection_credential: e.target.value })}
        className={inp}
        placeholder='{"username":"postgres","password":"pass"}'
      />
      <p className="text-xs text-gray-400 mt-1">JSON format. Credentials stored separately from connection URL.</p>
    </div>
  </div>
);

// ── Chart helpers ────────────────────────────────────────────────────────────

const CHART_COLORS = ['#4a77b4', '#53a7ba', '#5bc0de', '#7cb97c', '#e8a838', '#d65f4e', '#9b72b0'];

const trunc = (s: unknown, n = 20) => {
  const str = String(s ?? '');
  return str.length > n ? str.slice(0, n) + '…' : str;
};

const isNumericVal = (v: unknown) => v !== null && v !== '' && !isNaN(Number(v));

const isDateLabel = (col: string) => /date|time|week|month|year|day/i.test(col);

type SqlData = { columns: string[]; rows: any[][]; row_count: number };

const ResultChart = ({ data }: { data: SqlData }) => {
  const { columns, rows } = data;
  if (columns.length === 0 || rows.length === 0) return null;

  const numericCols = columns.filter(col => {
    const idx = columns.indexOf(col);
    const first = rows.find(r => r[idx] !== null && r[idx] !== '');
    return first !== undefined && isNumericVal(first[idx]);
  });
  const textCols = columns.filter(col => !numericCols.includes(col));

  // Single cell → prominent stat card
  if (columns.length === 1 && rows.length === 1) {
    return (
      <div className="p-8 border border-gray-200 rounded bg-gray-50 flex flex-col items-center justify-center min-h-[160px]">
        <p className="text-6xl font-bold text-[#4a77b4] mb-3">{String(rows[0][0] ?? '—')}</p>
        <p className="text-sm text-gray-400">{columns[0]}</p>
      </div>
    );
  }

  // 1 text + 1 numeric → bar or line
  if (textCols.length >= 1 && numericCols.length === 1) {
    const labelCol = textCols[0];
    const valueCol = numericCols[0];
    const li = columns.indexOf(labelCol);
    const vi = columns.indexOf(valueCol);
    const useLine = isDateLabel(labelCol);
    // Reverse DESC-sorted date data so oldest appears on the left of the line chart
    const orderedRows = useLine ? [...rows].reverse() : rows;
    const chartData = orderedRows.map(r => ({ label: trunc(r[li]), value: Number(r[vi]) }));
    const title = `${valueCol} by ${labelCol}`;
    return (
      <div className="p-4 border border-gray-200 rounded bg-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
        <ResponsiveContainer width="100%" height={240}>
          {useLine ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#4a77b4" strokeWidth={2} dot={{ r: 3 }} name={valueCol} />
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#4a77b4" name={valueCol} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  // Multiple numeric cols → grouped bar
  if (numericCols.length > 1) {
    const labelCol = textCols[0] ?? columns[0];
    const li = columns.indexOf(labelCol);
    const chartData = rows.map(r => {
      const entry: Record<string, unknown> = { label: trunc(r[li]) };
      numericCols.forEach(col => { entry[col] = Number(r[columns.indexOf(col)]); });
      return entry;
    });
    return (
      <div className="p-4 border border-gray-200 rounded bg-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Data by {labelCol}</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {numericCols.map((col, ci) => (
              <Bar key={col} dataKey={col} fill={CHART_COLORS[ci % CHART_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
};

const SqlQuery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<ViewState>('search');

  // --- init ---
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // --- search ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDbId, setSelectedDbId] = useState('');
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<{ msg: string; requestId: string | null } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showGraph, setShowGraph] = useState(false);

  // --- configure ---
  const [databases, setDatabases] = useState<KmDatabase[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);

  // DB add/edit
  const [addDbOpen, setAddDbOpen] = useState(false);
  const [addDbForm, setAddDbForm] = useState<DbFormState>(EMPTY_DB_FORM);
  const [addDbLoading, setAddDbLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [editDbId, setEditDbId] = useState<string | null>(null);
  const [editDbForm, setEditDbForm] = useState<DbFormState>(EMPTY_DB_FORM);
  const [editDbLoading, setEditDbLoading] = useState(false);

  // Training script modal
  const [trainingModal, setTrainingModal] = useState<{ dbId: string; script: string } | null>(null);
  const [trainingFullscreen, setTrainingFullscreen] = useState(false);
  const [savingTraining, setSavingTraining] = useState(false);
  const [parsedCount, setParsedCount] = useState<{ examples: number }>({ examples: 0 });

  // Query expand/add/edit
  const [expandedDbId, setExpandedDbId] = useState<string | null>(null);
  const [addQueryModal, setAddQueryModal] = useState<{ dbId: string; dbName: string } | null>(null);
  const [addQueryForm, setAddQueryForm] = useState<QueryFormState>(EMPTY_QUERY_FORM);
  const [addQueryLoading, setAddQueryLoading] = useState(false);
  const [addQueryError, setAddQueryError] = useState<string | null>(null);
  const addQueryRankValue = addQueryForm.rank.trim() ? parseInt(addQueryForm.rank, 10) : null;
  const addQueryRankIsValid = addQueryRankValue === null || (Number.isInteger(addQueryRankValue) && addQueryRankValue >= 1 && addQueryRankValue <= 5);
  const [editQueryId, setEditQueryId] = useState<string | null>(null);
  const [editQueryDbId, setEditQueryDbId] = useState<string | null>(null);
  const [editQueryForm, setEditQueryForm] = useState<QueryFormState>(EMPTY_QUERY_FORM);
  const [editQueryLoading, setEditQueryLoading] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ type: 'db' | 'query' | 'ddl' | 'rule'; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Promote modal
  const [promoteModal, setPromoteModal] = useState<{ sqlQuery: string; queryText: string } | null>(null);
  const [promoteForm, setPromoteForm] = useState({ database_id: '', query_name: '', query_desc: '' });
  const [promoting, setPromoting] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // DDL expand/modal
  const [ddlExpandedDbId, setDdlExpandedDbId] = useState<string | null>(null);
  const [ddlModal, setDdlModal] = useState<{ dbId: string; dbName: string; editId?: string } | null>(null);
  const [ddlForm, setDdlForm] = useState({ table_name: '', ddl_text: '' });
  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlError, setDdlError] = useState<string | null>(null);

  // Rule expand/modal
  const [ruleExpandedDbId, setRuleExpandedDbId] = useState<string | null>(null);
  const [ruleModal, setRuleModal] = useState<{ dbId: string; dbName: string; editId?: string } | null>(null);
  const [ruleForm, setRuleForm] = useState({ rule_name: '', rule_text: '' });
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // View modal
  const [viewModal, setViewModal] = useState<{ db: KmDatabase } | null>(null);
  const [viewFullscreen, setViewFullscreen] = useState(false);

  // ---------------------------------------------------------------------------
  const fetchQueryHistory = async () => {
    try {
      const hist = await kmApi.get<any[]>('/manageSqlQuery/getHistory?limit=30');
      const filtered = (hist ?? []).filter(h => h.sql_text || h.db_name);
      
      const unique = [];
      const seen = new Set();
      for (const h of filtered) {
        if (h.question && !seen.has(h.question)) {
          seen.add(h.question);
          unique.push(h);
        }
      }

      setHistory(unique.map(h => ({
        id: h.id,
        query: h.question,
        db_name: h.db_name ?? undefined,
        sql_text: h.sql_text ?? undefined,
        has_error: h.has_error ?? false,
        created_at: h.created_at ?? undefined,
      })));
    } catch {
      // silently ignore
    }
  };

  // Change 1 — Auto-load on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      setLoadingInit(true);
      setInitError(null);
      try {
        const user = getXUser();
        const userType = getXuserType();
        const isSuperAdmin = user === 'nnpsuper' || userType === 'superAdmin' || userType === 'super-admin-role';
        const bkts = await kmApi.get<Bucket[]>('/manageBucket/getDetails/' + user);
        setBuckets(bkts ?? []);
        if (bkts && bkts.length > 0) {
          const ids = bkts.map(b => b.id).join(',');
          const dbs = await kmApi.get<KmDatabase[]>(`/manageDataSql/getDetails?bucketIds=${ids}`);
          const filteredDbs = (dbs ?? []).filter(db => {
            if (isSuperAdmin) return true;
            const bucket = bkts.find(b => b.id === db.bucket_id);
            const isBucketOwner = bucket ? bucket.created_by === user : false;
            const isDbCreator = db.created_by === user;
            return isDbCreator && isBucketOwner;
          });
          setDatabases(filteredDbs);
        }
        await fetchQueryHistory();
      } catch (err) {
        setInitError(err instanceof KmApiError ? err.detail : String(err));
      } finally {
        setLoadingInit(false);
      }
    };
    load();
  }, []);

  // Handle incoming question from navigation state (cross-navigation)
  useEffect(() => {
    if (location.state && (location.state as any).question) {
      const q = (location.state as any).question;
      // Clear navigation state to avoid re-running on refresh/back
      navigate(location.pathname, { replace: true, state: {} });
      // Run the query!
      handleSearch(q);
    }
  }, [location.state]);

  useEffect(() => {
    if (!trainingModal?.script) {
      setParsedCount({ examples: 0 });
      return;
    }
    const lines = trainingModal.script.split('\n');
    const examples = lines.filter(l => l.trim().startsWith('-- Q:')).length;
    setParsedCount({ examples });
  }, [trainingModal?.script]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // Change 3 — Search wired to new endpoint
  // ---------------------------------------------------------------------------

  const handleSearch = async (overrideQuestion?: string, skipSaveHistory = false) => {
    const question = overrideQuestion ?? searchQuery;
    if (!question.trim()) return;
    if (overrideQuestion !== undefined) setSearchQuery(overrideQuestion);
    if (buckets.length === 0) {
      setSearchError({ msg: 'No buckets loaded — please refresh the page.', requestId: null });
      return;
    }
    setSearching(true);
    setSearchError(null);
    setResult(null);
    setFeedback(null);
    setSubmittingFeedback(false);
    try {
      const res = await kmApi.post<SqlQueryResult>('/manageSqlQuery/query', {
        question,
        bucket_ids: buckets.map(b => b.id),
        db_id: selectedDbId || null,
        area: null,
      });
      setResult(res);
      setHistory(h => {
        const filtered = h.filter(
          item => item.query.trim().toLowerCase() !== question.trim().toLowerCase()
        );
        return [{
          id: Date.now(),
          query: question,
          result: res,
          db_name: res.database_name ?? undefined,
          has_error: !!res.error,
        }, ...filtered].slice(0, 20);
      });
      
      // Fire-and-forget — persist to server without blocking the UI
      if (!skipSaveHistory) {
        kmApi.post('/manageSqlQuery/saveHistory', {
          question,
          sql_text: res.sql ?? null,
          db_id: res.db_id,
          db_name: res.database_name,
          area: res.area,
          row_count: res.sql_data?.row_count ?? null,
          has_error: !!res.error,
        }).then(() => {
          fetchQueryHistory();
        }).catch(() => {});
      }
    } catch (err) {
      setSearchError(err instanceof KmApiError
        ? { msg: err.detail, requestId: err.requestId }
        : { msg: String(err), requestId: null });
    } finally {
      setSearching(false);
    }
  };

  const handleNewQuery = () => {
    setCurrentView('search');
    setSearchQuery('');
    setResult(null);
    setSearchError(null);
  };

  const handleHistoryClick = (item: HistoryItem) => {
    setCurrentView('search');
    setSearchError(null);
    handleSearch(item.query, true);
  };

  const handleDownloadCSV = () => {
    if (!result?.sql_data) return;
    const { columns, rows } = result.sql_data;
    const csv = columns.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_result.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    if (!result?.sql_data) return;
    const { columns, rows } = result.sql_data;
    const ws = XLSX.utils.aoa_to_sheet([columns, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'query_result.xlsx');
  };

  // ---------------------------------------------------------------------------
  // Configure — databases (Change 2: new fields in add/edit)
  // ---------------------------------------------------------------------------

  const handleAddDb = async () => {
    if (!addDbForm.bucket_id) { setDbError('Please select a bucket'); return; }
    setAddDbLoading(true);
    try {
      const created = await kmApi.post<KmDatabase>('/manageDataSql/addDBDetails', {
        bucket_id: addDbForm.bucket_id,
        database_name: addDbForm.database_name || null,
        database_type: addDbForm.database_type || null,
        database_desc: addDbForm.database_desc || null,
        connection_url: addDbForm.connection_url || null,
        area: addDbForm.area || null,
        connection_credential: addDbForm.connection_credential || null,
        keywords: addDbForm.keywords
          ? addDbForm.keywords.split(',').map(k => k.trim()).filter(Boolean)
          : null,
      });
      setDatabases(dbs => [...dbs, { ...created, queries: [], ddl: [], rules: [] }]);
      setAddDbOpen(false);
      setAddDbForm(EMPTY_DB_FORM);
      setUrlError('');
    } catch (err) {
      setDbError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setAddDbLoading(false);
    }
  };

  const handleStartEditDb = (db: KmDatabase) => {
    setEditDbId(db.id);
    setEditDbForm({
      bucket_id: db.bucket_id ?? '',
      database_name: db.database_name ?? '',
      database_type: db.database_type ?? '',
      database_desc: db.database_desc ?? '',
      connection_url: db.connection_url ?? '',
      area: (db as any).area ?? '',
      connection_credential: (db as any).connection_credential ?? '',
      keywords: db.keywords?.join(', ') ?? '',
    });
  };

  const handleSaveEditDb = async () => {
    if (!editDbId) return;
    setEditDbLoading(true);
    try {
      const updated = await kmApi.put<KmDatabase>(`/manageDataSql/updateDBDetails/${editDbId}`, {
        database_name: editDbForm.database_name || null,
        database_type: editDbForm.database_type || null,
        database_desc: editDbForm.database_desc || null,
        connection_url: editDbForm.connection_url || null,
        area: editDbForm.area || null,
        connection_credential: editDbForm.connection_credential || null,
        keywords: editDbForm.keywords
          ? editDbForm.keywords.split(',').map(k => k.trim()).filter(Boolean)
          : null,
      });
      setDatabases(dbs => dbs.map(d => d.id === editDbId ? { ...updated, queries: d.queries, ddl: d.ddl, rules: d.rules } : d));
      setEditDbId(null);
    } catch (err) {
      setDbError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setEditDbLoading(false);
    }
  };

  const handleSaveTraining = async () => {
    if (!trainingModal) return;
    setSavingTraining(true);
    try {
      const updated = await kmApi.put<KmDatabase>(
        `/manageDataSql/updateDBDetails/${trainingModal.dbId}`,
        { training_script: trainingModal.script || null }
      );
      setDatabases(dbs => dbs.map(d =>
        d.id === trainingModal.dbId ? { ...updated, queries: d.queries, ddl: d.ddl, rules: d.rules } : d
      ));
      setTrainingModal(null);
    } catch (err) {
      setDbError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setSavingTraining(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      if (deleteModal.type === 'db') {
        await kmApi.delete(`/manageDataSql/deleteDBDetail/${deleteModal.id}`);
        setDatabases(dbs => dbs.filter(d => d.id !== deleteModal.id));
        if (expandedDbId === deleteModal.id) setExpandedDbId(null);
        if (ddlExpandedDbId === deleteModal.id) setDdlExpandedDbId(null);
        if (ruleExpandedDbId === deleteModal.id) setRuleExpandedDbId(null);
      } else if (deleteModal.type === 'query') {
        await kmApi.delete(`/manageDataSql/deleteSQLDetail/${deleteModal.id}`);
        setDatabases(dbs => dbs.map(d => ({
          ...d,
          queries: d.queries.filter(q => q.id !== deleteModal.id),
        })));
        showToast('Training query deleted.');
      } else if (deleteModal.type === 'ddl') {
        await kmApi.delete(`/manageDataSql/deleteDDLDetail/${deleteModal.id}`);
        setDatabases(dbs => dbs.map(d => ({
          ...d,
          ddl: d.ddl.filter(e => e.id !== deleteModal.id),
        })));
        showToast('DDL entry deleted.');
      } else {
        await kmApi.delete(`/manageDataSql/deleteRuleDetail/${deleteModal.id}`);
        setDatabases(dbs => dbs.map(d => ({
          ...d,
          rules: d.rules.filter(r => r.id !== deleteModal.id),
        })));
        showToast('Rule deleted.');
      }
      setDeleteModal(null);
    } catch (err) {
      setDbError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Configure — SQL queries
  // ---------------------------------------------------------------------------

  const handleAddQuery = async (dbId: string) => {
    const queryName = addQueryForm.query_name.trim();
    const queryContext = addQueryForm.query_context.trim();
    const queryText = addQueryForm.query_text.trim();
    const rank = addQueryForm.rank.trim() ? parseInt(addQueryForm.rank, 10) : null;

    if (!queryName || !queryContext || !queryText) {
      setAddQueryError('Query name, natural language question, and SQL answer are required.');
      return;
    }

    if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 5)) {
      setAddQueryError('Rank must be between 1 and 5.');
      return;
    }

    setAddQueryLoading(true);
    setAddQueryError(null);
    try {
      const created = await kmApi.post<KmSqlQuery>('/manageDataSql/addSQLDetails', {
        database_id: dbId,
        query_name: queryName,
        query_desc: addQueryForm.query_desc || null,
        query_context: queryContext,
        query_text: queryText,
        rank,
      });
      setDatabases(dbs => dbs.map(d =>
        d.id === dbId ? { ...d, queries: [...d.queries, created] } : d
      ));
      setAddQueryModal(null);
      setAddQueryForm(EMPTY_QUERY_FORM);
      showToast('Training query saved and trained successfully.');
    } catch (err) {
      setAddQueryError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setAddQueryLoading(false);
    }
  };

  const handleStartEditQuery = (q: KmSqlQuery, dbId: string) => {
    setEditQueryId(q.id);
    setEditQueryDbId(dbId);
    setEditQueryForm({
      query_name: q.query_name ?? '',
      query_desc: q.query_desc ?? '',
      query_context: q.query_context ?? '',
      query_text: q.query_text ?? '',
      rank: String(q.rank ?? 3),
    });
  };

  const handleSaveEditQuery = async () => {
    if (!editQueryId || !editQueryDbId) return;
    setEditQueryLoading(true);
    try {
      const updated = await kmApi.put<KmSqlQuery>(`/manageDataSql/updateSQLDetails/${editQueryId}`, {
        query_name: editQueryForm.query_name || null,
        query_desc: editQueryForm.query_desc || null,
        query_context: editQueryForm.query_context || null,
        query_text: editQueryForm.query_text || null,
        rank: editQueryForm.rank ? parseInt(editQueryForm.rank, 10) : null,
      });
      const dbId = editQueryDbId;
      setDatabases(dbs => dbs.map(d =>
        d.id === dbId
          ? { ...d, queries: d.queries.map(q => q.id === editQueryId ? updated : q) }
          : d
      ));
      setEditQueryId(null);
      setEditQueryDbId(null);
      showToast('Training query updated and re-trained.');
    } catch (err) {
      setDbError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setEditQueryLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // DDL handlers
  // ---------------------------------------------------------------------------

  const handleSaveDdl = async () => {
    if (!ddlModal) return;
    setDdlLoading(true);
    setDdlError(null);
    try {
      const dbId = ddlModal.dbId;
      if (ddlModal.editId) {
        const updated = await kmApi.put<KmDdl>(`/manageDataSql/updateDDLDetails/${ddlModal.editId}`, {
          table_name: ddlForm.table_name || null,
          ddl_text: ddlForm.ddl_text,
        });
        setDatabases(dbs => dbs.map(d =>
          d.id === dbId
            ? { ...d, ddl: d.ddl.map(e => e.id === ddlModal.editId ? updated : e) }
            : d
        ));
        showToast('DDL entry updated and re-trained.');
      } else {
        const created = await kmApi.post<KmDdl>('/manageDataSql/addDDLDetails', {
          database_id: dbId,
          table_name: ddlForm.table_name || null,
          ddl_text: ddlForm.ddl_text,
        });
        setDatabases(dbs => dbs.map(d =>
          d.id === dbId ? { ...d, ddl: [...d.ddl, created] } : d
        ));
        showToast('DDL entry saved and trained.');
      }
      setDdlModal(null);
      setDdlForm({ table_name: '', ddl_text: '' });
    } catch (err) {
      setDdlError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setDdlLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rule handlers
  // ---------------------------------------------------------------------------

  const handleSaveRule = async () => {
    if (!ruleModal) return;
    setRuleLoading(true);
    setRuleError(null);
    try {
      const dbId = ruleModal.dbId;
      if (ruleModal.editId) {
        const updated = await kmApi.put<KmRule>(`/manageDataSql/updateRuleDetails/${ruleModal.editId}`, {
          rule_name: ruleForm.rule_name || null,
          rule_text: ruleForm.rule_text,
        });
        setDatabases(dbs => dbs.map(d =>
          d.id === dbId
            ? { ...d, rules: d.rules.map(r => r.id === ruleModal.editId ? updated : r) }
            : d
        ));
        showToast('Rule updated and re-trained.');
      } else {
        const created = await kmApi.post<KmRule>('/manageDataSql/addRuleDetails', {
          database_id: dbId,
          rule_name: ruleForm.rule_name || null,
          rule_text: ruleForm.rule_text,
        });
        setDatabases(dbs => dbs.map(d =>
          d.id === dbId ? { ...d, rules: [...d.rules, created] } : d
        ));
        showToast('Rule saved and trained.');
      }
      setRuleModal(null);
      setRuleForm({ rule_name: '', rule_text: '' });
    } catch (err) {
      setRuleError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setRuleLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Change 5 — Promote via new endpoint with database dropdown
  // ---------------------------------------------------------------------------

  const handleOpenPromote = () => {
    if (!result?.sql) return;
    setPromoteModal({ sqlQuery: result.sql, queryText: searchQuery });
    setPromoteForm({
      database_id: result.db_id ?? databases[0]?.id ?? '',
      query_name: '',
      query_desc: '',
    });
  };

  const handleFeedback = async (value: 1 | -1) => {
    if (!result || submittingFeedback || feedback !== null) return;
    setSubmittingFeedback(true);
    try {
      await kmApi.post('/manageSqlQuery/submitFeedback', {
        question: searchQuery,
        sql_text: result.sql ?? null,
        db_id: result.db_id,
        feedback: value,
      });
      setFeedback(value);
      showToast(value === 1 ? 'Thanks for the positive feedback!' : 'Thanks — we\'ll use this to improve.');
    } catch {
      showToast('Could not submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handlePromote = async () => {
    if (!promoteModal || !promoteForm.database_id) return;
    setPromoting(true);
    try {
      await kmApi.post('/manageSqlQuery/promoteQuery', {
        database_id: promoteForm.database_id,
        question: promoteModal.queryText,
        sql: promoteModal.sqlQuery,
        query_name: promoteForm.query_name || null,
        query_desc: promoteForm.query_desc || null,
      });
      setPromoteModal(null);
      showToast('Promoted to training successfully.');
    } catch (err) {
      setDbError(err instanceof KmApiError ? err.detail : String(err));
    } finally {
      setPromoting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const user = getXUser();
  const userType = getXuserType();
  const isSuperAdmin = user === 'nnpsuper' || userType === 'superAdmin' || userType === 'super-admin-role';
  const isAdminRole = userType === 'admin' || userType === 'admin-role' || userType === 'admin_role';
  const canConfigure = isSuperAdmin || isAdminRole;

  const dbIdForOwnership = result?.db_id || selectedDbId;
  const queryDb = dbIdForOwnership ? databases.find(d => d.id === dbIdForOwnership) : null;
  const queryBucket = queryDb ? buckets.find(b => b.id === queryDb.bucket_id) : null;
  const isQueryBucketOwner = queryBucket ? queryBucket.created_by === user : false;

  const showSqlQuery = isSuperAdmin || isQueryBucketOwner;

  if (loadingInit) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#4a77b4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading data sources…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full font-sans bg-gray-100 overflow-hidden">

      {/* Left Sidebar */}
      <aside className="w-64 bg-[#5b6164] text-gray-300 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-500/50 shrink-0">
          <button
            onClick={handleNewQuery}
            className="w-full py-2 px-4 border border-gray-400 text-gray-200 rounded hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            New Query
          </button>
        </div>

        <div className="p-5 flex-1 border-b border-gray-500/50 overflow-hidden flex flex-col">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-4 uppercase shrink-0">Recent Data Questions</h3>
          <ol className="text-sm space-y-3 text-[#5bc0de] list-none overflow-y-auto pr-2">
            {history.length === 0 && (
              <li className="text-gray-400 italic">No recent questions</li>
            )}
            {history.map((item, index) => (
              <li
                key={item.id}
                className="group cursor-pointer hover:text-white transition-colors flex items-start gap-2"
                title={item.query}
                onClick={() => handleHistoryClick(item)}
              >
                <span className="text-[#5bc0de]/50 group-hover:text-[#5bc0de] shrink-0 text-right w-6 select-none transition-colors">{index + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {item.has_error && <span className="text-red-400 shrink-0">•</span>}
                    <span className="truncate block">{item.query}</span>
                  </div>
                  {item.db_name && (
                    <span className="block text-xs text-gray-400 group-hover:text-gray-300 truncate mt-0.5">{item.db_name}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 bg-black/10 shrink-0">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-5 uppercase">Query Settings</h3>
          <div className="space-y-3 mb-8 text-sm">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={showGraph} onChange={e => setShowGraph(e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-500 text-[#5bc0de] focus:ring-[#5bc0de]" />
              <span className="text-gray-300 group-hover:text-white transition-colors">Show Graph</span>
            </label>
          </div>
          {canConfigure && (
            <button
              onClick={() => setCurrentView('configure')}
              className={`w-full py-2.5 px-4 text-sm font-bold tracking-wide transition-all duration-200 ${
                currentView === 'configure'
                  ? 'text-[#5bc0de] border border-[#5bc0de] rounded bg-[#5bc0de]/10'
                  : 'text-[#5bc0de] hover:text-white hover:bg-white/5 rounded uppercase border border-transparent'
              }`}
            >
              CONFIGURE DATA SOURCES
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-white p-8 overflow-y-auto">

        {initError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-sm text-red-700 flex justify-between">
            <span>Could not load data sources: {initError}</span>
            <button onClick={() => setInitError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-4">&times;</button>
          </div>
        )}

        {currentView === 'search' || !canConfigure ? (
          /* -------------------------------------------------------------- */
          /* SEARCH VIEW                                                      */
          /* -------------------------------------------------------------- */
          <div className="flex flex-col h-full max-w-6xl mx-auto">
            <h2 className="text-[#3b4754] font-bold text-lg mb-4">
              Ask for any Information (Data) from Nubo Native Platform
            </h2>

            {/* Change 3 — Filter row */}
            <div className="flex gap-4 mb-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Database:</label>
                <select
                  value={selectedDbId}
                  onChange={e => setSelectedDbId(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#4a77b4] bg-white"
                >
                  <option value="">Auto-select</option>
                  {databases.map(db => (
                    <option key={db.id} value={db.id}>{db.database_name || db.id}</option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSearch(); }}
              className="w-full h-32 shrink-0 border border-gray-400 bg-gray-200 rounded p-4 resize-none focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4] mb-4 text-gray-800 transition-colors"
              placeholder="e.g. Show total users per region… (Ctrl+Enter to submit)"
            />

            <div className="flex justify-end">
              <button
                onClick={() => handleSearch()}
                disabled={searching || !searchQuery.trim()}
                className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded text-sm font-medium transition-colors shadow-sm"
              >
                {searching ? 'Searching…' : 'Show Result'}
              </button>
            </div>

            {searchError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded text-sm text-red-700 flex justify-between items-start">
                <span>
                  {searchError.msg}
                  {searchError.requestId && (
                    <span className="ml-2 text-xs text-red-400">req: {searchError.requestId}</span>
                  )}
                </span>
                <button onClick={() => setSearchError(null)} className="text-red-400 hover:text-red-600 ml-4 shrink-0 text-lg leading-none">&times;</button>
              </div>
            )}

            <div className="mt-6 flex-1 flex flex-col gap-4">
              {!result && !searching && (
                <div className="flex-1 rounded flex items-start p-4 border border-dashed border-gray-300 bg-gray-50">
                  <span className="text-gray-400 italic">Data results will appear here…</span>
                </div>
              )}

              {result && (
                <>
                  {/* Answer */}
                  {showSqlQuery && (
                    <div className="p-4 border border-gray-200 rounded bg-gray-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Answer</p>
                      <p className="text-gray-800 text-sm whitespace-pre-wrap">{result.answer}</p>
                    </div>
                  )}

                  {/* Change 4 — DB info bar */}
                  {result.database_name && showSqlQuery && (
                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                      Database: <span className="font-medium text-gray-700">{result.database_name}</span>
                      {result.database_type && <span> ({result.database_type})</span>}
                      <span className="mx-2 text-gray-300">|</span>
                      RAG matches: <span className="font-medium text-gray-700">{result.rag_matches}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      Curated: <span className="font-medium text-gray-700">{result.curated_matches}</span>
                    </div>
                  )}

                  {/* Generated SQL */}
                  {result.sql && showSqlQuery && (
                    <div className="p-4 border border-gray-200 rounded bg-gray-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Generated SQL</p>
                      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">{result.sql}</pre>
                    </div>
                  )}

                  {/* Error from service */}
                  {result.error && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                      {result.error}
                    </div>
                  )}

                  {/* Chart */}
                  {showGraph && result.sql_data && result.sql_data.row_count > 0 && (
                    <ResultChart data={result.sql_data} />
                  )}

                  {/* Data table — hidden for stat (1×1) when chart is shown */}
                  {result.sql_data && result.sql_data.row_count > 0 &&
                   !(showGraph && result.sql_data.columns.length === 1 && result.sql_data.row_count === 1) && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              {result.sql_data.columns.map((col, i) => (
                                <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 tracking-wide border-b border-gray-200 whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.sql_data.rows.map((row, ri) => (
                              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-3 py-2 text-gray-700 border-b border-gray-100 whitespace-nowrap">
                                    {String(cell ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {result.sql_data && result.sql_data.row_count === 0 && (
                    <p className="text-xs text-gray-400 italic">Query returned no rows.</p>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {result.sql && showSqlQuery && (
                        <>
                          <span className="text-xs text-gray-400">Was this helpful?</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleFeedback(1)}
                              disabled={submittingFeedback || feedback !== null}
                              title="Thumbs up"
                              className={`text-lg leading-none px-1.5 py-0.5 rounded transition-colors disabled:cursor-not-allowed ${
                                feedback === 1
                                  ? 'text-green-600'
                                  : 'text-gray-400 hover:text-green-600 disabled:opacity-40'
                              }`}
                            >
                              👍
                            </button>
                            <button
                              onClick={() => handleFeedback(-1)}
                              disabled={submittingFeedback || feedback !== null}
                              title="Thumbs down"
                              className={`text-lg leading-none px-1.5 py-0.5 rounded transition-colors disabled:cursor-not-allowed ${
                                feedback === -1
                                  ? 'text-red-500'
                                  : 'text-gray-400 hover:text-red-500 disabled:opacity-40'
                              }`}
                            >
                              👎
                            </button>
                          </div>
                          <button
                            onClick={handleOpenPromote}
                            className="text-sm text-[#4a77b4] hover:text-[#3a6094] underline"
                          >
                            Promote to Training
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadCSV}
                        disabled={!result.sql_data || result.sql_data.row_count === 0}
                        className="bg-[#c2c2c2] hover:bg-gray-400 text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded text-sm font-medium transition-colors shadow-sm"
                      >
                        CSV
                      </button>
                      <button
                        onClick={handleDownloadExcel}
                        disabled={!result.sql_data || result.sql_data.row_count === 0}
                        className="bg-[#5cb85c] hover:bg-[#4cae4c] text-white disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded text-sm font-medium transition-colors shadow-sm"
                      >
                        Excel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        ) : (
          /* -------------------------------------------------------------- */
          /* CONFIGURE VIEW (Change 1: no bucket input; Change 2: new fields) */
          /* -------------------------------------------------------------- */
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[#3b4754] font-bold text-lg">Manage Data Sources</h2>
              <button
                onClick={handleNewQuery}
                className="text-sm font-medium text-[#4a77b4] hover:text-[#3a6094] underline"
              >
                Back to Search
              </button>
            </div>

            {dbError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-sm text-red-700 flex justify-between">
                <span>{dbError}</span>
                <button onClick={() => setDbError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
              </div>
            )}

            <div className="flex flex-col gap-8 mb-8">
              <div className="border border-gray-300 rounded bg-white shadow-sm flex flex-col overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1000px] p-5 flex flex-col min-h-[250px]">

                    {/* Header */}
                    <div className="grid grid-cols-[minmax(130px,2fr)_minmax(120px,2fr)_minmax(90px,1fr)_minmax(220px,3fr)_96px_260px] gap-2 text-xs font-semibold text-gray-500 border-b border-gray-200 pb-2 mb-3 tracking-wide">
                      <span>NAME</span>
                      <span>TYPE</span>
                      <span>AREA</span>
                      <span>DESCRIPTION</span>
                      <span>STATUS</span>
                      <span className="text-right">ACTIONS</span>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 space-y-0 overflow-y-auto pr-2">
                      {databases.length === 0 && (
                        <div className="text-xs text-gray-400 italic py-2">No databases found</div>
                      )}

                      {databases.map(db => (
                        <div key={db.id}>
                          {editDbId === db.id ? (
                            /* Stacked edit form */
                            <div className="border-b border-blue-100 py-3 bg-blue-50 px-2 mb-1 rounded">
                              <DbFormFields form={editDbForm} setForm={setEditDbForm} />
                              <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setEditDbId(null)} className="border border-gray-300 rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                                <button onClick={handleSaveEditDb} disabled={editDbLoading} className="border border-green-500 rounded px-3 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors">
                                  {editDbLoading ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-[minmax(130px,2fr)_minmax(120px,2fr)_minmax(90px,1fr)_minmax(220px,3fr)_96px_260px] gap-2 items-center border-b border-gray-100 py-2 hover:bg-gray-50 transition-colors">
                              <span className="text-sm text-gray-700 truncate font-medium" title={db.database_name ?? ''}>{db.database_name ?? '—'}</span>
                              <span className="text-sm text-gray-700 truncate" title={db.database_type ?? ''}>{db.database_type ?? '—'}</span>
                              <span className="text-xs text-gray-500 truncate">{(db as any).area ?? '—'}</span>
                              <span className="text-sm text-gray-700 truncate" title={db.database_desc ?? ''}>{db.database_desc ?? '—'}</span>
                              <span className="text-xs text-green-600 truncate whitespace-nowrap" title={db.status}>{db.status}</span>
                              <div className="flex justify-end gap-1 whitespace-nowrap">
                                <button onClick={() => handleStartEditDb(db)} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors" title="Edit">E</button>
                                <button
                                  onClick={() => setDdlExpandedDbId(ddlExpandedDbId === db.id ? null : db.id)}
                                  className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                                  title="Schema (DDL)"
                                >
                                  S{db.ddl.length > 0 ? `(${db.ddl.length})` : ''}
                                </button>
                                <button
                                  onClick={() => setRuleExpandedDbId(ruleExpandedDbId === db.id ? null : db.id)}
                                  className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                                  title="Business Rules"
                                >
                                  R{db.rules.length > 0 ? `(${db.rules.length})` : ''}
                                </button>
                                <button
                                  onClick={() => setExpandedDbId(expandedDbId === db.id ? null : db.id)}
                                  className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-[#4a77b4] hover:bg-blue-50 transition-colors"
                                  title="Training Queries"
                                >
                                  Q{db.queries.length > 0 ? `(${db.queries.length})` : ''}
                                </button>
                                <button
                                  onClick={() => setViewModal({ db })}
                                  className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                  title="View All Training Data"
                                >
                                  V
                                </button>
                                <button onClick={() => setDeleteModal({ type: 'db', id: db.id, name: db.database_name ?? db.id })} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors" title="Delete">X</button>
                              </div>
                            </div>
                          )}

                          {/* Expanded queries */}
                          {expandedDbId === db.id && (
                            <div className="ml-4 mb-2 border-l-2 border-[#5bc0de]/30 pl-4 pb-2">
                              <h4 className="text-xs font-semibold text-gray-400 tracking-wider uppercase mt-2 mb-2">
                                Training Queries — {db.database_name ?? db.id}
                              </h4>

                              {db.queries.length > 0 && (
                                <div className="mb-2">
                                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 border-b border-gray-200 pb-1 mb-1 tracking-wide">
                                    <span className="col-span-3">NAME</span>
                                    <span className="col-span-2">CONTEXT</span>
                                    <span className="col-span-4">QUERY TEXT</span>
                                    <span className="col-span-1">RANK</span>
                                    <span className="col-span-2 text-right">ACTIONS</span>
                                  </div>
                                  {db.queries.map(q => (
                                    <div key={q.id}>
                                      {editQueryId === q.id ? (
                                        <div className="grid grid-cols-12 gap-2 items-start border-b border-blue-100 py-2 bg-blue-50">
                                          <div className="col-span-3"><input value={editQueryForm.query_name} onChange={e => setEditQueryForm(f => ({ ...f, query_name: e.target.value }))} className={inp} placeholder="Name" /></div>
                                          <div className="col-span-2"><input value={editQueryForm.query_context} onChange={e => setEditQueryForm(f => ({ ...f, query_context: e.target.value }))} className={inp} placeholder="Context" /></div>
                                          <div className="col-span-4"><textarea value={editQueryForm.query_text} onChange={e => setEditQueryForm(f => ({ ...f, query_text: e.target.value }))} className={`${inp} resize-none h-14`} placeholder="SQL" /></div>
                                          <div className="col-span-1"><input value={editQueryForm.rank} onChange={e => setEditQueryForm(f => ({ ...f, rank: e.target.value }))} className={inp} type="number" min="1" max="5" /></div>
                                          <div className="col-span-2 flex justify-end gap-1 pt-1">
                                            <button onClick={handleSaveEditQuery} disabled={editQueryLoading} className="border border-green-500 rounded px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors">
                                              {editQueryLoading ? '…' : 'Save'}
                                            </button>
                                            <button onClick={() => { setEditQueryId(null); setEditQueryDbId(null); }} className="border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 py-1.5 hover:bg-gray-50 transition-colors">
                                          <span className="col-span-3 text-sm text-gray-700 truncate" title={q.query_name ?? ''}>{q.query_name ?? '—'}</span>
                                          <span className="col-span-2 text-xs text-gray-500 truncate">{q.query_context ?? '—'}</span>
                                          <span className="col-span-4 text-xs font-mono text-gray-600 truncate" title={q.query_text ?? ''}>{q.query_text ?? '—'}</span>
                                          <span className="col-span-1 text-xs text-gray-500">{q.rank ?? '—'}</span>
                                          <div className="col-span-2 flex justify-end gap-1">
                                            <button onClick={() => handleStartEditQuery(q, db.id)} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">E</button>
                                            <button onClick={() => setDeleteModal({ type: 'query', id: q.id, name: q.query_name ?? q.id })} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors">X</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {db.queries.length === 0 && (
                                <p className="text-xs text-gray-400 italic mb-2">No training queries added yet.</p>
                              )}

                              <button
                                onClick={() => { setAddQueryModal({ dbId: db.id, dbName: db.database_name ?? db.id }); setAddQueryForm(EMPTY_QUERY_FORM); setAddQueryError(null); }}
                                className="flex items-center gap-2 text-xs text-gray-600 hover:text-[#4a77b4] transition-colors group mt-1"
                              >
                                Add Training Query
                                <span className="border border-gray-300 rounded px-1.5 py-0.5 leading-none bg-gray-50 text-base group-hover:border-[#4a77b4] group-hover:bg-blue-50">+</span>
                              </button>
                            </div>
                          )}

                          {/* Schema (DDL) panel */}
                          {ddlExpandedDbId === db.id && (
                            <div className="ml-4 mb-2 border-l-2 border-purple-200/50 pl-4 pb-2">
                              <h4 className="text-xs font-semibold text-gray-400 tracking-wider uppercase mt-2 mb-2">
                                Schema (DDL) — {db.database_name ?? db.id}
                              </h4>
                              {db.ddl.length > 0 && (
                                <div className="mb-2">
                                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 border-b border-gray-200 pb-1 mb-1 tracking-wide">
                                    <span className="col-span-3">TABLE NAME</span>
                                    <span className="col-span-7">DDL TEXT</span>
                                    <span className="col-span-2 text-right">ACTIONS</span>
                                  </div>
                                  {db.ddl.map(entry => (
                                    <div key={entry.id} className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 py-1.5 hover:bg-gray-50 transition-colors">
                                      <span className="col-span-3 text-sm text-gray-700 truncate" title={entry.table_name ?? ''}>{entry.table_name ?? '—'}</span>
                                      <span className="col-span-7 text-xs font-mono text-gray-600 truncate" title={entry.ddl_text}>{entry.ddl_text}</span>
                                      <div className="col-span-2 flex justify-end gap-1">
                                        <button onClick={() => { setDdlModal({ dbId: db.id, dbName: db.database_name ?? db.id, editId: entry.id }); setDdlForm({ table_name: entry.table_name ?? '', ddl_text: entry.ddl_text }); setDdlError(null); }} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">E</button>
                                        <button onClick={() => setDeleteModal({ type: 'ddl', id: entry.id, name: entry.table_name ?? entry.id })} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors">X</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {db.ddl.length === 0 && (
                                <p className="text-xs text-gray-400 italic mb-2">No DDL entries yet.</p>
                              )}
                              <button
                                onClick={() => { setDdlModal({ dbId: db.id, dbName: db.database_name ?? db.id }); setDdlForm({ table_name: '', ddl_text: '' }); setDdlError(null); }}
                                className="flex items-center gap-2 text-xs text-gray-600 hover:text-purple-600 transition-colors group mt-1"
                              >
                                Add DDL Entry
                                <span className="border border-gray-300 rounded px-1.5 py-0.5 leading-none bg-gray-50 text-base group-hover:border-purple-400 group-hover:bg-purple-50">+</span>
                              </button>
                            </div>
                          )}

                          {/* Business Rules panel */}
                          {ruleExpandedDbId === db.id && (
                            <div className="ml-4 mb-2 border-l-2 border-amber-200/50 pl-4 pb-2">
                              <h4 className="text-xs font-semibold text-gray-400 tracking-wider uppercase mt-2 mb-2">
                                Business Rules — {db.database_name ?? db.id}
                              </h4>
                              {db.rules.length > 0 && (
                                <div className="mb-2">
                                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 border-b border-gray-200 pb-1 mb-1 tracking-wide">
                                    <span className="col-span-3">RULE NAME</span>
                                    <span className="col-span-7">RULE TEXT</span>
                                    <span className="col-span-2 text-right">ACTIONS</span>
                                  </div>
                                  {db.rules.map(rule => (
                                    <div key={rule.id} className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 py-1.5 hover:bg-gray-50 transition-colors">
                                      <span className="col-span-3 text-sm text-gray-700 truncate" title={rule.rule_name ?? ''}>{rule.rule_name ?? '—'}</span>
                                      <span className="col-span-7 text-xs text-gray-600 truncate" title={rule.rule_text}>{rule.rule_text}</span>
                                      <div className="col-span-2 flex justify-end gap-1">
                                        <button onClick={() => { setRuleModal({ dbId: db.id, dbName: db.database_name ?? db.id, editId: rule.id }); setRuleForm({ rule_name: rule.rule_name ?? '', rule_text: rule.rule_text }); setRuleError(null); }} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">E</button>
                                        <button onClick={() => setDeleteModal({ type: 'rule', id: rule.id, name: rule.rule_name ?? rule.id })} className="border border-gray-300 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors">X</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {db.rules.length === 0 && (
                                <p className="text-xs text-gray-400 italic mb-2">No rules added yet.</p>
                              )}
                              <button
                                onClick={() => { setRuleModal({ dbId: db.id, dbName: db.database_name ?? db.id }); setRuleForm({ rule_name: '', rule_text: '' }); setRuleError(null); }}
                                className="flex items-center gap-2 text-xs text-gray-600 hover:text-amber-600 transition-colors group mt-1"
                              >
                                Add Rule
                                <span className="border border-gray-300 rounded px-1.5 py-0.5 leading-none bg-gray-50 text-base group-hover:border-amber-400 group-hover:bg-amber-50">+</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add DB stacked form */}
                    {addDbOpen && (
                      <div className="border border-blue-200 rounded p-3 bg-blue-50 mt-3">
                        <div className="mb-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">BUCKET *</label>
                          <select value={addDbForm.bucket_id} onChange={e => setAddDbForm(f => ({ ...f, bucket_id: e.target.value }))} className={sel}>
                            <option value="">Select bucket…</option>
                            {buckets
                              .filter(b => {
                                const user = getXUser();
                                const userType = getXuserType();
                                const isSuperAdmin = user === 'nnpsuper' || userType === 'superAdmin' || userType === 'super-admin-role';
                                return isSuperAdmin || b.created_by === user;
                              })
                              .map(b => <option key={b.id} value={b.id}>{b.bucket_name || b.id}</option>)}
                          </select>
                        </div>
                        <DbFormFields
                          form={addDbForm}
                          setForm={setAddDbForm}
                          urlError={urlError}
                          onUrlChange={value => {
                            setAddDbForm(f => ({ ...f, connection_url: value }));
                            if (value.match(/\/\/[^@]+:[^@]+@/)) {
                              setUrlError('Remove credentials from URL. Use the Credentials field below.');
                            } else {
                              setUrlError('');
                            }
                          }}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => { setAddDbOpen(false); setAddDbForm(EMPTY_DB_FORM); setUrlError(''); }} className="border border-gray-300 rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                          <button onClick={handleAddDb} disabled={addDbLoading || !!urlError} className="border border-green-500 rounded px-3 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors">
                            {addDbLoading ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => { setAddDbOpen(true); setAddDbForm(EMPTY_DB_FORM); }}
                        disabled={!buckets.some(b => {
                          const user = getXUser();
                          const userType = getXuserType();
                          const isSuperAdmin = user === 'nnpsuper' || userType === 'superAdmin' || userType === 'super-admin-role';
                          return isSuperAdmin || b.created_by === user;
                        })}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#4a77b4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors group"
                      >
                        Add Data Source
                        <span className="border border-gray-300 rounded px-1.5 py-0.5 leading-none bg-gray-50 text-lg group-hover:border-[#4a77b4] group-hover:bg-blue-50">+</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* TRAINING SCRIPT MODAL                                               */}
      {/* ------------------------------------------------------------------ */}
      {trainingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className={`bg-white rounded shadow-xl flex flex-col transition-all duration-200 ${trainingFullscreen ? 'w-[98vw] h-[98vh]' : 'w-[85vw] max-w-[900px] h-[90vh]'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
              <h3 className="font-semibold text-[#3b4754]">Training Script</h3>
              <div className="flex items-center">
                <button
                  onClick={() => setTrainingFullscreen(f => !f)}
                  className="text-gray-400 hover:text-gray-600 text-sm border border-gray-300 rounded px-2 py-0.5 mr-2"
                  title={trainingFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                >
                  {trainingFullscreen ? '⊡' : '⤢'}
                </button>
                <button onClick={() => { setTrainingModal(null); setTrainingFullscreen(false); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex gap-2 mb-2 shrink-0">
                <span className="text-xs text-gray-400 self-center">Jump to:</span>
                {['SECTION 1', 'SECTION 2', 'SECTION 3'].map(sec => (
                  <button
                    key={sec}
                    onClick={() => {
                      const ta = document.getElementById('training-script-textarea') as HTMLTextAreaElement | null;
                      if (!ta) return;
                      const lines = ta.value.split('\n');
                      const idx = lines.findIndex(l => l.includes(sec));
                      if (idx >= 0) {
                        const pos = lines.slice(0, idx).join('\n').length;
                        ta.focus();
                        ta.setSelectionRange(pos, pos);
                        const lineHeight = 18;
                        ta.scrollTop = idx * lineHeight;
                      }
                    }}
                    className="text-xs border border-gray-300 rounded px-2 py-0.5 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors"
                  >
                    {sec === 'SECTION 1' ? 'Schema' : sec === 'SECTION 2' ? 'Rules' : 'Examples'}
                  </button>
                ))}
              </div>
              <textarea
                id="training-script-textarea"
                value={trainingModal.script}
                onChange={e => setTrainingModal(m => m ? { ...m, script: e.target.value } : m)}
                className="flex-1 w-full border border-gray-300 rounded p-3 font-mono text-xs resize-none focus:outline-none focus:border-[#4a77b4] min-h-0"
                placeholder="Enter Vanna training context / script…"
              />
            </div>
            <div className="px-4 pt-1 shrink-0">
              <p className="text-xs text-gray-400">
                Parsed:{' '}
                <span className={`font-medium ${parsedCount.examples > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {parsedCount.examples} Q→A examples
                </span>
                {' '}found in SECTION 3
                {parsedCount.examples === 0 && trainingModal?.script && trainingModal.script.length > 50 && (
                  <span className="text-amber-500 ml-2">— add lines starting with "-- Q:" and "-- A:"</span>
                )}
              </p>
            </div>
            <div className="px-4 pb-2 shrink-0">
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-medium text-gray-500">How this works:</span>
                {' '}SECTION 1 (schema) and SECTION 2 (rules) are sent to the AI as context. SECTION 3 examples (-- Q: / -- A: pairs) are embedded and stored in Milvus — they replace previous training examples when you save. Auto-trained pairs from user queries and promoted queries are always preserved.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 shrink-0">
              <button onClick={() => { setTrainingModal(null); setTrainingFullscreen(false); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleSaveTraining} disabled={savingTraining} className="px-4 py-2 bg-[#4a77b4] hover:bg-[#3a6094] text-white text-sm rounded disabled:opacity-50">
                {savingTraining ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DELETE CONFIRMATION MODAL                                           */}
      {/* ------------------------------------------------------------------ */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-[400px] p-6">
            <h3 className="font-semibold text-[#3b4754] mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-6">
              Delete <span className="font-medium">{deleteModal.name}</span>? This marks the record as deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* PROMOTE TO SAVED QUERY MODAL (Change 5)                            */}
      {/* ------------------------------------------------------------------ */}
      {promoteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-[500px] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="font-semibold text-[#3b4754]">Promote to Training</h3>
              <button onClick={() => setPromoteModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">DATABASE *</label>
                <select
                  value={promoteForm.database_id}
                  onChange={e => setPromoteForm(f => ({ ...f, database_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4] bg-white"
                >
                  <option value="">Select database…</option>
                  {databases.map(db => (
                    <option key={db.id} value={db.id}>{db.database_name || db.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">QUERY NAME</label>
                <input
                  value={promoteForm.query_name}
                  onChange={e => setPromoteForm(f => ({ ...f, query_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">DESCRIPTION</label>
                <input
                  value={promoteForm.query_desc}
                  onChange={e => setPromoteForm(f => ({ ...f, query_desc: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">GENERATED SQL (READ-ONLY)</label>
                <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap overflow-x-auto max-h-32">{promoteModal.sqlQuery}</pre>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setPromoteModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handlePromote}
                disabled={promoting || !promoteForm.database_id}
                className="px-4 py-2 bg-[#4a77b4] hover:bg-[#3a6094] text-white text-sm rounded disabled:opacity-50"
              >
                {promoting ? 'Saving…' : 'Promote to Training'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ADD TRAINING QUERY MODAL                                           */}
      {/* ------------------------------------------------------------------ */}
      {addQueryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-[500px] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="font-semibold text-[#3b4754]">Add Training Query — {addQueryModal.dbName}</h3>
              <button onClick={() => setAddQueryModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">NATURAL LANGUAGE QUESTION *</label>
                <textarea
                  rows={2}
                  value={addQueryForm.query_context}
                  onChange={e => setAddQueryForm(f => ({ ...f, query_context: e.target.value }))}
                  placeholder="e.g. How many active users are there?"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">SQL ANSWER *</label>
                <textarea
                  rows={4}
                  value={addQueryForm.query_text}
                  onChange={e => setAddQueryForm(f => ({ ...f, query_text: e.target.value }))}
                  placeholder="SELECT count(*) FROM users WHERE status = 'ACTIVE'"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-[#4a77b4] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">QUERY NAME *</label>
                  <input
                    value={addQueryForm.query_name}
                    onChange={e => setAddQueryForm(f => ({ ...f, query_name: e.target.value }))}
                    placeholder="Display name"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">RANK (1–5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={addQueryForm.rank}
                    onChange={e => setAddQueryForm(f => ({ ...f, rank: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4]"
                  />
                  {!addQueryRankIsValid && (
                    <p className="text-red-500 text-xs mt-1">Rank must be between 1 and 5.</p>
                  )}
                </div>
              </div>
              {addQueryError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{addQueryError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setAddQueryModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => handleAddQuery(addQueryModal.dbId)}
                disabled={addQueryLoading || !addQueryForm.query_name.trim() || !addQueryForm.query_context.trim() || !addQueryForm.query_text.trim() || !addQueryRankIsValid}
                className="px-4 py-2 bg-[#4a77b4] hover:bg-[#3a6094] text-white text-sm rounded disabled:opacity-50"
              >
                {addQueryLoading ? 'Saving…' : 'Save & Train'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DDL (SCHEMA) MODAL                                                  */}
      {/* ------------------------------------------------------------------ */}
      {ddlModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-[600px] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="font-semibold text-[#3b4754]">{ddlModal.editId ? 'Edit' : 'Add'} DDL Entry — {ddlModal.dbName}</h3>
              <button onClick={() => setDdlModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">TABLE NAME</label>
                <input
                  value={ddlForm.table_name}
                  onChange={e => setDdlForm(f => ({ ...f, table_name: e.target.value }))}
                  placeholder="e.g. public.users"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">DDL TEXT <span className="text-red-500">*</span></label>
                <textarea
                  rows={10}
                  value={ddlForm.ddl_text}
                  onChange={e => setDdlForm(f => ({ ...f, ddl_text: e.target.value }))}
                  placeholder="CREATE TABLE public.users (id UUID PRIMARY KEY, name VARCHAR(256), status VARCHAR(50));"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-[#4a77b4] resize-none"
                />
              </div>
              {ddlError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{ddlError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setDdlModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSaveDdl}
                disabled={ddlLoading || !ddlForm.ddl_text.trim()}
                className="px-4 py-2 bg-[#4a77b4] hover:bg-[#3a6094] text-white text-sm rounded disabled:opacity-50"
              >
                {ddlLoading ? 'Saving…' : ddlModal.editId ? 'Update & Re-train' : 'Save & Train'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* RULES MODAL                                                          */}
      {/* ------------------------------------------------------------------ */}
      {ruleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-[500px] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="font-semibold text-[#3b4754]">{ruleModal.editId ? 'Edit' : 'Add'} Rule — {ruleModal.dbName}</h3>
              <button onClick={() => setRuleModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">RULE NAME</label>
                <input
                  value={ruleForm.rule_name}
                  onChange={e => setRuleForm(f => ({ ...f, rule_name: e.target.value }))}
                  placeholder="e.g. Active users definition"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">RULE TEXT <span className="text-red-500">*</span></label>
                <textarea
                  rows={5}
                  value={ruleForm.rule_text}
                  onChange={e => setRuleForm(f => ({ ...f, rule_text: e.target.value }))}
                  placeholder={`e.g. "active" means status = 'ACTIVE' and deleted_at IS NULL`}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#4a77b4] resize-none"
                />
              </div>
              {ruleError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{ruleError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setRuleModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSaveRule}
                disabled={ruleLoading || !ruleForm.rule_text.trim()}
                className="px-4 py-2 bg-[#4a77b4] hover:bg-[#3a6094] text-white text-sm rounded disabled:opacity-50"
              >
                {ruleLoading ? 'Saving…' : ruleModal.editId ? 'Update & Re-train' : 'Save & Train'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW ALL TRAINING DATA MODAL                                        */}
      {/* ------------------------------------------------------------------ */}
      {viewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className={`bg-white rounded shadow-xl flex flex-col transition-all duration-200 ${viewFullscreen ? 'w-[98vw] h-[98vh]' : 'w-[80vw] max-w-[900px] h-[85vh]'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
              <h3 className="font-semibold text-[#3b4754]">Training Data — {viewModal.db.database_name ?? viewModal.db.id}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewFullscreen(f => !f)}
                  className="text-gray-400 hover:text-gray-600 text-sm border border-gray-300 rounded px-2 py-0.5"
                  title={viewFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                >
                  {viewFullscreen ? '⊡' : '⤢'}
                </button>
                <button onClick={() => { setViewModal(null); setViewFullscreen(false); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
              <section>
                <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Schema ({viewModal.db.ddl.length} entries)</h4>
                {viewModal.db.ddl.length === 0
                  ? <p className="text-xs text-gray-400 italic">No DDL entries.</p>
                  : viewModal.db.ddl.map(entry => (
                    <div key={entry.id} className="mb-3 border border-gray-200 rounded p-3 bg-gray-50">
                      {entry.table_name && <p className="text-xs font-semibold text-gray-500 mb-1">{entry.table_name}</p>}
                      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">{entry.ddl_text}</pre>
                    </div>
                  ))
                }
              </section>
              <section>
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Business Rules ({viewModal.db.rules.length} entries)</h4>
                {viewModal.db.rules.length === 0
                  ? <p className="text-xs text-gray-400 italic">No rules.</p>
                  : viewModal.db.rules.map(rule => (
                    <div key={rule.id} className="mb-2 border border-gray-200 rounded p-3 bg-gray-50">
                      {rule.rule_name && <p className="text-xs font-semibold text-gray-500 mb-1">{rule.rule_name}</p>}
                      <p className="text-xs text-gray-700">{rule.rule_text}</p>
                    </div>
                  ))
                }
              </section>
              <section>
                <h4 className="text-xs font-bold text-[#4a77b4] uppercase tracking-wider mb-2">Training Queries ({viewModal.db.queries.length} entries)</h4>
                {viewModal.db.queries.length === 0
                  ? <p className="text-xs text-gray-400 italic">No training queries.</p>
                  : viewModal.db.queries.map(q => (
                    <div key={q.id} className="mb-3 border border-gray-200 rounded p-3 bg-gray-50">
                      {q.query_name && <p className="text-xs font-semibold text-gray-500 mb-1">{q.query_name}</p>}
                      {q.query_context && <p className="text-xs text-gray-600 mb-1"><span className="font-medium">Q:</span> {q.query_context}</p>}
                      {q.query_text && <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">{q.query_text}</pre>}
                    </div>
                  ))
                }
              </section>
            </div>
            <div className="flex justify-end p-4 border-t border-gray-200 shrink-0">
              <button onClick={() => { setViewModal(null); setViewFullscreen(false); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (Change 5) */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-green-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50 transition-opacity">
          {toast}
        </div>
      )}
    </div>
  );
};

export default SqlQuery;
