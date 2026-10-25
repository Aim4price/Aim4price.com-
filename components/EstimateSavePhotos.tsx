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
    <div className={styles.actions}>
      {files.length > 0 ? <button type="button" aria-pressed={usePhotos} onClick={() => onUsePhotos(true)}>Use these photos ({files.length})</button> : null}
      <label className={styles.upload}>Upload photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => {
        const selected = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (selected.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type))) {setError('Choose JPG, PNG or WebP photos.'); return;}
        if (selected.length + files.length > 4) {setError('Choose up to 4 photos.'); return;}
        setError(''); onChange([...files, ...selected]); onUsePhotos(true);
      }} /></label>
      {marketplacePhotos.length > 0 ? <button type="button" aria-pressed={marketplaceSelected} onClick={onMarketplace}>Use Marketplace photos</button> : null}
      <button type="button" aria-pressed={!usePhotos && !marketplaceSelected} onClick={() => onUsePhotos(false)}>Skip for now</button>
    </div>
    {usePhotos && previews.length > 0 ? <div className={styles.previews}>{previews.map((url, index) =>
      <div key={url}><img src={url} alt={`Asset photo ${index + 1}`} /><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => onChange(files.filter((_, i) => i !== index))}>×</button></div>
    )}</div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
