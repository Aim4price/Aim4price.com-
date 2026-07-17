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

export type GeneralAssetCategoryKey = (typeof GENERAL_ASSET_CATEGORIES)[number]['value'];

const GENERAL_ASSET_CATEGORY_KEYS = new Set<string>(GENERAL_ASSET_CATEGORIES.map((category) => category.value));

export function normalizeGeneralAssetCategory(value: unknown): GeneralAssetCategoryKey | '' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return GENERAL_ASSET_CATEGORY_KEYS.has(normalized) ? normalized as GeneralAssetCategoryKey : '';
}

export function generalAssetCategoryLabel(value: unknown): string {
  const normalized = normalizeGeneralAssetCategory(value);
  return GENERAL_ASSET_CATEGORIES.find((category) => category.value === normalized)?.label ?? '';
}
