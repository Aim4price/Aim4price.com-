export type SavedItemKind = 'tractor' | 'manual' | 'property';
export type SavedItemMethod = 'aim4price' | 'market' | 'department' | 'manual';

export type SavedItem = {
  id: string;
  kind: SavedItemKind;
  title: string;
  brandName?: string;
  modelName?: string;
  drive?: string;
  tractorType?: string;
  yearModel?: number;
  hours?: number;
  selectedMethod: SavedItemMethod;
  selectedValueExVat: number;
  aim4priceValueExVat?: number | null;
  marketMidExVat?: number | null;
  departmentValueExVat?: number | null;
  note?: string;
  createdAtIso: string;
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

function asRequiredMoney(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function asKind(value: unknown): SavedItemKind {
  return value === 'tractor' || value === 'manual' || value === 'property' ? value : 'manual';
}

function asMethod(value: unknown): SavedItemMethod {
  return value === 'aim4price' ||
    value === 'market' ||
    value === 'department' ||
    value === 'manual'
    ? value
    : 'manual';
}

function normalizeItem(value: unknown): SavedItem | null {
  if (!isRecord(value)) return null;

  const id = asText(value.id);
  const title = asText(value.title);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    kind: asKind(value.kind),
    title,
    brandName: asOptionalText(value.brandName),
    modelName: asOptionalText(value.modelName),
    drive: asOptionalText(value.drive),
    tractorType: asOptionalText(value.tractorType),
    yearModel: asOptionalNumber(value.yearModel),
    hours: asOptionalNumber(value.hours),
    selectedMethod: asMethod(value.selectedMethod),
    selectedValueExVat: asRequiredMoney(value.selectedValueExVat),
    aim4priceValueExVat: asNullableNumber(value.aim4priceValueExVat),
    marketMidExVat: asNullableNumber(value.marketMidExVat),
    departmentValueExVat: asNullableNumber(value.departmentValueExVat),
    note: asOptionalText(value.note),
    createdAtIso: asText(value.createdAtIso) || FALLBACK_CREATED_AT,
  };
}

function writeItems(items: SavedItem[]): SavedItem[] {
  if (canUseStorage()) {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  }

  return items;
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

    return parsed
      .map((item) => normalizeItem(item))
      .filter((item): item is SavedItem => item !== null);
  } catch {
    return [];
  }
}

export function saveItem(item: SavedItem): SavedItem[] {
  const normalized = normalizeItem(item);

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
