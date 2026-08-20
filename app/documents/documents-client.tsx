'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type SVGProps,
} from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type DocumentCategory =
  | 'business'
  | 'insurance'
  | 'finance'
  | 'licence'
  | 'tax-accounting'
  | 'ownership'
  | 'contract'
  | 'warranty'
  | 'other';

type AssetLink = {
  id: string;
  title: string;
  meta: string;
};

type VaultDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  notes: string;
  expiryDate: string | null;
  fileName: string;
  contentType: string;
  byteSize: number;
  assetLinks: AssetLink[];
  createdAtIso: string;
  updatedAtIso: string;
  deletedAtIso: string | null;
};

type VaultSummary = {
  totalDocuments: number;
  expiringSoon: number;
  linkedDocuments: number;
  storageBytes: number;
};

type VaultResponse = {
  ok: boolean;
  documents?: VaultDocument[];
  summary?: VaultSummary;
  assets?: AssetLink[];
  document?: VaultDocument;
  error?: string;
};

type VaultView = 'documents' | 'recycle-bin';
type ModalMode = 'upload' | 'edit';
type Notice = { tone: 'success' | 'error'; message: string };
type IconName =
  | 'archive'
  | 'calendar'
  | 'chevron-down'
  | 'close'
  | 'document'
  | 'download'
  | 'edit'
  | 'eye'
  | 'filter'
  | 'folder'
  | 'info'
  | 'link'
  | 'refresh'
  | 'restore'
  | 'search'
  | 'trash'
  | 'upload';

type DocumentDraft = {
  title: string;
  category: DocumentCategory;
  notes: string;
  expiryDate: string;
  assetIds: string[];
};

const CATEGORY_OPTIONS: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'business', label: 'Business' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'finance', label: 'Finance' },
  { value: 'licence', label: 'Licences & permits' },
  { value: 'tax-accounting', label: 'Tax & accounting' },
  { value: 'ownership', label: 'Ownership' },
  { value: 'contract', label: 'Contracts' },
  { value: 'warranty', label: 'Warranties' },
  { value: 'other', label: 'Other' },
];

const EMPTY_SUMMARY: VaultSummary = {
  totalDocuments: 0,
  expiringSoon: 0,
  linkedDocuments: 0,
  storageBytes: 0,
};

function createEmptyDraft(): DocumentDraft {
  return {
    title: '',
    category: 'business',
    notes: '',
    expiryDate: '',
    assetIds: [],
  };
}

function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  let paths;

  switch (name) {
    case 'archive':
      paths = <><path d="M4.5 7.3h15v12.2h-15z" /><path d="M3.5 4.5h17v3h-17zM9.2 11.4h5.6" /></>;
      break;
    case 'calendar':
      paths = <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h2M13.5 14h2" /></>;
      break;
    case 'chevron-down':
      paths = <path d="m7 9.5 5 5 5-5" />;
      break;
    case 'close':
      paths = <path d="m6 6 12 12M18 6 6 18" />;
      break;
    case 'document':
      paths = <><path d="M6.3 3.5h7.9l3.5 3.6v13.4H6.3z" /><path d="M14.2 3.5v3.8h3.5M9 11h6M9 14.5h6M9 18h4" /></>;
      break;
    case 'download':
      paths = <><path d="M12 3.7v11.4M7.8 11.2 12 15.4l4.2-4.2M5 20h14" /></>;
      break;
    case 'edit':
      paths = <><path d="m14.7 5.2 4.1 4.1L9 19.1l-4.8.8.8-4.8z" /><path d="m12.7 7.2 4.1 4.1" /></>;
      break;
    case 'eye':
      paths = <><path d="M2.8 12s3.3-5.5 9.2-5.5 9.2 5.5 9.2 5.5-3.3 5.5-9.2 5.5S2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.7" /></>;
      break;
    case 'filter':
      paths = <><path d="M4 5h16M7 12h10M10 19h4" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="19" r="1.5" /></>;
      break;
    case 'folder':
      paths = <path d="M3.5 6.2h6.3l1.8 2.1h8.9v10.5h-17z" />;
      break;
    case 'info':
      paths = <><circle cx="12" cy="12" r="9" /><path d="M12 10.5v6M12 7.4h.01" /></>;
      break;
    case 'link':
      paths = <><path d="m9.4 14.6 5.2-5.2" /><path d="m7.5 16.5-1.2 1.2a3.1 3.1 0 0 1-4.4-4.4l3.3-3.3a3.1 3.1 0 0 1 4.4 0" /><path d="m16.5 7.5 1.2-1.2a3.1 3.1 0 0 1 4.4 4.4L18.8 14a3.1 3.1 0 0 1-4.4 0" /></>;
      break;
    case 'refresh':
      paths = <><path d="M19.5 7.5V3.8l-2.1 2.1A8 8 0 1 0 20 12" /><path d="M14.7 7.5h4.8" /></>;
      break;
    case 'restore':
      paths = <><path d="M5.2 8.2H2.7V5.7" /><path d="M3.2 8.1A9 9 0 1 1 4.6 17M12 7v5l3.2 2" /></>;
      break;
    case 'search':
      paths = <><circle cx="10.7" cy="10.7" r="6.6" /><path d="m15.7 15.7 4.3 4.3" /></>;
      break;
    case 'trash':
      paths = <><path d="M5.5 7h13l-.8 13H6.3zM4 7h16M9 7V4h6v3M9.5 10.5v6M14.5 10.5v6" /></>;
      break;
    case 'upload':
      paths = <><path d="M12 20.3V8.9M7.8 13.1 12 8.9l4.2 4.2" /><path d="M5 4h14" /></>;
      break;
    default:
      paths = null;
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths}
    </svg>
  );
}

