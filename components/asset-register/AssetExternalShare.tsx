'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildEmailShareUrl,
  buildExternalAssetShareCopy,
  buildWhatsAppShareUrl,
  type ExternalAssetShareItem,
} from '../../lib/asset-external-share';
import {
  createExternalShareFileCache,
  prepareExternalShareFiles,
  type ExternalShareFileSource,
} from '../../lib/external-file-share';
import styles from './AssetExternalShare.module.css';

export type { ExternalShareFileSource } from '../../lib/external-file-share';

type IconProps = { className?: string };
type ShareTarget = 'email' | 'whatsapp';
type AttachmentPreparation = {
  status: 'idle' | 'preparing' | 'ready' | 'error';
  files: File[];
  error: string;
};

const EMPTY_REPORT_FILES: ExternalShareFileSource[] = [];
const MAX_SHARE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SHARE_TOTAL_BYTES = 75 * 1024 * 1024;

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
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.892-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.892 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.3-1.654a11.882 11.882 0 0 0 5.69 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
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

function ReportsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 17v-3M12 17v-5M15 17v-7" />
    </svg>
  );
}

function PhotosIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 5-5 3.5 3.5 2.5-2.5 5 5" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" />
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

function photoShareUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://www.aim4price.com');
    if (!parsed.pathname.startsWith('/api/asset-register/uploads/')) return url;
    parsed.searchParams.set('share', '1');
    // Always fetch internal uploads from the current app origin. Normal image
    // requests may redirect to object storage, whose CORS policy is not part of
    // the native file-sharing contract.
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function credentialsForUrl(url: string): RequestCredentials {
  if (typeof window === 'undefined') return 'include';
  try {
    return new URL(url, window.location.href).origin === window.location.origin ? 'include' : 'omit';
  } catch {
    return 'include';
  }
}

function attachmentSummary(photoCount: number, reportCount: number): string {
  const parts = [
    photoCount ? `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : '',
    reportCount ? `${reportCount} Aim4price ${reportCount === 1 ? 'report' : 'reports'}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' and ') : 'No attachments selected';
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
          <small>Share with an Aim4price partner.</small>
        </span>
        <span className={styles.destinationArrow} aria-hidden="true">›</span>
      </button>

      <button type="button" className={`${styles.destinationCard} ${styles.destinationCardOutside}`} onClick={onOutside} disabled={disabled}>
        <span className={styles.destinationIcon}><OutsideIcon /></span>
        <span className={styles.destinationCopy}>
          <strong>Outside Aim4price</strong>
          <small>Send by WhatsApp or email.</small>
        </span>
        <span className={styles.destinationArrow} aria-hidden="true">›</span>
      </button>
    </div>
  );
}

