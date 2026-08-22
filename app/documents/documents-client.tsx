'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type SVGProps,
} from 'react';
import AppHeader from '../../components/AppHeader';
import {
  ACCOUNT_DOCUMENT_CATEGORY_LABELS,
  ACCOUNT_DOCUMENT_TYPES,
  getAccountDocumentType,
  getAccountDocumentTypeLabel,
  type AccountDocumentCategory,
  type AccountDocumentType,
} from '../../lib/account-document-taxonomy';
import styles from './page.module.css';

type DocumentCategory = AccountDocumentCategory;
type DocumentType = AccountDocumentType;

type AssetLink = {
  id: string;
  title: string;
  meta: string;
};

type VaultDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  documentType: DocumentType | null;
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
  selectedAsset?: AssetLink | null;
  document?: VaultDocument;
  error?: string;
};

type VaultView = 'documents' | 'recycle-bin';
type ModalMode = 'upload' | 'edit';
type Notice = { tone: 'success' | 'error'; message: string };
type SummaryNavigation = { hasOverflow: boolean; atStart: boolean; atEnd: boolean };
type IconName =
  | 'archive'
  | 'calendar'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
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
  category: DocumentCategory | '';
  documentType: DocumentType | '';
  notes: string;
  expiryDate: string;
  assetIds: string[];
};

type UploadProgress = {
  current: number;
  total: number;
};

const CATEGORY_OPTIONS: Array<{ value: DocumentCategory; label: string }> = [
  'finance',
  'tax-accounting',
  'insurance',
  'licence',
  'business',
  'contract',
  'ownership',
  'warranty',
  'other',
].map((value) => ({
  value: value as DocumentCategory,
  label: ACCOUNT_DOCUMENT_CATEGORY_LABELS[value as DocumentCategory],
}));

const CATEGORY_DESCRIPTIONS: Record<DocumentCategory, string> = {
  finance: 'Statements, funding and banking records',
  'tax-accounting': 'Invoices, tax records and reports',
  insurance: 'Policies, schedules and claims',
  licence: 'Certificates, permits and renewals',
  business: 'Registrations, resolutions and legal records',
  contract: 'Agreements and signed documents',
  ownership: 'Proof of ownership and transfer records',
  warranty: 'Warranty certificates and support records',
  other: 'Other important account documents',
};

const MAX_DOCUMENT_FILES_PER_BATCH = 20;
const MAX_DOCUMENT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENT_BATCH_BYTES = 250 * 1024 * 1024;
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.jpg', '.jpeg', '.png', '.webp',
]);

const EMPTY_SUMMARY: VaultSummary = {
  totalDocuments: 0,
  expiringSoon: 0,
  linkedDocuments: 0,
  storageBytes: 0,
};

