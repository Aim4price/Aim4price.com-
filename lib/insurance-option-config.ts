import type { InsuranceClientProfile } from './insurance-workspace-types';

export type InsuranceAssetCategory = {
  key: string;
  label: string;
  searchTerms: string[];
  policySections: string[];
  optionKeys: string[];
};

export type InsuranceOptionDefinition = {
  key: string;
  label: string;
  helpText: string;
  answerType?: 'status' | 'amount' | 'text';
};

export const CLIENT_PROFILES: Array<{ value: InsuranceClientProfile; label: string }> = [
  { value: 'unclassified', label: 'Select client profile' },
  { value: 'domestic', label: 'Domestic / personal lines' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'agricultural', label: 'Agricultural' },
  { value: 'transport', label: 'Transport and logistics' },
  { value: 'construction', label: 'Construction' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'other', label: 'Other' },
];

export const INSURANCE_OPTIONS: Record<string, InsuranceOptionDefinition> = {
  accidental_damage: { key: 'accidental_damage', label: 'Accidental damage', helpText: 'Sudden and unforeseen accidental loss or damage.' },
  theft: { key: 'theft', label: 'Theft', helpText: 'Theft cover and any required security conditions.' },
  fire_perils: { key: 'fire_perils', label: 'Fire and allied perils', helpText: 'Fire, lightning, explosion and stated allied perils.' },
  mechanical_breakdown: { key: 'mechanical_breakdown', label: 'Mechanical breakdown', helpText: 'Internal mechanical or electrical breakdown.' },
  power_surge: { key: 'power_surge', label: 'Power surge', helpText: 'Electrical damage arising from a power surge.' },
  business_interruption: { key: 'business_interruption', label: 'Business interruption', helpText: 'Consequential loss following an insured event.' },
  riot_strike: { key: 'riot_strike', label: 'Riot and strike extension', helpText: 'Applicable riot, strike or civil commotion extension.' },
  hail_storm: { key: 'hail_storm', label: 'Hail and storm', helpText: 'Hail, wind, storm and water damage where applicable.' },
  subsidence: { key: 'subsidence', label: 'Subsidence and landslip', helpText: 'Subsidence and landslip extension.' },
  glass: { key: 'glass', label: 'Glass', helpText: 'Fixed glass and associated signage.' },
  geyser_burst: { key: 'geyser_burst', label: 'Geyser and water damage', helpText: 'Escape of water and stated water-heating equipment.' },
  all_risks_away: { key: 'all_risks_away', label: 'Away from premises', helpText: 'Cover while the item is away from the insured premises.' },
  goods_in_transit: { key: 'goods_in_transit', label: 'Goods in transit', helpText: 'Loss or damage while goods are transported.' },
  third_party: { key: 'third_party', label: 'Third-party liability', helpText: 'Legal liability to third parties.' },
  own_damage: { key: 'own_damage', label: 'Own damage', helpText: 'Accidental loss of or damage to the vehicle.' },
  passenger_liability: { key: 'passenger_liability', label: 'Passenger liability', helpText: 'Liability related to passengers.' },
  hired_in_plant: { key: 'hired_in_plant', label: 'Hired-in plant', helpText: 'Plant hired, leased or temporarily in the insured’s custody.' },
  deterioration_stock: { key: 'deterioration_stock', label: 'Deterioration of stock', helpText: 'Deterioration following failure of stated equipment or services.' },
  leakage: { key: 'leakage', label: 'Leakage or contamination', helpText: 'Leakage or contamination of stored liquids or materials.' },
  livestock_mortality: { key: 'livestock_mortality', label: 'Livestock mortality', helpText: 'Mortality from stated insured events.' },
  veld_fire: { key: 'veld_fire', label: 'Fire on veld', helpText: 'Fire affecting veld, grazing or stated crops.' },
};

