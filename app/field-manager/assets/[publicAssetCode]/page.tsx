import ScanClient from '../../../scan/[publicAssetCode]/scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicAssetCode: string;
  };
  searchParams?: {
    assetId?: string;
    scheduledMaintenanceId?: string;
    scheduledMaintenanceType?: string;
    from?: string;
    overviewRange?: string;
  };
};

export default function FieldManagerAssetUpdatePage({ params, searchParams }: PageProps) {
  const openedFromOverview = searchParams?.from === 'overview';
  const overviewRange = searchParams?.overviewRange === 'month' ? 'month' : 'week';

  return (
    <ScanClient
      publicAssetCode={params.publicAssetCode ?? ''}
      fieldManagerMode
      fieldManagerAssetId={searchParams?.assetId ?? null}
      fieldManagerScheduledMaintenanceId={searchParams?.scheduledMaintenanceId ?? null}
      fieldManagerScheduledMaintenanceType={searchParams?.scheduledMaintenanceType ?? null}
      fieldManagerReturnTo={
        openedFromOverview
          ? `/field-manager/overview?range=${overviewRange}`
          : '/field-manager/assets'
      }
    />
  );
}
