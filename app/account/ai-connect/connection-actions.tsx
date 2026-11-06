'use client';

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from '../../../components/WebsitePortal';
import { useRouter } from 'next/navigation';
import accessStyles from '../app-access-management.module.css';
import styles from './page.module.css';
import { providerLogos } from './provider-logos';

type Flow = 'connect' | 'manage';
type SetupMethod = 'choose' | 'self' | 'help';

function SetupIcon({ help = false }: { help?: boolean }) {
  return <svg className={styles.setupOptionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={help ? 'M4 13v-1a8 8 0 0 1 16 0v1M4 12H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Zm0 7v1a2 2 0 0 1-2 2h-4' : 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2'} />
  </svg>;
}

export default function ConnectionActions({ setup, management, count, assistantOptions = [], admin = false }: {
  admin?: boolean;
  assistantOptions?: { name: string; available: boolean; setup: ReactNode }[];
  setup: ReactNode;
  management: ReactNode;
  count?: number;
}) {
  const [selectedAssistant, setSelectedAssistant] = useState<string | null>(null);
  const [method, setMethod] = useState<SetupMethod>('choose');
  const options = [...assistantOptions, { name: 'Other', available: false, setup: null }];
  const assistant = options.find(option => option.name === selectedAssistant);
  const choosingAssistant = !admin && !assistant;
  const router = useRouter();
  const [checking, startTransition] = useTransition();
  const [checked, setChecked] = useState(false);
  function checkStatus() {
    setChecked(true);
    startTransition(() => router.refresh());
  }
  const [flow, setFlow] = useState<Flow | null>(null);
  const panel = useRef<HTMLElement | null>(null);
  const attachPanel = useCallback((element: HTMLElement | null) => {
    panel.current = element;
    element?.querySelector<HTMLButtonElement>('[data-dialog-close]')?.focus();
  }, []);
  const connectButton = useRef<HTMLButtonElement>(null);
  const manageButton = useRef<HTMLButtonElement>(null);
  const helpMessage = selectedAssistant === 'Other'
    ? 'Hi Aim4price, please help me connect my AI assistant. The assistant I use is: '
    : `Hi Aim4price, please help me connect ${selectedAssistant} to my Aim4price account.`;
  function changeMethod(next: SetupMethod) {
    setMethod(next);
    setChecked(false);
    panel.current?.querySelector<HTMLButtonElement>('[data-dialog-close]')?.focus();
  }

  useEffect(() => {
    if (!flow) return;
    const trigger = flow === 'connect' ? connectButton.current : manageButton.current;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
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
        setSelectedAssistant(null); setMethod('choose'); setChecked(false);
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
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('focusin', keepFocus);
      trigger?.focus({ preventScroll: true });
    };
  }, [flow]);

  function close() {
    setFlow(null);
    setSelectedAssistant(null); setMethod('choose'); setChecked(false);
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
        <span className={accessStyles.actionCopy}><strong>Manage</strong><small>{count === undefined ? 'View or disconnect access.' : count === 0 ? 'No active connections' : `${count} active connection${count === 1 ? '' : 's'}`}</small></span>

      </button>
    </div>
    {flow && createPortal(<div className={`${accessStyles.modalOverlay} ${styles.connectionOverlay}`} data-website-overlay>
      <button type="button" className={accessStyles.modalBackdrop} tabIndex={-1} aria-label="Close AI connection dialog" onClick={close} />
      <section ref={attachPanel} id={`ai-${flow}-panel`}
        className={`${accessStyles.modal} ${accessStyles.notificationStyle} ${styles.connectionModal}`}
        role="dialog" aria-modal="true" aria-labelledby={`ai-${flow}-title`}
        aria-describedby={`ai-${flow}-description`}>
        <header className={accessStyles.modalHeader}>
          <h2 id={`ai-${flow}-title`}>{flow === 'connect' ? choosingAssistant ? 'Choose your assistant' : assistant ? method === 'help' ? 'Connect with help' : `Connect ${assistant.name}` : 'Connect your assistant' : 'Your connections'}</h2>
          <p id={`ai-${flow}-description`}>{flow === 'connect' ? admin ? 'Private, read-only reporting across accounts.' : choosingAssistant ? 'Choose where you want to ask about your Aim4price records.' : 'Connect your Owner account with read-only access.' : 'View active connections or stop their access.'}</p>
          <button type="button" data-dialog-close className={accessStyles.closeButton} onClick={close} aria-label={`Close ${flow === 'connect' ? 'connection setup' : 'your connections'}`} data-modal-close="true">×</button>
        </header>
        <div className={`${accessStyles.modalBody} ${styles.flowPanel} ${flow === 'manage' ? styles.managePanel : styles.connectPanel}`}>
          {flow === 'connect' ? admin ? setup : choosingAssistant ? <div className={styles.assistantChoices}>
            {options.map(option => <button type="button" key={option.name} className={styles.assistantChoice}
              onClick={() => { setSelectedAssistant(option.name); setMethod(option.name === 'Other' ? 'help' : 'choose'); setChecked(false); panel.current?.querySelector<HTMLButtonElement>('[data-dialog-close]')?.focus(); }}>
              <span className={styles.assistantLogo}>{option.name === 'Other' ? <SetupIcon help /> : <img src={providerLogos[option.name]} alt="" width="56" height="56" />}</span>
              <strong>{option.name}</strong>
              <span>{option.name === 'Other' ? 'Connect with help' : option.available ? 'Choose how to connect' : 'Setup help available'}</span>
            </button>)}
          </div> : method === 'help' ? <section className={styles.assistedSetup} aria-labelledby="ai-help-title">
            <span className={styles.helpIcon}><SetupIcon help /></span>
            <div><h3 id="ai-help-title">Let’s connect {assistant?.name === 'Other' ? 'your assistant' : assistant?.name} together</h3>
            <p>Contact Aim4price to arrange setup assistance. We’ll check compatibility and guide you through the connection.</p></div>
            <div className={styles.helpActions}>
              <a className={styles.primary} href={`https://wa.me/27625721650?text=${encodeURIComponent(helpMessage)}`} target="_blank" rel="noopener noreferrer">Request help on WhatsApp</a>
              <a href={`mailto:aim4price@gmail.com?subject=${encodeURIComponent('AI connection setup help')}&body=${encodeURIComponent(helpMessage)}`}>Request help by email</a>
            </div>
            <p className={styles.note}>You’ll sign in and approve access yourself. Please don’t send passwords. Remote assistance can be arranged if needed.</p>
          </section> : method === 'choose' ? <div className={styles.setupChoices}>
            <button type="button" className={styles.setupChoice} disabled={!assistant?.available} onClick={() => changeMethod('self')}>
              <SetupIcon /><strong>Connect yourself</strong>
              <span>{assistant?.available ? 'Follow the setup guide at your own pace.' : 'Self-service is not available yet.'}</span>
            </button>
            <button type="button" className={styles.setupChoice} onClick={() => changeMethod('help')}>
              <SetupIcon help /><strong>Connect with help</strong>
              <span>Ask Aim4price to guide you through setup.</span>
            </button>
          </div> : assistant?.setup : management}

        </div>
        <footer className={styles.dialogFooter}>
          <p role="status">{checking ? 'Checking connection status…' : count === undefined ? 'Connection status unavailable.' : count > 0 ? `${count} active connection${count === 1 ? '' : 's'}` : checked ? 'No approved connections yet. Complete setup in your assistant, then check again.' : 'Access appears here after approval in your assistant.'}</p>
          <div className={styles.footerActions}>
          {flow === 'connect' && assistant && (method === 'choose' || assistant.name === 'Other') && <button type="button" className={styles.changeAssistant} onClick={() => { setSelectedAssistant(null); setMethod('choose'); setChecked(false); panel.current?.querySelector<HTMLButtonElement>('[data-dialog-close]')?.focus(); }}>Change assistant</button>}
          {flow === 'connect' && assistant && assistant.name !== 'Other' && method !== 'choose' && <button type="button" onClick={() => changeMethod('choose')}>Connection options</button>}
          {(flow === 'manage' || admin || (assistant && method === 'self')) && <button type="button" disabled={checking} onClick={checkStatus}>{checking ? 'Checking…' : 'Check connection'}</button>}
          {flow === 'manage' && count === 0 && <button type="button" className={styles.primary} onClick={() => { setSelectedAssistant(null); setMethod('choose'); setChecked(false); setFlow('connect'); }}>Connect assistant</button>}
          </div>
        </footer>
      </section>
    </div>, document.body)}
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

/** Keep advanced instructions in the same dialog without expanding its height. */
export function SetupGuide({ children, manual }: { children: ReactNode; manual: ReactNode }) {
  const [showManual, setShowManual] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (showManual) heading.current?.focus();
  }, [showManual]);
  return <div className={styles.setupGuide}>
    {showManual ? <section className={styles.manualView} aria-labelledby="ai-manual-title">
      <h3 id="ai-manual-title" ref={heading} tabIndex={-1}>Manual connection setup</h3>
      {manual}
    </section> : children}
    <button ref={toggle} type="button" className={styles.setupHelp} onClick={() => {
      setShowManual(!showManual);
      if (showManual) toggle.current?.focus();
    }}>{showManual ? 'Back to connection guide' : 'Manual setup & connection address'}</button>
  </div>;
}
