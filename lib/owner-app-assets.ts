import { listAssetRegisterItems, type AssetRegisterItem } from './asset-register-db';
import { listAssetRegisters, type AssetRegisterSummary } from './asset-registers';

export type OwnerAppAssetSummary = {
  id: string;
  registerId: string | null;
  registerName: string;
  title: string;
  kind: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  serialNumber: string;
  registrationNumber: string;
  location: string;
  value: number;
  replacementPriceExVat: number | null;
  isInsured: boolean;
  insuredValueExVat: number | null;
  isLicensed: boolean;
  marketplaceStatus: string;
  usage: number | null;
  usageMetric: 'hours' | 'km' | 'percentage';
  thumbnailUrl: string;
  updatedAtIso: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function readFirst(specs: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(specs[key]);
    if (value) return value;
  }
  return '';
}

function usageForAsset(item: AssetRegisterItem): { value: number | null; metric: 'hours' | 'km' | 'percentage' } {
  const specs = asRecord(item.specsJson);
  const rawMetric = readFirst(specs, ['usageMetric', 'usage_metric', 'selectedUsageMode', 'selected_usage_mode']).toLowerCase();
  if (rawMetric.includes('percent') || (item.hours === null && item.lifeWorkedPercent !== null)) {
    return { value: item.lifeWorkedPercent, metric: 'percentage' };
  }
  return { value: item.hours, metric: rawMetric === 'km' || item.kind === 'vehicle' ? 'km' : 'hours' };
}

function toSummary(item: AssetRegisterItem, register: AssetRegisterSummary): OwnerAppAssetSummary {
  const specs = asRecord(item.specsJson);
  const usage = usageForAsset(item);
  return {
    id: item.id,
    registerId: item.registerId,
    registerName: register.businessName,
    title: item.title || 'Saved asset',
    kind: item.kind,
    brandName: item.brandName,
    modelName: item.modelName || item.typedModelName,
    yearModel: item.yearModel,
    serialNumber: item.serialNumber || readFirst(specs, ['serialNumber', 'serial_number', 'vin', 'vinNumber', 'chassisNumber']),
    registrationNumber: item.licenseRegistrationNumber || readFirst(specs, ['registrationNumber', 'numberPlate', 'licenseRegistrationNumber']),
    location: item.lastKnownLocationText,
    value: Math.round(Number(item.value || item.selectedValueExVat || 0)),
    replacementPriceExVat: item.replacementPriceExVat,
    isInsured: item.isInsured,
    insuredValueExVat: item.insuredValueExVat,
    isLicensed: item.isLicensed,
    marketplaceStatus: item.marketplaceStatus || 'draft',
    usage: usage.value,
    usageMetric: usage.metric,
    thumbnailUrl: item.photos[0] || '',
    updatedAtIso: item.updatedAtIso,
  };
}

export async function listAllOwnerAppAssets(ownerUserId: string): Promise<{
  registers: AssetRegisterSummary[];
  items: OwnerAppAssetSummary[];
}> {
  const registers = await listAssetRegisters(ownerUserId);
  const itemGroups = await Promise.all(registers.map(async (register) => {
    const items = await listAssetRegisterItems(ownerUserId, register.id);
    return items.map((item) => toSummary(item, register));
  }));
  return { registers, items: itemGroups.flat().sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso)) };
}

export function filterOwnerAppAssets(items: OwnerAppAssetSummary[], query: string): OwnerAppAssetSummary[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return items;
  return items.filter((item) => {
    const haystack = [
      item.title, item.kind, item.brandName, item.modelName, item.yearModel, item.serialNumber,
      item.registrationNumber, item.registerName, item.location,
    ].join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
