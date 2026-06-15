export type SectorKey = 'agricultural' | 'industrial' | 'construction' | 'motor';
export type UsageMetricType = 'hours' | 'km' | 'wear_class';
export type ValuationMode = 'engine_hours' | 'year_condition' | 'percent_used';
export type CatalogMode = 'generic_specs' | 'hybrid' | 'exact_model';

// Important: equipment family keys now come from Postgres.
// Keep this type as string so the app does not reject newly imported families.
export type EquipmentFamilyKey = string;

export type EquipmentKind = 'tractor' | 'equipment' | 'vehicle' | 'manual' | 'property' | 'tools';

export type UsageDisplayUnit = 'hours' | 'km' | 'percent';

export type EquipmentFamilyMeta = {
  key: EquipmentFamilyKey;
  label: string;
  sectorKey: SectorKey;
  isPropelled: boolean;
  usageMetricType: UsageMetricType;
  valuationMode: ValuationMode;
  catalogMode: CatalogMode;
  active: boolean;
  assetKind: EquipmentKind;
};

export const SECTOR_LABELS: Record<SectorKey, string> = {
  agricultural: 'Agricultural',
  industrial: 'Industrial',
  construction: 'Construction',
  motor: 'Motor',
};

// Backward-compatible fallback metadata only.
// Runtime family data must come from public.equipment_families.
export const EQUIPMENT_FAMILY_META: Record<string, EquipmentFamilyMeta> = {
  tractors: {
    key: 'tractors',
    label: 'Tractors',
    sectorKey: 'agricultural',
    isPropelled: true,
    usageMetricType: 'hours',
    valuationMode: 'engine_hours',
    catalogMode: 'hybrid',
    active: true,
    assetKind: 'tractor',
  },
  bakkies_ldvs: {
    key: 'bakkies_ldvs',
    label: 'Bakkies / LDVs',
    sectorKey: 'motor',
    isPropelled: true,
    usageMetricType: 'km',
    valuationMode: 'engine_hours',
    catalogMode: 'generic_specs',
    active: true,
    assetKind: 'vehicle',
  },
};

// Fallback only. The valuation page now loads families from Postgres.
export const AGRICULTURAL_FAMILY_ORDER: EquipmentFamilyKey[] = ['tractors'];

export function isSectorKey(value: unknown): value is SectorKey {
  return value === 'agricultural' || value === 'industrial' || value === 'construction' || value === 'motor';
}

export function isUsageMetricType(value: unknown): value is UsageMetricType {
  return value === 'hours' || value === 'km' || value === 'wear_class';
}

export function isValuationMode(value: unknown): value is ValuationMode {
  return value === 'engine_hours' || value === 'year_condition' || value === 'percent_used';
}

export function isCatalogMode(value: unknown): value is CatalogMode {
  return value === 'generic_specs' || value === 'hybrid' || value === 'exact_model';
}

export function isEquipmentFamilyKey(value: unknown): value is EquipmentFamilyKey {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isUsageAmountMetric(value: unknown): value is 'hours' | 'km' {
  return value === 'hours' || value === 'km';
}

export function getSectorLabel(sectorKey: SectorKey): string {
  return SECTOR_LABELS[sectorKey] ?? sectorKey;
}

export function getUsageDisplayUnit(
  sectorKey?: SectorKey | string | null,
  usageMetricType?: UsageMetricType | string | null,
): UsageDisplayUnit {
  if (sectorKey === 'motor' || usageMetricType === 'km') return 'km';
  if (usageMetricType === 'wear_class') return 'percent';
  return 'hours';
}

export function getUsageShortUnit(
  sectorKey?: SectorKey | string | null,
  usageMetricType?: UsageMetricType | string | null,
): string {
  const unit = getUsageDisplayUnit(sectorKey, usageMetricType);
  if (unit === 'km') return 'km';
  if (unit === 'percent') return '%';
  return 'hours';
}

export function getUsageFieldLabel(
  sectorKey?: SectorKey | string | null,
  usageMetricType?: UsageMetricType | string | null,
): string {
  const unit = getUsageDisplayUnit(sectorKey, usageMetricType);
  if (unit === 'km') return 'Kilometres';
  if (unit === 'percent') return 'Worked percentage';
  return 'Machine hours';
}

export function getUsageSentenceLabel(
  sectorKey?: SectorKey | string | null,
  usageMetricType?: UsageMetricType | string | null,
): string {
  const unit = getUsageDisplayUnit(sectorKey, usageMetricType);
  if (unit === 'km') return 'kilometres';
  if (unit === 'percent') return 'worked percentage';
  return 'hours';
}

export function getUnknownUsageButtonLabel(
  sectorKey?: SectorKey | string | null,
  usageMetricType?: UsageMetricType | string | null,
): string {
  return getUsageDisplayUnit(sectorKey, usageMetricType) === 'km'
    ? 'I do not know the kilometres'
    : 'I do not know the engine hours';
}

export function getKnownUsageButtonLabel(
  sectorKey?: SectorKey | string | null,
  usageMetricType?: UsageMetricType | string | null,
): string {
  return getUsageDisplayUnit(sectorKey, usageMetricType) === 'km'
    ? 'I know the kilometres'
    : 'I know the engine hours';
}

export function getEquipmentFamilyLabel(familyKey: EquipmentFamilyKey): string {
  return EQUIPMENT_FAMILY_META[familyKey]?.label ?? familyKey.replace(/_/g, ' ');
}

export function isAgriculturalFamily(familyKey: EquipmentFamilyKey): boolean {
  return EQUIPMENT_FAMILY_META[familyKey]?.sectorKey === 'agricultural' || familyKey === 'tractors';
}
