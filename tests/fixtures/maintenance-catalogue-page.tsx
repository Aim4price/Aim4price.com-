'use client';
// Installed temporarily by the browser runner, never a production route.
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DealerMaintenanceTrackerClient from '../../components/DealerMaintenanceTrackerClient';
import type { DealerMaintenanceTrackedAsset } from '../../lib/dealer-maintenance-tracker';
import trackerData from '../../tests/fixtures/account-dialog-data.json';
import DesktopServiceModal from '../../components/DesktopServiceModal';
import ScanClient from '../../app/scan/[publicAssetCode]/scan-client';
import MaintenanceCatalogueClient from '../../app/admin/maintenance-catalogue/maintenance-catalogue-client';
import { maintenanceIdentity } from '../../lib/maintenance-catalogue';
export default function Page() {
  const params = useSearchParams(); const [result,setResult] = useState<unknown>(null);
  if (params.get('view') === 'dealer') { const asset = { ...trackerData.asset, nextMaintenance: null, openMaintenanceRecords: [], maintenanceRecords: [], completedMaintenanceRecords: [], permissions: { ...trackerData.asset.permissions, canAddMaintenance: true, canViewParts: true, canAddParts: true } } as DealerMaintenanceTrackedAsset; return <DealerMaintenanceTrackerClient dealerAppMode initialAssets={[asset]} initialOpenAccessId={asset.accessId} />; }
  if (params.get('view') === 'admin') return <MaintenanceCatalogueClient />;
  if (params.get('view') === 'field-manager') return <ScanClient publicAssetCode="A4P-TEST" fieldManagerMode fieldManagerAssetId="11111111-1111-4111-8111-111111111111" />;
  if (params.get('view') === 'app') return <ScanClient publicAssetCode="A4P-TEST" ownerAppMode ownerAppAssetId="11111111-1111-4111-8111-111111111111" ownerAppOperatorName="Test owner" />;
  const identity = params.get('source') === 'advanced' ? maintenanceIdentity({equipmentFamilyId:114}) : maintenanceIdentity({specsJson:{basic_catalogue_release:'basic_ballpark_20260907_v1',basic_catalogue:{familyKey:'plough'}}});
  return <><DesktopServiceModal record={{id:'fixture',assetTitle:'Test plough',assetKind:'tractor',maintenanceIdentity:identity,maintenanceType:'checkup',title:'Inspect',currentUsage:null,usageMetric:'percentage'}} onClose={() => {}} onSubmit={setResult} /><pre id="result">{JSON.stringify(result)}</pre></>;
}
