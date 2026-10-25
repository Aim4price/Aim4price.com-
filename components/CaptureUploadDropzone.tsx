'use client';

import { useId, useRef, useState } from 'react';
import styles from './CaptureUploadDropzone.module.css';

type Props = {
  title: string;
  description: string;
  inputLabel: string;
  selectedCount: number;
  multiple?: boolean;
  maxFileSizeMb?: number;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

export default function CaptureUploadDropzone({ title, description, inputLabel, selectedCount, multiple = false, maxFileSizeMb = 12, disabled = false, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  function choose(files: File[]) {
    if (disabled || !files.length) return;
    if (!multiple && files.length > 1) { setError('Choose one photo or PDF at a time.'); return; }
    if (files.some(file => !['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('Choose a PDF, JPG, PNG or WebP file.'); return;
    }
    if (files.some(file => !file.size || file.size > maxFileSizeMb * 1024 * 1024)) {
      setError(`Each file must contain data and be ${maxFileSizeMb} MB or smaller.`); return;
    }
    setError('');
    onFiles(files);
  }

  return <div className={styles.wrapper}>
    <div className={`${styles.dropzone} ${selectedCount ? styles.selected : ''} ${dragging && !disabled ? styles.dragging : ''}`} aria-disabled={disabled}
      onDragEnter={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'; }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); choose(Array.from(event.dataTransfer.files)); }}>
      <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h16M12 21V8m-5 5 5-5 5 5" /></svg></span>
      <span className={styles.copy}><strong>{title}</strong><small id={descriptionId}>{description}</small></span>
      <input ref={input} className={styles.input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple={multiple} disabled={disabled} aria-label={inputLabel} tabIndex={-1}
        onChange={event => { choose(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <button type="button" className={styles.browse} disabled={disabled} aria-describedby={descriptionId} onClick={() => input.current?.click()}>{selectedCount ? 'Change files' : 'Browse files'}</button>
    </div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </div>;
}
