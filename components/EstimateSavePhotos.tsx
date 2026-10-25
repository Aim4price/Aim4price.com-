'use client';

import {useEffect, useState} from 'react';
import styles from './estimate-save-photos.module.css';

export default function EstimateSavePhotos({files, onChange, usePhotos, onUsePhotos, marketplacePhotos, marketplaceSelected, onMarketplace}: {
  files: File[]; onChange: (files: File[]) => void; usePhotos: boolean; onUsePhotos: (value: boolean) => void;
  marketplacePhotos: string[]; marketplaceSelected: boolean; onMarketplace: () => void;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  return <section className={styles.photos} aria-label="Asset photos">
    <div className={styles.heading}><strong>Photos</strong><span>Optional</span></div>
      <label className={styles.upload}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h5l2-3h4l2 3h5v15H3Z" /><circle cx="12" cy="13" r="4" /></svg>
        <span className={styles.uploadCopy}><strong>Add asset photos</strong><small>Up to 4 photos</small></span><span className={styles.browse}>Browse</span><input aria-label="Upload asset photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => {
        const selected = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (selected.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type))) {setError('Choose JPG, PNG or WebP photos.'); return;}
        if (selected.length + files.length > 4) {setError('Choose up to 4 photos.'); return;}
        setError(''); onChange([...files, ...selected]); onUsePhotos(true);
      }} /></label>
    <div className={styles.actions}>
      {files.length > 0 ? <button type="button" aria-pressed={usePhotos} onClick={() => onUsePhotos(true)}>Use these photos ({files.length})</button> : null}
      {marketplacePhotos.length > 0 ? <button type="button" aria-pressed={marketplaceSelected} onClick={onMarketplace}>Use Marketplace photos</button> : null}
      {(files.length > 0 || marketplaceSelected) ? <button type="button" aria-pressed={!usePhotos && !marketplaceSelected} onClick={() => onUsePhotos(false)}>Without photos</button> : null}
    </div>
    {usePhotos && previews.length > 0 ? <div className={styles.previews}>{previews.map((url, index) =>
      <div key={url}><img src={url} alt={`Asset photo ${index + 1}`} /><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => onChange(files.filter((_, i) => i !== index))}>×</button></div>
    )}</div> : null}
    <small className={styles.help}>Photos can be added later.</small>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
