'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './pricing-modal.module.css';

function ModalSurface({ open, title, onClose, children, owner = false }: { open: boolean; owner?: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => { document.body.style.overflow = overflow; previous?.isConnected && previous.focus(); };
  }, [open]);
  return <dialog ref={dialog} className={`${styles.dialog} ${owner ? styles.owner : ''}`} aria-labelledby={titleId} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    <header className={styles.header}><h2 id={titleId}>{title}</h2><button type="button" aria-label="Close pricing" onClick={onClose}>×</button></header>
    <div className={styles.body}>{children}</div>
  </dialog>;
}

export default function PricingModal(props: { open: boolean; owner?: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // Native dialogs use the browser top layer and viewport sizing, outside the website canvas zoom.
  return createPortal(<ModalSurface {...props} />, document.body);
}
