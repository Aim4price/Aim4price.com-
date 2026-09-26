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
  const senderName = share?.senderName || '';
  const enquiryUrl = share ? `/asset-share/${encodeURIComponent(token)}` : '';
  return <><Suspense fallback={null}><AppHeader active="none"/></Suspense>
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>AIM4PRICE · ASSET ENQUIRY</span>
        <h1>{share ? 'Asset details, shared with you.' : 'Receive asset enquiries.'}</h1>
        <p>{share ? 'Review the shared assets and open the enquiry to see their details.' : 'Your next asset enquiry starts here.'}</p>
      </header>
      <section className={styles.card} aria-labelledby="enquiry-title">
        {share ? <>
          <div className={styles.sender}>
            <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2"/></svg></span>
            <div><span className={styles.label}>SHARED BY</span><h2 id="enquiry-title">{senderName || 'An Aim4price business'}</h2><p>would like to share asset details with your business.</p></div>
          </div>
          <div className={styles.assets}>
            <div className={styles.listHeading}><h3>Included in this enquiry</h3><span className={styles.count}>{share.assets.length} {share.assets.length === 1 ? 'asset' : 'assets'}</span></div>
            <ul>{share.assets.map((asset, index) => <li key={index}>
              <span className={styles.assetIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9"/></svg></span>
              <span className={styles.assetTitle}>{asset.title}</span>
            </li>)}</ul>
          </div>
          <footer className={styles.footer}><p>View the assets and add your business details.</p><a className={styles.primary} href={enquiryUrl}>Open enquiry <span aria-hidden="true">→</span></a></footer>
        </> : <div className={styles.empty}>
          <h2 id="enquiry-title">{token ? 'This enquiry is no longer available' : 'Waiting for an invitation'}</h2>
          <p>Ask the sender for a link with the assets they want to share with you.</p>
        </div>}
      </section>
      <p className={styles.note}>Asset sharing through Aim4price</p>
    </main>
  </>;
}
