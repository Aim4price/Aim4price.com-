'use client';

import DropdownOverlay from '../../components/DropdownOverlay';
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
import wizardStyles from '../../components/AimWizardModal.module.css';

type DocumentCategory = AccountDocumentCategory;
type DocumentType = AccountDocumentType;

type AssetLink = {
  id: string;
  title: string;
  meta: string;
  detail?: string;
  categoryLabel?: string;
  methodLabel?: string;
  currentValue?: number;
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
type UploadStep = 1 | 2 | 3;
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
const UPLOAD_STEPS: Array<{ step: UploadStep; label: string; description: string }> = [
  { step: 1, label: 'Upload document', description: 'Choose the files you want to keep in your vault.' },
  { step: 2, label: 'Document details', description: 'Add the type, title and any useful dates or notes.' },
  { step: 3, label: 'Linked to?', description: 'Choose related assets, or keep the documents at account level.' },
];
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

function formatAssetValue(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
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
  initialReturnTo?: string;
};

export default function DocumentsClient({ initialAssetId = '', initialReturnTo = '' }: DocumentsClientProps) {
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
  const [uploadStep, setUploadStep] = useState<UploadStep>(1);
  const [editingDocument, setEditingDocument] = useState<VaultDocument | null>(null);
  const [documentPendingDelete, setDocumentPendingDelete] = useState<VaultDocument | null>(null);
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
  const uploadWizardBodyRef = useRef<HTMLDivElement | null>(null);
  const assetPickerModalRef = useRef<HTMLElement | null>(null);
  const filterModalRef = useRef<HTMLElement | null>(null);
  const deleteModalRef = useRef<HTMLElement | null>(null);
  const documentTypeComboboxRef = useRef<HTMLDivElement | null>(null);
  const pageContentRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const assetPickerReturnFocusRef = useRef<HTMLElement | null>(null);
  const assetSelectionSnapshotRef = useRef<string[]>([]);
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
    if (!modalMode && !showFilters && !documentPendingDelete && !showAssetPicker) return;

    const dialog = showAssetPicker
      ? assetPickerModalRef.current
      : modalMode
        ? modalRef.current
        : showFilters
          ? filterModalRef.current
          : deleteModalRef.current;
    const pageContent = pageContentRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.querySelector<HTMLElement>('[data-modal-initial-focus]')?.focus();
    pageContent?.setAttribute('inert', '');
    pageContent?.setAttribute('aria-hidden', 'true');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        if (showAssetPicker) {
          event.preventDefault();
          closeAssetPickerModal(false);
          return;
        }
        if (modalMode && showDocumentTypeOptionsRef.current) {
          event.preventDefault();
          showDocumentTypeOptionsRef.current = false;
          setShowDocumentTypeOptions(false);
          return;
        }
        setModalNotice(null);
        if (modalMode) setModalMode(null);
        else if (showFilters) setShowFilters(false);
        else setDocumentPendingDelete(null);
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
  }, [documentPendingDelete, modalMode, showAssetPicker, showFilters]);

  useEffect(() => {
    if (modalMode !== 'upload' || showAssetPicker) return undefined;
    const scrollFrame = window.requestAnimationFrame(() => {
      uploadWizardBodyRef.current?.scrollTo({ top: 0, left: 0 });
    });
    return () => window.cancelAnimationFrame(scrollFrame);
  }, [modalMode, showAssetPicker, uploadStep]);

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
    return assets.filter((asset) => [
      asset.title,
      asset.meta,
      asset.detail,
      asset.categoryLabel,
      asset.methodLabel,
      asset.currentValue,
    ].join(' ').toLowerCase().includes(needle));
  }, [assetSearch, assets]);

  const selectedDraftAssets = useMemo(
    () => assets.filter((asset) => draft.assetIds.includes(asset.id)),
    [assets, draft.assetIds],
  );
  const allFilteredAssetsSelected = filteredAssets.length > 0
    && filteredAssets.every((asset) => draft.assetIds.includes(asset.id));

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
  const activeUploadStep = UPLOAD_STEPS[uploadStep - 1];

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
    setShowAssetPicker(false);
    setAssetSearch('');
    setDocumentTypeSearch('');
    setShowDocumentTypeOptions(false);
    setModalNotice(null);
    setUploadStep(1);
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
    setShowAssetPicker(false);
    setAssetSearch('');
    setDocumentTypeSearch(getAccountDocumentTypeLabel(document.documentType) ?? '');
    setShowDocumentTypeOptions(false);
    setModalNotice(null);
    setUploadStep(2);
    setModalMode('edit');
    setNotice(null);
  }

  function openFiltersModal() {
    if (busyRef.current || loading || loadFailed || !hasDocumentsInView) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setShowFilters(true);
  }

  function requestDocumentDelete(document: VaultDocument) {
    if (busyRef.current) return;
    returnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    setModalNotice(null);
    setDocumentPendingDelete(document);
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

  function openAssetPickerModal() {
    if (busyRef.current) return;
    assetPickerReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    assetSelectionSnapshotRef.current = [...draft.assetIds];
    setAssetSearch('');
    setShowAssetPicker(true);
  }

  function closeAssetPickerModal(keepSelection: boolean) {
    if (busyRef.current) return;
    if (!keepSelection) {
      const previousAssetIds = [...assetSelectionSnapshotRef.current];
      setDraft((current) => ({ ...current, assetIds: previousAssetIds }));
    }
    setAssetSearch('');
    setShowAssetPicker(false);
    window.requestAnimationFrame(() => assetPickerReturnFocusRef.current?.focus());
  }

  function selectAllFilteredAssets() {
    if (busyRef.current || !filteredAssets.length) return;
    const visibleAssetIds = filteredAssets.map((asset) => asset.id);
    setDraft((current) => ({
      ...current,
      assetIds: Array.from(new Set([...current.assetIds, ...visibleAssetIds])),
    }));
  }

  function clearSelectedAssets() {
    if (busyRef.current) return;
    setDraft((current) => ({ ...current, assetIds: [] }));
  }

  function scrollSummary(direction: -1 | 1) {
    const viewport = summaryViewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * Math.max(320, viewport.clientWidth * 0.88), behavior: 'smooth' });
  }

  function validateDocumentDetails(): boolean {
    if (!draft.documentType) {
      setModalNotice({ tone: 'error', message: 'Choose the document type before continuing.' });
      documentTypeInputRef.current?.focus();
      return false;
    }
    if (!draft.category) {
      setModalNotice({ tone: 'error', message: 'Choose the document type that best fits these documents.' });
      return false;
    }
    if (draft.documentType === 'other' && !draft.notes.trim()) {
      setModalNotice({ tone: 'error', message: 'Describe the document in Notes when choosing Other document.' });
      return false;
    }
    return true;
  }

  function continueUploadFlow() {
    setModalNotice(null);
    if (uploadStep === 1) {
      if (!selectedFiles.length) {
        setModalNotice({ tone: 'error', message: 'Select at least one document before continuing.' });
        return;
      }
      setUploadStep(2);
      return;
    }
    if (uploadStep === 2 && validateDocumentDetails()) setUploadStep(3);
  }

  function returnToPreviousUploadStep() {
    setModalNotice(null);
    setShowDocumentTypeOptions(false);
    setUploadStep((current) => Math.max(1, current - 1) as UploadStep);
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalMode || busy) return;

    if (modalMode === 'upload' && uploadStep < 3) {
      continueUploadFlow();
      return;
    }

    if (modalMode === 'upload' && !validateDocumentDetails()) return;
    if (modalMode === 'edit' && !draft.category) {
      setModalNotice({ tone: 'error', message: 'Choose the document type that best fits this document.' });
      return;
    }
    if (modalMode === 'edit' && draft.documentType === 'other' && !draft.notes.trim()) {
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
    if (showAssetPicker) {
      closeAssetPickerModal(false);
      return;
    }
    setModalNotice(null);
    setShowDocumentTypeOptions(false);
    setModalMode(null);
  }

  async function moveToRecycleBin() {
    const document = documentPendingDelete;
    if (!document || busyRef.current) return;

    setOperationBusy(true);
    setNotice(null);
    setModalNotice(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' });
      const data = await readVaultResponse(response, 'The document could not be moved.');
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be moved.');

      setDocumentPendingDelete(null);
      setNotice({ tone: 'success', message: 'Document moved to the Recycle Bin.' });
      await loadDocuments('documents', { quiet: true });
    } catch (error) {
      setModalNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The document could not be moved.' });
    } finally {
      setOperationBusy(false);
    }
  }

  async function permanentlyDeleteDocument() {
    const document = documentPendingDelete;
    if (!document || view !== 'recycle-bin' || busyRef.current) return;

    setOperationBusy(true);
    setNotice(null);
    setModalNotice(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}?permanent=1`, { method: 'DELETE' });
      const data = await readVaultResponse(response, 'The document could not be permanently deleted.');
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be permanently deleted.');

      setDocumentPendingDelete(null);
      setNotice({ tone: 'success', message: 'Document permanently deleted.' });
      await loadDocuments('recycle-bin', { quiet: true });
    } catch (error) {
      setModalNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The document could not be permanently deleted.',
      });
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
            <h3>{document.title}</h3>
            <div className={styles.documentStatus} data-tone={isDeleted ? 'warning' : expiry.tone}>
              <Icon name={isDeleted ? 'trash' : 'calendar'} />
              <span>{isDeleted ? `${recycleDaysLeft(document.deletedAtIso)} days left in Recycle Bin` : expiry.label}</span>
            </div>
          </div>

          <div className={styles.documentFacts}>
            <div>
              <span>Type</span>
              <strong>{getAccountDocumentTypeLabel(document.documentType) ?? categoryLabel(document.category)}</strong>
            </div>
            <div>
              <span>File</span>
              <strong className={styles.fileName} title={document.fileName}>{document.fileName}</strong>
            </div>
            <div>
              <span>Size</span>
              <strong>{formatBytes(document.byteSize)}</strong>
            </div>
            <div>
              <span>Added</span>
              <strong>{formatDate(document.createdAtIso)}</strong>
            </div>
          </div>

          {document.notes ? <p className={styles.documentNotes}>{document.notes}</p> : null}

          <div className={styles.assetLinkRow}>
            <span className={styles.assetLinkLabel}><Icon name="link" /> Linked assets</span>
            <span className={styles.linkedAssetNames}>
              {document.assetLinks.length
                ? document.assetLinks.map((asset) => asset.title).join(' · ')
                : 'Account-level document'}
            </span>
          </div>
        </div>

        <div className={styles.documentActions} data-recycle-actions={isDeleted ? 'true' : undefined}>
          <a href={downloadUrl} target="_blank" rel="noreferrer" className={`${styles.actionButton} ${styles.previewButton}`}>
            <Icon name="eye" /> Preview
          </a>
          <a href={`${downloadUrl}?download=1`} className={`${styles.actionButton} ${styles.downloadButton}`}>
            <Icon name="download" /> Download
          </a>
          {isDeleted ? (
            <>
              <button type="button" className={styles.restoreButton} disabled={busy} onClick={() => void restoreDocument(document)}>
                <Icon name="restore" /> Restore
              </button>
              <button type="button" className={styles.trashButton} disabled={busy} onClick={() => requestDocumentDelete(document)} aria-label={`Permanently delete ${document.title}`}>
                <Icon name="trash" /> Delete
              </button>
            </>
          ) : (
            <>
              <button type="button" className={`${styles.actionButton} ${styles.editButton}`} disabled={busy} onClick={() => openEditModal(document)}>
                <Icon name="edit" /> Edit
              </button>
              <button type="button" className={styles.trashButton} disabled={busy} onClick={() => requestDocumentDelete(document)} aria-label={`Delete ${document.title}`}>
                <Icon name="trash" /> Delete
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
            <a href={initialReturnTo || '/documents'}>
              {initialReturnTo ? '← Back to asset' : 'View all documents'}
            </a>
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
            onClick={openFiltersModal}
            aria-expanded={showFilters}
            aria-haspopup="dialog"
            disabled={loading || loadFailed || !hasDocumentsInView}
          >
            <Icon name="filter" /> Filters
            {category !== 'all' ? <span className={styles.activeFilterText}>1 active</span> : null}
          </button>
          <button type="button" className={`${styles.headerButton} ${styles.primaryHeaderButton}`} onClick={openUploadModal} disabled={view === 'recycle-bin' || busy}>
            <Icon name="upload" /> Upload documents
          </button>
        </section>

        {showSummary && view === 'documents' && !loading && !loadFailed && summary.totalDocuments > 0 ? (
          <div id="document-vault-summary" className={styles.summaryCarousel} aria-label="Document Vault summary">
            <button
              type="button"
              className={`${styles.summaryNav} ${styles.summaryNavPrevious}`}
              onClick={() => scrollSummary(-1)}
              aria-label="Previous summary cards"
              data-tooltip="Previous"
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
              data-tooltip="Next"
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

      {modalMode && !showAssetPicker ? (
        <div className={`${styles.modalBackdrop} ${modalMode === 'upload' ? wizardStyles.overlay : ''}`} data-website-overlay onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section ref={modalRef} className={`${styles.modal} ${modalMode === 'upload' ? wizardStyles.dialog : ''}`} role="dialog" aria-modal="true" aria-labelledby="document-modal-title">
            <header className={`${styles.modalHeader} ${modalMode === 'upload' ? wizardStyles.header : ''}`}>
              <div className={modalMode === 'upload' ? wizardStyles.headerText : undefined}>
                <h2 id="document-modal-title">{modalMode === 'upload' ? 'Upload document' : 'Edit document'}</h2>
                <p>{modalMode === 'upload' ? 'Add files, details and links in three short steps.' : `Update the details and links for ${editingDocument?.fileName ?? 'this document'}.`}</p>
              </div>
              <button type="button" className={modalMode === 'upload' ? wizardStyles.closeButton : undefined} onClick={closeModal} disabled={busy} aria-label="Close dialog" data-modal-initial-focus="true"><Icon name="close" /></button>
            </header>

            <form onSubmit={submitDocument} className={styles.modalForm}>
              <div ref={modalMode === 'upload' ? uploadWizardBodyRef : undefined} className={`${styles.modalScroll} ${modalMode === 'upload' ? wizardStyles.body : ''}`}>
                {modalNotice ? (
                  <div className={styles.modalNotice} role="alert">
                    <Icon name="info" />
                    <span>{modalNotice.message}</span>
                    <button type="button" onClick={() => setModalNotice(null)} aria-label="Dismiss error"><Icon name="close" /></button>
                  </div>
                ) : null}

                {modalMode === 'upload' ? (
                  <>
                    <p className={wizardStyles.intro}>Complete one short step at a time. Your documents are uploaded on the final step.</p>
                    <ol className={`${styles.uploadSteps} ${wizardStyles.progress}`} aria-label="Upload progress">
                      {UPLOAD_STEPS.map((item) => (
                        <li
                          key={item.step}
                          className={`${wizardStyles.progressItem} ${item.step === uploadStep ? `${styles.uploadStepCurrent} ${wizardStyles.progressItemCurrent}` : item.step < uploadStep ? `${styles.uploadStepComplete} ${wizardStyles.progressItemComplete}` : ''}`}
                          aria-current={item.step === uploadStep ? 'step' : undefined}
                        >
                          <span>{item.step < uploadStep ? '✓' : item.step}</span>
                          <strong>{item.label}</strong>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : null}

                <div className={modalMode === 'upload' ? `${styles.uploadWizardPanel} ${wizardStyles.panel}` : undefined}>
                {modalMode === 'upload' ? (
                  <div className={wizardStyles.panelHeading}>
                    <span className={wizardStyles.panelNumber} aria-hidden="true">{uploadStep}</span>
                    <h3>{activeUploadStep.label}</h3>
                    <p>{activeUploadStep.description}</p>
                  </div>
                ) : null}
                <fieldset className={`${styles.modalFields} ${modalMode === 'upload' ? styles.uploadWizardFields : ''}`} disabled={busy}>
                {modalMode === 'upload' && uploadStep === 1 ? (
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
                ) : modalMode === 'edit' ? (
                  <div className={styles.currentFile}>
                    <Icon name="document" />
                    <div><strong>{editingDocument?.fileName}</strong><span>{formatBytes(editingDocument?.byteSize ?? 0)} · Original file stays unchanged</span></div>
                  </div>
                ) : null}

                {modalMode === 'edit' || uploadStep === 2 ? <div className={styles.formGrid}>
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
                        <DropdownOverlay id="document-type-options" className={styles.documentTypeOptions} role="listbox">
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
                        </DropdownOverlay>
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
                </div> : null}

                {modalMode === 'edit' || uploadStep === 3 ? (modalMode === 'upload' && initialAssetId ? (
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
                  <section className={styles.assetLinkSummary} aria-labelledby="linked-assets-heading">
                    <span className={styles.assetLinkSummaryIcon} aria-hidden="true"><Icon name="link" /></span>
                    <div>
                      <span>Optional · account-level by default</span>
                      <h3 id="linked-assets-heading">
                        {draft.assetIds.length
                          ? `${draft.assetIds.length} ${draft.assetIds.length === 1 ? 'asset' : 'assets'} selected`
                          : 'Keep at account level'}
                      </h3>
                      <p>
                        {draft.assetIds.length
                          ? selectedDraftAssets.map((asset) => asset.title).join(' · ') || 'Selected assets'
                          : selectedFiles.length > 1
                            ? 'You can link every document in this batch to the same assets.'
                            : 'Choose related assets only when this document belongs with them.'}
                      </p>
                    </div>
                    <button type="button" onClick={openAssetPickerModal} disabled={busy}>
                      {draft.assetIds.length ? 'Change assets' : 'Choose assets'}
                      <Icon name="chevron-right" />
                    </button>
                  </section>
                )) : null}
                </fieldset>
                </div>
              </div>

              <footer className={`${styles.modalFooter} ${modalMode === 'upload' ? wizardStyles.footer : ''}`}>
                <span className={styles.srOnly} role="status" aria-live="polite">
                  {uploadProgress ? `Uploading document ${uploadProgress.current} of ${uploadProgress.total}.` : ''}
                </span>
                <button
                  type="button"
                  className={`${styles.cancelButton} ${modalMode === 'upload' ? wizardStyles.secondaryAction : ''}`}
                  disabled={busy}
                  onClick={modalMode === 'upload' && uploadStep > 1 ? returnToPreviousUploadStep : closeModal}
                >
                  {modalMode === 'upload' && uploadStep > 1 ? <><Icon name="chevron-left" /> Back</> : 'Cancel'}
                </button>
                <button type="submit" className={`${styles.uploadButton} ${modalMode === 'upload' ? wizardStyles.primaryAction : ''}`} disabled={busy}>
                  {busy
                    ? <span className={styles.buttonSpinner} />
                    : <Icon name={modalMode === 'upload' && uploadStep < 3 ? 'chevron-right' : modalMode === 'upload' ? 'upload' : 'edit'} />}
                  {uploadProgress
                    ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
                    : busy
                      ? 'Saving…'
                      : modalMode === 'upload'
                        ? uploadStep < 3
                          ? 'Continue'
                          : selectedFiles.length > 1 ? `Upload ${selectedFiles.length} documents` : 'Upload document'
                        : 'Save changes'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {showAssetPicker ? (
        <div
          className={`${styles.modalBackdrop} ${styles.assetPickerBackdrop}`} data-website-overlay
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeAssetPickerModal(false); }}
        >
          <section
            ref={assetPickerModalRef}
            className={styles.assetSelectionModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-picker-title"
            aria-describedby="asset-picker-description"
          >
            <header className={styles.assetSelectionHeader}>
              <h2 id="asset-picker-title">Choose assets</h2>
              <p id="asset-picker-description" className={styles.srOnly}>Select the assets these documents belong to, or leave the selection empty to keep them at account level.</p>
              <button type="button" onClick={() => closeAssetPickerModal(false)} aria-label="Close asset chooser"><Icon name="close" /></button>
            </header>

            <div className={styles.assetSelectionBody} data-asset-choice-surface="true">
              <div className={styles.assetSelectionToolbar} data-asset-choice-toolbar="true">
                <input
                  className={styles.assetSelectionSearch}
                  type="search"
                  value={assetSearch}
                  onChange={(event) => setAssetSearch(event.target.value)}
                  placeholder="Search..."
                  aria-label="Search assets"
                  data-modal-initial-focus="true"
                />
                <div className={styles.assetSelectionToolbarActions}>
                  <button type="button" className={styles.cancelButton} onClick={selectAllFilteredAssets} disabled={!filteredAssets.length || allFilteredAssetsSelected}>
                    Select all
                  </button>
                  <button type="button" className={styles.cancelButton} onClick={clearSelectedAssets} disabled={!draft.assetIds.length}>
                    Clear
                  </button>
                </div>
              </div>

              {showAssetPicker && assets.length ? (
                <div className={styles.assetSelectionList} data-asset-choice-list="true">
                  {filteredAssets.length ? filteredAssets.map((asset) => {
                    const checked = draft.assetIds.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={`${styles.assetSelectionRow} ${checked ? styles.assetSelectionRowSelected : ''}`}
                        data-asset-choice-row="true"
                        data-asset-choice-selected={checked ? 'true' : undefined}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleAsset(asset.id)} />
                        <span className={styles.assetSelectionCheckbox} aria-hidden="true" />
                        <span className={styles.assetSelectionCopy} data-asset-choice-copy="true">
                          <strong>{asset.title}</strong>
                          <span data-asset-choice-meta="true">{asset.detail || asset.meta || 'No key details saved yet'}</span>
                          <small>{[asset.categoryLabel, asset.methodLabel].filter(Boolean).join(' · ') || 'Asset Register item'}</small>
                        </span>
                        <span className={styles.assetSelectionValue} data-asset-choice-value="true">
                          <strong>{formatAssetValue(asset.currentValue)}</strong>
                          <small>current value</small>
                        </span>
                      </label>
                    );
                  }) : <div className={styles.assetSelectionEmpty}>No assets match your search.</div>}
                </div>
              ) : (
                <div className={styles.assetSelectionEmpty}>No assets are available yet. These documents will stay at account level.</div>
              )}
            </div>

            <footer className={styles.assetSelectionFooter}>
              <span className={styles.srOnly} role="status" aria-live="polite">
                {draft.assetIds.length
                  ? `${draft.assetIds.length} ${draft.assetIds.length === 1 ? 'asset selected' : 'assets selected'}`
                  : 'Account-level document'}
              </span>
              <button type="button" className={styles.cancelButton} onClick={() => closeAssetPickerModal(false)}>Cancel</button>
              <button type="button" className={styles.uploadButton} onClick={() => closeAssetPickerModal(true)}>
                {draft.assetIds.length
                  ? `Done · ${draft.assetIds.length} selected`
                  : 'Done · Account level'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {showFilters ? (
        <div className={styles.modalBackdrop} data-website-overlay onMouseDown={(event) => { if (event.target === event.currentTarget) setShowFilters(false); }}>
          <section ref={filterModalRef} className={styles.filterModal} role="dialog" aria-modal="true" aria-labelledby="document-filter-title">
            <header className={`${styles.modalHeader} ${styles.compactModalHeader}`}>
              <div>
                <h2 id="document-filter-title">Filter documents</h2>
                <p>Choose one category to narrow down your Document Vault.</p>
              </div>
              <button type="button" onClick={() => setShowFilters(false)} aria-label="Close filters" data-modal-initial-focus="true"><Icon name="close" /></button>
            </header>

            <div className={styles.filterModalBody}>
              <button
                type="button"
                className={`${styles.filterOption} ${styles.filterOptionAll} ${category === 'all' ? styles.filterOptionActive : ''}`}
                aria-pressed={category === 'all'}
                onClick={() => setCategory('all')}
              >
                <span>All documents</span>
                <strong>{documents.length}</strong>
              </button>
              <div className={styles.filterOptionGrid}>
                {CATEGORY_OPTIONS.map((option) => {
                  const count = documents.filter((document) => document.category === option.value).length;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      className={`${styles.filterOption} ${category === option.value ? styles.filterOptionActive : ''}`}
                      aria-pressed={category === option.value}
                      onClick={() => setCategory(option.value)}
                    >
                      <span>{option.label}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" className={styles.cancelButton} disabled={category === 'all'} onClick={() => setCategory('all')}>Clear filter</button>
              <button type="button" className={styles.uploadButton} onClick={() => setShowFilters(false)}>Done</button>
            </footer>
          </section>
        </div>
      ) : null}

      {documentPendingDelete ? (
        <div className={styles.modalBackdrop} data-website-overlay onMouseDown={(event) => { if (event.target === event.currentTarget && !busyRef.current) setDocumentPendingDelete(null); }}>
          <section ref={deleteModalRef} className={styles.confirmationModal} role="dialog" aria-modal="true" aria-labelledby="document-delete-title">
            <header className={`${styles.modalHeader} ${styles.compactModalHeader}`}>
              <div>
                <h2 id="document-delete-title">
                  {view === 'recycle-bin'
                    ? 'Are you sure you want to permanently delete this document?'
                    : 'Are you sure you want to delete this document?'}
                </h2>
              </div>
              <button type="button" onClick={() => setDocumentPendingDelete(null)} disabled={busy} aria-label="Close delete confirmation" data-modal-initial-focus="true"><Icon name="close" /></button>
            </header>

            <div className={styles.confirmationBody}>
              {modalNotice ? (
                <div className={styles.modalNotice} role="alert">
                  <Icon name="info" />
                  <span>{modalNotice.message}</span>
                  <button type="button" onClick={() => setModalNotice(null)} aria-label="Dismiss error"><Icon name="close" /></button>
                </div>
              ) : null}
              <p>
                {view === 'recycle-bin'
                  ? 'This cannot be undone. The document file, details and asset links will be permanently removed.'
                  : 'The document will move to the Recycle Bin and can be restored for 90 days.'}
              </p>
              <div className={styles.selectedDocumentCard}>
                <span>Selected document</span>
                <strong>{documentPendingDelete.title}</strong>
                <p>
                  {documentPendingDelete.fileName} · {getAccountDocumentTypeLabel(documentPendingDelete.documentType) ?? categoryLabel(documentPendingDelete.category)} · {formatBytes(documentPendingDelete.byteSize)}
                </p>
                <small>
                  {documentPendingDelete.assetLinks.length
                    ? `Linked to ${documentPendingDelete.assetLinks.map((asset) => asset.title).join(', ')}`
                    : 'Account-level document'}
                </small>
              </div>
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" className={styles.cancelButton} disabled={busy} onClick={() => setDocumentPendingDelete(null)}>Cancel</button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busy}
                onClick={() => void (view === 'recycle-bin' ? permanentlyDeleteDocument() : moveToRecycleBin())}
              >
                {busy ? <span className={styles.buttonSpinner} /> : <Icon name="trash" />}
                {busy
                  ? view === 'recycle-bin' ? 'Permanently deleting…' : 'Deleting…'
                  : view === 'recycle-bin' ? 'Yes, permanently delete' : 'Yes, delete document'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

