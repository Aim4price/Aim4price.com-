'use client';
import { useState } from 'react';
import styles from './MarketplacePhotoEditor.module.css';

export default function MarketplacePhotoEditor({ photos, onChange, busy, onBusyChange, disabled = false }: {
  photos: string[]; onChange: (photos: string[]) => void; busy: boolean;
  onBusyChange: (busy: boolean) => void; disabled?: boolean;
}) {
  const [error, setError] = useState('');
  async function upload(files: File[]) {
    if (!files.length || busy || disabled) return;
    if (photos.length + files.length > 12) { setError('Choose up to 12 photos in total.'); return; }
    onBusyChange(true); setError('');
    try {
      const body = new FormData(); body.append('uploadType', 'photo');
      files.forEach(file => body.append('files', file));
      const response = await fetch('/api/asset-register/uploads', { method: 'POST', credentials: 'include', body });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.uploads?.length) throw new Error(data.error || 'Could not upload photos. Please try again.');
      onChange([...photos, ...data.uploads.map((item: {url: string}) => item.url)]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload photos.'); }
    finally { onBusyChange(false); }
  }
  return <section className={styles.editor} aria-label="Listing photos">
    <div className={styles.heading}><strong>Photos · {photos.length}/12</strong>
      <label className={styles.add} aria-disabled={busy || disabled || photos.length >= 12}>
        <span aria-hidden="true">＋</span> {busy ? 'Uploading…' : 'Add photos'}
        <input type="file" accept="image/*" multiple disabled={busy || disabled || photos.length >= 12} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void upload(files); }} />
      </label>
    </div>
    <p>These photos are shared with the asset register. Additions and removals apply when you save.</p>
    <div className={styles.grid}>{photos.map((url, index) => <div className={styles.photo} key={`${url}-${index}`}>
      <img src={url} alt={`Listing photo ${index + 1}`} />
      <button type="button" disabled={busy || disabled} aria-label={`Remove photo ${index + 1}`} onClick={() => onChange(photos.filter((_, i) => i !== index))}>Remove</button>
    </div>)}</div>
    {!photos.length ? <p>No photos selected. Add photos to show buyers the asset.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
