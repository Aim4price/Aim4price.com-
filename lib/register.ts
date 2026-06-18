import type { CabType, DriveType, TractorType } from './tractor-data';

export type SavedItemKind = 'tractor' | 'manual' | 'property' | 'equipment' | 'vehicle' | 'tools';
export type SavedItemMethod = 'aim4price' | 'manual';

export type SavedItem = {
  id: string;
  valuationRunId?: number;
  kind: SavedItemKind;
  title: string;
  value: number;
  selectedMethod: SavedItemMethod;
  method?: SavedItemMethod;
  selectedValueExVat: number;
  brandName?: string;
  modelName?: string;
  drive?: DriveType | string;
  tractorType?: TractorType | string;
  cab?: CabType | string;
  powerKw?: number;
  yearModel?: number;
  hours?: number;
  aim4priceValueExVat?: number | null;
  marketMidExVat?: number | null;
  note?: string;
  createdAtIso: string;
  updatedAtIso?: string;
  serialNumber?: string;
  isFinanced?: boolean;
  isInsured?: boolean;
  isLicensed?: boolean;
  licenseRegistrationNumber?: string;
  financeNote?: string;
  photos?: string[];
  sellerPhone?: string;
  marketplaceNotes?: string;
};

const KEY = 'aim4price-tractors-kit-register';
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalText(value: unknown): string | undefined {
  const next = asText(value);
  return next || undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRequiredMoney(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  const next = Number.isFinite(parsed) ? parsed : fallback;
  return Math.round(next);
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return undefined;

  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.map((entry) => asText(entry)).filter(Boolean);
}

function asKind(value: unknown): SavedItemKind {
  return value === 'tractor' || value === 'manual' || value === 'property' || value === 'equipment' || value === 'vehicle' || value === 'tools' ? value : 'manual';
}

function asMethod(value: unknown): SavedItemMethod {
  if (value === 'manual') return 'manual';
  if (value === 'aim4price' || value === 'market') return 'aim4price';
  return 'manual';
}

function normalizeCab(value: unknown): SavedItem['cab'] {
  if (value === true) return 'cab';
  if (value === false) return 'open-station';

  const normalized = asText(value).toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'cab') return 'cab';
  if (normalized === 'open-station' || normalized === 'open station') return 'open-station';
  return normalized;
}

export function normalizeSavedItem(value: unknown): SavedItem | null {
  if (!isRecord(value)) return null;

  const id = asText(value.id);
  const title = asText(value.title);

  if (!id || !title) {
    return null;
  }

  const selectedValueExVat = asRequiredMoney(value.selectedValueExVat, asRequiredMoney(value.value));
  const createdAtIso = asText(value.createdAtIso) || FALLBACK_CREATED_AT;
  const updatedAtIso = asText(value.updatedAtIso) || createdAtIso;
  const selectedMethod = asMethod(value.selectedMethod ?? value.method);

  return {
    id,
    valuationRunId: asOptionalNumber(value.valuationRunId),
    kind: asKind(value.kind),
    title,
    value: asOptionalNumber(value.value) ?? selectedValueExVat,
    selectedMethod,
    method: selectedMethod,
    selectedValueExVat,
    brandName: asOptionalText(value.brandName),
    modelName: asOptionalText(value.modelName),
    drive: asOptionalText(value.drive),
    tractorType: asOptionalText(value.tractorType),
    cab: normalizeCab(value.cab),
    powerKw: asOptionalNumber(value.powerKw),
    yearModel: asOptionalNumber(value.yearModel),
    hours: asOptionalNumber(value.hours),
    aim4priceValueExVat: asNullableNumber(value.aim4priceValueExVat),
    marketMidExVat: asNullableNumber(value.marketMidExVat),
    note: asOptionalText(value.note),
    createdAtIso,
    updatedAtIso,
    serialNumber: asOptionalText(value.serialNumber),
    isFinanced: asOptionalBoolean(value.isFinanced) ?? false,
    isInsured: asOptionalBoolean(value.isInsured) ?? false,
    isLicensed: asOptionalBoolean(value.isLicensed) ?? false,
    licenseRegistrationNumber: asOptionalText(value.licenseRegistrationNumber),
    financeNote: asOptionalText(value.financeNote),
    photos: asStringArray(value.photos) ?? [],
    sellerPhone: asOptionalText(value.sellerPhone),
    marketplaceNotes: asOptionalText(value.marketplaceNotes),
  };
}

function sortItems(items: SavedItem[]): SavedItem[] {
  return items
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAtIso || left.createdAtIso || FALLBACK_CREATED_AT).getTime();
      const rightTime = new Date(right.updatedAtIso || right.createdAtIso || FALLBACK_CREATED_AT).getTime();
      return rightTime - leftTime;
    });
}

function writeItems(items: SavedItem[]): SavedItem[] {
  const sorted = sortItems(items);

  if (canUseStorage()) {
    window.localStorage.setItem(KEY, JSON.stringify(sorted));
  }

  return sorted;
}

export function loadItems(): SavedItem[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortItems(
      parsed
        .map((item) => normalizeSavedItem(item))
        .filter((item): item is SavedItem => item !== null),
    );
  } catch {
    return [];
  }
}

export function saveItem(item: SavedItem): SavedItem[] {
  const normalized = normalizeSavedItem(item);

  if (!normalized) {
    return loadItems();
  }

  const current = loadItems();
  const next = [normalized, ...current.filter((existing) => existing.id !== normalized.id)];

  return writeItems(next);
}

export function deleteItem(id: string): SavedItem[] {
  const next = loadItems().filter((item) => item.id !== id);
  return writeItems(next);
}

export function clearItems(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(KEY);
  }
}