function categoryLabel(category: DocumentCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'Other';
}

function formatBytes(value: number): string {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

function formatDate(value: string | null, includeYear = true): string {
  if (!value) return 'No date';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (!Number.isFinite(date.getTime())) return 'No date';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date);
}

function documentExpiryState(expiryDate: string | null): { label: string; tone: 'safe' | 'warning' | 'danger' | 'neutral' } {
  if (!expiryDate) return { label: 'No expiry date', tone: 'neutral' };

  const expiry = new Date(`${expiryDate}T23:59:59`);
  const today = new Date();
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return { label: `Expired ${formatDate(expiryDate)}`, tone: 'danger' };
  if (days === 0) return { label: 'Expires today', tone: 'danger' };
  if (days <= 60) return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' };
  return { label: `Expires ${formatDate(expiryDate)}`, tone: 'safe' };
}

function recycleDaysLeft(deletedAtIso: string | null): number {
  const deleted = new Date(deletedAtIso ?? '');
  if (!Number.isFinite(deleted.getTime())) return 90;
  const elapsed = Math.floor((Date.now() - deleted.getTime()) / 86_400_000);
  return Math.max(0, 90 - elapsed);
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function DocumentsClient() {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [summary, setSummary] = useState<VaultSummary>(EMPTY_SUMMARY);
  const [assets, setAssets] = useState<AssetLink[]>([]);
  const [view, setView] = useState<VaultView>('documents');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | DocumentCategory>('all');
  const [showSummary, setShowSummary] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingDocument, setEditingDocument] = useState<VaultDocument | null>(null);
  const [draft, setDraft] = useState<DocumentDraft>(createEmptyDraft);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const requestSequence = useRef(0);

  const loadDocuments = useCallback(async (targetView: VaultView, options: { quiet?: boolean } = {}) => {
    const sequence = ++requestSequence.current;
    if (!options.quiet) setLoading(true);

    try {
      const query = targetView === 'recycle-bin' ? '?view=recycle-bin' : '';
      const response = await fetch(`/api/documents${query}`, { cache: 'no-store' });
      const data = await response.json() as VaultResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'The Document Vault could not be loaded.');
      if (sequence !== requestSequence.current) return;

      setLoadFailed(false);
      setDocuments(data.documents ?? []);
      setSummary(data.summary ?? EMPTY_SUMMARY);
      setAssets(data.assets ?? []);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setLoadFailed(true);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The Document Vault could not be loaded.',
      });
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments(view);
  }, [loadDocuments, view]);

  useEffect(() => {
    if (!modalMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setModalMode(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [busy, modalMode]);

  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return documents.filter((document) => {
      if (category !== 'all' && document.category !== category) return false;
      if (!needle) return true;

      return [
        document.title,
        document.fileName,
        document.notes,
        categoryLabel(document.category),
        ...document.assetLinks.flatMap((asset) => [asset.title, asset.meta]),
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [category, documents, search]);

  const groupedDocuments = useMemo(() => {
    return CATEGORY_OPTIONS
      .map((option) => ({
        ...option,
        documents: filteredDocuments.filter((document) => document.category === option.value),
      }))
      .filter((group) => group.documents.length > 0);
  }, [filteredDocuments]);

  const filteredAssets = useMemo(() => {
    const needle = assetSearch.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter((asset) => `${asset.title} ${asset.meta}`.toLowerCase().includes(needle));
  }, [assetSearch, assets]);

  function switchView(nextView: VaultView) {
    setView(nextView);
    setCategory('all');
    setSearch('');
    setShowFilters(false);
    setNotice(null);
  }

  function openUploadModal() {
    setEditingDocument(null);
    setDraft(createEmptyDraft());
    setSelectedFile(null);
    setAssetSearch('');
    setModalMode('upload');
    setNotice(null);
  }

  function openEditModal(document: VaultDocument) {
    setEditingDocument(document);
    setDraft({
      title: document.title,
      category: document.category,
      notes: document.notes,
      expiryDate: document.expiryDate ?? '',
      assetIds: document.assetLinks.map((asset) => asset.id),
    });
    setSelectedFile(null);
    setAssetSearch('');
    setModalMode('edit');
    setNotice(null);
  }

  function updateDraft<K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !draft.title.trim()) updateDraft('title', titleFromFileName(file.name));
  }

  function toggleAsset(assetId: string) {
    setDraft((current) => ({
      ...current,
      assetIds: current.assetIds.includes(assetId)
        ? current.assetIds.filter((id) => id !== assetId)
        : [...current.assetIds, assetId],
    }));
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalMode || busy) return;

    if (!draft.title.trim()) {
      setNotice({ tone: 'error', message: 'Add a clear document title.' });
      return;
    }
    if (modalMode === 'upload' && !selectedFile) {
      setNotice({ tone: 'error', message: 'Select a document to upload.' });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      let response: Response;

      if (modalMode === 'upload') {
        const formData = new FormData();
        formData.set('file', selectedFile as File);
        formData.set('title', draft.title.trim());
        formData.set('category', draft.category);
        formData.set('notes', draft.notes.trim());
        formData.set('expiryDate', draft.expiryDate);
        formData.set('assetIds', JSON.stringify(draft.assetIds));
        response = await fetch('/api/documents', { method: 'POST', body: formData });
      } else {
        response = await fetch(`/api/documents/${encodeURIComponent(editingDocument?.id ?? '')}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
      }

      const data = await response.json() as VaultResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be saved.');

      setModalMode(null);
      setEditingDocument(null);
      setSelectedFile(null);
      setNotice({
        tone: 'success',
        message: modalMode === 'upload' ? 'Document added to your vault.' : 'Document details updated.',
      });
      await loadDocuments('documents', { quiet: true });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The document could not be saved.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function moveToRecycleBin(document: VaultDocument) {
    const confirmed = window.confirm(
      `Move “${document.title}” to the Recycle Bin? It can be restored for 90 days.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' });
      const data = await response.json() as VaultResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be moved.');

      setNotice({ tone: 'success', message: 'Document moved to the Recycle Bin.' });
      await loadDocuments('documents', { quiet: true });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The document could not be moved.' });
    } finally {
      setBusy(false);
    }
  }

  async function restoreDocument(document: VaultDocument) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      const data = await response.json() as VaultResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be restored.');

      setNotice({ tone: 'success', message: 'Document restored to your vault.' });
      await loadDocuments('recycle-bin', { quiet: true });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The document could not be restored.' });
    } finally {
      setBusy(false);
    }
  }

  function renderDocumentCard(document: VaultDocument) {
    const expiry = documentExpiryState(document.expiryDate);
    const downloadUrl = `/api/documents/${encodeURIComponent(document.id)}/download`;
    const isDeleted = view === 'recycle-bin';

    return (
      <article key={document.id} className={styles.documentCard}>
        <div className={styles.fileMark} aria-hidden="true">
          <Icon name="document" />
          <span>{document.fileName.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}</span>
        </div>

        <div className={styles.documentBody}>
          <div className={styles.documentTitleRow}>
            <div>
              <h3>{document.title}</h3>
            </div>
            {isDeleted ? (
              <span className={`${styles.statusPill} ${styles.statusWarning}`}>
                {recycleDaysLeft(document.deletedAtIso)} days left
              </span>
            ) : (
              <span className={`${styles.statusPill} ${styles[`status${expiry.tone[0].toUpperCase()}${expiry.tone.slice(1)}`]}`}>
                <Icon name="calendar" />
                {expiry.label}
              </span>
            )}
          </div>

          <div className={styles.fileMeta}>
            <span className={styles.categoryPill}>{categoryLabel(document.category)}</span>
            <span>{document.fileName}</span>
            <i aria-hidden="true" />
            <span>{formatBytes(document.byteSize)}</span>
            <i aria-hidden="true" />
            <span>Added {formatDate(document.createdAtIso)}</span>
          </div>

          {document.notes ? <p className={styles.documentNotes}>{document.notes}</p> : null}

          <div className={styles.assetLinkRow}>
            <span className={styles.assetLinkLabel}><Icon name="link" /> Linked assets</span>
            {document.assetLinks.length ? (
              <div className={styles.assetChips}>
                {document.assetLinks.map((asset) => (
                  <span key={asset.id} title={asset.meta || asset.title}>{asset.title}</span>
                ))}
              </div>
            ) : (
              <span className={styles.accountLevelLabel}>Account-level document</span>
            )}
          </div>
        </div>

        <div className={styles.documentActions}>
          <a href={downloadUrl} target="_blank" rel="noreferrer" className={`${styles.actionButton} ${styles.previewButton}`}>
            <Icon name="eye" /> Preview
          </a>
          <a href={`${downloadUrl}?download=1`} className={`${styles.actionButton} ${styles.downloadButton}`}>
            <Icon name="download" /> Download
          </a>
          {isDeleted ? (
            <button type="button" className={styles.restoreButton} disabled={busy} onClick={() => void restoreDocument(document)}>
              <Icon name="restore" /> Restore
            </button>
          ) : (
            <>
              <button type="button" className={`${styles.actionButton} ${styles.editButton}`} disabled={busy} onClick={() => openEditModal(document)}>
                <Icon name="edit" /> Edit
              </button>
              <button type="button" className={styles.trashButton} disabled={busy} onClick={() => void moveToRecycleBin(document)} aria-label={`Move ${document.title} to Recycle Bin`}>
                <Icon name="trash" />
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className={styles.page}>
      <AppHeader active="documents" />

      <main className={styles.shell}>
        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <Icon name={notice.tone === 'success' ? 'info' : 'info'} />
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="close" /></button>
          </div>
        ) : null}

        <section className={styles.hero} aria-labelledby="document-vault-title">
          <h1 id="document-vault-title">Document Vault</h1>
        </section>

        <section className={styles.topActions} aria-label="Document Vault actions">
          <button
            type="button"
            className={`${styles.headerButton} ${styles.recycleButton}`}
            onClick={() => switchView(view === 'recycle-bin' ? 'documents' : 'recycle-bin')}
            aria-pressed={view === 'recycle-bin'}
          >
            <Icon name={view === 'recycle-bin' ? 'folder' : 'trash'} />
            {view === 'recycle-bin' ? 'Back to documents' : 'Recycle Bin'}
          </button>
          <button
            type="button"
            className={`${styles.headerButton} ${styles.summaryButton}`}
            onClick={() => setShowSummary((current) => !current)}
            aria-expanded={showSummary}
            aria-controls="document-vault-summary"
          >
            <Icon name="archive" /> Summary
          </button>
          <button
            type="button"
            className={`${styles.headerButton} ${styles.filtersButton}`}
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            aria-controls="document-vault-filters"
          >
            <Icon name="filter" /> Filters
            <Icon name="chevron-down" className={styles.buttonChevron} />
            {category !== 'all' ? <span className={styles.buttonCount}>1</span> : null}
          </button>
          <button type="button" className={`${styles.headerButton} ${styles.primaryHeaderButton}`} onClick={openUploadModal} disabled={view === 'recycle-bin'}>
            <Icon name="upload" /> Upload document
          </button>
        </section>

        {showFilters ? (
          <section id="document-vault-filters" className={styles.filterPanel} aria-label="Filter by category">
            <div>
              <strong>Categories</strong>
              <span>Choose one category or view everything.</span>
            </div>
            <div className={styles.filterChips}>
              <button type="button" className={category === 'all' ? styles.filterChipActive : ''} onClick={() => setCategory('all')}>
                All <span>{documents.length}</span>
              </button>
              {CATEGORY_OPTIONS.map((option) => {
                const count = documents.filter((document) => document.category === option.value).length;
                return (
                  <button
                    type="button"
                    key={option.value}
                    className={category === option.value ? styles.filterChipActive : ''}
                    onClick={() => setCategory(option.value)}
                  >
                    {option.label} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {showSummary ? (
          <section id="document-vault-summary" className={styles.summaryGrid} aria-label="Document Vault summary">
            <article className={styles.summaryCard}>
              <div className={styles.summaryHeading}><span>Total documents</span><Icon name="document" /></div>
              <strong>{summary.totalDocuments}</strong>
              <p>{formatBytes(summary.storageBytes)} securely catalogued</p>
            </article>
            <article className={`${styles.summaryCard} ${summary.expiringSoon ? styles.summaryAttention : ''}`}>
              <div className={styles.summaryHeading}><span>Expiry attention</span><Icon name="calendar" /></div>
              <strong>{summary.expiringSoon}</strong>
              <p>{summary.expiringSoon ? 'Expired or due within 60 days' : 'No upcoming expiry actions'}</p>
            </article>
            <article className={styles.summaryCard}>
              <div className={styles.summaryHeading}><span>Linked to assets</span><Icon name="link" /></div>
              <strong>{summary.linkedDocuments}</strong>
              <p>{summary.totalDocuments - summary.linkedDocuments} kept at account level</p>
            </article>
          </section>
        ) : null}

        <section className={styles.toolbar} aria-label="Search and refresh documents">
          <label className={styles.searchBox}>
            <Icon name="search" />
            <span className={styles.srOnly}>Search documents</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, file, category or linked asset"
            />
            {search ? <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><Icon name="close" /></button> : null}
          </label>

          <div className={styles.toolbarActions}>
            <button type="button" className={styles.refreshButton} onClick={() => void loadDocuments(view)} disabled={loading}>
              <Icon name="refresh" className={loading ? styles.refreshIconActive : undefined} /> Refresh
            </button>
          </div>
        </section>

        {view === 'recycle-bin' ? (
          <div className={styles.recycleNotice}>
            <Icon name="info" />
            <div>
              <strong>90-day Recycle Bin</strong>
              <span>Deleted documents remain recoverable for 90 days and are permanently removed when vault cleanup next runs.</span>
            </div>
          </div>
        ) : null}

        <div className={styles.resultsHeading}>
          <div>
            <span>{view === 'recycle-bin' ? 'Recycle Bin' : category === 'all' ? 'All documents' : categoryLabel(category)}</span>
            <strong>{filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'}</strong>
          </div>
          {(search || category !== 'all') ? (
            <button type="button" onClick={() => { setSearch(''); setCategory('all'); }}>Clear search &amp; filters</button>
          ) : null}
        </div>

        {loading ? (
          <section className={styles.loadingCard} aria-live="polite">
            <span className={styles.loadingSpinner} />
            <strong>Loading your documents…</strong>
          </section>
        ) : loadFailed ? (
          <section className={styles.emptyCard} role="alert">
            <div className={styles.emptyIcon}><Icon name="document" /></div>
            <h2>Documents could not be loaded</h2>
            <p>Please try again. Your stored documents have not been changed.</p>
            <button type="button" className={styles.uploadButton} onClick={() => void loadDocuments(view)}><Icon name="refresh" /> Try again</button>
          </section>
        ) : groupedDocuments.length ? (
          <div className={styles.categoryGroups}>
            {groupedDocuments.map((group) => (
              <section key={group.value} className={styles.categoryGroup} aria-labelledby={`category-${group.value}`}>
                <header className={styles.categoryHeader}>
                  <div className={styles.categoryHeadingGroup}>
                    <div className={styles.categoryIcon}><Icon name="folder" /></div>
                    <div>
                      <h2 id={`category-${group.value}`}>{group.label}</h2>
                      <p>Account records and documents</p>
                    </div>
                  </div>
                  <strong className={styles.categoryCount}>{group.documents.length} {group.documents.length === 1 ? 'document' : 'documents'}</strong>
                </header>
                <div className={styles.documentList}>{group.documents.map(renderDocumentCard)}</div>
              </section>
            ))}
          </div>
        ) : (
          <section className={styles.emptyCard}>
            <div className={styles.emptyIcon}><Icon name={view === 'recycle-bin' ? 'trash' : 'archive'} /></div>
            <h2>{view === 'recycle-bin' ? 'Your Recycle Bin is empty' : documents.length ? 'No documents match' : 'Start your Document Vault'}</h2>
            <p>
              {view === 'recycle-bin'
                ? 'Documents moved here will remain recoverable for 90 days.'
                : documents.length
                  ? 'Try clearing your search or choosing another category.'
                  : 'Upload company records, policies, agreements, permits or any other important document that should stay with the account.'}
            </p>
            {view === 'documents' && !documents.length ? (
              <button type="button" className={styles.uploadButton} onClick={openUploadModal}><Icon name="upload" /> Upload your first document</button>
            ) : null}
          </section>
        )}
      </main>

      {modalMode ? (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModalMode(null); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="document-modal-title">
            <header className={styles.modalHeader}>
              <div>
                <span>{modalMode === 'upload' ? 'Add to your vault' : 'Document details'}</span>
                <h2 id="document-modal-title">{modalMode === 'upload' ? 'Upload document' : 'Edit document'}</h2>
                <p>{modalMode === 'upload' ? 'The document can stay account-level or be linked to several assets.' : `Editing ${editingDocument?.fileName ?? 'document'}`}</p>
              </div>
              <button type="button" onClick={() => setModalMode(null)} disabled={busy} aria-label="Close dialog"><Icon name="close" /></button>
            </header>

            <form onSubmit={submitDocument} className={styles.modalForm}>
              <div className={styles.modalScroll}>
                {modalMode === 'upload' ? (
                  <label className={`${styles.filePicker} ${selectedFile ? styles.filePickerSelected : ''}`}>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      required
                    />
                    <span className={styles.filePickerIcon}><Icon name={selectedFile ? 'document' : 'upload'} /></span>
                    <span>
                      <strong>{selectedFile ? selectedFile.name : 'Choose a document'}</strong>
                      <small>{selectedFile ? `${formatBytes(selectedFile.size)} selected` : 'PDF, Word, Excel, CSV, TXT or image · up to 12 MB'}</small>
                    </span>
                    <b>{selectedFile ? 'Change file' : 'Browse'}</b>
                  </label>
                ) : (
                  <div className={styles.currentFile}>
                    <Icon name="document" />
                    <div><strong>{editingDocument?.fileName}</strong><span>{formatBytes(editingDocument?.byteSize ?? 0)} · Original file stays unchanged</span></div>
                  </div>
                )}

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Document title <b>*</b></span>
                    <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} maxLength={180} placeholder="e.g. Company registration certificate" required />
                  </label>
                  <label className={styles.field}>
                    <span>Category <b>*</b></span>
                    <select value={draft.category} onChange={(event) => updateDraft('category', event.target.value as DocumentCategory)}>
                      {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Expiry or renewal date <em>Optional</em></span>
                    <input type="date" value={draft.expiryDate} onChange={(event) => updateDraft('expiryDate', event.target.value)} />
                  </label>
                  <label className={`${styles.field} ${styles.notesField}`}>
                    <span>Notes <em>Optional</em></span>
                    <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} maxLength={5000} rows={4} placeholder="Add a short reminder, reference number or context…" />
                  </label>
                </div>

                <section className={styles.assetPicker} aria-labelledby="linked-assets-heading">
                  <div className={styles.assetPickerHeading}>
                    <div>
                      <span>Optional</span>
                      <h3 id="linked-assets-heading">Link to assets</h3>
                      <p>Leave this empty for an account-level document, or choose one or more related assets.</p>
                    </div>
                    <strong>{draft.assetIds.length} selected</strong>
                  </div>

                  {assets.length ? (
                    <>
                      <label className={styles.assetSearch}>
                        <Icon name="search" />
                        <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Find an asset" />
                      </label>
                      <div className={styles.assetOptions}>
                        {filteredAssets.length ? filteredAssets.map((asset) => {
                          const checked = draft.assetIds.includes(asset.id);
                          return (
                            <label key={asset.id} className={checked ? styles.assetOptionSelected : ''}>
                              <input type="checkbox" checked={checked} onChange={() => toggleAsset(asset.id)} />
                              <span className={styles.customCheckbox}>{checked ? '✓' : ''}</span>
                              <span><strong>{asset.title}</strong><small>{asset.meta || 'Asset Register item'}</small></span>
                            </label>
                          );
                        }) : <p className={styles.noAssetResults}>No assets match that search.</p>}
                      </div>
                    </>
                  ) : (
                    <div className={styles.noAssets}><Icon name="info" /><span>No assets are available yet. This document will stay at account level.</span></div>
                  )}
                </section>
              </div>

              <footer className={styles.modalFooter}>
                <button type="button" className={styles.cancelButton} disabled={busy} onClick={() => setModalMode(null)}>Cancel</button>
                <button type="submit" className={styles.uploadButton} disabled={busy}>
                  {busy ? <span className={styles.buttonSpinner} /> : <Icon name={modalMode === 'upload' ? 'upload' : 'edit'} />}
                  {busy ? 'Saving…' : modalMode === 'upload' ? 'Add to vault' : 'Save changes'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
