'use client';

import DealerMaintenanceTrackerClient from '../../components/DealerMaintenanceTrackerClient';
import type { DealerMaintenanceTrackedAsset } from '../../lib/dealer-maintenance-tracker';

export default function TrackingClient({
  initialAssets,
  initialOpenAccessId,
}: {
  initialAssets: DealerMaintenanceTrackedAsset[];
  initialOpenAccessId?: string | null;
}) {
  return <DealerMaintenanceTrackerClient initialAssets={initialAssets} initialOpenAccessId={initialOpenAccessId} />;
}
