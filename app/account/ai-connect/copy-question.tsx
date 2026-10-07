'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function CopyQuestion({ question, category }: { question: string; category: string }) {
  const [status, setStatus] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(question);
      setStatus('Copied. Paste into ChatGPT.');
    } catch {
      setStatus('Select the question above and copy it manually.');
    }
  }
  return <div className={styles.copyQuestion}>
    <button type="button" onClick={copy} aria-label={`Copy question about ${category.toLowerCase()}`}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
      Copy question
    </button>
    <span role="status">{status}</span>
  </div>;
}
