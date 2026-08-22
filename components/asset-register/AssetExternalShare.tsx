'use client';

import { useMemo, useState } from 'react';
import {
  buildEmailShareUrl,
  buildExternalAssetShareCopy,
  buildWhatsAppShareUrl,
  type ExternalAssetShareItem,
} from '../../lib/asset-external-share';
import styles from './AssetExternalShare.module.css';

type IconProps = { className?: string };

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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.2Z" />
      <path d="M8.2 7.8c.4 4 3.1 6.7 7.1 7.1" />
      <path d="m8.2 7.8 1.9-.4 1.1 2.5-1.1 1" />
      <path d="m15.3 14.9.4-1.9-2.5-1.1-1 1.1" />
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
          <small>Send the saved asset details and photos neatly through WhatsApp or email.</small>
        </span>
        <span className={styles.destinationArrow} aria-hidden="true">›</span>
      </button>
    </div>
  );
}

export default function AssetExternalShare({
  shareName,
  assets,
  onBack,
}: {
  shareName: string;
  assets: ExternalAssetShareItem[];
  onBack: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  const copy = useMemo(() => buildExternalAssetShareCopy(shareName, assets), [assets, shareName]);
  const whatsappHref = useMemo(() => buildWhatsAppShareUrl(copy), [copy]);
  const emailHref = useMemo(() => buildEmailShareUrl(copy), [copy]);
  const previewPhotos = useMemo(
    () => assets.flatMap((asset) => asset.photoUrls.slice(0, 1).map((url) => ({ url, title: asset.title }))).slice(0, 4),
    [assets],
  );
  const savedPhotoCount = assets.reduce((count, asset) => count + asset.photoUrls.length, 0);

  async function copyDetails() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copy.body);
        setCopyStatus('Details copied.');
        window.setTimeout(() => setCopyStatus(''), 2200);
        return;
      }

      window.prompt('Copy these asset details', copy.body);
      setCopyStatus('Details ready to copy.');
    } catch {
      window.prompt('Copy these asset details', copy.body);
      setCopyStatus('Details ready to copy.');
    }
  }

  return (
    <section className={styles.externalPanel} aria-label="Share outside Aim4price">
      <div className={styles.externalIntro}>
        <div>
          <span>Ready to send</span>
          <h4>{assets.length === 1 ? assets[0]?.title : shareName}</h4>
          <p>The message includes serial, year, usage, condition, replacement price and current value. Recipients can open the saved photos from the included Aim4price asset link.</p>
        </div>
        <span className={styles.photoCount}>{savedPhotoCount} {savedPhotoCount === 1 ? 'photo' : 'photos'}</span>
      </div>

      <div className={styles.externalLayout}>
        <div className={styles.previewColumn}>
          {previewPhotos.length ? (
            <div className={`${styles.photoGrid} ${previewPhotos.length === 1 ? styles.photoGridSingle : ''}`}>
              {previewPhotos.map((photo, index) => (
                <img key={`${photo.url}-${index}`} src={photo.url} alt={`${photo.title} share preview`} />
              ))}
            </div>
          ) : (
            <div className={styles.noPhotos}>
              <OutsideIcon />
              <strong>No photos saved</strong>
              <span>The rest of the asset details can still be shared.</span>
            </div>
          )}

          <div className={styles.deliveryNote}>
            <strong>What the recipient gets</strong>
            <span>A neatly typed message plus access to the saved photos.</span>
          </div>
        </div>

        <div className={styles.messageColumn}>
          <div className={styles.messageHeader}>
            <span>Message preview</span>
            <small>{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</small>
          </div>
          <pre className={styles.messagePreview}>{copy.body}</pre>
        </div>
      </div>

      <div className={styles.externalActions}>
        <button type="button" className={styles.backButton} onClick={onBack}>Back</button>
        <span className={styles.copyStatus} role="status" aria-live="polite">{copyStatus}</span>
        <button type="button" className={styles.copyButton} onClick={() => void copyDetails()}>
          <CopyIcon />
          <span>Copy details</span>
        </button>
        <a className={styles.emailButton} href={emailHref}>
          <EmailIcon />
          <span>Email</span>
        </a>
        <a className={styles.whatsappButton} href={whatsappHref} target="_blank" rel="noreferrer">
          <WhatsAppIcon />
          <span>WhatsApp</span>
        </a>
      </div>
    </section>
  );
}
