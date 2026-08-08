import { getDb } from './db';
import {
  ensureDealerMaintenanceTrackerTables,
  getDealerTrackedAsset,
  type DealerMaintenanceTrackedAsset,
  type DealerMaintenanceTrackerStatus,
} from './dealer-maintenance-tracker';

const DEFAULT_INITIAL_MAINTENANCE_SIZE = 10;
const MAX_INITIAL_MAINTENANCE_SIZE = 25;

function statusPriority(status: DealerMaintenanceTrackerStatus): number {
  if (status === 'overdue') return 0;
  if (status === 'due') return 1;
  if (status === 'due_soon') return 2;
  if (status === 'usage_needed') return 3;
  if (status === 'upcoming') return 4;
  if (status === 'done') return 5;
  return 6;
}

export async function listInitialDealerTrackedAssets(input: {
  dealerUserId: string;
  limit?: number;
  openAccessId?: string | null;
}): Promise<{
  assets: DealerMaintenanceTrackedAsset[];
  hasMore: boolean;
}> {
  await ensureDealerMaintenanceTrackerTables();

  const requestedLimit = Number.isFinite(input.limit) ? Math.trunc(input.limit as number) : DEFAULT_INITIAL_MAINTENANCE_SIZE;
  const limit = Math.min(MAX_INITIAL_MAINTENANCE_SIZE, Math.max(1, requestedLimit));
  const candidateLimit = limit + 1;
  const openAccessId = String(input.openAccessId ?? '').trim();

  const result = await getDb().query<{ id: string }>(
    `
      select access.id::text
      from public.dealer_maintenance_access access
      where access.dealer_user_id = $1
        and access.is_active = true
        and (
          exists (
            select 1
            from public.asset_maintenance_records maintenance
            where maintenance.user_id = access.owner_user_id
              and maintenance.asset_register_item_id = access.asset_register_item_id
              and maintenance.status in ('upcoming', 'done')
          )
          or exists (
            select 1
            from public.dealer_maintenance_schedule_proposals proposal
            where proposal.access_id = access.id
              and proposal.proposal_status = 'pending'
          )
        )
      order by
        case when $2 <> '' and access.id::text = $2 then 0 else 1 end,
        access.updated_at desc,
        access.created_at desc
      limit $3
    `,
    [input.dealerUserId, openAccessId, candidateLimit],
  );

  const builtAssets = await Promise.all(
    result.rows.map((row) => getDealerTrackedAsset(input.dealerUserId, row.id)),
  );
  const assets = builtAssets
    .filter((asset): asset is DealerMaintenanceTrackedAsset => asset !== null)
    .slice(0, limit)
    .sort((left, right) => {
      const priority = statusPriority(left.status) - statusPriority(right.status);
      if (priority) return priority;
      return left.assetTitle.localeCompare(right.assetTitle);
    });

  return {
    assets,
    hasMore: result.rows.length > limit,
  };
}
