'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './InvoicePreview.module.css';

type Props = {
  id: string;
  number?: string | null;
  draft?: boolean;
  busy?: boolean;
  actionError?: string;
  onClose: () => void;
  onIssue?: () => void;
};

export function InvoicePreview({ id, number, draft = false, busy = false, actionError, onClose, onIssue }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [html, setHtml] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setReady(false); setHtml(''); setError('');
    void fetch(`/api/billing/invoices/${id}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json()).error || 'Invoice preview unavailable.');
        if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Please sign in again to preview this invoice.');
        return response.text();
      })
      .then(content => { if (!controller.signal.aborted) setHtml(content); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Invoice preview unavailable.'); });
    return () => controller.abort();
  }, [id, attempt]);

  return <dialog ref={dialog} className={styles.dialog} aria-label="Invoice preview" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.layout}>
      <header className={styles.header}>
        <div><h2>{draft ? 'Preview invoice draft' : number || 'Invoice preview'}</h2><p>{draft ? 'Check the details before issuing. This draft has not been emailed.' : 'Review your invoice, then download a copy.'}</p></div>
        <button className={styles.close} aria-label="Close invoice preview" disabled={busy} onClick={onClose}>×</button>
      </header>
      <div className={styles.document}>
        {error ? <div className={styles.message} role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : !ready ? <p className={styles.message} role="status">Preparing invoice preview…</p> : null}
        {html ? <iframe title="Aim4price invoice document" sandbox="" srcDoc={html} onLoad={() => setReady(true)} className={styles.frame} /> : null}
      </div>
      {actionError ? <p className={styles.actionError} role="alert">{actionError}</p> : null}
      <footer className={styles.footer}>
        <span>{draft ? 'Draft · No payment due until issued' : 'No VAT applicable'}</span>
        <div><button className={styles.secondary} disabled={busy} onClick={onClose}>{draft ? 'Back to billing' : 'Close'}</button>
          {draft ? onIssue ? <button className={styles.primary} disabled={!ready || Boolean(error) || busy} onClick={onIssue}>{busy ? 'Issuing…' : 'Issue & email'}</button> : null : ready && !error ? <a className={styles.primary} href={`/api/billing/invoices/${id}?format=pdf`} download>Download PDF</a> : <button className={styles.primary} disabled>Download PDF</button>}
        </div>
      </footer>
    </div>
  </dialog>;
}

export default function InvoicePreviewButton({ id, number, className }: { id: string; number: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  return <><button className={className} onClick={() => setOpen(true)}>View invoice</button>{open ? <InvoicePreview id={id} number={number} onClose={() => setOpen(false)} /> : null}</>;
}
