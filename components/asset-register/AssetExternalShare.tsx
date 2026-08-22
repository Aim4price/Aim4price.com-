'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  buildEmailShareUrl,
  buildExternalAssetShareCopy,
  buildWhatsAppShareUrl,
  type ExternalAssetShareItem,
} from '../../lib/asset-external-share';
import {
  createExternalShareArchive,
  fetchExternalShareFile,
  formatExternalShareFileSize,
  type ExternalShareFileSource,
} from '../../lib/external-file-share';
import styles from './AssetExternalShare.module.css';

export type { ExternalShareFileSource } from '../../lib/external-file-share';

type IconProps = { className?: string };
type FileShareTarget = 'files' | 'email' | 'whatsapp';

const MAX_SHARE_FILES = 12;
const MAX_SHARE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SHARE_TOTAL_BYTES = 75 * 1024 * 1024;
const FILE_INPUT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp';

function Aim4priceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 19V7l8-4 8 4v12" />
      <path d="M8 19v-7h8v7" />
      <path d="M3 19h18" />
      <path d="M9 8h6" />
    </svg>
  );
}

function OutsideIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.6 6.8-4.2" />
      <path d="m8.6 13.4 6.8 4.2" />
    </svg>
  );
}

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20.5 11.7a8.45 8.45 0 0 1-12.45 7.45L3 20.5l1.4-4.65A8.5 8.5 0 1 1 20.5 11.7Z" />
      <path fill="currentColor" stroke="none" d="M8.05 6.95c.3-.14.66-.01.8.29l1.27 2.72c.11.24.05.52-.14.7l-1.05.98a8.25 8.25 0 0 0 3.43 3.43l.98-1.05c.18-.19.46-.25.7-.14l2.72 1.27c.3.14.43.5.29.8l-.72 1.56c-.13.27-.42.43-.72.39-5.08-.67-8.84-4.43-9.51-9.51-.04-.3.12-.59.39-.72Z" />
    </svg>
  );
}

function EmailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ReportsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 17v-3M12 17v-5M15 17v-7" />
    </svg>
  );
}

function PaperclipIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m20.5 11.5-8.1 8.1a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 1 1 5.7 5.7l-8.7 8.7a2 2 0 1 1-2.8-2.8l8.1-8.1" />
    </svg>
  );
}

function ShareFilesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function slugFileName(value: string): string {
  return String(value || 'aim4price-asset')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'aim4price-asset';
}

function photoExtension(url: string): string {
  const pathname = (() => {
    try {
      return new URL(url, 'https://www.aim4price.com').pathname;
    } catch {
      return '';
    }
  })();
  const extension = /\.(jpe?g|png|webp)$/i.exec(pathname)?.[1]?.toLowerCase();
  return extension === 'jpeg' ? 'jpg' : extension || 'jpg';
}

