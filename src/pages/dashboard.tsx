import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import kmApi, { KmApiError } from '../services/kmApiService';
import { searchKnowledgeBase } from '../services/queryApiService';
import type { RagImage } from '../services/queryApiService';
import type { Bucket, BucketDetail, BucketStatus, DocStatus } from '../types/km';
import { getXUser, getXuserType } from '../shared/utils';
import { GitRepositoryForm } from '../components/git-repository-form';
import { RedmineBucketDetailsForm } from '../components/redmine-bucket-details-form';
import { MarkdownAnswer } from '../components/markdown-answer';

// Type definitions
type ViewState = 'search' | 'configure';
type TabState = 'Documents' | 'Web Pages' | 'Code Repository' | 'Incident Repo';
// type TabState = 'Documents' | 'Web Pages' | 'Google Drive' | 'Code Repository' | 'Incident Repo';

interface HistoryItem {
  id: number;
  query: string;
  answer?: string;
  images?: RagImage[];
  sql_text?: string;
  db_name?: string;
  has_error?: boolean;
  created_at?: string;
}

const TAB_CATEGORY: Record<TabState, string> = {
  'Documents': 'document',
  'Web Pages': 'web',
  // 'Google Drive': 'gdrive',
  'Code Repository': 'git',
  'Incident Repo': 'redmine',
};

const BUCKET_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,254}$/;

const getBucketNameError = (name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName) return 'Bucket name is required.';
  if (trimmedName.length > 255) return 'Bucket name must be 255 characters or fewer.';
  if (!/^[A-Za-z_]/.test(trimmedName)) return 'Bucket name must start with a letter or underscore.';
  if (!BUCKET_NAME_RE.test(trimmedName)) {
    return 'Use only letters, numbers, and underscores. Spaces and special characters are not allowed.';
  }
  return '';
};

