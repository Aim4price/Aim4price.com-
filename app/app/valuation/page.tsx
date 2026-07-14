import dealerStyles from '../../dealer/dealer.module.css';
import ValuationClient from '../../valuation/valuation-client';
import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppValuationPage() {
  await requireOwnerAppPageAccess();

  return (
    <div className={dealerStyles.module}>
      <OwnerAppNav title="Get Estimate" backHref="/app" />
      <ValuationClient dealerAppMode appHomeHref="/app" marketplaceHref="/marketplace" />
    </div>
  );
}
