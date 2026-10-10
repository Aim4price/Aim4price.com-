'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import accessStyles from '../app-access-management.module.css';
import styles from './page.module.css';

type Flow = 'connect' | 'manage';

export default function ConnectionActions({ setup, management, count, admin = false }: {
  admin?: boolean;
  setup: ReactNode;
  management: ReactNode;
  count?: number;
}) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const panel = useRef<HTMLElement>(null);
  const connectButton = useRef<HTMLButtonElement>(null);
  const manageButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!flow) return;
    const trigger = flow === 'connect' ? connectButton.current : manageButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('[data-dialog-close]')?.focus();

    function focusable() {
      return Array.from(panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
      ) || []).filter(element => {
        if (!element.getClientRects().length || element.tabIndex < 0) return false;
        // Closed details can still report rectangles for their hidden controls.
        let ancestor: HTMLElement | null = element.parentElement;
        while (ancestor && ancestor !== panel.current) {
          if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
            const summary = ancestor.querySelector(':scope > summary');
            if (!summary?.contains(element)) return false;
          }
          ancestor = ancestor.parentElement;
        }
        return true;
      });
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setFlow(null);
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    function keepFocus(event: FocusEvent) {
      if (panel.current && !panel.current.contains(event.target as Node)) {
        focusable()[0]?.focus();
      }
    }
    document.addEventListener('keydown', keyDown);
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('focusin', keepFocus);
      trigger?.focus({ preventScroll: true });
    };
  }, [flow]);

  function close() {
    setFlow(null);
  }

  return <>
    <div className={accessStyles.actionGrid} aria-label="AI connection actions">
      <button ref={connectButton} type="button"
        className={`${accessStyles.actionButton} ${accessStyles.actionButtonNew} ${styles.actionButton}`}
        aria-haspopup="dialog" aria-expanded={flow === 'connect'} aria-controls={flow === 'connect' ? "ai-connect-panel" : undefined}
        onClick={() => flow === 'connect' ? close() : setFlow('connect')}>
        <span className={accessStyles.actionIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        <span className={accessStyles.actionCopy}><strong>Connect</strong><small>Choose your assistant.</small></span>
      </button>
      <button ref={manageButton} type="button"
        className={`${accessStyles.actionButton} ${accessStyles.actionButtonManage} ${styles.actionButton}`}
        aria-haspopup="dialog" aria-expanded={flow === 'manage'} aria-controls={flow === 'manage' ? "ai-manage-panel" : undefined}
        onClick={() => flow === 'manage' ? close() : setFlow('manage')}>
        <span className={accessStyles.actionIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6" /></svg>
        </span>
        <span className={accessStyles.actionCopy}><strong>Manage</strong><small>View or disconnect access.</small></span>
        {count !== undefined && <span className={accessStyles.actionMeta}><span className={accessStyles.countPill} aria-label={`${count} active connections`}>{count}</span></span>}
      </button>
    </div>
    {flow && <div className={accessStyles.modalOverlay} data-website-overlay>
      <button type="button" className={accessStyles.modalBackdrop} tabIndex={-1} aria-label="Close AI connection dialog" onClick={close} />
      <section ref={panel} id={`ai-${flow}-panel`}
        className={`${accessStyles.modal} ${accessStyles.notificationStyle}`}
        role="dialog" aria-modal="true" aria-labelledby={`ai-${flow}-title`}
        aria-describedby={`ai-${flow}-description`}>
        <header className={accessStyles.modalHeader}>
          <h2 id={`ai-${flow}-title`}>{flow === 'connect' ? 'Connect your assistant' : 'Your connections'}</h2>
          <p id={`ai-${flow}-description`}>{flow === 'connect' ? admin ? 'Private, read-only reporting across accounts.' : 'Connect your Owner account with read-only access.' : 'View active connections or stop their access.'}</p>
          <button type="button" data-dialog-close className={accessStyles.closeButton} onClick={close} aria-label={`Close ${flow === 'connect' ? 'connection setup' : 'your connections'}`}>×</button>
        </header>
        <div className={`${accessStyles.modalBody} ${styles.flowPanel}`}>
          {flow === 'connect' ? setup : management}
        </div>
      </section>
    </div>}
  </>;
}

export function ServerAddress({ resource }: { resource: string }) {
  const [message, setMessage] = useState('');
  return <div className={styles.serverAddress}>
    <code className={styles.code}>{resource}</code>
    <button type="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(resource);
        setMessage('Server address copied.');
      } catch {
        setMessage('Select the server address above to copy it manually.');
      }
    }}>Copy address</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
