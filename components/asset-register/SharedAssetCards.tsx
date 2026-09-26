'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import type { PublicAssetShare } from '../../lib/asset-share-links';
import ShareModalCloseButton from './ShareModalCloseButton';
import BusinessAcceptanceForm from '../business-network/BusinessAcceptanceForm';
import { createPortal } from '../WebsitePortal';
import assetStyles from '../../app/asset-register/page.module.css';
import leadStyles from '../../app/leads/page.module.css';
import dialogStyles from '../AccountDialog.module.css';
import styles from './SharedAssetCards.module.css';

const money = (value: number | null) => value != null && Number.isFinite(value) && value > 0 ? `R ${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}` : 'Not saved';

export default function SharedAssetCards({ share, request, actions, example = false, senderName = '', allowBusinessDetails = false }: {
  example?: boolean; share: PublicAssetShare | null; request?: ReactNode; actions?: ReactNode;
  senderName?: string; allowBusinessDetails?: boolean;
}) {
  const [managed, setManaged] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const asset = managed == null ? null : share?.assets[managed];
  const date = share ? new Date(share.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' }) : '';
  return <main className={`${leadStyles.leadsPage} ${leadStyles.dealerOwnerParity} ${styles.page}`}>
    <header className={styles.header}><span className={styles.brand}>Aim4price<span>.</span></span><span>{example ? 'Example enquiry · fictional details' : 'Asset enquiry'}</span></header>
    {!share ? <section className={styles.empty}><h1>This link is no longer available</h1><p>Ask the sender for a new asset link.</p></section> : <>
      <div className={styles.intro}>
        <h1>{example ? 'Example enquiry' : senderName ? `Enquiry from ${senderName}` : 'Your asset enquiry'}</h1>
        <span>{example ? 'Fictional assets for illustration.' : `${share.assets.length} ${share.assets.length === 1 ? 'asset' : 'assets'} shared on ${date}.`}</span>
      </div>
      {request}
      <div className={`${leadStyles.leadStack} ${styles.assets}`}>
        {share.assets.map((item, index) => <article key={index} className={`${leadStyles.leadThread} ${leadStyles.leadThreadNew}`}>
          <div className={leadStyles.clientPanel}>
            <div className={leadStyles.clientPanelHeader}>
              <div className={leadStyles.clientIdentity}>
                <div className={leadStyles.leadCardTitleRow}><h3>{item.title}</h3></div>
                <div className={leadStyles.leadAssetContext}>
                  {senderName && <strong className={leadStyles.leadAssetName}>{senderName}</strong>}
                  {item.serialNumber && <span className={leadStyles.leadAssetIdentifier}>{item.serialNumber}</span>}
                </div>
                <span className={leadStyles.clientKicker}>{[item.yearModel, item.usage, item.condition].filter(Boolean).join(' · ')}</span>
              </div>
              <div className={leadStyles.clientDecisionArea}>
                <div className={`${assetStyles.valueBlock} ${leadStyles.leadValueBlock}`}><strong>{money(item.valueExVat)}</strong><span>Excl. VAT</span></div>
                <div className={leadStyles.clientActionRow}>
                  <button type="button" className={`${assetStyles.primaryButton} ${leadStyles.openLeadButton}`} aria-haspopup="dialog" aria-label={`Manage ${item.title}`} onClick={event => { trigger.current = event.currentTarget; setManaged(index); }}>Manage</button>
                </div>
              </div>
            </div>
          </div>
        </article>)}
      </div>
      {allowBusinessDetails && <details className={styles.businessDetails}>
        <summary>Add your business details</summary>
        <BusinessAcceptanceForm embedded />
      </details>}
      <p className={styles.note}>Only the details selected by the sender are shared. Values are saved estimates and remain subject to inspection.</p>
    </>}
    {asset && createPortal(<dialog ref={node => { dialog.current = node; if (node && !node.open) node.showModal(); }}
      className={`${dialogStyles.surface} ${styles.manageDialog}`} aria-labelledby={titleId}
      onClose={() => { setManaged(null); trigger.current?.focus(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
      }}>
      <header className={dialogStyles.header}><div><h2 id={titleId}>{asset.title}</h2><p>Manage enquiry</p></div><ShareModalCloseButton aria-label="Close enquiry management" onClick={() => dialog.current?.close()} /></header>
      <div className={dialogStyles.body}>
        <dl className={styles.facts}>{[['Serial number', asset.serialNumber], ['Year', asset.yearModel], ['Usage', asset.usage], ['Condition', asset.condition]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value || 'Not saved'}</dd></div>)}</dl>
        <div className={styles.values}><div><span>Current value · excl. VAT</span><strong>{money(asset.valueExVat)}</strong></div><div><span>Replacement price · excl. VAT</span><strong>{money(asset.replacementPriceExVat)}</strong></div></div>
        {asset.photoUrls.length > 0 && <div className={styles.photos}>{asset.photoUrls.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${asset.title}, photo ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" />)}</div>}
        {actions && <section aria-label="Enquiry actions"><p className={styles.note}>These actions apply to the shared enquiry.</p>{actions}</section>}
        {!actions && <p className={styles.note}>The sender has shared asset details only. No reports or reply actions were included.</p>}
      </div>
    </dialog>, document.body)}
  </main>;
}
