import { getOwnerAppAccess, ownerAppCanAccessAsset } from './owner-app-access';
import type { FuelLedgerAsset } from './fuel-ledger';

/** Apply both current operational eligibility and the app user's asset permissions. */
export async function fuelScanSelectableAssets(
  access: { ownerUserId: string; accessMode: string; fieldManagerId?: string },
  assets: FuelLedgerAsset[],
): Promise<FuelLedgerAsset[]> {
  const eligible = assets.filter(asset => asset.isActive && asset.canReceiveFuel && !asset.workUseExcluded);
  if (access.accessMode === 'field_manager') return [];
  if (access.accessMode === 'owner_session') {
    const owner = await getOwnerAppAccess();
    if (!owner || owner.ownerUserId !== access.ownerUserId) return [];
    return eligible.filter(asset => ownerAppCanAccessAsset(owner, asset.id));
  }
  return eligible;
}

/** Apply the same desktop projection to every scan response, including successful writes. */
export async function projectManagerFuelScan<T extends { storage: import('./fuel-ledger').FuelLedgerStorage; assets: FuelLedgerAsset[]; recentEvents: import('./fuel-ledger').FuelLedgerEvent[]; event?: import('./fuel-ledger').FuelLedgerEvent }>(access: { ownerUserId: string; accessMode: string }, payload: T): Promise<T> {
  const assets = await fuelScanSelectableAssets(access, payload.assets);
  if (access.accessMode !== 'owner_session') return { ...payload, assets };
  const owner = await getOwnerAppAccess();
  if (!owner || owner.ownerUserId !== access.ownerUserId) throw new Error('Sign in again.');
  const { projectTeamFuelLedger, projectTeamFuelEvent } = await import('./team-workspace-policy');
  const result = projectTeamFuelLedger({ assets, storages: [payload.storage], recentEvents: payload.recentEvents, recentFuelSlips: [], summary: { totalStorageUnits: 0, totalCapacityLitres: 0, currentLitres: 0, currentStockPercent: null, lowStorageCount: 0, issuedLitres30Days: 0, filledLitres30Days: 0, activeAssetsCount: 0 } }, new Set(assets.map(a => a.id)), owner.teamPermissions);
  return { ...payload, assets: result.assets, storage: result.storages[0], recentEvents: result.recentEvents, ...(payload.event ? { event: projectTeamFuelEvent(payload.event, owner.teamPermissions) } : {}) };
}
