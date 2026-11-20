'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import access from '../app-access-management.module.css';
import styles from '../ai-connect/page.module.css';
import local from './accounting.module.css';

const brands = { sage: 'Sage', xero: 'Xero', quickbooks: 'QuickBooks', zoho: 'Zoho Books' } as const;
type Brand = keyof typeof brands;
export type Choice = { brand: Brand; label: string; href: string; ready: boolean; connected: boolean; company?: string | null };
type View = 'choose' | 'manage' | 'other' | Brand;
const message = encodeURIComponent('Hi Aim4price Admin, please help me connect my accounting software. I use: ');

export default function AccountingActions({ choices }: { choices: Choice[] }) {
  const [view, setView] = useState<View>('choose');
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const connections = choices.filter(choice => choice.connected);

  function show(next: View) {
    setView(next);
    if (!dialog.current?.open) dialog.current?.showModal();
    heading.current?.focus();
  }

  const isBrand = view !== 'choose' && view !== 'manage' && view !== 'other';
  const title = isBrand ? brands[view] : view === 'choose' ? 'Choose your accounting software' : view === 'other' ? 'Contact Aim4price Admin' : 'Your connections';
  const visible = view === 'manage' ? connections : choices.filter(choice => choice.brand === view);

  return <>
    <div className={access.actionGrid}>
      {(['choose', 'manage'] as const).map(action => <button key={action} type="button" aria-haspopup="dialog" onClick={() => show(action)}
        className={`${access.actionButton} ${action === 'choose' ? access.actionButtonNew : access.actionButtonManage} ${styles.actionButton}`}>
        <span className={access.actionIcon}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={action === 'choose' ? 'M12 5v14M5 12h14' : 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6'} /></svg></span>
        <span className={access.actionCopy}><strong>{action === 'choose' ? 'Connect software' : 'Manage'}</strong>
          <small>{action === 'choose' ? 'Choose your accounting platform.' : connections.length ? `${connections.length} active connection${connections.length === 1 ? '' : 's'}` : 'No active connections'}</small></span>
      </button>)}
    </div>
    <dialog ref={dialog} aria-labelledby="accounting-title" className={`${access.modal} ${access.notificationStyle} ${styles.connectionModal} ${local.dialog}`}
      onClick={event => { if (event.target === dialog.current) {
        const box = dialog.current.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.current.close();
      } }}>
      <header className={access.modalHeader}>
        <h2 id="accounting-title" className={styles.flowTitle} ref={heading} tabIndex={-1}>{isBrand && <span className={styles.titleLogo}><img alt="" src={`/accounting/${view}.svg`} width="32" height="32" /></span>}{title}</h2>
        <p>{view === 'choose' ? 'Which platform do you use for bookkeeping?' : view === 'manage' ? 'Open a connection to preview bills or disconnect.' : view === 'other' ? 'Tell us which accounting software you use so we can help.' : view === 'sage' ? 'Choose the Sage product you use.' : 'View setup for your accounting platform.'}</p>
        <button type="button" data-modal-close="true" className={access.closeButton} onClick={() => dialog.current?.close()} aria-label="Close accounting connections">×</button>
      </header>
      <div className={`${access.modalBody} ${styles.flowPanel}`}>
        {view === 'choose' ? <div className={`${styles.assistantChoices} ${local.providerGrid}`}>{(Object.keys(brands) as Brand[]).map(brand =>
          <button type="button" key={brand} className={styles.assistantChoice} onClick={() => show(brand)}>
            <span className={styles.assistantLogo}><img alt="" src={`/accounting/${brand}.svg`} width="56" height="56" /></span><strong>{brands[brand]}</strong>
          </button>)}
          <button type="button" className={styles.assistantChoice} onClick={() => show('other')}>
            <span className={styles.assistantLogo}><svg className={styles.setupOptionIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></span><strong>Other</strong>
          </button>
        </div> : view === 'other' ? <div className={styles.helpActions}>
          <a className={styles.contactChoice} href={`https://wa.me/27625721650?text=${message}`} target="_blank" rel="noopener noreferrer"><strong>WhatsApp</strong><span className={styles.contactAction}>Open WhatsApp</span></a>
          <a className={styles.contactChoice} href={`mailto:aim4price@gmail.com?subject=Accounting%20connection&body=${message}`}><strong>Email</strong><span className={styles.contactAction}>Write an email</span></a>
        </div> : visible.length ? <div className={local.options}>{visible.map(choice => <div key={choice.href}>
          <strong>{choice.label}</strong>
          {choice.company && <span>{choice.company}</span>}
          {choice.ready ? <Link prefetch={false} href={choice.href}>{choice.href.endsWith('sage-export') ? 'Preview a file' : choice.connected ? 'Manage connection' : 'Open setup'}</Link> : <span>Awaiting provider setup</span>}
        </div>)}</div> : <div className={styles.empty}><h3>No active connections</h3><p>Choose your accounting software to get started.</p></div>}
      </div>
      <footer className={styles.dialogFooter}><p>{view === 'other' ? 'You can edit the message before sending.' : 'Only the company you approve will be connected.'}</p>
        {view !== 'choose' && <div className={styles.footerActions}><button type="button" onClick={() => show('choose')}>Choose software</button></div>}
      </footer>
    </dialog>
  </>;
}