function createEmptyDraft(): DocumentDraft {
  return {
    title: '',
    category: '',
    documentType: '',
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
    case 'chevron-left':
      paths = <path d="m14.5 6.5-5.5 5.5 5.5 5.5" />;
      break;
    case 'chevron-right':
      paths = <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />;
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

function categoryDescription(category: DocumentCategory): string {
  return CATEGORY_DESCRIPTIONS[category] ?? CATEGORY_DESCRIPTIONS.other;
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

function fileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
}

function fileIdentity(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function readVaultResponse(response: Response, fallback: string): Promise<VaultResponse> {
  try {
    return await response.json() as VaultResponse;
  } catch {
    return {
      ok: false,
      error: response.status === 413
        ? 'That file is too large for the upload service. Remove it or choose a smaller file.'
        : fallback,
    };
  }
}

type DocumentsClientProps = {
  initialAssetId?: string;
};

export default function DocumentsClient({ initialAssetId = '' }: DocumentsClientProps) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [summary, setSummary] = useState<VaultSummary>(EMPTY_SUMMARY);
  const [assets, setAssets] = useState<AssetLink[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetLink | null>(null);
  const [view, setView] = useState<VaultView>('documents');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | DocumentCategory>('all');
  const [showSummary, setShowSummary] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modalNotice, setModalNotice] = useState<Notice | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingDocument, setEditingDocument] = useState<VaultDocument | null>(null);
  const [draft, setDraft] = useState<DocumentDraft>(createEmptyDraft);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [filePickerDragging, setFilePickerDragging] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [documentTypeSearch, setDocumentTypeSearch] = useState('');
  const [showDocumentTypeOptions, setShowDocumentTypeOptions] = useState(false);
  const [activeDocumentTypeIndex, setActiveDocumentTypeIndex] = useState(0);
  const [summaryNavigation, setSummaryNavigation] = useState<SummaryNavigation>({
    hasOverflow: false,
    atStart: true,
    atEnd: true,
  });
  const requestSequence = useRef(0);
  const summaryViewportRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);
  const documentTypeComboboxRef = useRef<HTMLDivElement | null>(null);
  const pageContentRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const documentTypeInputRef = useRef<HTMLInputElement | null>(null);
  const busyRef = useRef(false);
  const showDocumentTypeOptionsRef = useRef(false);

  const loadDocuments = useCallback(async (targetView: VaultView, options: { quiet?: boolean } = {}) => {
    const sequence = ++requestSequence.current;
    if (!options.quiet) setLoading(true);

    try {
      const searchParams = new URLSearchParams();
      if (targetView === 'recycle-bin') searchParams.set('view', 'recycle-bin');
      if (initialAssetId) searchParams.set('assetId', initialAssetId);
      const query = searchParams.size ? `?${searchParams.toString()}` : '';
      const response = await fetch(`/api/documents${query}`, { cache: 'no-store' });
      const data = await readVaultResponse(response, 'The Document Vault could not be loaded.');
      if (!response.ok || !data.ok) throw new Error(data.error || 'The Document Vault could not be loaded.');
      if (sequence !== requestSequence.current) return false;

      setLoadFailed(false);
      setDocuments(data.documents ?? []);
      setSummary(data.summary ?? EMPTY_SUMMARY);
      setAssets(data.assets ?? []);
      setSelectedAsset(data.selectedAsset ?? null);
      return true;
    } catch (error) {
      if (sequence !== requestSequence.current) return false;
      setLoadFailed(true);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The Document Vault could not be loaded.',
      });
      return false;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [initialAssetId]);

  useEffect(() => {
    void loadDocuments(view);
  }, [loadDocuments, view]);

  useEffect(() => {
    if (!showSummary || loadFailed) return;
    const viewport = summaryViewportRef.current;
    if (!viewport) return;

    const updateNavigation = () => {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      setSummaryNavigation({
        hasOverflow: maxScrollLeft > 2,
        atStart: viewport.scrollLeft <= 2,
        atEnd: viewport.scrollLeft >= maxScrollLeft - 2,
      });
    };

    const frame = window.requestAnimationFrame(updateNavigation);
    viewport.addEventListener('scroll', updateNavigation, { passive: true });
    window.addEventListener('resize', updateNavigation);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', updateNavigation);
      window.removeEventListener('resize', updateNavigation);
    };
  }, [loadFailed, showSummary]);

  useEffect(() => {
    showDocumentTypeOptionsRef.current = showDocumentTypeOptions;
  }, [showDocumentTypeOptions]);

  useEffect(() => {
    if (!showDocumentTypeOptions) return undefined;

    const handleOutsideDocumentTypePointerDown = (event: PointerEvent) => {
      if (documentTypeComboboxRef.current && event.composedPath().includes(documentTypeComboboxRef.current)) return;
      showDocumentTypeOptionsRef.current = false;
      setShowDocumentTypeOptions(false);
    };

    document.addEventListener('pointerdown', handleOutsideDocumentTypePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsideDocumentTypePointerDown);
  }, [showDocumentTypeOptions]);

  useEffect(() => {
    if (!modalMode) return;

    const dialog = modalRef.current;
    const pageContent = pageContentRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.querySelector<HTMLElement>('[data-modal-initial-focus]')?.focus();
    pageContent?.setAttribute('inert', '');
    pageContent?.setAttribute('aria-hidden', 'true');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        if (showDocumentTypeOptionsRef.current) {
          event.preventDefault();
          showDocumentTypeOptionsRef.current = false;
          setShowDocumentTypeOptions(false);
          return;
        }
        setModalNotice(null);
        setModalMode(null);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      pageContent?.removeAttribute('inert');
      pageContent?.removeAttribute('aria-hidden');
      returnFocusRef.current?.focus();
    };
  }, [modalMode]);

  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return documents.filter((document) => {
      if (category !== 'all' && document.category !== category) return false;
      if (!needle) return true;

      return [
        document.title,
        document.fileName,
        document.notes,
        getAccountDocumentTypeLabel(document.documentType) ?? '',
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

  const filteredDocumentTypes = useMemo(() => {
    const needle = documentTypeSearch.trim().toLowerCase();
    if (!needle || draft.documentType) return ACCOUNT_DOCUMENT_TYPES;
    return ACCOUNT_DOCUMENT_TYPES.filter((option) => [
      option.label,
      option.value,
      ACCOUNT_DOCUMENT_CATEGORY_LABELS[option.category],
      ...option.keywords,
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [documentTypeSearch, draft.documentType]);

  const selectedFilesBytes = useMemo(
    () => selectedFiles.reduce((total, file) => total + file.size, 0),
    [selectedFiles],
  );
  const activeCategoryCount = useMemo(
    () => new Set(documents.map((document) => document.category)).size,
    [documents],
  );
  const accountLevelDocuments = Math.max(0, summary.totalDocuments - summary.linkedDocuments);
  const hasDocumentsInView = documents.length > 0;

  function switchView(nextView: VaultView) {
    if (busyRef.current || loading) return;
    setView(nextView);
    setCategory('all');
    setSearch('');
    setShowFilters(false);
    setNotice(null);
  }

  function openUploadModal() {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingDocument(null);
    setDraft({
      ...createEmptyDraft(),
      assetIds: initialAssetId ? [initialAssetId] : [],
    });
    setSelectedFiles([]);
    setUploadProgress(null);
    setFilePickerDragging(false);
    setShowAssetPicker(Boolean(initialAssetId));
    setAssetSearch('');
    setDocumentTypeSearch('');
    setShowDocumentTypeOptions(false);
    setModalNotice(null);
    setModalMode('upload');
    setNotice(null);
  }

  function openEditModal(document: VaultDocument) {
    returnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    setEditingDocument(document);
    setDraft({
      title: document.title,
      category: document.category,
      documentType: document.documentType ?? '',
      notes: document.notes,
      expiryDate: document.expiryDate ?? '',
      assetIds: document.assetLinks.map((asset) => asset.id),
    });
    setSelectedFiles([]);
    setUploadProgress(null);
    setFilePickerDragging(false);
    setShowAssetPicker(document.assetLinks.length > 0);
    setAssetSearch('');
    setDocumentTypeSearch(getAccountDocumentTypeLabel(document.documentType) ?? '');
    setShowDocumentTypeOptions(false);
    setModalNotice(null);
    setModalMode('edit');
    setNotice(null);
  }

  function updateDraft<K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectDocumentType(documentType: DocumentType) {
    const option = getAccountDocumentType(documentType);
    if (!option) return;
    setDraft((current) => ({
      ...current,
      documentType: option.value,
      category: option.category,
    }));
    setDocumentTypeSearch(option.label);
    setShowDocumentTypeOptions(false);
    setActiveDocumentTypeIndex(0);
  }

  function changeDocumentTypeSearch(value: string) {
    setDocumentTypeSearch(value);
    setDraft((current) => ({ ...current, documentType: '' }));
    setShowDocumentTypeOptions(true);
    setActiveDocumentTypeIndex(0);
  }

  function handleDocumentTypeKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && showDocumentTypeOptions) {
      event.preventDefault();
      event.stopPropagation();
      showDocumentTypeOptionsRef.current = false;
      setShowDocumentTypeOptions(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setShowDocumentTypeOptions(true);
      setActiveDocumentTypeIndex((current) => Math.min(current + 1, Math.max(0, filteredDocumentTypes.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setShowDocumentTypeOptions(true);
      setActiveDocumentTypeIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter' && showDocumentTypeOptions && filteredDocumentTypes[activeDocumentTypeIndex]) {
      event.preventDefault();
      selectDocumentType(filteredDocumentTypes[activeDocumentTypeIndex].value);
    }
  }

  function setOperationBusy(nextBusy: boolean) {
    busyRef.current = nextBusy;
    setBusy(nextBusy);
  }

  function addSelectedFiles(files: File[]) {
    if (busy || !files.length) return;

    const unsupported: File[] = [];
    const empty: File[] = [];
    const oversized: File[] = [];
    const validFiles: File[] = [];

    for (const file of files) {
      if (!file.size) empty.push(file);
      else if (!ALLOWED_DOCUMENT_EXTENSIONS.has(fileExtension(file.name))) unsupported.push(file);
      else if (file.size > MAX_DOCUMENT_FILE_BYTES) oversized.push(file);
      else validFiles.push(file);
    }

    const existingIds = new Set(selectedFiles.map(fileIdentity));
    const deduplicated = validFiles.filter((file) => {
      const identity = fileIdentity(file);
      if (existingIds.has(identity)) return false;
      existingIds.add(identity);
      return true;
    });
    const duplicateCount = validFiles.length - deduplicated.length;
    const availableSlots = Math.max(0, MAX_DOCUMENT_FILES_PER_BATCH - selectedFiles.length);
    const withinCount = deduplicated.slice(0, availableSlots);
    const countOverflow = deduplicated.length - withinCount.length;
    let runningBytes = selectedFilesBytes;
    const accepted: File[] = [];
    let batchOverflow = 0;

    for (const file of withinCount) {
      if (runningBytes + file.size > MAX_DOCUMENT_BATCH_BYTES) {
        batchOverflow += 1;
        continue;
      }
      accepted.push(file);
      runningBytes += file.size;
    }

    const nextFiles = [...selectedFiles, ...accepted];
    setSelectedFiles(nextFiles);
    setFilePickerDragging(false);
    if (nextFiles.length === 1 && !draft.title.trim()) {
      updateDraft('title', titleFromFileName(nextFiles[0].name));
    }

    const issues: string[] = [];
    if (unsupported.length) issues.push(`${unsupported.length} unsupported ${unsupported.length === 1 ? 'file was' : 'files were'} skipped`);
    if (empty.length) issues.push(`${empty.length} empty ${empty.length === 1 ? 'file was' : 'files were'} skipped`);
    if (oversized.length) issues.push(`${oversized.length} ${oversized.length === 1 ? 'file exceeds' : 'files exceed'} 25 MB`);
    if (duplicateCount) issues.push(`${duplicateCount} duplicate ${duplicateCount === 1 ? 'was' : 'files were'} skipped`);
    if (countOverflow) issues.push(`only ${MAX_DOCUMENT_FILES_PER_BATCH} files can be added per batch`);
    if (batchOverflow) issues.push(`the batch may not exceed ${formatBytes(MAX_DOCUMENT_BATCH_BYTES)}`);
    setModalNotice(issues.length ? { tone: 'error', message: `${issues.join('. ')}.` } : null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (busy) return;
    addSelectedFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (busy) return;
    addSelectedFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function removeSelectedFile(file: File) {
    const identity = fileIdentity(file);
    const nextFiles = selectedFiles.filter((candidate) => fileIdentity(candidate) !== identity);
    setSelectedFiles(nextFiles);
    setModalNotice(null);
    if (nextFiles.length === 1) updateDraft('title', titleFromFileName(nextFiles[0].name));
    if (!nextFiles.length) updateDraft('title', '');
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);
    setModalNotice(null);
    updateDraft('title', '');
  }

  function toggleAsset(assetId: string) {
    if (busy) return;
    setDraft((current) => ({
      ...current,
      assetIds: current.assetIds.includes(assetId)
        ? current.assetIds.filter((id) => id !== assetId)
        : [...current.assetIds, assetId],
    }));
  }

  function scrollSummary(direction: -1 | 1) {
    const viewport = summaryViewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * Math.max(320, viewport.clientWidth * 0.88), behavior: 'smooth' });
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalMode || busy) return;

    if (modalMode === 'upload' && !draft.documentType) {
      setModalNotice({ tone: 'error', message: 'Choose the document type before uploading.' });
      documentTypeInputRef.current?.focus();
      return;
    }
    if (!draft.category) {
      setModalNotice({ tone: 'error', message: 'Choose the document type that best fits these documents.' });
      return;
    }
    if (draft.documentType === 'other' && !draft.notes.trim()) {
      setModalNotice({ tone: 'error', message: 'Describe the document in Notes when choosing Other document.' });
      return;
    }
    if (modalMode === 'edit' && !draft.title.trim()) {
      setModalNotice({ tone: 'error', message: 'Add a clear document title.' });
      return;
    }
    if (modalMode === 'upload' && !selectedFiles.length) {
      setModalNotice({ tone: 'error', message: 'Select at least one document to upload.' });
      return;
    }

    setOperationBusy(true);
    setModalNotice(null);
    setNotice(null);

    try {
      if (modalMode === 'upload') {
        const filesToUpload = [...selectedFiles];
        const failures: Array<{ file: File; message: string }> = [];
        let uploadedCount = 0;

        for (let index = 0; index < filesToUpload.length; index += 1) {
          const file = filesToUpload[index];
          setUploadProgress({ current: index + 1, total: filesToUpload.length });

          try {
            const formData = new FormData();
            formData.set('file', file);
            formData.set(
              'title',
              filesToUpload.length === 1
                ? draft.title.trim()
                : titleFromFileName(file.name) || file.name,
            );
            formData.set('category', draft.category);
            formData.set('documentType', draft.documentType);
            formData.set('notes', draft.notes.trim());
            formData.set('expiryDate', draft.expiryDate);
            formData.set('assetIds', JSON.stringify(draft.assetIds));
            const response = await fetch('/api/documents', { method: 'POST', body: formData });
            const data = await readVaultResponse(response, `${file.name} could not be saved.`);
            if (!response.ok || !data.ok) throw new Error(data.error || `${file.name} could not be saved.`);
            uploadedCount += 1;
          } catch (error) {
            failures.push({
              file,
              message: error instanceof Error ? error.message : `${file.name} could not be saved.`,
            });
          }
        }

        const refreshSucceeded = uploadedCount
          ? await loadDocuments('documents', { quiet: true })
          : true;

        if (failures.length) {
          const failedFiles = failures.map((failure) => failure.file);
          setSelectedFiles(failedFiles);
          if (filesToUpload.length > 1 && failedFiles.length === 1) {
            updateDraft('title', titleFromFileName(failedFiles[0].name));
          }
          setModalNotice({
            tone: 'error',
            message: `${uploadedCount} of ${filesToUpload.length} uploaded. ${failures.length} ${failures.length === 1 ? 'file remains' : 'files remain'} ready to retry. ${failures[0].message}`,
          });
          return;
        }

        setOperationBusy(false);
        setModalMode(null);
        setEditingDocument(null);
        setSelectedFiles([]);
        if (refreshSucceeded) {
          setNotice({
            tone: 'success',
            message: `${uploadedCount} ${uploadedCount === 1 ? 'document' : 'documents'} added to your vault.`,
          });
        }
      } else {
        const response = await fetch(`/api/documents/${encodeURIComponent(editingDocument?.id ?? '')}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
        const data = await readVaultResponse(response, 'The document could not be saved.');
        if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be saved.');

        setOperationBusy(false);
        setModalMode(null);
        setEditingDocument(null);
        setNotice({ tone: 'success', message: 'Document details updated.' });
        await loadDocuments('documents', { quiet: true });
      }
    } catch (error) {
      setModalNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The document could not be saved.',
      });
    } finally {
      setUploadProgress(null);
      setOperationBusy(false);
    }
  }

  function closeModal() {
    if (busyRef.current) return;
    setModalNotice(null);
    setModalMode(null);
  }

  async function moveToRecycleBin(document: VaultDocument) {
    const confirmed = window.confirm(
      `Move “${document.title}” to the Recycle Bin? It can be restored for 90 days.`,
    );
    if (!confirmed) return;

    setOperationBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' });
      const data = await readVaultResponse(response, 'The document could not be moved.');
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be moved.');

      setNotice({ tone: 'success', message: 'Document moved to the Recycle Bin.' });
      await loadDocuments('documents', { quiet: true });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The document could not be moved.' });
    } finally {
      setOperationBusy(false);
    }
  }

  async function restoreDocument(document: VaultDocument) {
    setOperationBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      const data = await readVaultResponse(response, 'The document could not be restored.');
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be restored.');

      setNotice({ tone: 'success', message: 'Document restored to your vault.' });
      await loadDocuments('recycle-bin', { quiet: true });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The document could not be restored.' });
    } finally {
      setOperationBusy(false);
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
            <span className={styles.categoryPill} title={categoryLabel(document.category)}>
              {getAccountDocumentTypeLabel(document.documentType) ?? categoryLabel(document.category)}
            </span>
            <span className={styles.fileName} title={document.fileName}>{document.fileName}</span>
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
      <div ref={pageContentRef} className={styles.pageContent}>
        <AppHeader active="documents" />

        <main className={styles.shell}>
          <div className={styles.vaultCanvas}>
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

        {initialAssetId ? (
          <section className={styles.assetFilterBanner} aria-label="Asset document filter">
            <span className={styles.assetFilterIcon}><Icon name="link" /></span>
            <div>
              <span>Asset-linked documents</span>
              <strong>{selectedAsset?.title ?? (loading ? 'Loading selected asset…' : 'Selected asset')}</strong>
              {selectedAsset?.meta ? <small>{selectedAsset.meta}</small> : null}
            </div>
            <a href="/documents">View all documents</a>
          </section>
        ) : null}

        <section className={styles.topActions} aria-label="Document Vault actions">
          <button
            type="button"
            className={`${styles.headerButton} ${styles.recycleButton}`}
            onClick={() => switchView(view === 'recycle-bin' ? 'documents' : 'recycle-bin')}
            aria-pressed={view === 'recycle-bin'}
            disabled={busy || loading}
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
            disabled={loading || loadFailed || view === 'recycle-bin' || summary.totalDocuments === 0}
          >
            <Icon name="archive" /> Summary
          </button>
          <button
            type="button"
            className={`${styles.headerButton} ${styles.filtersButton}`}
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            aria-controls="document-vault-filters"
            disabled={loading || loadFailed || !hasDocumentsInView}
          >
            <Icon name="filter" /> Filters
            <Icon name="chevron-down" className={styles.buttonChevron} />
            {category !== 'all' ? <span className={styles.buttonCount}>1</span> : null}
          </button>
          <button type="button" className={`${styles.headerButton} ${styles.primaryHeaderButton}`} onClick={openUploadModal} disabled={view === 'recycle-bin' || busy}>
            <Icon name="upload" /> Upload documents
          </button>
        </section>

        {showFilters && hasDocumentsInView ? (
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

        {showSummary && view === 'documents' && !loading && !loadFailed && summary.totalDocuments > 0 ? (
          <div id="document-vault-summary" className={styles.summaryCarousel} aria-label="Document Vault summary">
            <button
              type="button"
              className={`${styles.summaryNav} ${styles.summaryNavPrevious}`}
              onClick={() => scrollSummary(-1)}
              aria-label="Previous summary cards"
              disabled={!summaryNavigation.hasOverflow || summaryNavigation.atStart}
              hidden={!summaryNavigation.hasOverflow}
            >
              <Icon name="chevron-left" />
            </button>
            <div ref={summaryViewportRef} className={styles.summaryViewport}>
              <section className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                  <div className={styles.summaryHeading}><span>Total documents</span><Icon name="document" /></div>
                  <strong>{summary.totalDocuments}</strong>
                  <p>{activeCategoryCount} {activeCategoryCount === 1 ? 'category' : 'categories'} in use</p>
                </article>
                <article className={`${styles.summaryCard} ${summary.expiringSoon ? styles.summaryAttention : ''}`}>
                  <div className={styles.summaryHeading}><span>Expiry attention</span><Icon name="calendar" /></div>
                  <strong>{summary.expiringSoon}</strong>
                  <p>{summary.expiringSoon ? 'Expired or due within 60 days' : 'No upcoming expiry actions'}</p>
                </article>
                <article className={styles.summaryCard}>
                  <div className={styles.summaryHeading}><span>Storage used</span><Icon name="archive" /></div>
                  <strong>{formatBytes(summary.storageBytes)}</strong>
                  <p>{summary.linkedDocuments} linked · {accountLevelDocuments} account-level</p>
                </article>
              </section>
            </div>
            <button
              type="button"
              className={`${styles.summaryNav} ${styles.summaryNavNext}`}
              onClick={() => scrollSummary(1)}
              aria-label="Next summary cards"
              disabled={!summaryNavigation.hasOverflow || summaryNavigation.atEnd}
              hidden={!summaryNavigation.hasOverflow}
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        ) : null}

        {hasDocumentsInView ? <section className={styles.toolbar} aria-label="Search and refresh documents">
          <label className={styles.searchBox}>
            <Icon name="search" />
            <span className={styles.srOnly}>Search documents</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents, filenames, categories or assets"
            />
            {search ? <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><Icon name="close" /></button> : null}
          </label>

          <div className={styles.toolbarActions}>
            <button type="button" className={styles.refreshButton} onClick={() => void loadDocuments(view)} disabled={loading || busy}>
              <Icon name="refresh" className={loading ? styles.refreshIconActive : undefined} /> Refresh
            </button>
          </div>
        </section> : null}

        {view === 'recycle-bin' ? (
          <div className={styles.recycleNotice}>
            <Icon name="info" />
            <div>
              <strong>90-day Recycle Bin</strong>
              <span>Deleted documents remain recoverable for 90 days and are permanently removed when vault cleanup next runs.</span>
            </div>
          </div>
        ) : null}

        {!loadFailed && hasDocumentsInView ? (
          <div className={styles.resultsHeading}>
            <div>
              <span>{view === 'recycle-bin' ? 'Recycle Bin' : initialAssetId ? 'Documents linked to this asset' : category === 'all' ? 'All documents' : categoryLabel(category)}</span>
              <strong>{filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'}</strong>
            </div>
            {(search || category !== 'all') ? (
              <button type="button" onClick={() => { setSearch(''); setCategory('all'); }}>Clear search &amp; filters</button>
            ) : null}
          </div>
        ) : null}

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
                      <p>{categoryDescription(group.value)}</p>
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
            <h2>{view === 'recycle-bin' ? 'Your Recycle Bin is empty' : documents.length ? 'No documents match' : initialAssetId ? 'No documents linked yet' : 'Keep every important document in one place'}</h2>
            <p>
              {view === 'recycle-bin'
                ? 'Documents moved here will remain recoverable for 90 days.'
                : documents.length
                  ? 'Try clearing your search or choosing another category.'
                  : initialAssetId
                    ? 'Upload a document here and it will be saved in the Document Vault already linked to this asset.'
                  : 'Upload finance, accounting, insurance and licensing records in bulk. Files stay at account level unless you choose to link them to assets.'}
            </p>
            {view === 'documents' && !documents.length ? (
              <>
                <div className={styles.emptyCategories} aria-label="Popular document categories">
                  <span>Finance</span>
                  <span>Accounting &amp; tax</span>
                  <span>Insurance</span>
                  <span>Licences &amp; permits</span>
                </div>
                <button type="button" className={styles.uploadButton} onClick={openUploadModal}><Icon name="upload" /> Upload documents</button>
              </>
            ) : null}
          </section>
        )}
          </div>
        </main>
      </div>

      {modalMode ? (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="document-modal-title">
            <header className={styles.modalHeader}>
              <div>
                <span>{modalMode === 'upload' ? 'Add to your vault' : 'Document details'}</span>
                <h2 id="document-modal-title">{modalMode === 'upload' ? 'Upload documents' : 'Edit document'}</h2>
                <p>{modalMode === 'upload' ? 'Add up to 20 files at once. The details below apply to every file in this batch.' : `Editing ${editingDocument?.fileName ?? 'document'}`}</p>
              </div>
              <button type="button" onClick={closeModal} disabled={busy} aria-label="Close dialog" data-modal-initial-focus="true"><Icon name="close" /></button>
            </header>

            <form onSubmit={submitDocument} className={styles.modalForm}>
              <div className={styles.modalScroll}>
                {modalNotice ? (
                  <div className={styles.modalNotice} role="alert">
                    <Icon name="info" />
                    <span>{modalNotice.message}</span>
                    <button type="button" onClick={() => setModalNotice(null)} aria-label="Dismiss error"><Icon name="close" /></button>
                  </div>
                ) : null}

                <fieldset className={styles.modalFields} disabled={busy}>
                {modalMode === 'upload' ? (
                  <>
                  <div
                    className={`${styles.filePicker} ${selectedFiles.length ? styles.filePickerSelected : ''} ${filePickerDragging ? styles.filePickerDragging : ''}`}
                    onDragEnter={(event) => { event.preventDefault(); if (!busy) setFilePickerDragging(true); }}
                    onDragOver={(event) => { event.preventDefault(); if (!busy) setFilePickerDragging(true); }}
                    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFilePickerDragging(false); }}
                    onDrop={handleFileDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      aria-label="Choose documents to upload"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      multiple
                    />
                    <span className={styles.filePickerIcon}><Icon name={selectedFiles.length ? 'document' : 'upload'} /></span>
                    <span>
                      <strong>{selectedFiles.length ? `${selectedFiles.length} ${selectedFiles.length === 1 ? 'document' : 'documents'} ready` : 'Drop documents here or browse'}</strong>
                      <small>PDF, Word, Excel, CSV, TXT or images · 25 MB each · 20 files / 250 MB per batch</small>
                    </span>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                      {selectedFiles.length ? 'Add more' : 'Browse files'}
                    </button>
                  </div>

                  {selectedFiles.length ? (
                    <section className={styles.fileQueue} aria-label="Documents ready to upload">
                      <header>
                        <div>
                          <strong>Ready to upload</strong>
                          <span>{selectedFiles.length} of {MAX_DOCUMENT_FILES_PER_BATCH} files · {formatBytes(selectedFilesBytes)}</span>
                        </div>
                        <button type="button" onClick={clearSelectedFiles} disabled={busy}>Clear all</button>
                      </header>
                      <div className={styles.fileQueueList}>
                        {selectedFiles.map((file) => (
                          <article key={fileIdentity(file)}>
                            <span className={styles.fileQueueIcon}><Icon name="document" /></span>
                            <span><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
                            <button type="button" onClick={() => removeSelectedFile(file)} disabled={busy} aria-label={`Remove ${file.name}`}><Icon name="close" /></button>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {selectedFiles.length > 1 ? (
                    <div className={styles.batchHint}><Icon name="info" /><span>File names will become document titles. You can edit individual titles after upload.</span></div>
                  ) : null}
                  </>
                ) : (
                  <div className={styles.currentFile}>
                    <Icon name="document" />
                    <div><strong>{editingDocument?.fileName}</strong><span>{formatBytes(editingDocument?.byteSize ?? 0)} · Original file stays unchanged</span></div>
                  </div>
                )}

                <div className={styles.formGrid}>
                  {modalMode === 'edit' || selectedFiles.length <= 1 ? <label className={styles.field}>
                    <span>
                      Document title
                      {modalMode === 'edit' ? <b>*</b> : <em>Optional · filename used by default</em>}
                    </span>
                    <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} maxLength={180} placeholder="e.g. Company registration certificate" required={modalMode === 'edit'} />
                  </label> : null}
                  <div className={`${styles.field} ${styles.documentTypeField}`}>
                    <label htmlFor="document-type-search">
                      {selectedFiles.length > 1 ? 'Document type for all files' : 'Document type'}
                      {modalMode === 'upload' ? <b>*</b> : <em>Optional for older records</em>}
                    </label>
                    <div ref={documentTypeComboboxRef} className={styles.documentTypeCombobox}>
                      <Icon name="search" />
                      <input
                        ref={documentTypeInputRef}
                        id="document-type-search"
                        type="search"
                        value={documentTypeSearch}
                        onChange={(event) => changeDocumentTypeSearch(event.target.value)}
                        onFocus={() => { setShowDocumentTypeOptions(true); setActiveDocumentTypeIndex(0); }}
                        onKeyDown={handleDocumentTypeKeyDown}
                        placeholder="Search document types"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showDocumentTypeOptions}
                        aria-controls="document-type-options"
                        aria-invalid={!draft.documentType && modalNotice?.tone === 'error'}
                        aria-activedescendant={showDocumentTypeOptions && filteredDocumentTypes[activeDocumentTypeIndex]
                          ? `document-type-option-${filteredDocumentTypes[activeDocumentTypeIndex].value}`
                          : undefined}
                        required={modalMode === 'upload'}
                        autoComplete="off"
                      />
                      {draft.documentType ? (
                        <button
                          type="button"
                          onClick={() => changeDocumentTypeSearch('')}
                          aria-label="Clear document type"
                        >
                          <Icon name="close" />
                        </button>
                      ) : null}
                      {showDocumentTypeOptions ? (
                        <div id="document-type-options" className={styles.documentTypeOptions} role="listbox">
                          {filteredDocumentTypes.length ? filteredDocumentTypes.map((option, index) => (
                            <button
                              key={option.value}
                              id={`document-type-option-${option.value}`}
                              type="button"
                              role="option"
                              aria-selected={draft.documentType === option.value}
                              data-active={activeDocumentTypeIndex === index ? 'true' : undefined}
                              onMouseDown={(event) => event.preventDefault()}
                              onMouseEnter={() => setActiveDocumentTypeIndex(index)}
                              onClick={() => selectDocumentType(option.value)}
                            >
                              <span>{option.label}</span>
                              <small>{ACCOUNT_DOCUMENT_CATEGORY_LABELS[option.category]}</small>
                            </button>
                          )) : (
                            <p>No document types match that search.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {draft.documentType ? (
                      <small className={styles.documentTypeCategory}>
                        Saved under {ACCOUNT_DOCUMENT_CATEGORY_LABELS[draft.category as DocumentCategory]}
                      </small>
                    ) : null}
                  </div>
                  <label className={styles.field}>
                    <span>{selectedFiles.length > 1 ? 'Expiry for all files' : 'Expiry or renewal date'} <em>Optional</em></span>
                    <input type="date" value={draft.expiryDate} onChange={(event) => updateDraft('expiryDate', event.target.value)} />
                  </label>
                  <label className={`${styles.field} ${styles.notesField}`}>
                    <span>
                      {selectedFiles.length > 1 ? 'Note for all files' : 'Notes'}{' '}
                      {draft.documentType === 'other' ? <b>*</b> : <em>Optional</em>}
                    </span>
                    <textarea
                      value={draft.notes}
                      onChange={(event) => updateDraft('notes', event.target.value)}
                      maxLength={5000}
                      rows={4}
                      placeholder={draft.documentType === 'other'
                        ? 'Describe what this document is'
                        : selectedFiles.length > 1
                          ? 'Add a shared reference, reminder or context for this batch…'
                          : 'Add a short reminder, reference number or context…'}
                    />
                  </label>
                </div>

                {modalMode === 'upload' && initialAssetId ? (
                  <section className={styles.lockedAssetLink} aria-labelledby="linked-asset-heading">
                    <span className={styles.lockedAssetIcon}><Icon name="link" /></span>
                    <div>
                      <span>Document will be linked to</span>
                      <h3 id="linked-asset-heading">{selectedAsset?.title ?? 'Selected asset'}</h3>
                      <p>{selectedAsset?.meta || 'This link is fixed for the asset-card upload.'}</p>
                    </div>
                    <strong>Linked</strong>
                  </section>
                ) : (
                <section className={`${styles.assetPicker} ${showAssetPicker ? '' : styles.assetPickerCollapsed}`} aria-labelledby="linked-assets-heading">
                  <div className={styles.assetPickerHeading}>
                    <div>
                      <span>Optional · account-level by default</span>
                      <h3 id="linked-assets-heading">Link to assets</h3>
                      <p>{selectedFiles.length > 1 ? 'Selected assets will be linked to every document in this batch.' : 'Choose one or more related assets, or leave this at account level.'}</p>
                    </div>
                    <button type="button" onClick={() => setShowAssetPicker((current) => !current)} aria-expanded={showAssetPicker}>
                      {draft.assetIds.length ? `${draft.assetIds.length} selected` : showAssetPicker ? 'Done' : 'Choose assets'}
                      <Icon name="chevron-down" />
                    </button>
                  </div>

                  {showAssetPicker && assets.length ? (
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
                  ) : showAssetPicker ? (
                    <div className={styles.noAssets}><Icon name="info" /><span>No assets are available yet. This document will stay at account level.</span></div>
                  ) : null}
                </section>
                )}
                </fieldset>
              </div>

              <footer className={styles.modalFooter}>
                <span className={styles.srOnly} role="status" aria-live="polite">
                  {uploadProgress ? `Uploading document ${uploadProgress.current} of ${uploadProgress.total}.` : ''}
                </span>
                <button type="button" className={styles.cancelButton} disabled={busy} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.uploadButton} disabled={busy}>
                  {busy ? <span className={styles.buttonSpinner} /> : <Icon name={modalMode === 'upload' ? 'upload' : 'edit'} />}
                  {uploadProgress
                    ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
                    : busy
                      ? 'Saving…'
                      : modalMode === 'upload'
                        ? selectedFiles.length > 1 ? `Upload ${selectedFiles.length} documents` : 'Upload document'
                        : 'Save changes'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
