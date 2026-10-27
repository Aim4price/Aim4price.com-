'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import styles from './team.module.css';
import accessStyles from '../../app/account/app-access-management.module.css';
export default function TeamModal({ title, subtitle, children, onClose, busy = false, ownerStyle = false }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    onClose: () => void;
    busy?: boolean;
    ownerStyle?: boolean;
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
    return createPortal(<div className={ownerStyle ? `${accessStyles.modalOverlay} ${styles.overlayTheme}` : styles.overlay} data-website-overlay data-account-asset-modal>
    <div className={ownerStyle ? accessStyles.modalBackdrop : styles.backdrop} onClick={() => { if (!busy)
        onClose(); }}/>
    <div ref={ref} className={ownerStyle ? `${accessStyles.modal} ${accessStyles.notificationStyle} ${styles.ownerModal}` : styles.modal} role="dialog" aria-modal="true" aria-labelledby="team-modal-title" onKeyDown={event => {
            // Portalled calendars handle their own keyboard navigation and dismissal.
            if (!event.currentTarget.contains(event.target as Node)) return;
            if (event.key === 'Escape') {
                event.stopPropagation();
                if (!busy)
                    closeRef.current();
            }
            if (event.key !== 'Tab')
                return;
            const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary') || []);
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
      <header className={ownerStyle ? accessStyles.modalHeader : styles.modalHeader}><div><h2 id="team-modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className={ownerStyle ? accessStyles.closeButton : styles.close} onClick={onClose} disabled={busy} aria-label="Close dialog" data-modal-close="true">×</button></header>
      {children}
    </div>
  </div>, document.body);
}
