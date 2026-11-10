import { listFieldManagerAssets } from './field-manager';
import { getOwnerAppAccess, ownerAppCanAccessAsset } from './owner-app-access';
import type { FuelLedgerAsset } from './fuel-ledger';

/** Apply both current operational eligibility and the app user's asset permissions. */
export async function fuelScanSelectableAssets(
  access: { ownerUserId: string; accessMode: string; fieldManagerId?: string },
  assets: FuelLedgerAsset[],
): Promise<FuelLedgerAsset[]> {
  const eligible = assets.filter(asset => asset.isActive && asset.canReceiveFuel && !asset.workUseExcluded);
  if (access.accessMode === 'field_manager') {
    if (!access.fieldManagerId) return [];
    const allowed = new Set((await listFieldManagerAssets(access.ownerUserId, access.fieldManagerId)).map(asset => asset.id));
    return eligible.filter(asset => allowed.has(asset.id));
  }
  if (access.accessMode === 'owner_session') {
    const owner = await getOwnerAppAccess();
    if (!owner || owner.ownerUserId !== access.ownerUserId) return [];
    return eligible.filter(asset => ownerAppCanAccessAsset(owner, asset.id));
  }
  return eligible;
}
