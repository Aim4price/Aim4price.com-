import type { ReactNode } from 'react';
import type { PublicAssetShare } from '../../lib/asset-share-links';
import styles from './SharedAssetCards.module.css';
const money = (value: number | null) => value != null && Number.isFinite(value) && value > 0 ? `R ${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}` : 'Not saved';
export default function SharedAssetCards({ share, request, actions }: { share: PublicAssetShare | null; request?: ReactNode; actions?: ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.brand}>Aim4price<span>.</span></span><span>Shared asset details</span></header>
    {!share ? <section className={styles.empty}><h1>This link is no longer available</h1><p>Ask the sender for a new asset link.</p></section> : <>
      <div className={styles.intro}><p>READ-ONLY ASSET SNAPSHOT</p><h1>{share.assets.length === 1 ? 'Your shared asset' : `${share.assets.length} shared assets`}</h1><span>Shared {new Date(share.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })}. Details reflect the date shared.</span></div>
      {request}
      <div className={styles.assets}>{share.assets.map((asset, index) => <article key={index} className={styles.card}>
        {asset.photoUrls.length ? <div className={styles.photos}>{asset.photoUrls.map((url, i) => <img key={url} src={url} alt={`${asset.title}, photo ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" />)}</div> : null}
        <div className={styles.details}><h2>{asset.title}</h2><dl className={styles.facts}>
          {[['Serial number', asset.serialNumber], ['Year', asset.yearModel], ['Usage', asset.usage], ['Condition', asset.condition]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value || 'Not saved'}</dd></div>)}
        </dl><div className={styles.values}><div><span>Current value · excl. VAT</span><strong>{money(asset.valueExVat)}</strong></div><div><span>Replacement price · excl. VAT</span><strong>{money(asset.replacementPriceExVat)}</strong></div></div></div>
      </article>)}</div>
      {actions}
      <p className={styles.note}>Values are saved estimates and remain subject to inspection.</p>
    </>}
  </main>;
}
