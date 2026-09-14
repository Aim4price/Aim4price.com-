import { attachOpenPartnerNotesToAssets } from './partner-access';
import { attachOpenIssueNoteStatusToAssets } from './asset-issue-notes';
import { attachLatestMaintenanceStatusToAssets } from './scan-assets';
import { attachUpcomingMaintenanceAlertsToAssets } from './asset-maintenance';
import { attachUpcomingLicenseRenewalAlertsToAssets } from './asset-license-renewal';
import { listOwnerAssetCorrectionAlerts, type DealerAssetCorrectionRequest } from './dealer-asset-corrections';

export async function attachOpenAssetAlerts<T extends { id: string }>(
  ownerUserId: string,
  items: T[],
): Promise<Array<T & {
  openPartnerNote: unknown;
  maintenanceAlert: unknown;
  licenseRenewalAlert: unknown;
  latestMaintenanceStatus: unknown;
  latestIssueNoteStatus: unknown;
  dealerAssetCorrection: DealerAssetCorrectionRequest | null;
}>> {
  const itemsWithPartnerNotes = await attachOpenPartnerNotesToAssets(ownerUserId, items);
  const itemsWithScheduledMaintenance = await attachUpcomingMaintenanceAlertsToAssets(ownerUserId, itemsWithPartnerNotes);
  const itemsWithLicenseRenewals = await attachUpcomingLicenseRenewalAlertsToAssets(ownerUserId, itemsWithScheduledMaintenance);
  const itemsWithMaintenanceStatus = await attachLatestMaintenanceStatusToAssets(itemsWithLicenseRenewals);
  const itemsWithIssueStatus = await attachOpenIssueNoteStatusToAssets(itemsWithMaintenanceStatus);
  const corrections = await listOwnerAssetCorrectionAlerts(ownerUserId, items.map((item) => item.id));
  const correctionByAssetId = new Map(corrections.map((correction) => [correction.assetId, correction]));

  return itemsWithIssueStatus.map((item) => ({
    ...item,
    dealerAssetCorrection: correctionByAssetId.get(item.id) ?? null,
  }));
}

