'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { MarketplaceListing } from '../lib/marketplace';
import { marketplaceListingToAdContent } from '../lib/marketplace-ad-renderer';
import styles from './FacebookAdvertActions.module.css';

export function marketplaceShareCaption(listing: MarketplaceListing) {
  const content = marketplaceListingToAdContent(listing);
  const price = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(content.brand.vatLabel === 'vat-included' ? content.askingPriceExVat * 1.15 : content.askingPriceExVat);
  const vat = content.brand.vatLabel === 'vat-included' ? 'VAT included' : content.brand.vatLabel === 'no-vat' ? 'No VAT' : '+ VAT';
  const phone = content.sellerPhone?.trim();
  return [content.title, `${price} ${vat}`, [content.year, content.usage, content.condition].filter(Boolean).join(' · '), content.location,
    phone && !/^\+27\s*00\s*000\s*0000$/.test(phone) ? `Contact for more information: ${phone}` : content.brand.email ? `Contact for more information: ${content.brand.email}` : null,
  ].filter(Boolean).join('\n');
}

function Icon({ kind }: { kind: 'download' | 'copy' | 'marketplace' | 'groups' }) {
  const paths = { download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', copy: 'M9 9h12v12H9zM15 5V3H3v12h2', marketplace: 'M4 10v10h16V10M3 10l2-6h14l2 6H3M9 20v-6h6v6', groups: 'M3 21v-3a6 6 0 0 1 12 0v3M17 13a5 5 0 0 1 4 5v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 3a4 4 0 0 1 0 8' };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

function FacebookDialog({ listing, onClose }: { listing: MarketplaceListing; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [caption, setCaption] = useState(() => marketplaceShareCaption(listing));
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const photos = [...new Set([listing.imageSrc, ...(listing.imageUrls || [])].filter(Boolean))];
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
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
  return createPortal(<dialog ref={ref} className={styles.dialog} aria-labelledby="facebook-share-title" onCancel={onClose} onKeyDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <header className={styles.header}><div><h2 id="facebook-share-title">Share on Facebook</h2><p>Download photos, copy your caption, then create your post.</p></div><button type="button" className={styles.close} data-modal-close="true" aria-label="Close Facebook sharing" onClick={onClose}>×</button></header>
    <div className={styles.body}>
      <strong>{marketplaceListingToAdContent(listing).title}</strong>
      <div className={styles.photos}>{photos.map((src, index) => <a key={src} href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${index + 1} to save`}><img src={src} alt={`Advert photo ${index + 1}`} /></a>)}</div>
      <button type="button" className={styles.download} disabled={busy || !photos.length} onClick={() => void downloadPhotos()}><Icon kind="download" />{busy ? 'Downloading…' : photos.length ? 'Download photos' : 'No photos available'}</button>
      <div className={styles.captionHeader}><label htmlFor="facebook-advert-caption">Caption</label><button type="button" onClick={() => void copyCaption()}><Icon kind="copy" />Copy caption</button></div>
      <textarea id="facebook-advert-caption" value={caption} onChange={event => setCaption(event.target.value)} rows={5} />
      <div className={styles.destinations}><a href="https://www.facebook.com/marketplace/" target="_blank" rel="noopener noreferrer"><Icon kind="marketplace" />Marketplace</a><a href="https://www.facebook.com/groups/" target="_blank" rel="noopener noreferrer"><Icon kind="groups" />Groups</a></div>
      <small>Facebook opens in a new tab. Upload your photos and paste the caption to publish.</small>
      {feedback && <p role="status">{feedback}</p>}
    </div>
  </dialog>, document.body);
}

export default function FacebookAdvertActions({ listing, children }: { listing: MarketplaceListing; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={styles.trigger} onClick={() => setOpen(true)}>{children || 'Share on Facebook'}</button>{open && <FacebookDialog listing={listing} onClose={() => setOpen(false)} />}</>;
}
