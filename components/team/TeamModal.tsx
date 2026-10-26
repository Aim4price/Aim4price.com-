'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import styles from './team.module.css';
export default function TeamModal({ title, subtitle, children, onClose, busy = false }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    onClose: () => void;
    busy?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        ref.current?.querySelector<HTMLElement>('button,input,select,textarea')?.focus();
        return () => { document.body.style.overflow = overflow; if (previous?.isConnected)
            previous.focus(); };
    }, []);
    return createPortal(<div className={styles.overlay} data-website-overlay data-account-asset-modal>
    <div className={styles.backdrop} onClick={() => { if (!busy)
        onClose(); }}/>
    <div ref={ref} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="team-modal-title" onKeyDown={event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                if (!busy)
                    closeRef.current();
            }
            if (event.key !== 'Tab')
                return;
            const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []);
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }}>
      <header className={styles.modalHeader}><div><h2 id="team-modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label="Close dialog" data-modal-close="true">×</button></header>
      {children}
    </div>
  </div>, document.body);
}
