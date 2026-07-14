export type OwnerAppRegister = {
  id: string;
  name: string;
  isSelected: boolean;
  assetCount: number;
  totalValue: number;
  totalReplacementPrice: number;
};

export type OwnerAppAsset = {
  id: string;
  registerId: string | null;
  registerName: string;
  title: string;
  kind: string;
  categoryLabel: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  condition: string;
  value: number;
  replacementPriceExVat: number | null;
  usageValue: number | null;
  usageMetric: 'hours' | 'km' | 'percentage';
  isInsured: boolean;
  insuredValueExVat: number | null;
  isFinanced: boolean;
  isLicensed: boolean;
  licenseRegistrationNumber: string;
  serialNumber: string;
  documentCount: number;
  photoCount: number;
  lastScannedAtIso: string | null;
  lastKnownLocationText: string;
  updatedAtIso: string;
};

export type OwnerAppAssetDetail = OwnerAppAsset & {
  photos: string[];
  documents: Array<{
    id: string;
    url: string;
    fileName: string;
    contentType: string;
    uploadedAtIso: string;
  }>;
  note: string;
  financeNote: string;
  plateLabel: string;
  publicAssetCode: string;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  fuelPercent: number | null;
};

export type OwnerAppAssetsResponse = {
  ok?: boolean;
  error?: string;
  profile?: {
    displayName: string;
    businessName: string;
  };
  registers?: OwnerAppRegister[];
  assets?: OwnerAppAsset[];
  asset?: OwnerAppAssetDetail;
  summary?: {
    assetCount: number;
    totalValue: number;
    totalReplacementPrice: number;
  };
};

export function ownerAppMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

export function ownerAppDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: value.includes('T') ? 'Africa/Johannesburg' : 'UTC',
  }).format(parsed);
}

export function ownerAppUsage(asset: Pick<OwnerAppAsset, 'usageValue' | 'usageMetric'>): string {
  if (typeof asset.usageValue !== 'number' || !Number.isFinite(asset.usageValue)) return 'Not recorded';
  const value = asset.usageValue.toLocaleString('en-ZA', { maximumFractionDigits: 1 });
  if (asset.usageMetric === 'percentage') return `${value}% worked`;
  return `${value} ${asset.usageMetric}`;
}
