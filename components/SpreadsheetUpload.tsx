'use client';

import { useId, useState, type Ref } from 'react';
import styles from './PartsImportForm.module.css';

type Props = {
  title: string;
  fileLabel: string;
  headingRef?: Ref<HTMLHeadingElement>;
  busy: boolean;
  pasteMode: boolean;
  onModeChange: (paste: boolean) => void;
  pasted: string;
  onPasteChange: (text: string) => void;
  onFile: (file: File) => void;
};

export default function SpreadsheetUpload({ title, fileLabel, headingRef, busy, pasteMode, onModeChange, pasted, onPasteChange, onFile }: Props) {
  const pasteId = useId();
  const pasteHintId = useId();
  const [dragging, setDragging] = useState(false);
  return <section className={styles.upload}>
    <div className={styles.heading}>
      <h3 ref={headingRef} tabIndex={-1}>{title}</h3>
      <p>Choose a file or paste cells from Excel.</p>
    </div>
    <div className={styles.tabs} role="group" aria-label="Import source">
      <button type="button" aria-pressed={!pasteMode} onClick={() => onModeChange(false)}>Upload file</button>
      <button type="button" aria-pressed={pasteMode} onClick={() => onModeChange(true)}>Paste cells</button>
    </div>
    {pasteMode ? <div className={styles.paste}>
      <label htmlFor={pasteId}>Cells from Excel or Sheets</label>
      <p id={pasteHintId}>Headings are optional. Paste columns in any order.</p>
      <textarea id={pasteId} aria-label="Paste spreadsheet cells" aria-describedby={pasteHintId} value={pasted} onChange={e => onPasteChange(e.target.value)} placeholder="Paste your cells here." />
    </div> : <label className={styles.drop} data-dragging={dragging || undefined}
      onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (!busy && file) onFile(file);
      }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 13h8m-8 4h5" /></svg>
      <strong>Drop your file here, or browse</strong><span>CSV up to 2 MB · Excel (.xlsx) up to 5 MB</span>
      <input aria-label={fileLabel} type="file" accept=".csv,.xlsx" onChange={e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!busy && file) onFile(file);
      }} />
    </label>}
  </section>;
}
