'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from './WebsitePortal';
import styles from '../app/asset-discovery/page.module.css';
export default function DiscoveryAppDetails({ enabled, title, onClose, children }: {
    enabled: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const panel = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!enabled)
            return;
        const previous = (document.activeElement === document.body ? document.querySelector('button[aria-expanded="true"]') : document.activeElement) as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        close.current?.focus({ preventScroll: true });
        return () => { document.body.style.overflow = overflow; previous?.isConnected && previous.focus({ preventScroll: true }); };
    }, [enabled]);
    if (!enabled)
        return <>{children}</>;
    return createPortal(<div className={`${styles.compactAppSurface} ${styles.appDetailsOverlay}`} data-website-overlay onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget)
        onClose(); }}>
  <div ref={panel} className={styles.appDetailsPanel} role="dialog" aria-modal="true" aria-label={title} onKeyDown={event => {
            if (!panel.current?.contains(event.target as Node) || Array.from(document.querySelectorAll('[role="dialog"],dialog[open]')).some(node => node !== panel.current && !panel.current?.contains(node)))
                return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
            if (event.key === 'Tab') {
                const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') || []).filter(e => e.getClientRects().length);
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        }}>
   <header className={styles.appDetailsHeader}><h2>{title}</h2><button ref={close} type="button" aria-label="Close asset details" data-modal-close="true" onClick={onClose}>×</button></header>
   <div className={styles.appDetailsScroll}>{children}</div>
  </div>
 </div>, document.body);
}