export default function AssetExternalShare({
  shareName,
  assets,
  reportFiles = EMPTY_REPORT_FILES,
  onAddAim4priceReport,
  onRemoveAim4priceReport,
}: {
  shareName: string;
  assets: ExternalAssetShareItem[];
  reportFiles?: ExternalShareFileSource[];
  onAddAim4priceReport: () => void;
  onRemoveAim4priceReport: (reportId: string) => void;
}) {
  const [includePhotos, setIncludePhotos] = useState(false);
  const [preparationAttempt, setPreparationAttempt] = useState(0);
  const [sendingTarget, setSendingTarget] = useState<ShareTarget | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const [preparation, setPreparation] = useState<AttachmentPreparation>({
    status: 'idle',
    files: [],
    error: '',
  });
  const [attachmentFileCache] = useState(() => createExternalShareFileCache());

  const photoFiles = useMemo<ExternalShareFileSource[]>(() => assets.flatMap((asset, assetIndex) => (
    asset.photoUrls.map((url, photoIndex) => {
      const extension = photoExtension(url);
      const preparedUrl = photoShareUrl(url);
      return {
        id: `photo:${assetIndex}:${photoIndex}:${url}`,
        kind: 'photo',
        label: `${asset.title} photo ${photoIndex + 1}`,
        description: 'Saved asset photo',
        fileName: `${slugFileName(asset.title)}-photo-${photoIndex + 1}.${extension}`,
        contentType: photoContentType(extension),
        credentials: credentialsForUrl(preparedUrl),
        url: preparedUrl,
      };
    })
  )), [assets]);
  const savedPhotoCount = photoFiles.length;
  const selectedPhotoCount = includePhotos ? savedPhotoCount : 0;
  const selectedSources = useMemo(
    () => [...(includePhotos ? photoFiles : []), ...reportFiles],
    [includePhotos, photoFiles, reportFiles],
  );
  const selectedSourceSignature = selectedSources
    .map((source) => `${source.id}:${source.url}:${source.fileName}`)
    .join('|');
  const copy = useMemo(
    () => buildExternalAssetShareCopy(shareName, assets, {
      attachedPhotoCount: selectedPhotoCount,
      attachedReportCount: reportFiles.length,
    }),
    [assets, reportFiles.length, selectedPhotoCount, shareName],
  );
  const whatsappHref = useMemo(() => buildWhatsAppShareUrl(copy), [copy]);
  const emailHref = useMemo(() => buildEmailShareUrl(copy), [copy]);
  const selectedAttachmentCount = selectedSources.length;
  const isPreparing = preparation.status === 'preparing';
  const isSending = sendingTarget !== null;

  useEffect(() => {
    let cancelled = false;

    if (!selectedSources.length) {
      setPreparation({ status: 'idle', files: [], error: '' });
      return () => {
        cancelled = true;
      };
    }

    setPreparation({ status: 'preparing', files: [], error: '' });

    void prepareExternalShareFiles(selectedSources, attachmentFileCache)
      .then((files) => {
        if (cancelled) return;
        const oversized = files.find((file) => file.size > MAX_SHARE_FILE_BYTES);
        if (oversized) {
          throw new Error(`“${oversized.name}” is larger than 25 MB.`);
        }
        const totalBytes = files.reduce((total, file) => total + file.size, 0);
        if (totalBytes > MAX_SHARE_TOTAL_BYTES) {
          throw new Error('The selected attachments are larger than 75 MB in total.');
        }
        setPreparation({ status: 'ready', files, error: '' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPreparation({
          status: 'error',
          files: [],
          error: error instanceof Error ? error.message : 'The selected attachments could not be prepared.',
        });
      });

    return () => {
      cancelled = true;
    };
  // The signature deliberately keeps controlled arrays with identical files from refetching.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentFileCache, preparationAttempt, selectedSourceSignature]);

  function togglePhotos() {
    setIncludePhotos((current) => !current);
    setShareStatus('');
  }

  function removeReport(reportId: string) {
    onRemoveAim4priceReport(reportId);
    setShareStatus('');
  }

  async function sendShare(target: ShareTarget) {
    setShareStatus('');

    if (!selectedAttachmentCount) {
      if (target === 'email') {
        window.location.assign(emailHref);
      } else {
        window.open(whatsappHref, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    if (preparation.status === 'error') {
      setPreparationAttempt((current) => current + 1);
      setShareStatus('Trying to prepare the attachments again…');
      return;
    }

    if (preparation.status !== 'ready' || preparation.files.length !== selectedAttachmentCount) {
      setShareStatus('Please wait while the attachments finish preparing.');
      return;
    }

    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      setShareStatus('This browser cannot attach files. Turn off attachments to send the message, or use a device that supports file sharing.');
      return;
    }

    const shareData: ShareData = {
      files: preparation.files,
      title: copy.subject,
      text: copy.body,
    };
    let canSharePayload = false;
    try {
      // Validate the exact payload that will be sent. Some mobile browsers can
      // share files alone but cannot share a files-plus-message combination.
      canSharePayload = navigator.canShare(shareData);
    } catch {
      canSharePayload = false;
    }
    if (!canSharePayload) {
      setShareStatus('This device cannot send the message and selected attachments together. Nothing was sent.');
      return;
    }

    setSendingTarget(target);
    try {
      await navigator.share(shareData);
      setShareStatus(`${preparation.files.length} ${preparation.files.length === 1 ? 'attachment was' : 'attachments were'} handed to your phone together with the message.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setShareStatus('Sharing cancelled. Your message and attachments are still ready.');
      } else {
        setShareStatus(error instanceof Error ? error.message : 'The message and attachments could not be shared.');
      }
    } finally {
      setSendingTarget(null);
    }
  }

  const attachmentStatus = preparation.status === 'preparing'
    ? 'Preparing attachments…'
    : preparation.status === 'error'
      ? preparation.error
      : attachmentSummary(selectedPhotoCount, reportFiles.length);

  return (
    <section className={styles.externalPanel} aria-label="Share outside Aim4price">
      <div className={styles.shareContext}>
        <span>Ready to share</span>
        <strong>{assets.length === 1 ? assets[0]?.title : shareName}</strong>
        <small>{assets.length} {assets.length === 1 ? 'asset' : 'assets'} in one neatly formatted message</small>
      </div>

      <div className={styles.shareLayout}>
        <article className={styles.messageCard}>
          <div className={styles.sectionHeader}>
            <span>Message preview</span>
            <small>Sent as one message</small>
          </div>
          <pre className={styles.messagePreview} tabIndex={0} aria-label="External asset details message preview">{copy.body}</pre>
        </article>

        <aside className={styles.attachmentsCard} aria-labelledby="optional-attachments-title">
          <div className={styles.attachmentsHeader}>
            <div>
              <span>Optional attachments</span>
              <h4 id="optional-attachments-title">Add only what you need</h4>
            </div>
            <span className={styles.attachmentCount}>{selectedAttachmentCount}</span>
          </div>

          <label className={`${styles.photoToggle} ${includePhotos ? styles.photoToggleSelected : ''} ${!savedPhotoCount ? styles.photoToggleDisabled : ''}`}>
            <input type="checkbox" checked={includePhotos} onChange={togglePhotos} disabled={!savedPhotoCount} />
            <span className={styles.attachmentIcon}><PhotosIcon /></span>
            <span className={styles.attachmentCopy}>
              <strong>Include saved photos</strong>
              <small>{savedPhotoCount ? `${savedPhotoCount} available · Off by default` : 'No saved photos available'}</small>
            </span>
            <span className={styles.toggleControl} aria-hidden="true"><span><CheckIcon /></span></span>
          </label>

          <button type="button" className={styles.addReportButton} onClick={onAddAim4priceReport}>
            <span className={styles.attachmentIcon}><ReportsIcon /></span>
            <span className={styles.attachmentCopy}>
              <strong>{reportFiles.length ? 'Add another Aim4price report' : 'Add Aim4price report'}</strong>
              <small>Use the normal Aim4price report flow</small>
            </span>
            <span className={styles.addReportArrow} aria-hidden="true">›</span>
          </button>

          {reportFiles.length ? (
            <div className={styles.attachedReports} aria-label="Attached Aim4price reports">
              {reportFiles.map((report) => (
                <div key={report.id} className={styles.attachedReport}>
                  <span className={styles.reportFileIcon}><ReportsIcon /></span>
                  <span><strong>{report.label}</strong><small>{report.fileName}</small></span>
                  <button type="button" onClick={() => removeReport(report.id)} aria-label={`Remove ${report.label}`}><CloseIcon /></button>
                </div>
              ))}
            </div>
          ) : null}

          <div className={`${styles.attachmentStatus} ${preparation.status === 'error' ? styles.attachmentStatusError : ''}`} role="status" aria-live="polite">
            {attachmentStatus}
          </div>
        </aside>
      </div>

      <footer className={styles.sendFooter}>
        <div className={styles.sendLead}>
          <strong>Send message</strong>
          <span>{selectedAttachmentCount
            ? 'Your phone will open its share menu with every selected attachment.'
            : 'Photos and reports stay private unless you add them above.'}</span>
          {shareStatus ? <small role="status" aria-live="polite">{shareStatus}</small> : null}
        </div>
        <div className={styles.sendButtons}>
          <button type="button" className={`${styles.sendButton} ${styles.emailButton}`} onClick={() => void sendShare('email')} disabled={isPreparing || isSending}>
            <span className={styles.sendIcon}><EmailIcon /></span>
            <span><strong>{sendingTarget === 'email' ? 'Opening…' : 'Send by email'}</strong><small>{selectedAttachmentCount ? 'Choose Email in the share menu' : 'Open a ready email'}</small></span>
          </button>
          <button type="button" className={`${styles.sendButton} ${styles.whatsappButton}`} onClick={() => void sendShare('whatsapp')} disabled={isPreparing || isSending}>
            <span className={styles.sendIcon}><WhatsAppIcon /></span>
            <span><strong>{sendingTarget === 'whatsapp' ? 'Opening…' : 'Send with WhatsApp'}</strong><small>{selectedAttachmentCount ? 'Choose WhatsApp in the share menu' : 'Open a ready chat'}</small></span>
          </button>
        </div>
      </footer>
    </section>
  );
}
