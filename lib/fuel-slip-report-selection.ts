import type { FuelSlipTransaction } from './fuel-ledger';
export type FuelSlipReportFilters = { assetId: string; storageId: string; year: string; month: string; capture: string };
export function parseFuelSlipReportFilters(value: unknown): FuelSlipReportFilters | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const result = {assetId:v.assetId ?? 'all',storageId:v.storageId ?? 'all',year:v.year ?? 'all',month:v.month ?? 'all',capture:v.capture ?? 'all'};
  if (Object.values(result).some(v=>typeof v !== 'string')) return null;
  const filters = result as FuelSlipReportFilters;
  if (filters.year !== 'all' && (!/^\d{4}$/.test(filters.year) || Number(filters.year)<2000 || Number(filters.year)>2200)) return null;
  if (filters.month !== 'all' && (!/^(?:[1-9]|1[0-2])$/.test(filters.month) || filters.year === 'all')) return null;
  if (!['all','manual','automatic','needs_review'].includes(filters.capture)) return null;
  if (filters.assetId !== 'all' && filters.storageId !== 'all') return null;
  return filters;
}
export function selectFuelSlipsForReport(slips: FuelSlipTransaction[], filters: FuelSlipReportFilters): FuelSlipTransaction[] {
  return slips.filter(slip => {
    if (filters.assetId !== 'all' && (slip.targetType !== 'asset' || slip.assetId !== filters.assetId)) return false;
    if (filters.storageId !== 'all' && (slip.targetType !== 'storage_tank' || slip.storageId !== filters.storageId)) return false;
    const date = slip.documentDate || (slip.createdAtIso ? new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(slip.createdAtIso)) : '');
    if (filters.year !== 'all' && date.slice(0,4) !== filters.year) return false;
    if (filters.month !== 'all' && Number(date.slice(5,7)) !== Number(filters.month)) return false;
    const capture = slip.reviewRequired || slip.extractionStatus === 'needs_review' ? 'needs_review' : slip.extractionStatus === 'extracted' ? 'automatic' : 'manual';
    return filters.capture === 'all' || filters.capture === capture;
  });
}
