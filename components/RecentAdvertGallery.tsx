'use client';
import { useState } from 'react';
import LeadPhotoViewerModal from './LeadPhotoViewerModal';
import styles from './RecentAdvertGallery.module.css';

function PhotoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>;
}

export default function RecentAdvertGallery({ id, title, urls, onOpen }: { id: string; title: string; urls: string[]; onOpen?: (index: number) => void }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState('');
  const [loaded, setLoaded] = useState('');
  const [retry, setRetry] = useState(0);
  const current = Math.min(index, Math.max(0, urls.length - 1));
  const url = urls[current];
  const unavailable = !url || failed === url;
  const openPhoto = () => onOpen ? onOpen(current) : setOpen(true);
  return <div className={styles.gallery} data-recent-photo-open={open || undefined}>
    <div className={`${styles.stage} ${unavailable ? styles.emptyStage : ''}`}>
      {!unavailable ? <>
        <button type="button" className={styles.photoButton} onClick={openPhoto} aria-label={`Open ${title} photo ${current + 1}`} data-tooltip="Open photo">
          <img key={`${url}-${retry}`} src={url} alt={`${title}, photo ${current + 1}`} onLoad={() => setLoaded(url)} onError={() => setFailed(url)} />
        </button>
        {loaded !== url ? <span className={styles.loading} role="status">Loading photo…</span> : null}
      </> : <div className={styles.unavailable} role="status">
        <PhotoIcon />
        <strong>{url ? 'Photo unavailable' : 'No photos saved'}</strong>
        {url ? <><span>Try again or choose another photo.</span><button type="button" onClick={() => { setFailed(''); setLoaded(''); setRetry(value => value + 1); }}>Retry photo</button></> : null}
      </div>}
    </div>
    {urls.length ? <div className={styles.controls}>
      <div className={styles.navigation}>
        {urls.length > 1 ? <button type="button" className={styles.nav} aria-label="Previous photo" data-tooltip="Previous photo" onClick={() => setIndex((current + urls.length - 1) % urls.length)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button> : null}
        <span className={styles.counter} aria-live="polite">{current + 1} / {urls.length}</span>
        {urls.length > 1 ? <button type="button" className={styles.nav} aria-label="Next photo" data-tooltip="Next photo" onClick={() => setIndex((current + 1) % urls.length)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button> : null}
      </div>
      <button className={styles.openButton} type="button" onClick={openPhoto} data-tooltip="Open photo"><PhotoIcon /><span>Open photo</span></button>
    </div> : null}
    {open && urls.length ? <LeadPhotoViewerModal assetKey={`recent-${id}`} title={title} urls={urls} initialIndex={current} onClose={() => setOpen(false)} /> : null}
  </div>;
}
