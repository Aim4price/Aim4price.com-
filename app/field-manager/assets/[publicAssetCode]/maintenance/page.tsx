import FieldManagerMaintenanceClient from './field-manager-maintenance-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicAssetCode: string;
  };
  searchParams?: {
    assetId?: string;
    from?: string;
    overviewRange?: string;
  };
};

export default function FieldManagerMaintenancePage({ params, searchParams }: PageProps) {
  const assetId = String(searchParams?.assetId ?? '').trim();
  const assetParams = new URLSearchParams();
  if (assetId) assetParams.set('assetId', assetId);
  if (searchParams?.from === 'overview') {
    assetParams.set('from', 'overview');
    assetParams.set('overviewRange', searchParams?.overviewRange === 'week' ? 'week' : 'upcoming');
  }
  const query = assetParams.toString();
  const assetHref = `/field-manager/assets/${encodeURIComponent(params.publicAssetCode ?? '')}${query ? `?${query}` : ''}`;

  return (
    <FieldManagerMaintenanceClient
      publicAssetCode={params.publicAssetCode ?? ''}
      assetId={assetId}
      assetHref={assetHref}
    />
  );
}
