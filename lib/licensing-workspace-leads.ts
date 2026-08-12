import {
  listLicensingAssetDiscoveryLeadOpportunities,
  type AssetDiscoveryNotification,
} from './asset-discovery';
import {
  listAssetLeadsForUser,
  type AssetLead,
} from './partner-access';

type RenewalOutcome = 'pending' | 'denied';

function opportunityLead(
  userId: string,
  enquiry: AssetDiscoveryNotification,
): AssetLead {
  const outcome: RenewalOutcome = enquiry.status === 'temporarily_denied' ? 'denied' : 'pending';
  const asset = enquiry.asset;
  const title = [asset.year === 'Unknown' ? '' : asset.year, asset.brand, asset.model]
    .filter(Boolean)
    .join(' ');

  return {
    id: `discovery-enquiry:${enquiry.id}`,
    ownerUserId: '',
    partnerUserId: userId,
    assetRegisterItemId: enquiry.assetId,
    leadType: 'license_renewal',
    status: outcome === 'denied' ? 'declined' : 'sent',
    assetSnapshot: {
      id: enquiry.assetId,
      title,
      kind: asset.type,
      equipmentFamilyLabel: asset.type,
      brandName: asset.brand,
      modelName: asset.model,
      yearModel: asset.year === 'Unknown' ? null : asset.year,
      usage: asset.usage,
      condition: asset.condition,
      province: asset.province,
      renewalWindow: asset.renewalWindow,
      isLicensed: true,
    },
    includedSections: {
      source: 'asset_discovery',
      discoveryEnquiryId: enquiry.id,
      renewalOutcome: outcome,
      opportunityOnly: true,
    },
    ownerMessage: '',
    ownerContactName: '',
    ownerContactPhone: '',
    ownerContactEmail: '',
    ownerName: 'Aim4price owner',
    ownerBusinessName: 'Aim4price.com',
    ownerEmail: '',
    ownerPhone: '',
    ownerProvince: asset.province,
    ownerTownCity: '',
    partnerName: '',
    partnerBusinessName: '',
    partnerPhone: '',
    partnerProvince: '',
    partnerTownCity: '',
    partnerNoteAttachmentCount: 0,
    latestPartnerNoteAttachmentFileName: '',
    latestPartnerNoteAttachmentByteSize: null,
    latestPartnerNoteAttachmentCreatedAtIso: null,
    createdAtIso: enquiry.createdAtIso,
    viewedAtIso: outcome === 'pending' ? null : enquiry.updatedAtIso,
    acceptedAtIso: null,
    quotedAtIso: null,
    declinedAtIso: outcome === 'denied' ? enquiry.updatedAtIso : null,
    closedAtIso: null,
    updatedAtIso: enquiry.updatedAtIso,
  };
}

export async function listLicensingWorkspaceLeads(
  userId: string,
  options: { limit?: number } = {},
): Promise<AssetLead[]> {
  const [savedLeads, opportunities] = await Promise.all([
    listAssetLeadsForUser(userId),
    listLicensingAssetDiscoveryLeadOpportunities(userId),
  ]);
  const savedRenewalAssetIds = new Set(
    savedLeads
      .filter((lead) => lead.leadType === 'license_renewal' && lead.partnerUserId === userId)
      .map((lead) => lead.assetRegisterItemId),
  );
  const combined = [
    ...savedLeads,
    ...opportunities
      .filter((enquiry) => !savedRenewalAssetIds.has(enquiry.assetId))
      .map((enquiry) => opportunityLead(userId, enquiry)),
  ].sort((left, right) => Date.parse(right.updatedAtIso) - Date.parse(left.updatedAtIso));
  const requestedLimit = Number.isFinite(options.limit) ? Math.trunc(options.limit as number) : 0;

  return requestedLimit > 0 ? combined.slice(0, Math.min(requestedLimit, 100)) : combined;
}
