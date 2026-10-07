'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import accessStyles from '../app-access-management.module.css';
import styles from './page.module.css';

type Flow = 'connect' | 'manage';

export default function ConnectionActions({ setup, management, count }: {
  setup: ReactNode;
  management: ReactNode;
  count?: number;
}) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const panel = useRef<HTMLElement>(null);
  const connectButton = useRef<HTMLButtonElement>(null);
  const manageButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (flow) panel.current?.focus({ preventScroll: true });
  }, [flow]);

  function close() {
    const trigger = flow === 'connect' ? connectButton : manageButton;
    setFlow(null);
    trigger.current?.focus();
  }

  return <>
    <div className={accessStyles.actionGrid} aria-label="AI connection actions">
      <button ref={connectButton} type="button"
        className={`${accessStyles.actionButton} ${accessStyles.actionButtonNew} ${styles.actionButton}`}
        aria-expanded={flow === 'connect'} aria-controls="ai-connect-panel"
        onClick={() => flow === 'connect' ? close() : setFlow('connect')}>
        <span className={accessStyles.actionIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        <span className={accessStyles.actionCopy}><strong>Connect</strong><small>Set up ChatGPT.</small></span>
      </button>
      <button ref={manageButton} type="button"
        className={`${accessStyles.actionButton} ${accessStyles.actionButtonManage} ${styles.actionButton}`}
        aria-expanded={flow === 'manage'} aria-controls="ai-manage-panel"
        onClick={() => flow === 'manage' ? close() : setFlow('manage')}>
        <span className={accessStyles.actionIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6" /></svg>
        </span>
        <span className={accessStyles.actionCopy}><strong>Manage</strong><small>View or disconnect access.</small></span>
        {count !== undefined && <span className={accessStyles.actionMeta}><span className={accessStyles.countPill} aria-label={`${count} active connections`}>{count}</span></span>}
      </button>
    </div>
    {(['connect', 'manage'] as const).map(kind => <section key={kind}
      id={`ai-${kind}-panel`} hidden={flow !== kind} ref={flow === kind ? panel : undefined}
      className={styles.flowPanel} tabIndex={-1} aria-labelledby={`ai-${kind}-title`}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div className={styles.sectionHeading}>
        <h2 id={`ai-${kind}-title`}>{kind === 'connect' ? 'Connect ChatGPT' : 'Your connections'}</h2>
        <button type="button" className={styles.closeButton} onClick={close} aria-label={`Close ${kind === 'connect' ? 'connection setup' : 'your connections'}`}>Close <span aria-hidden="true">×</span></button>
      </div>
      {kind === 'connect' ? setup : management}
    </section>)}
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
