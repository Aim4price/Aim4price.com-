import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import { readPublicAssetShare } from '../../../lib/asset-share-links';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Asset enquiry', robots: { index: false, follow: false, noarchive: true }, referrer: 'no-referrer' as const };

export default async function Page({ searchParams }: { searchParams: { from?: string | string[]; share?: string | string[] } }) {
  const token = typeof searchParams.share === 'string' ? searchParams.share : '';
  const share = token ? await readPublicAssetShare(token) : null;
  return <><Suspense fallback={null}><AppHeader active="none"/></Suspense>
    <main className={styles.page}>
      <div className={styles.overlay} aria-hidden="true"/>
      <div className={styles.layout}>
        <section className={styles.copy}>
          <h1><span>Asset details.</span><span>Shared with you.</span></h1>
          {share ? <>
            <p className={styles.sender}><strong>{share.senderName || 'An Aim4price business'}</strong> would like to share asset details with your business.</p>
            <div className={styles.summary}>
              <span className={styles.assetIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9"/></svg></span>
              <div><h2>{share.assets.length} {share.assets.length === 1 ? 'asset shared' : 'assets shared'}</h2>
                {share.umbrellaName ? <p className={styles.umbrella}>{share.umbrellaName}</p> : <ul>{share.assets.map((asset, index) => <li key={index}>{asset.title}</li>)}</ul>}
              </div>
            </div>
            <p className={styles.hint}>Open the enquiry to view the asset details.</p>
          </> : <div className={styles.empty}>
            <h2>{token ? 'This enquiry is no longer available' : 'Waiting for an invitation'}</h2>
            <p>Ask the sender for a link with the assets they want to share with you.</p>
          </div>}
        </section>
        {share && <a className={styles.action} href={`/asset-share/${encodeURIComponent(token)}`}>
          <span className={styles.actionIcon} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 9a2 2 0 0 1 2-2h7l3 3h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="m12 21 8-8m-7 0h7v7"/></svg></span>
          <strong>Open enquiry</strong>
          <span className={styles.actionHint}>{share.assets.length === 1 ? 'View the shared asset' : 'View the shared assets'}</span>
        </a>}
      </div>
    </main>
  </>;
}
