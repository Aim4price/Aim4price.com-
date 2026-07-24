'use client';

import DealerMaintenanceTrackerClient from '../../../components/DealerMaintenanceTrackerClient';
import type { DealerMaintenanceTrackedAsset } from '../../../lib/dealer-maintenance-tracker';

export default function DealerMaintenanceClient({
  initialAssets,
  initialOpenAccessId,
}: {
  initialAssets: DealerMaintenanceTrackedAsset[];
  initialOpenAccessId?: string | null;
}) {
  return <DealerMaintenanceTrackerClient dealerAppMode initialAssets={initialAssets} initialOpenAccessId={initialOpenAccessId} />;
}
