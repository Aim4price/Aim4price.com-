import ScanClient from '../../../scan/[publicAssetCode]/scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicAssetCode: string;
  };
  searchParams?: {
    reportProblem?: string;
    assetId?: string;
    scheduledMaintenanceId?: string;
    scheduledMaintenanceType?: string;
    from?: string;
    overviewRange?: string;
  };
};

export default function FieldManagerAssetUpdatePage({ params, searchParams }: PageProps) {
  const openedFromOverview = searchParams?.from === 'overview';
  const overviewRange = searchParams?.overviewRange === 'week' ? 'week' : 'upcoming';

  return (
    <ScanClient
      publicAssetCode={params.publicAssetCode ?? ''}
      reportProblemMode={searchParams?.reportProblem === '1'}
      fieldManagerMode
      fieldManagerAssetId={searchParams?.assetId ?? null}
      fieldManagerScheduledMaintenanceId={searchParams?.scheduledMaintenanceId ?? null}
      fieldManagerScheduledMaintenanceType={searchParams?.scheduledMaintenanceType ?? null}
      fieldManagerReturnTo={
        searchParams?.reportProblem === '1' ? '/field-manager/report-problem' : openedFromOverview
          ? `/field-manager/overview?range=${overviewRange}`
          : '/field-manager/assets'
      }
    />
  );
}
