export const GENERAL_ASSET_CATEGORIES = [
  {
    value: 'furniture_contents',
    label: 'Furniture & contents',
    description: 'Desks & chairs',
  },
  {
    value: 'appliances',
    label: 'Appliances',
    description: 'Home & business',
  },
  {
    value: 'computers_it',
    label: 'Computers & IT',
    description: 'PCs & servers',
  },
  {
    value: 'portable_electronics',
    label: 'Portable electronics',
    description: 'Phones & cameras',
  },
  {
    value: 'commercial_refrigeration',
    label: 'Refrigeration',
    description: 'Cold rooms & tanks',
  },
  {
    value: 'kitchen_catering',
    label: 'Kitchen & catering',
    description: 'Food preparation',
  },
  {
    value: 'security_systems',
    label: 'Security & access',
    description: 'Alarms & cameras',
  },
  {
    value: 'power_energy',
    label: 'Power systems',
    description: 'Solar & backup power',
  },
  {
    value: 'fixtures_improvements',
    label: 'Fixtures',
    description: 'Fittings & upgrades',
  },
  {
    value: 'high_value_items',
    label: 'Specialist items',
    description: 'Art & valuables',
  },
  {
    value: 'other_general',
    label: 'Other contents',
    description: 'Unlisted contents',
  },
] as const;

export const PROPERTY_ASSET_SUBTYPES = [
  {
    value: 'land',
    label: 'Land',
    description: 'Plots and farmland',
  },
  {
    value: 'building_structure',
    label: 'Building or structure',
    description: 'Homes, offices & sheds',
  },
  {
    value: 'fixed_improvement',
    label: 'Fixed improvement',
    description: 'Fences and paving',
  },
  {
    value: 'tenant_improvement',
    label: 'Tenant improvement',
    description: 'Tenant-funded work',
  },
  {
    value: 'other_property',
    label: 'Other property',
    description: 'Unlisted property',
  },
] as const;

export const STOCK_ASSET_SUBTYPES = [
  {
    value: 'raw_materials',
    label: 'Raw materials',
    description: 'Production inputs',
  },
  {
    value: 'finished_goods',
    label: 'Finished goods',
    description: 'Completed products',
  },
  {
    value: 'resale_goods',
    label: 'Goods for resale',
    description: 'Bought to sell on',
  },
  {
    value: 'work_in_progress',
    label: 'Work in progress',
    description: 'Partly made goods',
  },
  {
    value: 'parts_spares',
    label: 'Parts and spares',
    description: 'Workshop spares',
  },
  {
    value: 'agricultural_inputs',
    label: 'Agricultural inputs',
    description: 'Seed and fertiliser',
  },
  {
    value: 'produce',
    label: 'Produce',
    description: 'Harvested crops',
  },
  {
    value: 'livestock',
    label: 'Livestock',
    description: 'Animals and herds',
  },
  {
    value: 'third_party_stock',
    label: 'Third-party stock',
    description: 'Includes consignment',
  },
  {
    value: 'other_stock',
    label: 'Other stock',
    description: 'Unlisted stock',
  },
] as const;

export type GeneralAssetCategoryKey = (typeof GENERAL_ASSET_CATEGORIES)[number]['value'];
export type PropertyAssetSubtypeKey = (typeof PROPERTY_ASSET_SUBTYPES)[number]['value'];
export type StockAssetSubtypeKey = (typeof STOCK_ASSET_SUBTYPES)[number]['value'];

const GENERAL_ASSET_CATEGORY_KEYS = new Set<string>(GENERAL_ASSET_CATEGORIES.map((category) => category.value));
const PROPERTY_ASSET_SUBTYPE_KEYS = new Set<string>(PROPERTY_ASSET_SUBTYPES.map((category) => category.value));
const STOCK_ASSET_SUBTYPE_KEYS = new Set<string>(STOCK_ASSET_SUBTYPES.map((category) => category.value));

export function normalizeGeneralAssetCategory(value: unknown): GeneralAssetCategoryKey | '' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return GENERAL_ASSET_CATEGORY_KEYS.has(normalized) ? normalized as GeneralAssetCategoryKey : '';
}

export function generalAssetCategoryLabel(value: unknown): string {
  const normalized = normalizeGeneralAssetCategory(value);
  return GENERAL_ASSET_CATEGORIES.find((category) => category.value === normalized)?.label ?? '';
}

export function normalizePropertyAssetSubtype(value: unknown): PropertyAssetSubtypeKey | '' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return PROPERTY_ASSET_SUBTYPE_KEYS.has(normalized) ? normalized as PropertyAssetSubtypeKey : '';
}

export function propertyAssetSubtypeLabel(value: unknown): string {
  const normalized = normalizePropertyAssetSubtype(value);
  return PROPERTY_ASSET_SUBTYPES.find((category) => category.value === normalized)?.label ?? '';
}

export function normalizeStockAssetSubtype(value: unknown): StockAssetSubtypeKey | '' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return STOCK_ASSET_SUBTYPE_KEYS.has(normalized) ? normalized as StockAssetSubtypeKey : '';
}

export function stockAssetSubtypeLabel(value: unknown): string {
  const normalized = normalizeStockAssetSubtype(value);
  return STOCK_ASSET_SUBTYPES.find((category) => category.value === normalized)?.label ?? '';
}
