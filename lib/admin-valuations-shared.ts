export type AdminValuationRecordType = 'estimate' | 'saved';
export type AdminValuationMode = 'tractor' | 'generic' | 'unknown';
export type AdminValuationRecordFilter = 'all' | AdminValuationRecordType;
export type AdminValuationModeFilter = 'all' | AdminValuationMode;
export type AdminValuationAccountFilter = 'all' | 'known' | 'unknown';
export type AdminValuationSort =
  | 'latest'
  | 'oldest'
  | 'value-high'
  | 'value-low'
  | 'account'
  | 'asset';

export type AdminValuationAccount = {
  userId: string | null;
  known: boolean;
  label: string;
  name: string;
  businessName: string;
  email: string;
  accountType: string;
  accountStatus: string;
};

export type AdminValuationAsset = {
  sectorKey: string;
  sectorLabel: string;
  familyKey: string;
  familyLabel: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  condition: string;
  usageAmount: number | null;
  usageUnit: string;
};

export type AdminValuationEstimate = {
  selectedValueExVat: number | null;
  lowValueExVat: number | null;
  midValueExVat: number | null;
  highValueExVat: number | null;
  replacementPriceExVat: number | null;
  confidenceLabel: string;
};

export type AdminValuationRecord = {
  id: string;
  sourceId: string;
  recordType: AdminValuationRecordType;
  valuationMode: AdminValuationMode;
  source: string;
  createdAtIso: string;
  account: AdminValuationAccount;
  asset: AdminValuationAsset;
  estimate: AdminValuationEstimate;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type AdminValuationSummary = {
  totalValuations: number;
  estimateEvents: number;
  savedValuations: number;
  knownAccountValuations: number;
  unknownAccountValuations: number;
  uniqueAccounts: number;
  valuedValuations: number;
};

export type AdminValuationFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AdminValuationOptions = {
  sectors: AdminValuationFilterOption[];
  years: AdminValuationFilterOption[];
};

export type AdminValuationFilters = {
  search: string;
  recordType: AdminValuationRecordFilter;
  valuationMode: AdminValuationModeFilter;
  account: AdminValuationAccountFilter;
  sector: string;
  period: string;
  sort: AdminValuationSort;
  page: number;
  pageSize: number;
};

export type AdminValuationReport = {
  generatedAtIso: string;
  valuations: AdminValuationRecord[];
  summary: AdminValuationSummary;
  options: AdminValuationOptions;
  filters: AdminValuationFilters;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export const ADMIN_VALUATION_PAGE_SIZES = [25, 50, 100] as const;

export function formatAdminValuationMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatAdminValuationDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

