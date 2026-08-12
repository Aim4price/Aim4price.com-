import {
  listAssetLeadsForUser,
  type AssetLead,
} from './partner-access';

function isDirectRenewalLead(lead: AssetLead, userId: string): boolean {
  return (
    lead.partnerUserId === userId &&
    lead.leadType === 'license_renewal' &&
    String(lead.includedSections.source ?? '').trim().toLowerCase() !== 'asset_discovery'
  );
}

export async function listLicensingWorkspaceLeads(
  userId: string,
  options: { limit?: number } = {},
): Promise<AssetLead[]> {
  const directRenewalLeads = (await listAssetLeadsForUser(userId))
    .filter((lead) => isDirectRenewalLead(lead, userId))
    .sort((left, right) => Date.parse(right.updatedAtIso) - Date.parse(left.updatedAtIso));
  const requestedLimit = Number.isFinite(options.limit) ? Math.trunc(options.limit as number) : 0;

  return requestedLimit > 0
    ? directRenewalLeads.slice(0, Math.min(requestedLimit, 100))
    : directRenewalLeads;
}
