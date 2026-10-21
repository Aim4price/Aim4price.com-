'use client';

import { useState } from 'react';
import { validateInvoicePages } from '../../lib/invoice-upload';
import styles from './page.module.css';

export default function ManualCostAttachment({ fileName, disabled, onFile }: {
  fileName: string; disabled: boolean; onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  function select(files: File[]) {
    if (disabled || !files.length) return;
    const message = files.length > 1 ? 'Choose one document or photo.' : validateInvoicePages(files);
    setError(message || '');
    if (!message) onFile(files[0]);
  }
  return <div>
    <label className={styles.manualCostAttachment} data-dragging={dragging} data-disabled={disabled}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); select(Array.from(event.dataTransfer.files)); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18H5a4 4 0 0 1-.5-8A7 7 0 0 1 18 8a5 5 0 0 1 1 10h-2M12 21V11m-4 4 4-4 4 4" /></svg>
      <span>{fileName ? <><strong>{fileName}</strong><small>Drop a replacement or <u>browse</u></small></> : <>Drop a document or photo here, or <u>browse</u></>}</span>
      <small>Optional</small>
      <input type="file" aria-label="Attach a document or photo" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled}
        onChange={event => { select(Array.from(event.target.files || [])); event.target.value = ''; }} />
    </label>
    {error ? <p className={styles.noticeError} role="alert">{error}</p> : null}
  </div>;
}
