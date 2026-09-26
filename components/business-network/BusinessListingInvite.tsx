'use client';
import ShareModalCloseButton from '../asset-register/ShareModalCloseButton';

import { useId, useRef, useState } from 'react';
import { createPortal } from '../WebsitePortal';
import { buildEmailShareUrl, buildWhatsAppShareUrl } from '../../lib/asset-external-share';
import styles from './BusinessListingInvite.module.css';

export default function BusinessListingInvite({ senderName = '', assetIds, includePhotos = false }: { senderName?: string; assetIds: string[]; includePhotos?: boolean }) {
  const titleId = useId();
  const descriptionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opening = useRef(false);
  const [link, setLink] = useState('');
  const [notice, setNotice] = useState('');
  const [showCopyField, setShowCopyField] = useState(false);
  const copy = {
    subject: 'An invitation to the Aim4price business directory',
    body: `${senderName || 'We'} would like to share asset details and requests with you through Aim4price. Open the enquiry to view the selected assets.\n\nView the enquiry here:\n${link}`,
  };

  async function open() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true); setError(''); setNotice(''); setShowCopyField(false);
    try {
      if (!assetIds.length) throw new Error('Select the assets you want to include in this enquiry.');
      const url = new URL('/business-network/accept', window.location.origin);
      if (senderName.trim()) url.searchParams.set('from', senderName.trim().slice(0, 120));
      if (assetIds.length) {
        const response = await fetch('/api/asset-share-links', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetIds, includePhotos }),
        });
        const data = await response.json();
        if (!response.ok || !data.share?.token) throw new Error(data.error || 'Unable to prepare the enquiry. Please try again.');
        url.searchParams.set('share', data.share.token);
      }
      setLink(url.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to prepare the enquiry. Please try again.');
    } finally { opening.current = false; setBusy(false); }
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
    <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" disabled={busy} onClick={() => void open()}>
      <span>{busy ? 'Preparing enquiry…' : 'Business not listed?'}</span><span aria-hidden="true">+</span>
    </button>
    {error && <p role="alert">{error}</p>}
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
          <ShareModalCloseButton aria-label="Close business invitation" onClick={() => dialog.current?.close()} />
        </header>
        <p id={descriptionId} className={styles.description}>{assetIds.length ? `Share an enquiry with all ${assetIds.length} selected ${assetIds.length === 1 ? 'asset' : 'assets'}. They can open the asset cards and add their business details afterwards.` : 'Send an invitation to receive asset enquiries through Aim4price.'}</p>
        <div className={styles.actions}>
          <a className={styles.whatsapp} href={buildWhatsAppShareUrl(copy)} target="_blank" rel="noopener noreferrer">
            <span className={styles.actionIcon}><svg className={styles.whatsappGlyph} viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.892-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.892 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.3-1.654a11.882 11.882 0 0 0 5.69 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg></span>
            <strong>WhatsApp</strong>
          </a>
          <a className={styles.email} href={buildEmailShareUrl(copy)}>
            <span className={styles.actionIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></span>
            <strong>Email</strong>
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
