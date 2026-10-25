'use client';
import { useEffect, useRef, useState } from 'react';
import modal from './estimate-modal.module.css';
import styles from './valuation-pdf-options.module.css';

const preferenceKey = 'aim4price:pdf:include-market-value';
export default function ValuationPdfOptions({ idealValue, replacementValue, marketValue, stale, busy, error, onClose, onCalculate, onDownload }: {
  idealValue: string; replacementValue: string; marketValue: string | null; stale: boolean; busy: boolean; error: string;
  onClose: () => void; onCalculate: () => void; onDownload: (includeMarketValue: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [includeMarket, setIncludeMarket] = useState(() => {
    try { return localStorage.getItem(preferenceKey) !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className={`${modal.surface} ${styles.dialog}`} aria-labelledby="pdf-options-title" aria-describedby="pdf-options-description" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <button type="button" className={modal.close} data-modal-close="true" aria-label="Close PDF options" disabled={busy} onClick={onClose}>×</button>
    <header className={styles.header}><h2 id="pdf-options-title" data-estimate-modal-title>Download PDF</h2><p id="pdf-options-description">Choose what to include in your report.</p></header>
    <div className={styles.body}>
      <div className={styles.values}>
        <div><span>Aim4price Ideal Value</span><strong>{idealValue}</strong></div>
        <div><span>Replacement Value</span><strong>{replacementValue}</strong></div>
      </div>
      <small className={styles.basis}>Included in every report · VAT excluded</small>
      <section className={styles.market} aria-label="Market value report option">
        <div className={styles.marketHeading}><div><strong>Realistic Market Value</strong><p>{marketValue ? `${marketValue} · VAT excluded` : stale ? 'Update this assessment before including it.' : 'Not calculated yet.'}</p></div>
          {marketValue ? <button type="button" role="switch" aria-label="Include Realistic Market Value" aria-checked={includeMarket} className={styles.toggle} disabled={busy} onClick={() => { const next = !includeMarket; setIncludeMarket(next); try { localStorage.setItem(preferenceKey, String(next)); } catch { /* Keep the session choice. */ } }}><span /></button> : null}
        </div>
        {marketValue ? <p className={styles.note}>{includeMarket ? 'Included with a short explanation of why values may differ.' : 'The market value section will be left out.'}</p> : <button type="button" className={modal.adjustButton} disabled={busy} onClick={onCalculate}>{stale ? 'Update market value' : 'Calculate market value'}</button>}
        {!marketValue ? <p className={styles.note}>Optional. You can download without it.</p> : null}
      </section>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div>
    <footer className={`${modal.actions} ${styles.actions}`}><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className={styles.download} disabled={busy} onClick={() => onDownload(Boolean(marketValue) && includeMarket)}>{busy ? 'Preparing PDF…' : 'Download PDF'}</button></footer>
  </dialog>;
}