const statusBadge = (status: BucketStatus) => {
  const cfg: Record<BucketStatus, { label: string; cls: string }> = {
    PROVISIONING: { label: 'Provisioning', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    ACTIVE: { label: 'Active', cls: 'bg-green-100 text-green-700 border-green-300' },
    FAILED: { label: 'Failed', cls: 'bg-red-100 text-red-700 border-red-300' },
    INACTIVE: { label: 'Inactive', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
    ARCHIVED: { label: 'Archived', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
    DELETED: { label: 'Deleted', cls: 'bg-gray-100 text-gray-400 border-gray-200' },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-300' };
  return <span className={`inline-block px-2 py-0.5 text-xs rounded border ${cls}`}>{label}</span>;
};

const docStatusBadge = (status: DocStatus) => {
  const cfg: Record<DocStatus, { label: string; cls: string }> = {
    PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    INGESTED: { label: 'Ingested', cls: 'bg-green-100 text-green-700 border-green-300' },
    FAILED: { label: 'Failed', cls: 'bg-red-100 text-red-700 border-red-300' },
    DELETED: { label: 'Deleted', cls: 'bg-gray-100 text-gray-400 border-gray-200' },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-300' };
  return <span className={`inline-block px-2 py-0.5 text-xs rounded border ${cls}`}>{label}</span>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<ViewState>('search');
  const [activeTab, setActiveTab] = useState<TabState>('Documents');

  // --- STATE FOR SEARCH AND HISTORY ---
  const [searchQuery, setSearchQuery] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentImages, setCurrentImages] = useState<RagImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeBuckets, setActiveBuckets] = useState<Bucket[]>([]);
  const [selectedBucketNames, setSelectedBucketNames] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [noOfSources, setNoOfSources] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(40);
  // const [showSourceDoc, setShowSourceDoc] = useState(true);
  const [showSourceDoc] = useState(true);
  const [extendPublic, setExtendPublic] = useState(true);

  // --- STATE FOR CONFIGURE LISTS ---
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [accountInput, setAccountInput] = useState('');
  const [details, setDetails] = useState<BucketDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // --- BUCKET STATE ---
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const [selectedBucketId, setSelectedBucketId] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const currentUser = getXUser();
  const currentUserType = getXuserType();
  const isSuperAdmin = currentUser === 'nnpsuper' || currentUserType === 'superAdmin' || currentUserType === 'super-admin-role';
  const isAdminRole = currentUserType === 'admin' || currentUserType === 'admin-role' || currentUserType === 'admin_role';
  const canConfigure = isSuperAdmin || isAdminRole;
  const isOwnerOfSelected = !selectedBucketId || selectedBucketId === 'new' || (selectedBucket ? selectedBucket.created_by === currentUser : true);
  const [formBucketName, setFormBucketName] = useState('');
  const [bucketNameTouched, setBucketNameTouched] = useState(false);
  const [formCategory, setFormCategory] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; requestId?: string | null } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; bucketId: string; bucketName: string; type: 'bucket' | 'detail' }>({ open: false, bucketId: '', bucketName: '', type: 'bucket' });
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string; requestId: string | null }>({ open: false, message: '', requestId: null });

  // --- ADD DOCUMENT INLINE FORM ---
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addFormFile, setAddFormFile] = useState<File | null>(null);
  const [addFormName, setAddFormName] = useState('');
  const [addFormUrl, setAddFormUrl] = useState('');
  const [submittingDetail, setSubmittingDetail] = useState(false);
  const bucketNameError = selectedBucketId === 'new' ? getBucketNameError(formBucketName) : '';
  const showBucketNameError = selectedBucketId === 'new' && bucketNameTouched && Boolean(bucketNameError);

  // --- NEW QUERY HANDLER ---
  const handleNewQuery = () => {
    setCurrentView('search');
    setSearchQuery("");
    setCurrentAnswer("");
    setCurrentImages([]);
  }; const fetchQueryHistory = async () => {
    try {
      const hist = await kmApi.get<any[]>('/manageSqlQuery/getHistory?limit=30');
      const filtered = (hist ?? []).filter(h => !h.sql_text && !h.db_name);

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
        sql_text: h.sql_text ?? undefined,
        db_name: h.db_name ?? undefined,
        has_error: h.has_error ?? false,
        created_at: h.created_at ?? undefined,
      })));
    } catch {
      // silently ignore
    }
  };

  // --- SEARCH HANDLERS ---
  const handleSearch = async (overrideQuestion?: string, skipSaveHistory = false) => {
    const question = overrideQuestion ?? searchQuery;
    if (!question.trim()) return;
    if (overrideQuestion !== undefined) {
      setSearchQuery(overrideQuestion);
    }
    setSearching(true);
    setCurrentAnswer("");
    setCurrentImages([]);
    try {
      const result = await searchKnowledgeBase(question, noOfSources, similarityThreshold, extendPublic, selectedBucketNames);

      const seen = new Set<string>();
      const unique = result.answer
        .filter(r => r.text)
        .filter(r => Math.round(r.score * 100) >= similarityThreshold)
        .filter(r => {
          const key = r.text!.trim().substring(0, 100);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, noOfSources);

      let answerText = '';
      if (showSourceDoc) {
        // answerText = unique
        //   .map((r, i) => {
        //     const rawText = (r.text || '').trim();
        //     const paragraphs = rawText.split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());
        //     const cleanedText = paragraphs.filter(p => p).join('\n\n');
        //     return `Result ${i + 1} (relevance: ${Math.round(r.score * 100)}%)\n${cleanedText}`;
        //   })
        //   .filter(text => text.trim())
        //   .join('\n\n---\n\n');
        answerText = unique
          .map((r) => {
            return (r.text || '').trim();
          })
          .filter(text => text.trim())
          .join('\n\n---\n\n');
      } else {
        // Summarized output: deduplicate paragraphs from all results
        const seenParas = new Set<string>();
        const summarizedParagraphs: string[] = [];
        for (const r of unique) {
          const rawText = r.text || '';
          const paragraphs = rawText.split(/\n\s*\n/);
          for (const p of paragraphs) {
            const cleanedLines = p.split('\n')
              .filter(line => !/\bpage\b\s*\d*/i.test(line))
              .map(line => line.trim());

            const cleanedParaText = cleanedLines.join(' ').replace(/\s+/g, ' ').trim();
            if (!cleanedParaText) continue;

            const normKey = cleanedParaText.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!seenParas.has(normKey)) {
              seenParas.add(normKey);
              summarizedParagraphs.push(cleanedParaText);
            }
          }
        }
        answerText = summarizedParagraphs.join('\n\n');
      }

      const finalAnswer = answerText || 'No relevant results found for your question. Try rephrasing or add more documents to the knowledge base.';

      const newItem: HistoryItem = {
        id: Date.now(),
        query: question,
        answer: finalAnswer,
        images: result.images ?? [],
      };
      setHistory(h => [newItem, ...h.filter(item => item.query !== question)].slice(0, 30));
      setCurrentAnswer(finalAnswer);
      setCurrentImages(result.images ?? []);

      // Save to server history (fire-and-forget)
      if (!skipSaveHistory) {
        kmApi.post('/manageSqlQuery/saveHistory', {
          question,
          has_error: false,
        }).then(() => {
          fetchQueryHistory();
        }).catch(() => { });
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Search failed';
      const newItem: HistoryItem = {
        id: Date.now(),
        query: question,
        answer: `Error: ${errMsg}`,
        has_error: true,
      };
      setHistory(h => [newItem, ...h.filter(item => item.query !== question)].slice(0, 30));
      setCurrentAnswer(`Error: ${errMsg}`);
      setCurrentImages([]);

      // Save to server history (fire-and-forget)
      if (!skipSaveHistory) {
        kmApi.post('/manageSqlQuery/saveHistory', {
          question,
          has_error: true,
        }).then(() => {
          fetchQueryHistory();
        }).catch(() => { });
      }
    } finally {
      setSearching(false);
    }
  };

  const handleHistoryClick = (item: HistoryItem) => {
    setCurrentView('search');
    setSearchQuery(item.query);
    if (item.answer) {
      setCurrentAnswer(item.answer);
      setCurrentImages(item.images ?? []);
    } else {
      setCurrentImages([]);
      handleSearch(item.query, true);
    }
  };


  const handleCopyAnswer = () => {
    if (currentAnswer) {
      navigator.clipboard.writeText(currentAnswer);
      alert("Answer copied to clipboard!");
    }
  };

  // --- CONFIGURE HANDLERS ---
  const handleAddAccountId = () => {
    const trimmed = accountInput.trim();
    if (!trimmed || accountIds.includes(trimmed)) return;
    setAccountIds([...accountIds, trimmed]);
    setAccountInput('');
  };

  const handleRemoveAccountId = (id: string) => {
    if (accountIds.length <= 1) return;
    setAccountIds(accountIds.filter((a) => a !== id));
  };

  const fetchDetails = async (bucketId: string, tab: TabState) => {
    if (!bucketId || bucketId === 'new') { setDetails([]); return; }
    setDetailsLoading(true);
    try {
      const data = await kmApi.get<BucketDetail[]>(
        `/manageBucketDetails/getDetails/${bucketId}?category=${TAB_CATEGORY[tab]}`
      );
      setDetails(data ?? []);
    } catch (err) {
      showErrorModal(
        err instanceof KmApiError ? err.detail : 'Failed to load documents',
        err instanceof KmApiError ? err.requestId : null,
      );
      setDetails([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchAssociatedAccountIdsByBucketId = async (bucketId: string): Promise<string[]> => {
    const data = await kmApi.get<Array<string>>(
      `/manageBucket/getAccountIds/${bucketId}`
    );
    return (data ?? []);
  };

  const handleOpenAddForm = () => {
    setAddFormOpen(true);
    setAddFormFile(null);
    setAddFormName('');
    setAddFormUrl('');
  };

  const handleCancelAddForm = () => {
    setAddFormOpen(false);
    setAddFormFile(null);
    setAddFormName('');
    setAddFormUrl('');
  };

  const handleSubmitAddForm = async () => {
    if (!selectedBucketId || selectedBucketId === 'new') return;
    setSubmittingDetail(true);
    try {
      const fd = new FormData();
      fd.append('bucket_id', selectedBucketId);
      fd.append('doc_category', TAB_CATEGORY[activeTab]);
      if (activeTab === 'Documents' && addFormFile) {
        fd.append('file', addFormFile);
        fd.append('doc_name', addFormName || addFormFile.name);
      } else if (activeTab === 'Web Pages') {
        fd.append('url', addFormUrl);
        fd.append('doc_name', addFormName || addFormUrl);
      } else {
        fd.append('doc_name', addFormName);
      }
      await kmApi.postForm('/manageBucketDetails/createBucketDetails', fd);
      showToast('Document added. Ingestion started.');
      setAddFormOpen(false);
      setAddFormFile(null);
      setAddFormName('');
      setAddFormUrl('');
      await fetchDetails(selectedBucketId, activeTab);
    } catch (err) {
      showErrorModal(
        err instanceof KmApiError ? err.detail : 'Failed to add document',
        err instanceof KmApiError ? err.requestId : null,
      );
    } finally {
      setSubmittingDetail(false);
    }
  };

  const handleDeleteDetail = (detailId: string, docName: string) => {
    setDeleteModal({ open: true, bucketId: detailId, bucketName: docName ?? 'this document', type: 'detail' });
  };

  const handleConfirmDeleteDetail = async () => {
    const detailId = deleteModal.bucketId;
    setDeleteModal(m => ({ ...m, open: false }));
    setSaving(true);
    try {
      await kmApi.delete(`/manageBucketDetails/deleteBucketDetail/${detailId}`);
      showToast('Document deleted successfully');
      await fetchDetails(selectedBucketId, activeTab);
    } catch (err) {
      showErrorModal(
        err instanceof KmApiError ? err.detail : 'Failed to delete document',
        err instanceof KmApiError ? err.requestId : null,
      );
    } finally {
      setSaving(false);
    }
  };

  // --- BUCKET HANDLERS ---
  const showToast = (message: string, requestId?: string | null) => {
    const id = Date.now();
    setToast({ id, message, requestId });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5000);
  };

  const showErrorModal = (message: string, requestId: string | null = null) => {
    setErrorModal({ open: true, message, requestId });
  };

  const fetchBuckets = async () => {
    setBucketsLoading(true);
    try {
      const data = await kmApi.get<Bucket[]>(`/manageBucket/getDetails/${getXUser()}`);
      setBuckets(data);
    } catch (err) {
      const detail = err instanceof KmApiError ? err.detail : 'Failed to load buckets';
      const requestId = err instanceof KmApiError ? err.requestId : null;
      showErrorModal(detail, requestId);
    } finally {
      setBucketsLoading(false);
    }
  };

  const handleSaveBucket = async () => {
    if (selectedBucketId === 'new') {
      const validationError = getBucketNameError(formBucketName);
      if (validationError) {
        setBucketNameTouched(true);
        return;
      }
    }

    setSaving(true);
    try {
      if (selectedBucketId === 'new') {
        const created = await kmApi.post<Bucket>('/manageBucket/createBucket', {
          account_id: getXUser(),
          bucket_name: formBucketName.trim(),
          bucket_category: formCategory.trim() || null,
          bucket_desc: formDesc.trim() || null,
        });
        await fetchBuckets();
        setSelectedBucketId(created.id);
        setAccountIds([getXUser()]);
        showToast('Bucket created successfully. Status: Provisioning');
      } else {
        const updatePayload: any = {
          bucket_category: formCategory.trim() || null,
          bucket_desc: formDesc.trim() || null,
        };
        if (isSuperAdmin) {
          updatePayload.account_ids = accountIds;
        }
        await kmApi.put<Bucket>(`/manageBucket/updateBucket/${selectedBucketId}`, updatePayload);
        await fetchBuckets();
        showToast('Changes saved successfully');
      }
    } catch (err) {
      const detail = err instanceof KmApiError ? err.detail : 'Failed to save bucket';
      const requestId = err instanceof KmApiError ? err.requestId : null;
      showErrorModal(detail, requestId);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    if (!selectedBucket) return;
    setDeleteModal({ open: true, bucketId: selectedBucketId, bucketName: selectedBucket.bucket_name, type: 'bucket' });
  };

  const handleConfirmDelete = async () => {
    const { bucketId } = deleteModal;
    const deletedBucketName = buckets.find((b) => b.id === bucketId)?.bucket_name;
    setDeleteModal({ open: false, bucketId: '', bucketName: '', type: 'bucket' });
    setDeleting(true);
    try {
      await kmApi.delete(`/manageBucket/deleteBucket/${bucketId}`);
      await fetchBuckets();
      setActiveBuckets(active => active.filter(bucket => bucket.id !== bucketId));
      if (deletedBucketName) {
        setSelectedBucketNames(names => names.filter(name => name !== deletedBucketName));
      }
      setSelectedBucketId('');
      showToast('Bucket deleted successfully');
    } catch (err) {
      const detail = err instanceof KmApiError ? err.detail : 'Failed to delete bucket';
      const requestId = err instanceof KmApiError ? err.requestId : null;
      showErrorModal(detail, requestId);
    } finally {
      setDeleting(false);
    }
  };

  // Fetch active buckets once on mount for search context
  // Fetch active buckets once on mount for search context — errors silently suppressed
  useEffect(() => {
    const loadBuckets = async () => {
      try {
        const data = await kmApi.get<Bucket[]>(`/manageBucket/getDetails/${getXUser()}`);
        const active = (Array.isArray(data) ? data : [])
          .filter((b: Bucket) => b.status === 'ACTIVE');
        setActiveBuckets(active);
      } catch {
        // silently ignore — search works without bucket list
      }
    };
    loadBuckets();
    fetchQueryHistory();
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

  // Fetch bucket list whenever the configure view opens
  useEffect(() => {
    if (currentView === 'configure') fetchBuckets();
  }, [currentView]);

  // Reload documents when the active tab or selected bucket changes; also close any open add form
  useEffect(() => {
    setAddFormOpen(false);
    setAddFormFile(null);
    setAddFormName('');
    setAddFormUrl('');
    if (selectedBucketId && selectedBucketId !== 'new') {
      fetchDetails(selectedBucketId, activeTab);
    } else {
      setDetails([]);
    }
  }, [activeTab, selectedBucketId]);

  // Sync form fields when the selected bucket changes
  useEffect(() => {
    let cancelled = false;

    const syncSelectedBucket = async () => {
      setAccountInput('');
      if (selectedBucketId === '') {
        setSelectedBucket(null);
        setFormBucketName('');
        setBucketNameTouched(false);
        setFormCategory('');
        setFormDesc('');
        setAccountIds([]);
      } else if (selectedBucketId === 'new') {
        setSelectedBucket(null);
        setFormBucketName('');
        setBucketNameTouched(false);
        setFormCategory('');
        setFormDesc('');
        setAccountIds([getXUser()]);
      } else {
        const bucket = buckets.find((b) => b.id === selectedBucketId) ?? null;
        setSelectedBucket(bucket);
        setFormCategory(bucket?.bucket_category ?? '');
        setFormDesc(bucket?.bucket_desc ?? '');
        setAccountIds([]);
        try {
          const ids = await fetchAssociatedAccountIdsByBucketId(selectedBucketId);
          if (!cancelled) setAccountIds(ids);
        } catch (err) {
          if (!cancelled) {
            showErrorModal(
              err instanceof KmApiError ? err.detail : 'Failed to load assigned accounts',
              err instanceof KmApiError ? err.requestId : null,
            );
            setAccountIds([]);
          }
        }
      }
    };

    syncSelectedBucket();
    return () => { cancelled = true; };
  }, [selectedBucketId, buckets]);

  return (
    <div className="flex h-full w-full font-sans bg-gray-100 overflow-hidden">

      {/* --- Left Sidebar --- */}
      <aside className="w-64 bg-[#5b6164] text-gray-300 flex flex-col shrink-0">

        {/* NEW QUERY BUTTON */}
        <div className="p-4 border-b border-gray-500/50 shrink-0">
          <button
            onClick={handleNewQuery}
            className="w-full py-2 px-4 border border-gray-400 text-gray-200 rounded hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
            New Query
          </button>
        </div>

        <div className="p-5 flex-1 border-b border-gray-500/50 overflow-hidden flex flex-col">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-4 uppercase shrink-0">Recent Questions</h3>

          {/* Dynamic Recent Questions List */}
          <ol className="text-sm space-y-3 text-[#5bc0de] list-decimal list-inside overflow-y-auto pr-2">
            {history.length === 0 && <li className="text-gray-400 italic list-none">No recent questions</li>}
            {history.map((item) => (
              <li
                key={item.id}
                className="cursor-pointer hover:text-white transition-colors truncate"
                title={item.query}
                onClick={() => handleHistoryClick(item)}
              >
                {item.has_error && <span className="text-red-400 mr-1">•</span>}
                {item.query}
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 bg-black/10 shrink-0">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-5 uppercase">Query Settings</h3>

          <div className="space-y-5 mb-6">
            <div>
              <div className="flex justify-between text-xs mb-2 text-gray-300">
                <span>No of Sources</span>
                <span className="text-[#5bc0de]">{noOfSources}</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={noOfSources}
                onChange={(e) => setNoOfSources(Number(e.target.value))}
                className="w-full h-1 bg-gray-500 rounded-lg appearance-none cursor-pointer accent-[#5bc0de]"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2 text-gray-300">
                <span>Similarity Threshold</span>
                <span className="text-[#5bc0de]">{similarityThreshold}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="w-full h-1 bg-gray-500 rounded-lg appearance-none cursor-pointer accent-[#5bc0de]"
              />
            </div>
          </div>

          <div className="space-y-3 mb-8 text-sm">
            {/* <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={showSourceDoc}
                onChange={(e) => setShowSourceDoc(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-500 text-[#5bc0de] focus:ring-[#5bc0de]"
              />
              <span className="text-gray-300 group-hover:text-white transition-colors">Show Source Document</span>
            </label> */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={extendPublic}
                onChange={(e) => setExtendPublic(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-500 text-[#5bc0de] focus:ring-[#5bc0de]"
              />
              <span className="text-gray-300 group-hover:text-white transition-colors">Extend with public information</span>
            </label>
          </div>

          {canConfigure && (
            <button
              onClick={() => setCurrentView('configure')}
              className={`w-full py-2.5 px-4 text-sm font-bold tracking-wide transition-all duration-200 ${currentView === 'configure'
                ? 'text-[#5bc0de] border border-[#5bc0de] rounded bg-[#5bc0de]/10'
                : 'text-[#5bc0de] hover:text-white hover:bg-white/5 rounded uppercase border border-transparent'
                }`}
            >
              CONFIGURE KNOWLEDGE BASE
            </button>
          )}
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 bg-white p-8 overflow-y-auto">
        {currentView === 'search' || !canConfigure ? (

          <div className="flex flex-col h-full w-full">
            <div className="w-full max-w-6xl mx-auto flex flex-col">
              <h2 className="text-[#3b4754] font-bold text-lg mb-4">
                Ask anything that you want to know about Nubo Native Platform and related technologies in general
              </h2>

              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type your query here..."
                className="w-full h-32 min-h-[80px] shrink-0 border border-gray-400 bg-gray-100 rounded p-4 resize-none focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4] mb-4 text-gray-800 transition-colors"
              ></textarea>

              <div className="flex items-center justify-between">
                <div>
                  {activeBuckets.length > 0 && (
                    <span className="text-xs text-gray-400 font-medium">
                      {activeBuckets.length} active bucket{activeBuckets.length !== 1 ? 's' : ''} available
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 relative">
                  {/* Multi-select Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      disabled={searching}
                      className="bg-white border border-gray-400 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 px-4 py-2.5 rounded text-sm font-medium transition-colors shadow-sm focus:outline-none flex items-center gap-2"
                    >
                      <span>
                        {selectedBucketNames.length === 0
                          ? 'Select Buckets'
                          : `${selectedBucketNames.length} Selected`}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <>
                        {/* Click-outside backdrop */}
                        <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />

                        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-300 rounded shadow-xl z-20 py-2 max-h-60 overflow-y-auto">
                          {activeBuckets.length === 0 ? (
                            <div className="px-4 py-2 text-xs text-gray-400 italic">No active buckets</div>
                          ) : (
                            <>
                              <div className="px-3 pb-2 mb-2 border-b border-gray-200 flex justify-between text-xs">
                                <button
                                  type="button"
                                  onClick={() => setSelectedBucketNames(activeBuckets.map(b => b.bucket_name))}
                                  disabled={searching}
                                  className="text-[#4a77b4] hover:underline font-semibold"
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedBucketNames([])}
                                  disabled={searching}
                                  className="text-gray-500 hover:underline font-semibold"
                                >
                                  Clear All
                                </button>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                {activeBuckets.map((b) => {
                                  const isChecked = selectedBucketNames.includes(b.bucket_name);
                                  return (
                                    <label
                                      key={b.id}
                                      className="flex items-center gap-3 px-4 py-1.5 hover:bg-gray-100 cursor-pointer select-none text-sm text-gray-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        disabled={searching}
                                        onChange={() => {
                                          if (isChecked) {
                                            setSelectedBucketNames(selectedBucketNames.filter(name => name !== b.bucket_name));
                                          } else {
                                            setSelectedBucketNames([...selectedBucketNames, b.bucket_name]);
                                          }
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-[#4a77b4] focus:ring-[#4a77b4]"
                                      />
                                      <span className="truncate" title={b.bucket_name}>
                                        {b.bucket_name}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => handleSearch()}
                    disabled={searching || !searchQuery.trim()}
                    className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded text-sm font-medium transition-colors shadow-sm"
                  >
                    {searching ? 'Searching...' : 'Search Repository'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-10 flex-1 flex flex-col pt-6 border-t border-gray-200 w-full">
              <h3 className="text-sm font-bold text-[#3b4754] mb-4">Query Performance</h3>

              <div className="flex-1 bg-gray-50 rounded p-5 border border-gray-200 overflow-y-auto w-full">
                {currentAnswer
                  ? (
                    <div className="space-y-5">
                      <MarkdownAnswer content={currentAnswer} />
                      {currentImages.length > 0 && (
                        <div className="border-t border-gray-200 pt-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {currentImages.map((image, index) => (
                              <figure key={image.asset_id ?? image.object_key ?? image.url ?? index} className="overflow-hidden rounded border border-gray-200 bg-white">
                                <img
                                  src={image.url}
                                  alt={image.caption || image.label || `Referenced image ${index + 1}`}
                                  className="max-h-96 w-full object-contain bg-gray-100"
                                  loading="lazy"
                                />
                                <figcaption className="px-3 py-2 text-xs text-gray-600">
                                  <span className="font-medium text-gray-800">{image.label || 'Referenced image'}</span>
                                  {image.doc_name && <span> · {image.doc_name}</span>}
                                  {image.page_number && <span> · page {image.page_number}</span>}
                                  {image.caption && <span className="block mt-0.5">{image.caption}</span>}
                                  {image.summary && <span className="block mt-0.5">{image.summary}</span>}
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                  : <span className="text-gray-400 italic">Results will appear here...</span>}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleCopyAnswer}
                  disabled={!currentAnswer}
                  className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:bg-[#c2c2c2] disabled:hover:bg-[#c2c2c2] text-white disabled:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-2.5 rounded text-sm font-medium transition-colors shadow-sm"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

        ) : (

          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[#3b4754] font-bold text-lg">Manage Knowledge Repository</h2>
              {/* Secondary Back to search button (optional, but good for UX) */}
              <button
                onClick={handleNewQuery}
                className="text-sm font-medium text-[#4a77b4] hover:text-[#3a6094] underline"
              >
                Back to Search
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 mb-8">
              {/* Knowledge Buckets */}
              <div className="flex-1 border border-gray-300 rounded p-5 bg-white shadow-sm">
                <h3 className="text-sm font-bold text-[#3b4754] mb-4">Manage Knowledge Buckets</h3>

                {bucketsLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Loading buckets…
                  </div>
                )}

                <div className="space-y-4 text-sm">
                  {/* Bucket selector */}
                  <div>
                    <select
                      value={selectedBucketId}
                      onChange={(e) => setSelectedBucketId(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2.5 bg-gray-100 text-gray-700 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4] transition-colors"
                    >
                      <option value="">Select Bucket</option>
                      <option value="new">+ Create New Bucket</option>
                      {buckets.map((b) => (
                        <option key={b.id} value={b.id}>{b.bucket_name}</option>
                      ))}
                    </select>
                    {selectedBucket && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {statusBadge(selectedBucket.status)}
                        {selectedBucket.error_detail && (
                          <span className="text-xs text-red-500 truncate" title={selectedBucket.error_detail}>
                            {selectedBucket.error_detail}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bucket name input — only for new buckets */}
                  {selectedBucketId === 'new' && (
                    <div>
                      <input
                        type="text"
                        value={formBucketName}
                        onChange={(e) => {
                          setFormBucketName(e.target.value);
                          setBucketNameTouched(true);
                        }}
                        onBlur={() => setBucketNameTouched(true)}
                        placeholder="Bucket name *"
                        aria-invalid={showBucketNameError}
                        className={`w-full border rounded p-2.5 bg-gray-100 text-gray-700 focus:outline-none focus:ring-1 transition-colors ${
                          showBucketNameError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-[#4a77b4] focus:ring-[#4a77b4]'
                        }`}
                      />
                      <p className={`text-xs mt-1 ${showBucketNameError ? 'text-red-600' : 'text-gray-400'}`}>
                        {showBucketNameError
                          ? bucketNameError
                          : 'Letters, numbers and underscores only. Must start with a letter or underscore. Cannot be changed after creation.'}
                      </p>
                    </div>
                  )}

                  {/* Category and description — shown whenever a bucket is selected or being created */}
                  {selectedBucketId !== '' && (
                    <>
                      <input
                        type="text"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="Bucket Category"
                        disabled={!isOwnerOfSelected}
                        className="w-full border border-gray-300 rounded p-2.5 bg-gray-100 text-gray-700 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4] transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                      <textarea
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="Description"
                        disabled={!isOwnerOfSelected}
                        className="w-full border border-gray-300 rounded p-3 bg-gray-50 text-gray-700 h-28 resize-none focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4] transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </>
                  )}

                  {/* Action buttons */}
                  {selectedBucketId !== '' && isOwnerOfSelected && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveBucket}
                        disabled={saving || deleting || (selectedBucketId === 'new' && Boolean(bucketNameError))}
                        className="flex-1 bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                      >
                        {saving ? 'Saving…' : selectedBucketId === 'new' ? 'Create Bucket' : 'Save Changes'}
                      </button>
                      {selectedBucketId !== 'new' && (
                        <button
                          onClick={handleDeleteClick}
                          disabled={saving}
                          className="border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned Accounts:  ONLY super admins should be able to see the Accounts section */}
              {isSuperAdmin && (
                <div className="flex-1 border border-gray-300 rounded p-5 bg-white shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-[#3b4754] mb-4">Assigned Accounts</h3>
                  <div className="text-xs font-semibold text-gray-500 border-b border-gray-200 pb-2 mb-2 tracking-wide uppercase">
                    Account
                  </div>

                  {/* Account list */}
                  <div className="flex-1 overflow-y-auto max-h-[150px] mb-3">
                    {accountIds.length === 0 && (
                      <div className="text-xs text-gray-400 italic py-1">No accounts assigned</div>
                    )}
                    {accountIds.map((id) => (
                      <div key={id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-xs text-gray-700 truncate mr-2">{id}</span>
                        <button
                          onClick={() => handleRemoveAccountId(id)}
                          disabled={accountIds.length <= 1 || !isOwnerOfSelected}
                          title={accountIds.length <= 1 ? 'At least one account required' : `Remove ${id}`}
                          className="shrink-0 text-xs text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          ⊗
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add account input — only when a bucket is selected and user is owner */}
                  {selectedBucketId !== '' && isOwnerOfSelected && (
                    <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                      <input
                        type="text"
                        value={accountInput}
                        onChange={(e) => setAccountInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddAccountId(); }}
                        placeholder="Account ID"
                        className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4] transition-colors"
                      />
                      <button
                        onClick={handleAddAccountId}
                        className="border border-gray-400 rounded px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-[#4a77b4] hover:text-[#4a77b4] transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Repository Tabs & Upload Area */}
            {!isOwnerOfSelected ? (
              <div className="bg-white rounded shadow-sm border border-gray-300 p-8 flex flex-col items-center justify-center min-h-[320px] text-center">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4 border border-amber-100 shadow-sm animate-pulse">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Access Restricted</h3>
                <p className="text-sm text-gray-500 max-w-md mb-2 leading-relaxed">
                  This section is only accessible to the owner/creator of this bucket.
                </p>
                {selectedBucket && (
                  <p className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded border border-gray-200 font-mono">
                    Owner: <span className="font-semibold text-gray-700">{selectedBucket.created_by || 'Unknown'}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-white rounded shadow-sm border border-gray-300">
                <div className="flex border-b border-gray-300 overflow-x-auto">
                  {(['Documents', 'Web Pages', 'Code Repository', 'Incident Repo'] as TabState[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-5 py-2.5 text-sm font-medium border border-gray-300 border-b-0 rounded-t mr-1 transition-colors whitespace-nowrap ${activeTab === tab
                        ? 'bg-[#53a7ba] text-white border-[#53a7ba]'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="p-6 min-h-[320px] flex flex-col">
                  {/* Loading */}
                  {detailsLoading ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Loading…
                    </div>
                  ) : !selectedBucketId || selectedBucketId === 'new' ? (
                    <p className="text-xs text-gray-400 italic">Select a bucket to view documents</p>
                  ) : details.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No documents in this category</p>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-0 mb-2">
                      {details.map((d) => (
                        <div key={d.id} className="flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0">
                          <div className="flex-1 mr-3 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-800 font-medium truncate">{d.doc_name ?? 'Unnamed document'}</span>
                              {docStatusBadge(d.status)}
                            </div>
                            {d.status === 'INGESTED' && (
                              <span className="text-xs text-gray-400 mt-0.5 block">
                                chunks: {d.milvus_chunks_stored}
                                {d.ingested_at && <> · {new Date(d.ingested_at).toLocaleDateString()}</>}
                              </span>
                            )}
                            {d.status === 'FAILED' && d.error_detail && (
                              <span className="text-xs text-red-500 mt-0.5 block">{d.error_detail}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteDetail(d.id, d.doc_name ?? 'this document')}
                            title="Delete document"
                            className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            ⊗
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add document */}
                  <div className="mt-auto pt-4 border-t border-gray-100">
                    {addFormOpen && selectedBucketId && selectedBucketId !== 'new' ? (
                      activeTab === 'Documents' ? (
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept=".pdf,.docx,.txt,.md"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setAddFormFile(f);
                              if (f && !addFormName) setAddFormName(f.name);
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                          />
                          <input
                            type="text"
                            value={addFormName}
                            onChange={(e) => setAddFormName(e.target.value)}
                            placeholder="Document name (auto-filled from filename)"
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={handleCancelAddForm} className="px-4 py-1.5 rounded text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                            <button
                              onClick={handleSubmitAddForm}
                              disabled={!addFormFile || submittingDetail}
                              className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded text-sm font-medium transition-colors"
                            >
                              {submittingDetail ? 'Uploading…' : 'Upload'}
                            </button>
                          </div>
                        </div>
                      ) : activeTab === 'Web Pages' ? (
                        <div className="space-y-2">
                          <input
                            type="url"
                            value={addFormUrl}
                            onChange={(e) => setAddFormUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
                          />
                          <input
                            type="text"
                            value={addFormName}
                            onChange={(e) => setAddFormName(e.target.value)}
                            placeholder="Document name (optional)"
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={handleCancelAddForm} className="px-4 py-1.5 rounded text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                            <button
                              onClick={handleSubmitAddForm}
                              disabled={!addFormUrl.trim() || submittingDetail}
                              className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded text-sm font-medium transition-colors"
                            >
                              {submittingDetail ? 'Adding…' : 'Add URL'}
                            </button>
                          </div>
                        </div>
                      ) : activeTab === 'Code Repository' ? (
                        <GitRepositoryForm
                          bucketId={selectedBucketId}
                          onSubmitSuccess={() => {
                            setAddFormOpen(false);
                            fetchDetails(selectedBucketId, activeTab);
                          }}
                          onCancel={handleCancelAddForm}
                          showErrorModal={showErrorModal}
                          showToast={showToast}
                        />
                      ) : activeTab === 'Incident Repo' ? (
                        <RedmineBucketDetailsForm
                          bucketId={selectedBucketId}
                          onSubmitSuccess={() => {
                            setAddFormOpen(false);
                            fetchDetails(selectedBucketId, activeTab);
                          }}
                          onCancel={handleCancelAddForm}
                          showErrorModal={showErrorModal}
                          showToast={showToast}
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-gray-500 italic">Coming soon — this document type requires additional configuration.</p>
                          <button onClick={handleCancelAddForm} className="shrink-0 px-4 py-1.5 rounded text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                        </div>
                      )
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={handleOpenAddForm}
                          disabled={!selectedBucketId || selectedBucketId === 'new' || saving}
                          className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-sm"
                        >
                          {activeTab === 'Code Repository' ? 'Add Repository' : activeTab === 'Incident Repo' ? 'Add Redmine Issues' : activeTab === 'Web Pages' ? 'Add URL' : 'Add Document'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteModal(m => ({ ...m, open: false }))}
        >
          <div
            className="bg-white rounded shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#3b4754] mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold text-gray-800">"{deleteModal.bucketName}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(m => ({ ...m, open: false }))}
                className="px-4 py-2 rounded text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteModal.type === 'bucket' ? handleConfirmDelete : handleConfirmDeleteDetail}
                className="px-4 py-2 rounded text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error modal */}
      {errorModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setErrorModal({ open: false, message: '', requestId: null })}
        >
          <div
            className="bg-white rounded shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#3b4754] mb-2">Error</h3>
            <p className="text-sm text-gray-600">{errorModal.message}</p>
            {errorModal.requestId && (
              <p className="text-xs text-gray-400 mt-1">Request ID: {errorModal.requestId}</p>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setErrorModal({ open: false, message: '', requestId: null })}
                className="px-4 py-2 rounded text-sm font-medium bg-[#4a77b4] hover:bg-[#3a6094] text-white transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast — fixed top-right, auto-dismisses after 5 s */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-start gap-3 max-w-sm w-80 rounded shadow-lg px-4 py-3 text-white bg-[#375623]">
          <span className="flex-1 text-sm leading-snug">
            {toast.message}
            {toast.requestId && (
              <span className="block text-xs opacity-75 mt-0.5">ID: {toast.requestId}</span>
            )}
          </span>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 ml-1 mt-0.5 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
