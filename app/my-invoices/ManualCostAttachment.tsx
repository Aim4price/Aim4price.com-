'use client';

import { useRef, useState } from 'react';
import { validateInvoicePages } from '../../lib/invoice-upload';
import styles from './manual-cost-attachment.module.css';

export default function ManualCostAttachment({ fileName, disabled, onFile, onRemove }: {
  fileName?: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return (
    <details className={styles.section}>
      <summary>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9" /></svg>
        <span>Attach invoice or receipt <small>· Optional</small></span>
        <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className={styles.content}>
        <p>Keep a copy with this cost. Your entered details stay unchanged.</p>
        <input ref={input} type="file" hidden aria-label="Attach invoice or receipt" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const validationError = validateInvoicePages([file]);
          setError(validationError ?? '');
          if (!validationError) onFile(file);
        }} />
        <div className={styles.fileRow}>
          <span className={styles.fileName} role="status">{fileName || 'PDF, JPG, PNG or WebP · Up to 12 MB'}</span>
          <div className={styles.actions}>
            <button type="button" disabled={disabled} onClick={() => input.current?.click()}>{fileName ? 'Replace' : 'Choose file'}</button>
            {fileName ? <button type="button" disabled={disabled} onClick={() => { setError(''); onRemove(); }}>Remove</button> : null}
          </div>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </details>
  );
}