export const ASSET_CATEGORIES: InsuranceAssetCategory[] = [
  { key: 'motor_vehicle', label: 'Motor vehicle', searchTerms: ['vehicle', 'car', 'truck', 'bakkie', 'hilux', 'motor'], policySections: ['Motor'], optionKeys: ['own_damage', 'third_party', 'theft', 'hail_storm', 'passenger_liability', 'riot_strike'] },
  { key: 'trailer', label: 'Trailer', searchTerms: ['trailer'], policySections: ['Motor', 'Business All Risks'], optionKeys: ['own_damage', 'third_party', 'theft', 'goods_in_transit'] },
  { key: 'building_property', label: 'Building or property', searchTerms: ['building', 'house', 'shed', 'store', 'warehouse', 'office', 'property'], policySections: ['Buildings Combined', 'Fire', 'Houseowners'], optionKeys: ['fire_perils', 'theft', 'hail_storm', 'subsidence', 'glass', 'geyser_burst', 'business_interruption', 'riot_strike'] },
  { key: 'mobile_machinery', label: 'Mobile plant and machinery', searchTerms: ['tractor', 'loader', 'excavator', 'harvester', 'forklift', 'mobile plant'], policySections: ['Business All Risks', 'Motor', 'Machinery Breakdown'], optionKeys: ['accidental_damage', 'theft', 'fire_perils', 'mechanical_breakdown', 'third_party', 'hired_in_plant', 'riot_strike'] },
  { key: 'fixed_machinery', label: 'Fixed plant and machinery', searchTerms: ['plant', 'machine', 'machinery', 'milking', 'compressor', 'generator'], policySections: ['Machinery Breakdown', 'Fire', 'Business All Risks'], optionKeys: ['accidental_damage', 'fire_perils', 'mechanical_breakdown', 'power_surge', 'business_interruption', 'riot_strike'] },
  { key: 'irrigation_water', label: 'Irrigation and water systems', searchTerms: ['irrigation', 'pivot', 'pump', 'borehole', 'water'], policySections: ['Business All Risks', 'Machinery Breakdown', 'Fire'], optionKeys: ['accidental_damage', 'theft', 'fire_perils', 'mechanical_breakdown', 'power_surge', 'hail_storm'] },
  { key: 'renewable_energy', label: 'Renewable energy', searchTerms: ['solar', 'battery', 'inverter', 'renewable'], policySections: ['Electronic Equipment', 'Machinery Breakdown', 'Fire'], optionKeys: ['accidental_damage', 'theft', 'fire_perils', 'mechanical_breakdown', 'power_surge', 'business_interruption'] },
  { key: 'electronic_equipment', label: 'Electronic equipment', searchTerms: ['electronic', 'computer', 'server', 'camera', 'alarm', 'laptop'], policySections: ['Electronic Equipment', 'Business All Risks'], optionKeys: ['accidental_damage', 'theft', 'power_surge', 'all_risks_away', 'business_interruption'] },
  { key: 'tools_portable', label: 'Tools and portable equipment', searchTerms: ['tool', 'portable'], policySections: ['Business All Risks', 'All Risks'], optionKeys: ['accidental_damage', 'theft', 'all_risks_away', 'fire_perils'] },
  { key: 'stock_materials', label: 'Stock and materials', searchTerms: ['stock', 'material', 'inventory', 'produce'], policySections: ['Fire', 'Office Contents', 'Goods in Transit'], optionKeys: ['fire_perils', 'theft', 'goods_in_transit', 'deterioration_stock', 'leakage', 'riot_strike'] },
  { key: 'domestic_contents', label: 'Domestic contents', searchTerms: ['contents', 'furniture', 'appliance', 'household'], policySections: ['Householders', 'All Risks'], optionKeys: ['fire_perils', 'theft', 'accidental_damage', 'all_risks_away', 'power_surge'] },
  { key: 'livestock_game', label: 'Livestock and game', searchTerms: ['livestock', 'cattle', 'sheep', 'goat', 'game', 'animal'], policySections: ['Livestock and Game', 'Agricultural Assets'], optionKeys: ['livestock_mortality', 'fire_perils', 'veld_fire', 'theft'] },
  { key: 'other', label: 'Other asset', searchTerms: [], policySections: ['Business All Risks', 'Fire', 'All Risks'], optionKeys: ['accidental_damage', 'theft', 'fire_perils'] },
];

export const GENERAL_COVERS = [
  { key: 'public_liability', label: 'Public liability', profiles: ['commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other'] },
  { key: 'employers_liability', label: 'Employers’ liability', profiles: ['commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other'] },
  { key: 'business_interruption', label: 'Business interruption', profiles: ['commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other'] },
  { key: 'money', label: 'Money', profiles: ['commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other'] },
  { key: 'fidelity', label: 'Fidelity guarantee', profiles: ['commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other'] },
  { key: 'goods_in_transit', label: 'Goods in transit', profiles: ['commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other'] },
  { key: 'personal_liability', label: 'Personal liability', profiles: ['domestic'] },
  { key: 'personal_accident', label: 'Personal accident', profiles: ['domestic', 'commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other'] },
] as const;

export const EXCLUSION_REASONS = [
  { value: '', label: 'Select reason' },
  { value: 'client_declined', label: 'Client declined' },
  { value: 'covered_elsewhere', label: 'Covered elsewhere' },
  { value: 'not_applicable', label: 'Not applicable to risk' },
  { value: 'unacceptable_risk', label: 'Risk not accepted' },
  { value: 'value_below_threshold', label: 'Value below scheduling threshold' },
  { value: 'information_outstanding', label: 'Information outstanding' },
  { value: 'other', label: 'Other recorded reason' },
];

export function categoryDefinition(key: string): InsuranceAssetCategory {
  return ASSET_CATEGORIES.find((category) => category.key === key) ?? ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1];
}

export function suggestInsuranceCategory(asset: Record<string, unknown>): string {
  const haystack = [asset.title, asset.kind, asset.equipmentFamilyLabel, asset.brandName, asset.modelName]
    .map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
    .join(' ');
  return ASSET_CATEGORIES.find((category) => category.searchTerms.some((term) => haystack.includes(term)))?.key ?? 'other';
}

export function optionsForCategory(categoryKey: string): InsuranceOptionDefinition[] {
  return categoryDefinition(categoryKey).optionKeys.map((key) => INSURANCE_OPTIONS[key]).filter(Boolean);
}

export function generalCoversForProfile(profile: InsuranceClientProfile) {
  return GENERAL_COVERS.filter((cover) => profile === 'unclassified' || cover.profiles.includes(profile as never));
}
