import ValuationClient from '../../valuation/valuation-client';
import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppValuationPage() {
  await requireOwnerAppPageAccess();
  return <div className={styles.module}><OwnerAppNav /><ValuationClient ownerAppMode /></div>;
}
