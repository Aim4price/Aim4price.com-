'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from '../../components/WebsitePortal';
import styles from './pricing-modal.module.css';

function ModalSurface({ open, title, onClose, children, owner = false }: { open: boolean; owner?: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = overflow; previous?.isConnected && previous.focus({ preventScroll: true }); };
  }, [open]);
  if (!open) return null;
  return <div className={styles.overlay} data-website-overlay onClick={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div className={styles.backdrop} data-website-overlay onClick={onClose} aria-hidden="true" />
    <div role="dialog" aria-modal="true" tabIndex={-1} ref={dialog} className={`${styles.dialog} ${owner ? styles.owner : ''}`} aria-labelledby={titleId} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <header className={styles.header}><h2 id={titleId}>{title}</h2><button type="button" aria-label="Close pricing" onClick={onClose}>×</button></header>
    <div className={styles.body}>{children}</div>
    </div>
  </div>;
}

export default function PricingModal(props: { open: boolean; owner?: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // Keep pricing and its nested journey inside the shared canonical overlay host.
  return createPortal(<ModalSurface {...props} />, document.body);
}
