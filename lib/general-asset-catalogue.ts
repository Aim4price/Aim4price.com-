export const GENERAL_ASSET_CATEGORIES = [
  {
    value: 'furniture_contents',
    label: 'Furniture & contents',
    description: 'Desks, chairs, couches, beds, cupboards, shelving and ordinary contents.',
  },
  {
    value: 'appliances',
    label: 'Appliances',
    description: 'Fridges, freezers, stoves, washing machines, microwaves and similar appliances.',
  },
  {
    value: 'computers_it',
    label: 'Computers & IT',
    description: 'Laptops, desktops, servers, tablets, printers and network equipment.',
  },
  {
    value: 'portable_electronics',
    label: 'Phones, cameras & portable electronics',
    description: 'Mobile phones, cameras, scanners and electronics that regularly leave the premises.',
  },
  {
    value: 'commercial_refrigeration',
    label: 'Commercial refrigeration & cold storage',
    description: 'Cold rooms, display fridges, milk tanks and refrigeration used to protect stock or produce.',
  },
  {
    value: 'kitchen_catering',
    label: 'Kitchen & catering equipment',
    description: 'Ovens, mixers, coffee machines, fryers and other commercial food-service equipment.',
  },
  {
    value: 'security_systems',
    label: 'Security & access systems',
    description: 'Cameras, alarms, access control, electric fencing and monitoring equipment.',
  },
  {
    value: 'power_energy',
    label: 'Generators, inverters, batteries & solar',
    description: 'Backup power, solar equipment, batteries, generators and related controls.',
  },
  {
    value: 'fixtures_improvements',
    label: 'Fixed fixtures & improvements',
    description: 'Built-in counters, fitted equipment, tenant improvements and other attached items.',
  },
  {
    value: 'high_value_items',
    label: 'High-value or specialist items',
    description: 'Art, jewellery, collectibles, display items and assets that may need individual specification.',
  },
  {
    value: 'other_general',
    label: 'Something else',
    description: 'Another ordinary asset that does not fit one of the groups above.',
  },
] as const;

export const PROPERTY_ASSET_SUBTYPES = [
  {
    value: 'land',
    label: 'Land',
    description: 'Vacant, agricultural or other land recorded separately from buildings and improvements.',
  },
  {
    value: 'building_structure',
    label: 'Building or structure',
    description: 'Houses, offices, warehouses, workshops, sheds, stores and similar structures.',
  },
  {
    value: 'fixed_improvement',
    label: 'Fixed improvement',
    description: 'Walls, paving, boreholes, fencing and other permanent improvements to a property.',
  },
  {
    value: 'tenant_improvement',
    label: 'Tenant improvement',
    description: 'Alterations, fittings or improvements paid for by a tenant at a leased premises.',
  },
  {
    value: 'other_property',
    label: 'Other property',
    description: 'Another property interest that does not fit one of the groups above.',
  },
] as const;

export const STOCK_ASSET_SUBTYPES = [
  {
    value: 'raw_materials',
    label: 'Raw materials',
    description: 'Materials and commodities held for manufacturing, processing or production.',
  },
  {
    value: 'finished_goods',
    label: 'Finished goods',
    description: 'Completed products or merchandise held for sale or distribution.',
  },
  {
    value: 'parts_spares',
    label: 'Parts and spares',
    description: 'Replacement parts, workshop spares and service inventory.',
  },
  {
    value: 'agricultural_inputs',
    label: 'Agricultural inputs',
    description: 'Seed, fertiliser, chemicals, feed and other farming inputs.',
  },
  {
    value: 'produce',
    label: 'Produce',
    description: 'Harvested crops, food products and other stored agricultural produce.',
  },
  {
    value: 'livestock',
    label: 'Livestock',
    description: 'Animals or herds recorded on a market, agreed or declared-value basis.',
  },
  {
    value: 'third_party_stock',
    label: 'Third-party or consignment stock',
    description: 'Goods held on behalf of a customer, supplier or another owner.',
  },
  {
    value: 'other_stock',
    label: 'Other stock',
    description: 'Another inventory or stock group that does not fit one of the groups above.',
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
