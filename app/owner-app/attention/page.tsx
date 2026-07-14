import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';
import OwnerAttentionClient from './owner-attention-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAttentionPage() {
  await requireOwnerAppPageAccess();
  return <main className={styles.page}><OwnerAppNav /><OwnerAttentionClient /></main>;
}
