import { redirect } from 'next/navigation';
import MyInvoicesClient from '../../my-invoices/my-invoices-client';
import { getDealerCostRequestContext } from '../../../lib/dealer-cost-request';
import dealerStyles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    assetId?: string;
    add?: string;
  };
};

export default async function DealerCostsPage({ searchParams }: PageProps) {
  const context = await getDealerCostRequestContext();
  if (!context) redirect('/dealer/login');

  const initialAssetId = String(searchParams?.assetId ?? '').trim();
  const initialOpenAdd = searchParams?.add === '1' && Boolean(initialAssetId);

  return (
    <div className={dealerStyles.module}>
      <MyInvoicesClient
        dealerMode
        initialAssetId={initialAssetId}
        initialOpenAdd={initialOpenAdd}
        initialDealerDefaults={{
          supplierName: context.actor.supplierName,
          vatNumber: context.vatNumber,
          address: context.address,
        }}
      />
    </div>
  );
}
