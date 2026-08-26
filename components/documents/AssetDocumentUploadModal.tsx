'use client';

import DropdownOverlay from '../DropdownOverlay';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  ACCOUNT_DOCUMENT_CATEGORY_LABELS,
  ACCOUNT_DOCUMENT_TYPES,
  getAccountDocumentType,
  type AccountDocumentCategory,
  type AccountDocumentType,
} from '../../lib/account-document-taxonomy';
import styles from './AssetDocumentUploadModal.module.css';

export type UploadedVaultDocument = {
  id: string;
  title: string;
  category: AccountDocumentCategory;
  documentType: AccountDocumentType | null;
  notes: string;
  expiryDate: string | null;
  fileName: string;
  contentType: string;
  byteSize: number;
  assetLinks: Array<{ id: string; title: string; meta: string }>;
  createdAtIso: string;
  updatedAtIso: string;
  deletedAtIso: string | null;
};

type UploadResponse = {
  ok?: boolean;
  document?: UploadedVaultDocument;
  error?: string;
};

type AssetDocumentUploadModalProps = {
  assetId: string;
  assetTitle: string;
  uploadEndpoint?: string;
  onClose: () => void;
  onUploaded: (
    documents: UploadedVaultDocument[],
    outcome: { complete: boolean; totalUploaded: number },
  ) => void | Promise<void>;
};

const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_BYTES = 250 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'jpg', 'jpeg', 'png', 'webp',
]);

function cleanFileTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function isSupportedDocument(file: File): boolean {
  const extension = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  return ACCEPTED_EXTENSIONS.has(extension);
}

async function readUploadResponse(response: Response, fallback: string): Promise<UploadResponse> {
  try {
    const data = await response.json() as UploadResponse;
    return data && typeof data === 'object' ? data : { ok: false, error: fallback };
  } catch {
    return { ok: false, error: fallback };
  }
}

