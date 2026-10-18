'use client';
import { useState } from 'react';
import LeadPhotoViewerModal from './LeadPhotoViewerModal';
import styles from './RecentAdvertGallery.module.css';

export default function RecentAdvertGallery({ id, title, urls }: { id: string; title: string; urls: string[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState('');
  const current = Math.min(index, Math.max(0, urls.length - 1));
  return <div className={styles.gallery} data-recent-photo-open={open || undefined}>
    <div className={styles.stage}>
      {urls.length && failed !== urls[current] ? <img src={urls[current]} alt={`${title}, photo ${current + 1}`} onError={() => setFailed(urls[current])} /> : <p>Photo unavailable</p>}
      {urls.length > 1 ? <>
        <button type="button" className={`${styles.nav} ${styles.previous}`} aria-label="Previous photo" data-tooltip="Previous photo" onClick={() => setIndex((current + urls.length - 1) % urls.length)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button>
        <button type="button" className={`${styles.nav} ${styles.next}`} aria-label="Next photo" data-tooltip="Next photo" onClick={() => setIndex((current + 1) % urls.length)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
      </> : null}
    </div>
    {urls.length ? <div className={styles.footer}><span aria-live="polite">{current + 1} / {urls.length}</span><button type="button" onClick={() => setOpen(true)} data-tooltip="Open photo">Open photo</button></div> : null}
    {open && urls.length ? <LeadPhotoViewerModal assetKey={`recent-${id}`} title={title} urls={urls} initialIndex={current} onClose={() => setOpen(false)} /> : null}
  </div>;
}
