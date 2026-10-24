'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { MarketplaceListing } from '../lib/marketplace';
import { createMarketplaceAdJpeg, downloadMarketplaceAd, marketplaceAdFilename, marketplaceListingToAdContent } from '../lib/marketplace-ad-renderer';
import styles from './FacebookAdvertActions.module.css';

export function marketplaceShareCaption(listing: MarketplaceListing) {
  const content = marketplaceListingToAdContent(listing);
  const price = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(content.brand.vatLabel === 'vat-included' ? content.askingPriceExVat * 1.15 : content.askingPriceExVat);
  const vat = content.brand.vatLabel === 'vat-included' ? 'VAT included' : content.brand.vatLabel === 'no-vat' ? 'No VAT' : '+ VAT';
  const phone = content.sellerPhone?.trim();
  return [content.title, `${price} ${vat}`, [content.year, content.usage, content.condition].filter(Boolean).join(' · '), content.location,
    phone && !/^\+27\s*00\s*000\s*0000$/.test(phone) ? `Contact for more information: **${phone}**` : content.brand.email ? `Contact for more information: ${content.brand.email}` : null,
  ].filter(Boolean).join('\n');
}

function Icon({ kind }: { kind: 'download' | 'copy' | 'marketplace' | 'groups' | 'link' | 'photo' | 'details' }) {
  const paths = { link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2', photo: 'M3 3h18v18H3zM3 17l5-5 4 4 4-5 5 6M7 7h2', details: 'M4 3h16v18H4zM8 7h8M8 12h8M8 17h5', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', copy: 'M9 9h12v12H9zM15 5V3H3v12h2', marketplace: 'M4 10v10h16V10M3 10l2-6h14l2 6H3M9 20v-6h6v6', groups: 'M3 21v-3a6 6 0 0 1 12 0v3M17 13a5 5 0 0 1 4 5v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 3a4 4 0 0 1 0 8' };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

export function MarketplaceShareDialog({ listing, onClose, whatsappUrl }: { listing: MarketplaceListing; onClose: () => void; whatsappUrl?: string }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'ad' | 'details' | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const isWhatsApp = whatsappUrl !== undefined;
  const ref = useRef<HTMLDialogElement>(null);
  const [caption, setCaption] = useState(() => marketplaceShareCaption(listing));
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const photos = [...new Set([listing.imageSrc, ...(listing.imageUrls || [])].filter(Boolean))];
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    // The child is portalled outside the parent: hide the previous sheet while
    // it is open, then restore it (and its focus) on Back/close.
    const parent = trigger?.closest<HTMLElement>('[role="dialog"]');
    const previousVisibility = parent?.style.visibility ?? '';
    const previousOverflow = document.documentElement.style.overflow;
    if (parent) parent.style.visibility = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (parent) parent.style.visibility = previousVisibility;
      document.documentElement.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  async function copyCaption() {
    try { await navigator.clipboard.writeText(caption); setFeedback('Caption copied. Paste it into your post.'); }
    catch { ref.current?.querySelector('textarea')?.select(); setFeedback('Select and copy the caption below.'); }
  }
  async function downloadPhotos() {
    setBusy(true);
    let downloaded = 0;
    for (const [index, src] of photos.entries()) {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('Not an image');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `advert-photo-${index + 1}.${blob.type.split('/')[1].replace('jpeg', 'jpg')}`;
        document.body.append(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        downloaded++;
      } catch { /* Keep remaining photos available if one download fails. */ }
    }
    setFeedback(downloaded === photos.length ? 'Photo downloads started. Allow multiple downloads if your browser asks.' : 'Some photos could not download. Open the photos below and save them manually.');
    setBusy(false);
  }
  async function prepareFiles(nextMode: 'ad' | 'details') {
    setMode(nextMode);
    setFiles([]);
    setFeedback('');
    setBusy(true);
    try {
      if (nextMode === 'details' && !photos.length) throw new Error('No photos');
      const prepared = nextMode === 'ad'
        ? [new File([(await createMarketplaceAdJpeg(listing)).blob], marketplaceAdFilename(listing.title), { type: 'image/jpeg' })]
        : await Promise.all(photos.map(async (src, index) => {
            const response = await fetch(src);
            if (!response.ok) throw new Error('Photo unavailable');
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) throw new Error('Photo unavailable');
            return new File([blob], `advert-photo-${index + 1}.${blob.type.split('/')[1].replace('jpeg', 'jpg')}`, { type: blob.type });
          }));
      setFiles(prepared);
    } catch { setFeedback('The files could not be prepared. Please try again.'); }
    finally { setBusy(false); }
  }
  async function shareFiles() {
    try {
      await navigator.share({ files, ...(mode === 'details' ? { text: caption } : {}) });
      setFeedback('Share menu closed.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setFeedback('Sharing is unavailable. Download the files and attach them in WhatsApp.');
    }
  }
  const canShareFiles = files.length > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files });
  return createPortal(<dialog ref={ref} className={styles.dialog} aria-labelledby="facebook-share-title" onCancel={onClose} onKeyDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <header className={styles.header}><div><h2 id="facebook-share-title">{isWhatsApp ? 'Share on WhatsApp' : 'Share on Facebook'}</h2><p>{isWhatsApp ? 'Choose what you want to send.' : step === 1 ? 'Step 1 of 2 · Asset details' : 'Step 2 of 2 · Choose destination'}</p></div><button type="button" className={styles.close} data-modal-close="true" aria-label="Close sharing" onClick={onClose}>×</button></header>
    <div className={styles.body}>
      <div className={styles.summary}><span className={styles.summaryIcon}><Icon kind="marketplace" /></span><div><small>Selected listing</small><strong>{marketplaceListingToAdContent(listing).title}</strong></div></div>
      {isWhatsApp && !mode ? <div className={styles.options}>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${marketplaceListingToAdContent(listing).title}\n${whatsappUrl}`)}`} target="_blank" rel="noopener noreferrer"><span className={styles.optionIcon}><Icon kind="link" /></span><span className={styles.optionCopy}><strong>Send Aim4price Link</strong><small>Open the listing inside Aim4price.</small></span></a>
        <button type="button" onClick={() => void prepareFiles('ad')}><span className={styles.optionIcon}><Icon kind="photo" /></span><span className={styles.optionCopy}><strong>Send Ad</strong><small>Share the ad image created by Aim4price.</small></span></button>
        <button type="button" onClick={() => void prepareFiles('details')}><span className={styles.optionIcon}><Icon kind="details" /></span><span className={styles.optionCopy}><strong>Send Marketplace Ad Details</strong><small>Share the photos and Facebook caption.</small></span></button>
      </div> : null}
      {((!isWhatsApp && step === 1) || mode === 'details') && <div className={styles.detailsGrid}>
      <section className={styles.photoPanel} aria-label="Advert photos"><div className={styles.sectionHeading}>Photos <small>{photos.length} available</small></div><div className={styles.photos}>{photos.map((src, index) => <a key={src} href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${index + 1} to save`}><img src={src} alt={`Advert photo ${index + 1}`} /></a>)}</div>
      {!isWhatsApp && <button type="button" className={styles.download} disabled={busy || !photos.length} onClick={() => void downloadPhotos()}><Icon kind="download" />{busy ? 'Downloading…' : photos.length ? 'Download photos' : 'No photos available'}</button>}
      </section><section className={styles.captionPanel}><div className={styles.captionHeader}><label htmlFor="facebook-advert-caption">Caption</label><button type="button" onClick={() => void copyCaption()}><Icon kind="copy" />Copy caption</button></div>
      <textarea id="facebook-advert-caption" value={caption} onChange={event => setCaption(event.target.value)} rows={6} />
      </section></div>}

      {!isWhatsApp && step === 2 && <>
        <div className={styles.destinations}><a href="https://www.facebook.com/marketplace/" target="_blank" rel="noopener noreferrer"><span className={styles.optionIcon}><Icon kind="marketplace" /></span><span className={styles.optionCopy}><strong>Marketplace</strong><small>Create a listing</small></span></a><a href="https://www.facebook.com/groups/" target="_blank" rel="noopener noreferrer"><span className={styles.optionIcon}><Icon kind="groups" /></span><span className={styles.optionCopy}><strong>Groups</strong><small>Post to your groups</small></span></a></div>
        <small>Facebook opens in a new tab. Upload your photos and paste the caption to publish.</small>

      </>}
      {isWhatsApp && mode && <>
        {busy ? <p role="status">Preparing {mode === 'ad' ? 'your ad' : 'photos'}…</p> : files.length > 0 ? <>
          {mode === 'ad' && <AdPreview file={files[0]} />}
          {canShareFiles && <button type="button" onClick={() => void shareFiles()}>Share files</button>}
          <button type="button" onClick={() => files.forEach(file => downloadMarketplaceAd(file, file.name))}><Icon kind="download" />Download {mode === 'ad' ? 'ad' : 'photos'}</button>
          <div className={styles.destinations}><a href={`https://wa.me/?text=${encodeURIComponent(mode === 'details' ? caption : '')}`} target="_blank" rel="noopener noreferrer">Open WhatsApp</a></div>
          <small>{canShareFiles ? 'Choose WhatsApp in the share menu. If the caption is omitted, copy and paste it into your message.' : 'Download the files, open WhatsApp and attach them to your message. The caption is included for Marketplace Ad Details.'}</small>
        </> : <button type="button" onClick={() => void prepareFiles(mode)}>Try again</button>}

      </>}
      {feedback && <p role="status">{feedback}</p>}
    </div>
    {(!isWhatsApp || mode) && <footer className={styles.footer}>
      {(!isWhatsApp && step === 2) || mode ? <button type="button" disabled={busy} onClick={() => { if (isWhatsApp) { setMode(null); setFiles([]); } else setStep(1); setFeedback(''); }}>Back</button> : <small>Prepare your photos and caption.</small>}
      {!isWhatsApp && step === 1 && <button type="button" className={styles.primary} onClick={() => { setStep(2); setFeedback(''); }}>Continue</button>}
    </footer>}
  </dialog>, document.body);
}

export default function FacebookAdvertActions({ listing, children }: { listing: MarketplaceListing; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={styles.trigger} onClick={() => setOpen(true)}>{children || 'Share on Facebook'}</button>{open && <MarketplaceShareDialog listing={listing} onClose={() => setOpen(false)} />}</>;
}

function AdPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img className={styles.adPreview} src={url} alt="Aim4price ad preview" /> : null;
}

export function WhatsAppAdvertActions({ listing, shareUrl, children }: { listing: MarketplaceListing; shareUrl: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={styles.trigger} onClick={() => setOpen(true)}>{children}</button>{open && <MarketplaceShareDialog listing={listing} whatsappUrl={shareUrl} onClose={() => setOpen(false)} />}</>;
}