export default function AssetDocumentUploadModal({
  assetId,
  assetTitle,
  uploadEndpoint = '/api/documents',
  onClose,
  onUploaded,
}: AssetDocumentUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<AccountDocumentType | ''>('');
  const [documentTypeSearch, setDocumentTypeSearch] = useState('');
  const [showDocumentTypes, setShowDocumentTypes] = useState(false);
  const [activeDocumentTypeIndex, setActiveDocumentTypeIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLElement | null>(null);
  const typeComboboxRef = useRef<HTMLDivElement | null>(null);
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);
  const showDocumentTypesRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const totalUploadedRef = useRef(0);

  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const selectedType = useMemo(() => getAccountDocumentType(documentType), [documentType]);
  const filteredTypes = useMemo(() => {
    const query = documentTypeSearch.trim().toLowerCase();
    if (!query || documentType) return ACCOUNT_DOCUMENT_TYPES;
    return ACCOUNT_DOCUMENT_TYPES.filter((option) => [
      option.label,
      option.value,
      ACCOUNT_DOCUMENT_CATEGORY_LABELS[option.category],
      ...option.keywords,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [documentType, documentTypeSearch]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    showDocumentTypesRef.current = showDocumentTypes;
  }, [showDocumentTypes]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!showDocumentTypes) return undefined;

    const handleOutsideTypePointerDown = (event: PointerEvent) => {
      if (typeComboboxRef.current && event.composedPath().includes(typeComboboxRef.current)) return;
      showDocumentTypesRef.current = false;
      setShowDocumentTypes(false);
    };

    document.addEventListener('pointerdown', handleOutsideTypePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsideTypePointerDown);
  }, [showDocumentTypes]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => typeInputRef.current?.focus());

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showDocumentTypesRef.current) {
          event.preventDefault();
          setShowDocumentTypes(false);
          return;
        }
        if (!busyRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, []);

  function selectType(nextType: AccountDocumentType) {
    const option = getAccountDocumentType(nextType);
    if (!option) return;
    setDocumentType(option.value);
    setDocumentTypeSearch(option.label);
    setShowDocumentTypes(false);
    setActiveDocumentTypeIndex(0);
    setError('');
  }

  function changeTypeSearch(value: string) {
    setDocumentTypeSearch(value);
    setDocumentType('');
    setShowDocumentTypes(true);
    setActiveDocumentTypeIndex(0);
  }

  function handleTypeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && showDocumentTypes) {
      event.preventDefault();
      event.stopPropagation();
      showDocumentTypesRef.current = false;
      setShowDocumentTypes(false);
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && filteredTypes.length) {
      event.preventDefault();
      const wasOpen = showDocumentTypes;
      if (!showDocumentTypes) {
        showDocumentTypesRef.current = true;
        setShowDocumentTypes(true);
      }
      setActiveDocumentTypeIndex((current) => {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        if (!wasOpen) return direction === 1 ? 0 : filteredTypes.length - 1;
        return (current + direction + filteredTypes.length) % filteredTypes.length;
      });
      return;
    }
    if (event.key === 'Enter' && showDocumentTypes && filteredTypes.length) {
      event.preventDefault();
      selectType(filteredTypes[Math.min(activeDocumentTypeIndex, filteredTypes.length - 1)].value);
    }
  }

  function addFiles(nextFiles: File[]) {
    if (busy || !nextFiles.length) return;
    const unsupported = nextFiles.filter((file) => !isSupportedDocument(file));
    const empty = nextFiles.filter((file) => file.size <= 0);
    const oversized = nextFiles.filter((file) => file.size > MAX_FILE_BYTES);
    if (unsupported.length) {
      setError('Use PDF, Word, Excel, CSV, TXT, JPG, PNG or WEBP documents.');
      return;
    }
    if (empty.length) {
      setError('Empty files cannot be uploaded.');
      return;
    }
    if (oversized.length) {
      setError('Each document must be 25 MB or smaller.');
      return;
    }

    const unique = new Map(files.map((file) => [fileKey(file), file]));
    nextFiles.forEach((file) => unique.set(fileKey(file), file));
    const combined = Array.from(unique.values()).slice(0, MAX_FILES);
    const combinedBytes = combined.reduce((sum, file) => sum + file.size, 0);
    if (combinedBytes > MAX_BATCH_BYTES) {
      setError('The complete upload batch must be 250 MB or smaller.');
      return;
    }

    setFiles(combined);
    if (combined.length === 1 && !title.trim()) setTitle(cleanFileTitle(combined[0].name));
    if (combined.length !== 1) setTitle('');
    setError(nextFiles.length + files.length > MAX_FILES ? 'Only the first 20 documents were added.' : '');
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(target: File) {
    const remaining = files.filter((file) => fileKey(file) !== fileKey(target));
    setFiles(remaining);
    if (remaining.length === 1) setTitle(cleanFileTitle(remaining[0].name));
    if (!remaining.length || remaining.length > 1) setTitle('');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!files.length) {
      setError('Choose at least one document.');
      return;
    }
    if (!selectedType) {
      setError('Choose the document type before uploading.');
      typeInputRef.current?.focus();
      return;
    }
    if (files.length === 1 && !title.trim()) {
      setError('Add a clear document title.');
      return;
    }
    if (selectedType.value === 'other' && !notes.trim()) {
      setError('Describe the document in Notes when choosing Other document.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');
    const failed: Array<{ file: File; message: string }> = [];
    const uploaded: UploadedVaultDocument[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress({ current: index + 1, total: files.length });
      try {
        const form = new FormData();
        form.set('file', file);
        form.set('title', files.length === 1 ? title.trim() : cleanFileTitle(file.name) || file.name);
        form.set('documentType', selectedType.value);
        form.set('category', selectedType.category);
        form.set('notes', notes.trim());
        form.set('expiryDate', expiryDate);
        form.set('assetIds', JSON.stringify([assetId]));
        const response = await fetch(uploadEndpoint, { method: 'POST', body: form });
        const data = await readUploadResponse(response, `${file.name} could not be uploaded.`);
        if (!response.ok || !data.ok || !data.document) {
          throw new Error(data.error || `${file.name} could not be uploaded.`);
        }
        uploaded.push(data.document);
      } catch (uploadError) {
        failed.push({
          file,
          message: uploadError instanceof Error ? uploadError.message : `${file.name} could not be uploaded.`,
        });
      }
    }

    setProgress(null);
    totalUploadedRef.current += uploaded.length;
    if (failed.length) {
      let refreshMessage = '';
      if (uploaded.length) {
        try {
          await onUploaded(uploaded, { complete: false, totalUploaded: totalUploadedRef.current });
        } catch {
          refreshMessage = ' The saved documents may appear after reopening the card.';
        }
      }
      setFiles(failed.map((entry) => entry.file));
      if (failed.length === 1) setTitle(cleanFileTitle(failed[0].file.name));
      setError(`${uploaded.length} of ${files.length} uploaded. ${failed.length} remain ready to retry. ${failed[0].message}${refreshMessage}`);
      busyRef.current = false;
      setBusy(false);
      return;
    }

    try {
      await onUploaded(uploaded, { complete: true, totalUploaded: totalUploadedRef.current });
    } catch {
      setFiles([]);
      setError('The documents were saved, but this card could not refresh. Close and reopen it to see the latest files.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
    >
      <section ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="asset-document-modal-title">
        <header className={styles.header}>
          <div>
            <span>Documents Vault</span>
            <h2 id="asset-document-modal-title">Add documents</h2>
            <p>Choose a type, then upload directly to this asset’s document record.</p>
          </div>
          <button type="button" onClick={() => { if (!busyRef.current) onClose(); }} disabled={busy} aria-label="Close document upload">×</button>
        </header>

        <form onSubmit={submit}>
          <div className={styles.content}>
            {error ? <div className={styles.error} role="alert">{error}</div> : null}

            <div className={styles.assetBadge}>
              <span>Linked asset</span>
              <strong title={assetTitle}>{assetTitle}</strong>
              <small>This link cannot be removed during quick add.</small>
            </div>

            <div className={styles.field}>
              <label htmlFor="asset-document-type">Document type <b>*</b></label>
              <div ref={typeComboboxRef} className={styles.combobox}>
                <span aria-hidden="true">⌕</span>
                <input
                  ref={typeInputRef}
                  id="asset-document-type"
                  type="search"
                  value={documentTypeSearch}
                  onChange={(event) => changeTypeSearch(event.target.value)}
                  onFocus={() => {
                    showDocumentTypesRef.current = true;
                    setShowDocumentTypes(true);
                    setActiveDocumentTypeIndex(0);
                  }}
                  onKeyDown={handleTypeKeyDown}
                  placeholder="Search licence, insurance, invoice, service…"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showDocumentTypes}
                  aria-controls="asset-document-type-options"
                  aria-activedescendant={showDocumentTypes && filteredTypes[activeDocumentTypeIndex]
                    ? `asset-document-type-option-${filteredTypes[activeDocumentTypeIndex].value}`
                    : undefined}
                  aria-required="true"
                  aria-invalid={!selectedType && Boolean(error)}
                  required
                  autoComplete="off"
                />
                {documentType ? (
                  <button type="button" onClick={() => changeTypeSearch('')} aria-label="Clear document type">×</button>
                ) : null}
                {showDocumentTypes ? (
                  <DropdownOverlay id="asset-document-type-options" className={styles.options} role="listbox">
                    {filteredTypes.length ? filteredTypes.map((option, index) => (
                      <button
                        key={option.value}
                        id={`asset-document-type-option-${option.value}`}
                        type="button"
                        role="option"
                        aria-selected={documentType === option.value}
                        data-active={activeDocumentTypeIndex === index ? 'true' : undefined}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveDocumentTypeIndex(index)}
                        onClick={() => selectType(option.value)}
                      >
                        <span>{option.label}</span>
                        <small>{ACCOUNT_DOCUMENT_CATEGORY_LABELS[option.category]}</small>
                      </button>
                    )) : <p>No document types match that search.</p>}
                  </DropdownOverlay>
                ) : null}
              </div>
              {selectedType ? <small>Saved under {ACCOUNT_DOCUMENT_CATEGORY_LABELS[selectedType.category]}</small> : null}
            </div>

            <div
              className={`${styles.filePicker} ${files.length ? styles.filePickerSelected : ''} ${dragging ? styles.filePickerDragging : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                multiple
                onChange={handleFileChange}
                aria-label="Choose documents"
              />
              <div>
                <strong>{files.length ? `${files.length} ${files.length === 1 ? 'document' : 'documents'} ready` : 'Drop documents here or browse'}</strong>
                <span>Up to 20 files · 25 MB each · 250 MB per batch</span>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                {files.length ? 'Add more' : 'Browse files'}
              </button>
            </div>

            {files.length ? (
              <div className={styles.fileList} aria-label="Documents ready to upload">
                <header><strong>Ready to upload</strong><span>{formatBytes(totalBytes)}</span></header>
                {files.map((file) => (
                  <div key={fileKey(file)}>
                    <span><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
                    <button type="button" onClick={() => removeFile(file)} disabled={busy} aria-label={`Remove ${file.name}`}>×</button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className={styles.detailsGrid}>
              {files.length <= 1 ? (
                <label className={styles.field}>
                  <span>Document title <b>*</b></span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Clear document title" />
                </label>
              ) : null}
              <label className={styles.field}>
                <span>Expiry or renewal date <em>Optional</em></span>
                <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.notes}`}>
                <span>Notes {selectedType?.value === 'other' ? <b>*</b> : <em>Optional</em>}</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  maxLength={5000}
                  required={selectedType?.value === 'other'}
                  aria-required={selectedType?.value === 'other'}
                  aria-invalid={selectedType?.value === 'other' && !notes.trim() && Boolean(error)}
                  placeholder={selectedType?.value === 'other' ? 'Describe what this document is' : 'Reference number or useful context'}
                />
              </label>
            </div>
          </div>

          <footer className={styles.footer}>
            <span role="status" aria-live="polite">
              {progress ? `Uploading ${progress.current} of ${progress.total}` : ''}
            </span>
            <button type="button" className={styles.cancel} onClick={() => { if (!busyRef.current) onClose(); }} disabled={busy}>Cancel</button>
            <button type="submit" className={styles.submit} disabled={busy}>
              {progress ? `Uploading ${progress.current} of ${progress.total}…` : files.length > 1 ? `Upload ${files.length} documents` : 'Upload document'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
