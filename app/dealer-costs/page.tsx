import { redirect } from 'next/navigation';
import { getDealerCostRequestContext } from '../../lib/dealer-cost-request';
import MyInvoicesClient from '../my-invoices/my-invoices-client';

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
  if (!context) redirect('/account');

  const initialAssetId = String(searchParams?.assetId ?? '').trim();
  const initialOpenAdd = searchParams?.add === '1' && Boolean(initialAssetId);

  return (
    <MyInvoicesClient
      dealerMode
      showAppHeader
      initialAssetId={initialAssetId}
      initialOpenAdd={initialOpenAdd}
      initialDealerDefaults={{
        supplierName: context.actor.supplierName,
        vatNumber: context.vatNumber,
        address: context.address,
      }}
    />
  );
}
