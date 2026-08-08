'use client';

import { useEffect, useState } from 'react';
import DealerMaintenancePagination from '../../components/DealerMaintenancePagination';
import DealerMaintenanceTrackerClient from '../../components/DealerMaintenanceTrackerClient';
import type { DealerMaintenanceTrackedAsset } from '../../lib/dealer-maintenance-tracker';

type TrackerResponse = {
  ok?: boolean;
  assets?: DealerMaintenanceTrackedAsset[];
};

export default function TrackingClient({
  initialAssets,
  initialAssetsHaveMore = false,
  initialOpenAccessId,
}: {
  initialAssets: DealerMaintenanceTrackedAsset[];
  initialAssetsHaveMore?: boolean;
  initialOpenAccessId?: string | null;
}) {
  const [assets, setAssets] = useState(initialAssets);

  useEffect(() => setAssets(initialAssets), [initialAssets]);

  useEffect(() => {
    if (!initialAssetsHaveMore) return undefined;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch('/api/dealer/maintenance', {
            credentials: 'include',
            cache: 'no-store',
          });
          const payload = await response.json().catch(() => null) as TrackerResponse | null;
          if (!cancelled && response.ok && payload?.ok && Array.isArray(payload.assets)) {
            setAssets(payload.assets);
          }
        } catch {
          // Keep the fast first page available if background hydration temporarily fails.
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [initialAssetsHaveMore]);

  return (
    <DealerMaintenancePagination initialOpenAccessId={initialOpenAccessId}>
      <DealerMaintenanceTrackerClient initialAssets={assets} initialOpenAccessId={initialOpenAccessId} />
    </DealerMaintenancePagination>
  );
}
