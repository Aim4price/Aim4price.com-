'use client';

import { useId, useRef, useState } from 'react';
import { createPortal } from '../WebsitePortal';
import { buildEmailShareUrl, buildWhatsAppShareUrl } from '../../lib/asset-external-share';
import styles from './BusinessListingInvite.module.css';

export default function BusinessListingInvite() {
  const titleId = useId();
  const descriptionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [link, setLink] = useState('');
  const [notice, setNotice] = useState('');
  const [showCopyField, setShowCopyField] = useState(false);
  const copy = {
    subject: 'An invitation to the Aim4price business directory',
    body: `Hi, I’d like to invite your business to the Aim4price directory. A basic listing is free and no Aim4price account is required.\n\nConfirm your business details and accept your listing here:\n${link}`,
  };

  function open() {
    setNotice('');
    setShowCopyField(false);
    setLink(new URL('/business-network/accept', window.location.origin).href);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setNotice('Invitation link copied.');
    } catch {
      setShowCopyField(true);
      setNotice('Select and copy the link below.');
    }
  }

  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" onClick={open}>
      <span>Business not listed?</span><span aria-hidden="true">+</span>
    </button>
    {link && createPortal(
      <dialog
        ref={node => { dialog.current = node; if (node && !node.open) node.showModal(); }}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={event => event.stopPropagation()}
        onCancel={event => event.stopPropagation()}
        onClose={() => { setLink(''); trigger.current?.focus(); }}
        onClick={event => {
          event.stopPropagation();
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
        }}
      >
        <header className={styles.header}>
          <h2 id={titleId}>Invite a business</h2>
          <button type="button" className={styles.close} aria-label="Close business invitation" onClick={() => dialog.current?.close()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <p id={descriptionId} className={styles.description}>Send them a link to join the directory. They confirm their details, and Aim4price reviews the listing.</p>
        <div className={styles.actions}>
          <a className={styles.whatsapp} href={buildWhatsAppShareUrl(copy)} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.2-4.6a8.5 8.5 0 1 1 16.3-3.9Z"/><path d="M8.5 7.5c-.7 2.8 3.2 6.7 6 6l1-1.5-2-1-1 1c-1.5-.6-2.5-1.6-3-3l1-1-1-2Z"/></svg>
            WhatsApp
          </a>
          <a className={styles.email} href={buildEmailShareUrl(copy)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
            Email
          </a>
        </div>
        <p className={styles.hint}>Choose the recipient in WhatsApp or your email app. A basic listing is free; no account is required.</p>
        <footer className={styles.footer}>
          <button type="button" className={styles.copy} onClick={() => void copyLink()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/></svg>
            Copy link
          </button>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </footer>
        {showCopyField && <input className={styles.copyField} aria-label="Business invitation link" readOnly value={link} onFocus={event => event.currentTarget.select()}/>}
      </dialog>, document.body,
    )}
  </>;
}
