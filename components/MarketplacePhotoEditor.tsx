'use client';
import { useRef, useState } from 'react';
import styles from './MarketplacePhotoEditor.module.css';

export default function MarketplacePhotoEditor({ photos, onChange, busy, onBusyChange, disabled = false }: {
  photos: string[]; onChange: (photos: string[]) => void; busy: boolean;
  onBusyChange: (busy: boolean) => void; disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const index = Math.min(selected, Math.max(0, photos.length - 1));
  const locked = busy || disabled;
  async function upload(files: File[]) {
    if (!files.length || locked || uploadLock.current) return;
    if (photos.length + files.length > 12) { setError('Choose up to 12 photos in total.'); return; }
    uploadLock.current = true;
    onBusyChange(true); setError('');
    try {
      const body = new FormData(); body.append('uploadType', 'photo');
      files.forEach(file => body.append('files', file));
      const response = await fetch('/api/asset-register/uploads', { method: 'POST', credentials: 'include', body });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.uploads?.length) throw new Error(data.error || 'Could not upload photos. Please try again.');
      onChange([...photos, ...data.uploads.map((item: {url: string}) => item.url)]);
      setSelected(photos.length);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload photos.'); }
    finally { uploadLock.current = false; onBusyChange(false); }
  }
  function makeMain() {
    onChange([photos[index], ...photos.filter((_, i) => i !== index)]);
    setSelected(0);
  }
  function remove() {
    onChange(photos.filter((_, i) => i !== index));
    setSelected(Math.max(0, Math.min(index, photos.length - 2)));
    setError('');
  }
  return <section className={styles.editor} aria-label="Listing photos">
    <div className={styles.heading}><strong>Photos</strong><span aria-live="polite">{photos.length ? `${index + 1} of ${photos.length}` : 'No photos yet'}</span></div>
    <div className={styles.frame}>
      {photos.length ? <img className={styles.mainPhoto} src={photos[index]} alt={`Listing photo ${index + 1}${index === 0 ? ', main photo' : ''}`} /> : <div className={styles.empty}>Add photos to show buyers your asset.</div>}
      {photos.length ? <div className={styles.tools}>
        <button type="button" className={styles.mainAction} disabled={locked || index === 0} onClick={makeMain}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>{index === 0 ? 'Main photo' : 'Make main photo'}
        </button>
        <button type="button" className={styles.deleteAction} disabled={locked} onClick={remove}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>Delete photo
        </button>
      </div> : null}
      {photos.length > 1 ? <>
        <button type="button" className={`${styles.nav} ${styles.previous}`} aria-label="Previous photo" onClick={() => setSelected((index + photos.length - 1) % photos.length)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button>
        <button type="button" className={`${styles.nav} ${styles.next}`} aria-label="Next photo" onClick={() => setSelected((index + 1) % photos.length)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
      </> : null}
      <button type="button" className={styles.add} disabled={locked || photos.length >= 12} onClick={() => inputRef.current?.click()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{busy ? 'Uploading…' : 'Add photo'}
      </button>
      <input ref={inputRef} className={styles.fileInput} type="file" aria-label="Add listing photos" accept="image/*" multiple disabled={locked || photos.length >= 12} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void upload(files); }} />
    </div>
    {photos.length > 1 ? <div className={styles.thumbnails} aria-label="Choose listing photo">{photos.map((url, i) => <button type="button" key={`${url}-${i}`} className={styles.thumbnail} aria-label={`View photo ${i + 1}${i === 0 ? ', main photo' : ''}`} aria-pressed={index === i} onClick={() => setSelected(i)}><img src={url} alt="" />{i === 0 ? <span>Main</span> : null}</button>)}</div> : null}
    <p className={styles.hint}>The main photo appears first. Changes also update the asset register photos when you save.</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </section>;
}
