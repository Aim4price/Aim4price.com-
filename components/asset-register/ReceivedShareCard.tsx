import Link from 'next/link';
import RecipientAssetSummary from '../leads/RecipientAssetSummary';
import styles from '../../app/leads/shared-assets.module.css';
import type { listReceivedSharedEnquiries } from '../../lib/guest-leads';

type ReceivedShare = Awaited<ReturnType<typeof listReceivedSharedEnquiries>>[number];

export default function ReceivedShareCard({ share }: { share: ReceivedShare }) {
  return (
    <article className={styles.frame}>
      <RecipientAssetSummary
        title={share.title}
        sender={share.sender}
        date={new Date(share.created_at).toLocaleDateString('en-ZA')}
        pills={[`${share.assetCount} ${share.assetCount === 1 ? 'asset' : 'assets'}`]}
        message={share.request}
        action={<Link className={styles.toggle} href={`/asset-share/${share.token}`} aria-label={`Open ${share.title}`}>Open</Link>}
      />
    </article>
  );
}
