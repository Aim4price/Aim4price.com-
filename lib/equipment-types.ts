export type SectorKey = 'agricultural' | 'industrial' | 'construction';
export type UsageMetricType = 'hours' | 'wear_class';
export type ValuationMode = 'engine_hours' | 'year_condition' | 'percent_used';
export type CatalogMode = 'generic_specs' | 'hybrid' | 'exact_model';

// Important: equipment family keys now come from Postgres.
// Keep this type as string so the app does not reject newly imported families.
export type EquipmentFamilyKey = string;

export type EquipmentKind = 'tractor' | 'manual' | 'property';

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
};

// Fallback only. The valuation page now loads families from Postgres.
export const AGRICULTURAL_FAMILY_ORDER: EquipmentFamilyKey[] = ['tractors'];

export function isSectorKey(value: unknown): value is SectorKey {
  return value === 'agricultural' || value === 'industrial' || value === 'construction';
}

export function isUsageMetricType(value: unknown): value is UsageMetricType {
  return value === 'hours' || value === 'wear_class';
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

export function getSectorLabel(sectorKey: SectorKey): string {
  return SECTOR_LABELS[sectorKey] ?? sectorKey;
}

export function getEquipmentFamilyLabel(familyKey: EquipmentFamilyKey): string {
  return EQUIPMENT_FAMILY_META[familyKey]?.label ?? familyKey.replace(/_/g, ' ');
}

export function isAgriculturalFamily(familyKey: EquipmentFamilyKey): boolean {
  return EQUIPMENT_FAMILY_META[familyKey]?.sectorKey === 'agricultural' || familyKey === 'tractors';
}