function photoContentType(extension: string): string {
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function credentialsForUrl(url: string): RequestCredentials {
  if (typeof window === 'undefined') return 'include';
  try {
    return new URL(url, window.location.href).origin === window.location.origin ? 'include' : 'omit';
  } catch {
    return 'include';
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function localFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function AssetShareDestinationPicker({
  onInside,
  onOutside,
  disabled = false,
}: {
  onInside: () => void;
  onOutside: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.destinationGrid}>
      <button type="button" className={`${styles.destinationCard} ${styles.destinationCardInside}`} onClick={onInside} disabled={disabled}>
        <span className={styles.destinationIcon}><Aim4priceIcon /></span>
        <span className={styles.destinationCopy}>
          <strong>Inside Aim4price</strong>
          <small>Share securely with a finance, insurance, dealer or licence-renewal account.</small>
        </span>
        <span className={styles.destinationArrow} aria-hidden="true">›</span>
      </button>

      <button type="button" className={`${styles.destinationCard} ${styles.destinationCardOutside}`} onClick={onOutside} disabled={disabled}>
        <span className={styles.destinationIcon}><OutsideIcon /></span>
        <span className={styles.destinationCopy}>
          <strong>Outside Aim4price</strong>
          <small>Send actual photos, reports and documents through WhatsApp, email or another app.</small>
        </span>
        <span className={styles.destinationArrow} aria-hidden="true">›</span>
      </button>
    </div>
  );
}

export default function AssetExternalShare({
  shareName,
  assets,
  reportFiles = [],
  loadDocumentFiles,
  onOpenReportsAndDocuments,
}: {
  shareName: string;
  assets: ExternalAssetShareItem[];
  reportFiles?: ExternalShareFileSource[];
  loadDocumentFiles?: () => Promise<ExternalShareFileSource[]>;
  onOpenReportsAndDocuments: () => void;
}) {
  const [view, setView] = useState<'overview' | 'choose-files' | 'ready'>('overview');
  const [preferredTarget, setPreferredTarget] = useState<FileShareTarget>('files');
  const [copyStatus, setCopyStatus] = useState('');
  const [documentFiles, setDocumentFiles] = useState<ExternalShareFileSource[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [preparedFiles, setPreparedFiles] = useState<File[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState({ complete: 0, total: 0 });
  const [fileStatus, setFileStatus] = useState('');
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filePickerHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const readyHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const copy = useMemo(() => buildExternalAssetShareCopy(shareName, assets), [assets, shareName]);
  const whatsappHref = useMemo(() => buildWhatsAppShareUrl(copy), [copy]);
  const emailHref = useMemo(() => buildEmailShareUrl(copy), [copy]);
  const previewPhotos = useMemo(
    () => assets.flatMap((asset) => asset.photoUrls.slice(0, 1).map((url) => ({ url, title: asset.title }))).slice(0, 4),
    [assets],
  );
  const photoFiles = useMemo<ExternalShareFileSource[]>(() => assets.flatMap((asset, assetIndex) => (
    asset.photoUrls.map((url, photoIndex) => {
      const extension = photoExtension(url);
      return {
        id: `photo:${assetIndex}:${photoIndex}:${url}`,
        kind: 'photo',
        label: `${asset.title} · Photo ${photoIndex + 1}`,
        description: 'Saved asset photo',
        fileName: `${slugFileName(asset.title)}-photo-${photoIndex + 1}.${extension}`,
        contentType: photoContentType(extension),
        credentials: credentialsForUrl(url),
        url,
      };
    })
  )), [assets]);
  const allRemoteFiles = useMemo(
    () => [...photoFiles, ...reportFiles, ...documentFiles],
    [documentFiles, photoFiles, reportFiles],
  );
  const selectedRemoteFiles = useMemo(
    () => allRemoteFiles.filter((file) => selectedFileIds.has(file.id)),
    [allRemoteFiles, selectedFileIds],
  );
  const selectedFileCount = selectedRemoteFiles.length + localFiles.length;
  const savedPhotoCount = photoFiles.length;
  const knownLocalBytes = localFiles.reduce((total, file) => total + file.size, 0);
  const preparedBytes = preparedFiles.reduce((total, file) => total + file.size, 0);
  const canPrepare = selectedFileCount > 0
    && selectedFileCount <= MAX_SHARE_FILES
    && knownLocalBytes <= MAX_SHARE_TOTAL_BYTES
    && localFiles.every((file) => file.size <= MAX_SHARE_FILE_BYTES);
  const canSharePreparedFiles = useMemo(() => {
    if (!preparedFiles.length || typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
    try {
      return navigator.canShare({ files: preparedFiles });
    } catch {
      return false;
    }
  }, [preparedFiles]);

  useEffect(() => {
    if (view === 'overview') return undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      (view === 'choose-files' ? filePickerHeadingRef.current : readyHeadingRef.current)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [view]);

  async function copyDetails() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copy.body);
        setCopyStatus('Message copied.');
        window.setTimeout(() => setCopyStatus(''), 2200);
        return;
      }
      window.prompt('Copy these asset details', copy.body);
      setCopyStatus('Message ready to copy.');
    } catch {
      window.prompt('Copy these asset details', copy.body);
      setCopyStatus('Message ready to copy.');
    }
  }

  function clearPreparedFiles() {
    setPreparedFiles([]);
    setFileStatus('');
    setFileError('');
  }

  async function loadSavedDocuments() {
    if (!loadDocumentFiles || documentsLoaded || isLoadingDocuments) return;
    setIsLoadingDocuments(true);
    setDocumentError('');
    try {
      const loaded = await loadDocumentFiles();
      setDocumentFiles(loaded);
      setDocumentsLoaded(true);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Saved documents could not be loaded.');
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  function openFilePicker(target: FileShareTarget) {
    setPreferredTarget(target);
    setView('choose-files');
    setSelectedFileIds(new Set(photoFiles.map((file) => file.id)));
    clearPreparedFiles();
    void loadSavedDocuments();
  }

  function toggleRemoteFile(fileId: string) {
    clearPreparedFiles();
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function selectFilesByKind(kind: ExternalShareFileSource['kind'], select: boolean) {
    clearPreparedFiles();
    setSelectedFileIds((current) => {
      const next = new Set(current);
      allRemoteFiles.filter((file) => file.kind === kind).forEach((file) => {
        if (select) next.add(file.id);
        else next.delete(file.id);
      });
      return next;
    });
  }

  function addLocalFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!incoming.length) return;
    clearPreparedFiles();
    setLocalFiles((current) => {
      const seen = new Set(current.map(localFileKey));
      return [...current, ...incoming.filter((file) => !seen.has(localFileKey(file)))];
    });
  }

  function removeLocalFile(file: File) {
    clearPreparedFiles();
    const key = localFileKey(file);
    setLocalFiles((current) => current.filter((candidate) => localFileKey(candidate) !== key));
  }

  async function prepareSelectedFiles() {
    if (!canPrepare || isPreparing) return;
    setIsPreparing(true);
    setFileError('');
    setFileStatus('');
    setPreparationProgress({ complete: 0, total: selectedRemoteFiles.length });

    try {
      const fetchedFiles: Array<File | undefined> = Array(selectedRemoteFiles.length);
      const failures: string[] = [];
      let cursor = 0;
      let completed = 0;
      const workerCount = Math.min(3, selectedRemoteFiles.length);

      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (cursor < selectedRemoteFiles.length) {
          const sourceIndex = cursor;
          const source = selectedRemoteFiles[sourceIndex];
          cursor += 1;
          try {
            const file = await fetchExternalShareFile(source);
            if (!file.size) throw new Error('The file is empty.');
            if (file.size > MAX_SHARE_FILE_BYTES) throw new Error('The file is larger than 25 MB.');
            fetchedFiles[sourceIndex] = file;
          } catch {
            failures.push(source.label);
          } finally {
            completed += 1;
            setPreparationProgress({ complete: completed, total: selectedRemoteFiles.length });
          }
        }
      }));

      if (failures.length) {
        throw new Error(`Could not prepare ${failures.length === 1 ? failures[0] : `${failures.length} selected files`}. Nothing has been shared.`);
      }

      const readyFiles = [...fetchedFiles.filter((file): file is File => Boolean(file)), ...localFiles];
      const totalBytes = readyFiles.reduce((total, file) => total + file.size, 0);
      if (totalBytes > MAX_SHARE_TOTAL_BYTES) {
        throw new Error('This package is larger than 75 MB. Remove a few files and prepare it again.');
      }

      setPreparedFiles(readyFiles);
      setView('ready');
      setFileStatus(`${readyFiles.length} ${readyFiles.length === 1 ? 'file' : 'files'} ready · ${formatExternalShareFileSize(totalBytes)}`);
    } catch (error) {
      setPreparedFiles([]);
      setFileError(error instanceof Error ? error.message : 'The selected files could not be prepared.');
    } finally {
      setIsPreparing(false);
    }
  }

  async function sharePreparedFiles() {
    if (!canSharePreparedFiles || !preparedFiles.length) return;
    setFileError('');
    try {
      await navigator.share({ title: copy.subject, text: copy.body, files: preparedFiles });
      setFileStatus('Files handed to your selected app.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setFileStatus('Share cancelled. Your files are still ready.');
        return;
      }
      setFileError(error instanceof Error ? error.message : 'The files could not be shared from this browser.');
    }
  }

  async function downloadPreparedFiles() {
    if (!preparedFiles.length) return;
    setFileError('');
    try {
      if (preparedFiles.length === 1) {
        downloadBlob(preparedFiles[0], preparedFiles[0].name);
      } else {
        const archive = await createExternalShareArchive(preparedFiles);
        downloadBlob(archive, `${slugFileName(shareName)}-files.zip`);
      }
      setFileStatus(`${preparedFiles.length === 1 ? 'File' : 'ZIP package'} downloaded. Attach it in WhatsApp or your email.`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'The selected files could not be downloaded.');
    }
  }

  if (view === 'choose-files') {
    const selectedPhotoCount = photoFiles.filter((file) => selectedFileIds.has(file.id)).length;
    const selectedReportCount = reportFiles.filter((file) => selectedFileIds.has(file.id)).length;
    const selectedDocumentCount = documentFiles.filter((file) => selectedFileIds.has(file.id)).length;

    return (
      <section className={styles.filePickerPanel} aria-labelledby="external-file-picker-title">
        <div className={styles.filePickerHeader}>
          <div>
            <span>Actual attachments</span>
            <h4 ref={filePickerHeadingRef} id="external-file-picker-title" tabIndex={-1}>Choose files to share</h4>
            <p>Select several photos, reports or documents. Saved documents start unselected to protect private files.</p>
          </div>
          <button type="button" className={styles.doneButton} onClick={() => setView('overview')}>Done</button>
        </div>

        <div className={styles.targetHint}>
          {preferredTarget === 'whatsapp' ? <WhatsAppIcon /> : preferredTarget === 'email' ? <EmailIcon /> : <ShareFilesIcon />}
          <span>
            <strong>{preferredTarget === 'whatsapp' ? 'WhatsApp files' : preferredTarget === 'email' ? 'Email attachments' : 'Share package'}</strong>
            <small>After preparation, choose WhatsApp, Mail or another installed app from your device share menu.</small>
          </span>
        </div>

        <div className={styles.filePickerSections}>
          <fieldset className={styles.fileSection}>
            <legend>
              <span><strong>Photos</strong><small>{selectedPhotoCount} of {photoFiles.length} selected</small></span>
              {photoFiles.length ? <button type="button" onClick={() => selectFilesByKind('photo', selectedPhotoCount !== photoFiles.length)}>{selectedPhotoCount === photoFiles.length ? 'Clear' : 'Select all'}</button> : null}
            </legend>
            {photoFiles.length ? (
              <div className={styles.photoSelectionGrid}>
                {photoFiles.map((file) => (
                  <label key={file.id} className={`${styles.photoSelection} ${selectedFileIds.has(file.id) ? styles.fileSelected : ''}`}>
                    <input type="checkbox" checked={selectedFileIds.has(file.id)} onChange={() => toggleRemoteFile(file.id)} />
                    <img src={file.url} alt="" />
                    <span className={styles.selectionCheck}><CheckIcon /></span>
                    <small>{file.label}</small>
                  </label>
                ))}
              </div>
            ) : <div className={styles.emptyFiles}>No saved photos are available.</div>}
          </fieldset>

          <fieldset className={styles.fileSection}>
            <legend>
              <span><strong>Aim4price reports</strong><small>{selectedReportCount} of {reportFiles.length} selected</small></span>
              {reportFiles.length ? <button type="button" onClick={() => selectFilesByKind('report', selectedReportCount !== reportFiles.length)}>{selectedReportCount === reportFiles.length ? 'Clear' : 'Select all'}</button> : null}
            </legend>
            {reportFiles.length ? (
              <div className={styles.fileOptionList}>
                {reportFiles.map((file) => (
                  <label key={file.id} className={`${styles.fileOption} ${selectedFileIds.has(file.id) ? styles.fileSelected : ''}`}>
                    <input type="checkbox" checked={selectedFileIds.has(file.id)} onChange={() => toggleRemoteFile(file.id)} />
                    <span className={styles.fileOptionIcon}><ReportsIcon /></span>
                    <span><strong>{file.label}</strong><small>{file.description}</small></span>
                    <span className={styles.selectionCheck}><CheckIcon /></span>
                  </label>
                ))}
              </div>
            ) : <div className={styles.emptyFiles}>No direct report files are available for this selection.</div>}
            <button type="button" className={styles.reportStudioButton} onClick={onOpenReportsAndDocuments}>
              <ReportsIcon />
              <span><strong>Open report studio</strong><small>Create a custom PDF or filtered report, then add the saved file below.</small></span>
            </button>
          </fieldset>

          <fieldset className={styles.fileSection}>
            <legend>
              <span><strong>Saved documents</strong><small>{selectedDocumentCount} selected</small></span>
              {documentFiles.length ? <button type="button" onClick={() => selectFilesByKind('document', selectedDocumentCount !== documentFiles.length)}>{selectedDocumentCount === documentFiles.length ? 'Clear' : 'Select all'}</button> : null}
            </legend>
            {isLoadingDocuments ? <div className={styles.emptyFiles}>Loading saved documents…</div> : null}
            {documentError ? (
              <div className={styles.fileInlineError} role="alert"><span>{documentError}</span><button type="button" onClick={() => void loadSavedDocuments()}>Retry</button></div>
            ) : null}
            {!isLoadingDocuments && !documentError && documentFiles.length ? (
              <div className={styles.fileOptionList}>
                {documentFiles.map((file) => (
                  <label key={file.id} className={`${styles.fileOption} ${selectedFileIds.has(file.id) ? styles.fileSelected : ''}`}>
                    <input type="checkbox" checked={selectedFileIds.has(file.id)} onChange={() => toggleRemoteFile(file.id)} />
                    <span className={styles.fileOptionIcon}><PaperclipIcon /></span>
                    <span><strong>{file.label}</strong><small>{file.description}</small></span>
                    <span className={styles.selectionCheck}><CheckIcon /></span>
                  </label>
                ))}
              </div>
            ) : null}
            {!isLoadingDocuments && documentsLoaded && !documentFiles.length ? <div className={styles.emptyFiles}>No saved documents are linked to this selection.</div> : null}
          </fieldset>

          <section className={styles.localFileSection} aria-labelledby="add-local-files-title">
            <div><strong id="add-local-files-title">Add any file</strong><small>Choose several saved PDFs, spreadsheets, photos or documents from this device.</small></div>
            <input ref={fileInputRef} type="file" accept={FILE_INPUT_ACCEPT} multiple onChange={addLocalFiles} hidden />
            <button type="button" className={styles.addFilesButton} onClick={() => fileInputRef.current?.click()}><PaperclipIcon /> Add files</button>
            {localFiles.length ? (
              <div className={styles.localFileList}>
                {localFiles.map((file) => (
                  <span key={localFileKey(file)}>
                    <span><strong>{file.name}</strong><small>{formatExternalShareFileSize(file.size)}</small></span>
                    <button type="button" onClick={() => removeLocalFile(file)} aria-label={`Remove ${file.name}`}>×</button>
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className={styles.filePickerFooter}>
          <div className={styles.filePickerCount} role="status" aria-live="polite">
            <strong>{selectedFileCount} {selectedFileCount === 1 ? 'file' : 'files'} selected</strong>
            <small>Maximum {MAX_SHARE_FILES} files · 25 MB each · 75 MB total</small>
            {selectedFileCount > MAX_SHARE_FILES ? <span>Remove {selectedFileCount - MAX_SHARE_FILES} files to continue.</span> : null}
            {knownLocalBytes > MAX_SHARE_TOTAL_BYTES || localFiles.some((file) => file.size > MAX_SHARE_FILE_BYTES) ? <span>One or more added files exceeds the size limit.</span> : null}
            {fileError ? <span>{fileError}</span> : null}
          </div>
          <button type="button" className={styles.prepareButton} onClick={() => void prepareSelectedFiles()} disabled={!canPrepare || isPreparing}>
            <ShareFilesIcon />
            <span>{isPreparing ? `Preparing ${preparationProgress.complete} of ${preparationProgress.total}…` : `Prepare ${selectedFileCount || ''} ${selectedFileCount === 1 ? 'file' : 'files'}`}</span>
          </button>
        </div>
      </section>
    );
  }

  if (view === 'ready') {
    return (
      <section className={styles.readyPanel} aria-labelledby="external-files-ready-title">
        <div className={styles.readyHero}>
          <span className={styles.readyIcon}><CheckIcon /></span>
          <div><span>Ready to hand over</span><h4 ref={readyHeadingRef} id="external-files-ready-title" tabIndex={-1}>{preparedFiles.length} {preparedFiles.length === 1 ? 'file' : 'files'} prepared</h4><p>{formatExternalShareFileSize(preparedBytes)} · No private download links are sent to the recipient.</p></div>
          <button type="button" className={styles.doneButton} onClick={() => setView('overview')}>Done</button>
        </div>

        <div className={styles.readyLayout}>
          <div className={styles.readyFileList}>
            {preparedFiles.map((file, index) => (
              <span key={`${file.name}:${file.size}:${index}`}><span className={styles.readyFileIcon}><PaperclipIcon /></span><span><strong>{file.name}</strong><small>{file.type || 'File'} · {formatExternalShareFileSize(file.size)}</small></span></span>
            ))}
          </div>

          <div className={styles.readyActions}>
            {canSharePreparedFiles ? (
              <button type="button" className={styles.nativeShareButton} onClick={() => void sharePreparedFiles()}><ShareFilesIcon /><span><strong>Share {preparedFiles.length} {preparedFiles.length === 1 ? 'file' : 'files'}</strong><small>Choose WhatsApp, Mail or another installed app</small></span></button>
            ) : (
              <div className={styles.unsupportedNotice}><strong>This browser cannot attach this file package directly.</strong><span>Download one ZIP, then attach it in WhatsApp or your email.</span></div>
            )}

            <button type="button" className={styles.downloadPackageButton} onClick={() => void downloadPreparedFiles()}><DownloadIcon /><span>{preparedFiles.length === 1 ? 'Download file' : 'Download one ZIP'}</span></button>
            <button type="button" className={styles.changeSelectionButton} onClick={() => setView('choose-files')}>Change selection</button>

            <div className={styles.messageOnlyActions}>
              <span>Message-only fallback</span>
              <a href={emailHref}><EmailIcon /> Email message</a>
              <a href={whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp message</a>
              <button type="button" onClick={() => void copyDetails()}><CopyIcon /> Copy message</button>
            </div>

            <div className={`${styles.readyStatus} ${fileError ? styles.readyStatusError : ''}`} role="status" aria-live="polite">{fileError || fileStatus || 'Choose Share files to hand the actual attachments to another app.'}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.externalPanel} aria-label="Share outside Aim4price">
      <div className={styles.externalIntro}>
        <div><span>Ready to send</span><h4>{assets.length === 1 ? assets[0]?.title : shareName}</h4><p>The message includes serial, year, usage, condition, replacement price and current value. Photos are sent as actual attachments, not links. You can add several reports and documents too.</p></div>
        <span className={styles.photoCount}>{savedPhotoCount} {savedPhotoCount === 1 ? 'photo' : 'photos'}</span>
      </div>

      <div className={styles.externalLayout}>
        <div className={styles.previewColumn}>
          {previewPhotos.length ? (
            <div className={`${styles.photoGrid} ${previewPhotos.length === 1 ? styles.photoGridSingle : ''}`}>{previewPhotos.map((photo, index) => <img key={`${photo.url}-${index}`} src={photo.url} alt={`${photo.title} share preview`} />)}</div>
          ) : (
            <div className={styles.noPhotos}><OutsideIcon /><strong>No photos saved</strong><span>The rest of the asset details can still be shared.</span></div>
          )}
          <div className={styles.deliveryNote}><strong>What the recipient gets</strong><span>A neatly typed message plus the photos, reports and documents you select as actual files.</span></div>
        </div>

        <div className={styles.messageColumn}>
          <div className={styles.messageHeader}><span>Message preview</span><small>{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</small></div>
          <pre className={styles.messagePreview} tabIndex={0} aria-label="External asset details message preview">{copy.body}</pre>
        </div>
      </div>

      <div className={styles.externalActions}>
        <div className={styles.externalActionLead}><strong>Choose how to share</strong><span className={styles.copyStatus} role="status" aria-live="polite">{copyStatus || 'Files open through your device share menu, so you can choose the receiving app.'}</span></div>
        <div className={styles.externalActionButtons}>
          <button type="button" className={`${styles.actionButton} ${styles.reportsButton}`} onClick={() => openFilePicker('files')}><span className={styles.actionIcon}><ReportsIcon /></span><span className={styles.actionCopy}><strong>Photos &amp; files</strong><small>Select several reports or documents</small></span></button>
          <button type="button" className={`${styles.actionButton} ${styles.copyButton}`} onClick={() => void copyDetails()}><span className={styles.actionIcon}><CopyIcon /></span><span className={styles.actionCopy}><strong>Copy message</strong><small>Copy details without private links</small></span></button>
          <button type="button" className={`${styles.actionButton} ${styles.emailButton}`} onClick={() => openFilePicker('email')}><span className={styles.actionIcon}><EmailIcon /></span><span className={styles.actionCopy}><strong>Email</strong><small>Prepare real email attachments</small></span></button>
          <button type="button" className={`${styles.actionButton} ${styles.whatsappButton}`} onClick={() => openFilePicker('whatsapp')}><span className={styles.actionIcon}><WhatsAppIcon /></span><span className={styles.actionCopy}><strong>WhatsApp</strong><small>Prepare photos and files</small></span></button>
        </div>
      </div>
    </section>
  );
}
