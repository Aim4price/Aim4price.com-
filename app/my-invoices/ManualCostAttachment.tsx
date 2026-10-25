'use client';

import { useState } from 'react';
import CaptureUploadDropzone from '../../components/CaptureUploadDropzone';
import { validateInvoicePages } from '../../lib/invoice-upload';
import styles from './manual-cost-attachment.module.css';

export default function ManualCostAttachment({ fileName, disabled, onFile, onRemove }: {
  fileName?: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const [error, setError] = useState('');
  return (
    <div className={styles.section}>
      <CaptureUploadDropzone
        title="Drop invoice or receipt here or browse"
        description="One PDF or photo · PDF, JPG, PNG or WebP · Up to 12 MB"
        inputLabel="Attach invoice or receipt"
        selectedCount={fileName ? 1 : 0}
        disabled={disabled}
        onFiles={(files) => {
          const validationError = validateInvoicePages(files);
          setError(validationError ?? '');
          if (!validationError) onFile(files[0]);
        }}
      />
      {fileName ? <div className={styles.fileRow}>
        <span className={styles.fileName} role="status">{fileName}</span>
        <button type="button" disabled={disabled} onClick={() => { setError(''); onRemove(); }}>Remove</button>
      </div> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
