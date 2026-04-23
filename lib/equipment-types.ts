export type SectorKey = 'agricultural' | 'industrial' | 'construction';
export type UsageMetricType = 'hours' | 'wear_class';
export type ValuationMode = 'engine_hours' | 'year_condition' | 'percent_used';

export type EquipmentFamilyKey =
  | 'tractors'
  | 'combines'
  | 'forage_harvesters'
  | 'self_propelled_sprayers'
  | 'balers'
  | 'planters'
  | 'mowers'
  | 'seed_drills'
  | 'fertilizer_spreaders'
  | 'tillage_implements'
  | 'trailers'
  | 'telehandlers';

export type EquipmentKind = 'tractor' | 'manual' | 'property';

export type EquipmentFamilyMeta = {
  key: EquipmentFamilyKey;
  label: string;
  sectorKey: SectorKey;
  isPropelled: boolean;
  usageMetricType: UsageMetricType;
  valuationMode: ValuationMode;
  active: boolean;
  assetKind: EquipmentKind;
};

export const SECTOR_LABELS: Record<SectorKey, string> = {
  agricultural: 'Agricultural',
  industrial: 'Industrial',
  construction: 'Construction',
};

export const EQUIPMENT_FAMILY_META: Record<EquipmentFamilyKey, EquipmentFamilyMeta> = {
  tractors: {
    key: 'tractors',
    label: 'Tractors',
    sectorKey: 'agricultural',
    isPropelled: true,
    usageMetricType: 'hours',
    valuationMode: 'engine_hours',
    active: true,
    assetKind: 'tractor',
  },
  combines: {
    key: 'combines',
    label: 'Combines',
    sectorKey: 'agricultural',
    isPropelled: true,
    usageMetricType: 'hours',
    valuationMode: 'engine_hours',
    active: false,
    assetKind: 'manual',
  },
  forage_harvesters: {
    key: 'forage_harvesters',
    label: 'Forage Harvesters',
    sectorKey: 'agricultural',
    isPropelled: true,
    usageMetricType: 'hours',
    valuationMode: 'engine_hours',
    active: false,
    assetKind: 'manual',
  },
  self_propelled_sprayers: {
    key: 'self_propelled_sprayers',
    label: 'Self-Propelled Sprayers',
    sectorKey: 'agricultural',
    isPropelled: true,
    usageMetricType: 'hours',
    valuationMode: 'engine_hours',
    active: false,
    assetKind: 'manual',
  },
  balers: {
    key: 'balers',
    label: 'Balers',
    sectorKey: 'agricultural',
    isPropelled: false,
    usageMetricType: 'wear_class',
    valuationMode: 'year_condition',
    active: false,
    assetKind: 'manual',
  },
  planters: {
    key: 'planters',
    label: 'Planters',
    sectorKey: 'agricultural',
    isPropelled: false,
    usageMetricType: 'wear_class',
    valuationMode: 'year_condition',
    active: false,
    assetKind: 'manual',
  },
  mowers: {
    key: 'mowers',
    label: 'Mowers',
    sectorKey: 'agricultural',
    isPropelled: false,
    usageMetricType: 'wear_class',
    valuationMode: 'year_condition',
    active: false,
    assetKind: 'manual',
  },
  seed_drills: {
    key: 'seed_drills',
    label: 'Seed Drills',
    sectorKey: 'agricultural',
    isPropelled: false,
    usageMetricType: 'wear_class',
    valuationMode: 'year_condition',
    active: false,
    assetKind: 'manual',
  },
  fertilizer_spreaders: {
    key: 'fertilizer_spreaders',
    label: 'Fertilizer Spreaders',
    sectorKey: 'agricultural',
    isPropelled: false,
    usageMetricType: 'wear_class',
    valuationMode: 'year_condition',
    active: false,
    assetKind: 'manual',
  },
  tillage_implements: {
    key: 'tillage_implements',
    label: 'Tillage Implements',
    sectorKey: 'agricultural',
    isPropelled: false,
    usageMetricType: 'wear_class',
    valuationMode: 'year_condition',
    active: false,
    assetKind: 'manual',
  },
  trailers: {
    key: 'trailers',
    label: 'Trailers',
    sectorKey: 'agricultural',
    isPropelled: false,
    usageMetricType: 'wear_class',
    valuationMode: 'year_condition',
    active: false,
    assetKind: 'manual',
  },
  telehandlers: {
    key: 'telehandlers',
    label: 'Telehandlers',
    sectorKey: 'agricultural',
    isPropelled: true,
    usageMetricType: 'hours',
    valuationMode: 'engine_hours',
    active: false,
    assetKind: 'manual',
  },
};

export const AGRICULTURAL_FAMILY_ORDER: EquipmentFamilyKey[] = [
  'tractors',
  'combines',
  'forage_harvesters',
  'self_propelled_sprayers',
  'balers',
  'planters',
  'mowers',
  'seed_drills',
  'fertilizer_spreaders',
  'tillage_implements',
  'trailers',
  'telehandlers',
];

export function isSectorKey(value: unknown): value is SectorKey {
  return value === 'agricultural' || value === 'industrial' || value === 'construction';
}

export function isUsageMetricType(value: unknown): value is UsageMetricType {
  return value === 'hours' || value === 'wear_class';
}

export function isValuationMode(value: unknown): value is ValuationMode {
  return value === 'engine_hours' || value === 'year_condition' || value === 'percent_used';
}

export function isEquipmentFamilyKey(value: unknown): value is EquipmentFamilyKey {
  return typeof value === 'string' && value in EQUIPMENT_FAMILY_META;
}

export function getSectorLabel(sectorKey: SectorKey): string {
  return SECTOR_LABELS[sectorKey] ?? sectorKey;
}

export function getEquipmentFamilyLabel(familyKey: EquipmentFamilyKey): string {
  return EQUIPMENT_FAMILY_META[familyKey]?.label ?? familyKey;
}

export function isAgriculturalFamily(familyKey: EquipmentFamilyKey): boolean {
  return EQUIPMENT_FAMILY_META[familyKey]?.sectorKey === 'agricultural';
}
