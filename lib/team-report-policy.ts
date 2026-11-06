import type { AssetRegisterItem } from './asset-register-db';
import type { TeamPermissions } from './team-access-policy';

// Only structural/status specs are needed in the owner report. Never carry notes,
// uploaded-file references, or arbitrary financial JSON into a restricted report.
const REPORT_SPEC_KEYS = new Set([
  'includeInRegisterTotal', 'usageMetric', 'usage_metric', 'usageMode', 'usage_mode',
  'lifeWorkedPercent', 'life_worked_percent', 'propertySize', 'property_size', 'size', 'sizeText', 'size_text',
  'financeStatus', 'finance_status', 'financedStatus', 'financed_status',
  'insuranceStatus', 'insurance_status', 'insuredStatus', 'insured_status',
  'licenseStatus', 'license_status', 'licensedStatus', 'licensed_status',
  'licenceStatus', 'licence_status', 'licencedStatus', 'licenced_status',
]);
const VALUE_SPEC_KEYS = /^(replacementPrice|replacement_price|userReplacementPrice|user_replacement_price|officialReplacementPrice|official_replacement_price|insuredValue|insured_value|insuranceValue|insurance_value)/;

type ApprovedDocument = { id: string; fileName: string; assetLinks: Array<{ id: string }> };

/** The original data stays server-side; the canonical renderer receives no private documents or notes. */
export function restrictTeamReportItems(items: AssetRegisterItem[], permissions: TeamPermissions, documents: ApprovedDocument[]): AssetRegisterItem[] {
  const documentsByAsset = new Map<string, AssetRegisterItem['documents']>();
  for (const document of documents) for (const link of document.assetLinks) {
    const entries = documentsByAsset.get(link.id) || [];
    // Reports show the approved count only. Download URLs are separately authorized.
    entries.push({ id: document.id, fileName: 'Approved document', url: '', uploadedAtIso: '', contentType: '', byteSize: 0, category: 'other', documentType: '' });
    documentsByAsset.set(link.id, entries);
  }
  return items.map(item => ({
    ...item,
    specsJson: Object.fromEntries(Object.entries(item.specsJson || {}).filter(([key, value]) =>
      (REPORT_SPEC_KEYS.has(key) || (permissions.viewValues && VALUE_SPEC_KEYS.test(key))) &&
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null))),
    note: '', financeNote: '', marketplaceNotes: '',
    marketplacePriceExVat: null,
    value: permissions.viewValues ? item.value : 0,
    selectedValueExVat: permissions.viewValues ? item.selectedValueExVat : 0,
    aim4priceValueExVat: permissions.viewValues ? item.aim4priceValueExVat : null,
    marketMidExVat: permissions.viewValues ? item.marketMidExVat : null,
    replacementPriceExVat: permissions.viewValues ? item.replacementPriceExVat : null,
    insuredValueExVat: permissions.viewValues ? item.insuredValueExVat : null,
    realisticSellingAssessment: permissions.viewValues ? item.realisticSellingAssessment : null,
    photos: permissions.viewPhotos ? item.photos : [],
    documents: documentsByAsset.get(item.id) || [],
  }));
}
