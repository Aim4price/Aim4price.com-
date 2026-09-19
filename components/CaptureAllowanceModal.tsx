'use client';
import { useEffect, useRef, useState } from 'react';
import styles from '../app/my-invoices/page.module.css';
import accountStyles from '../app/account/page.module.css';

type Props = { endpoint: string; ledger: 'Cost' | 'Fuel'; onClose: () => void };
export default function CaptureAllowanceModal({ endpoint, ledger, onClose }: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // One record per account / actor / ledger / SA day, even after remounts.
    void fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shown' }) }).then(response => {
        if (!response.ok && response.status !== 409) setError('We could not notify Admin that you reached the limit. You can still request assistance below.');
      }).catch(() => setError('We could not notify Admin. Please try requesting assistance.'));
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, [endpoint]);
  async function requestHelp() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your request could not be sent.');
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className={`${styles.modalBackdrop} ${styles.accountCostBackdrop}`} data-website-overlay>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="capture-allowance-title"
      className={`${styles.formModal} ${styles.costUploadModal} ${styles.accountCostModal} ${accountStyles.modalTheme}`}
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
      }}>
      <div className={styles.modalHeader}>
        <div><h2 id="capture-allowance-title">{sent ? 'Request received' : 'Need help with more documents?'}</h2><p>{ledger} Ledger · 10 daily Aim4price captures</p></div>
        <button type="button" disabled={busy} className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton} ${styles.accountCostClose}`} onClick={onClose} aria-label="Close"><span aria-hidden="true">×</span></button>
      </div>
      <div className={styles.modalDivider} />
      <div className={styles.formModalScrollBody}><section className={styles.uploadPanel}>
        {sent ? <p role="status">Aim4price has received your request. We’ll contact you to discuss the volume, timing and hourly cost before any additional work starts.</p> : <>
          <p>Aim4price is happy to help. You’ve used today’s 10 captures for this ledger. Request assistance for a larger upload and we’ll agree on the work and hourly cost with you first.</p>
          <p>You can still enter records and upload documents manually. Your allowance resets at midnight, South African time.</p>
          <label className={styles.captureNoteField}><span>Anything we should know? <small>Optional</small></span>
            <textarea rows={3} maxLength={1000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder={`For example, I have 40 ${ledger === 'Cost' ? 'invoices' : 'fuel slips'} to capture.`} /></label>
        </>}
        {error ? <p role="alert">{error}</p> : null}
      </section></div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>{sent ? 'Done' : 'Back'}</button>
        {!sent ? <button type="button" className={styles.primaryButton} disabled={busy} onClick={requestHelp}>{busy ? 'Sending…' : 'Request assistance'}</button> : null}
      </div>
    </div>
  </div>;
}
