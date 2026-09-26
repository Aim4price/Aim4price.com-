import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import { readPublicAssetShare } from '../../../lib/asset-share-links';
import styles from '../../../components/business-network/BusinessAcceptanceForm.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Asset enquiry', robots: { index: false, follow: false, noarchive: true }, referrer: 'no-referrer' as const };

export default async function Page({ searchParams }: { searchParams: { from?: string | string[]; share?: string | string[] } }) {
  const senderName = typeof searchParams.from === 'string' ? searchParams.from.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) : '';
  const token = typeof searchParams.share === 'string' ? searchParams.share : '';
  const share = token ? await readPublicAssetShare(token) : null;
  const enquiryUrl = share ? `/asset-share/${encodeURIComponent(token)}${senderName ? `?from=${encodeURIComponent(senderName)}` : ''}` : '';
  return <><Suspense fallback={null}><AppHeader active="none"/></Suspense>
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1>{senderName ? `${senderName} wants to share asset details with you.` : 'An easier way to receive asset details.'}</h1>
        <p>Open the enquiry to view the assets shared with your business.</p>
      </header>
      <section className={styles.card}>
        {share ? <>
          <h2>Asset enquiry</h2>
          <p>{share.assets.length} {share.assets.length === 1 ? 'asset shared' : 'assets shared'} with you.</p>
          <ul>{share.assets.map((asset, index) => <li key={index}>{asset.title}</li>)}</ul>
          <a className={styles.exampleButton} href={enquiryUrl}>Open enquiry</a>
        </> : <>
          <h2>{token ? 'This enquiry is no longer available' : 'Receive asset enquiries'}</h2>
          <p>Ask the sender for a link with the assets they want to share with you.</p>
        </>}
      </section>
    </main>
  </>;
}
