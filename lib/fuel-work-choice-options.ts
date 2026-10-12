export type FuelActivityAsset = { kind?: string; assetTypeLabel?: string; equipmentFamilyKey?: string };
export type FuelWorkChoice = { id: string; name: string; profile?: string };

// Specific equipment wins over broad vehicle/tractor classifications.
const PROFILES: Array<{ key: string; match: RegExp; activities: string[] }> = [
  { key: 'generator', match: /generator/, activities: ['Generator operation', 'Backup power', 'Powering site equipment'] },
  { key: 'lighting', match: /lighting tower/, activities: ['Site lighting', 'Night work lighting'] },
  { key: 'compressor', match: /compressor/, activities: ['Operating pneumatic tools', 'Compressed air supply'] },
  { key: 'concrete-pump', match: /concrete.*pump/, activities: ['Pumping concrete', 'Concrete placement', 'Site setup'] },
  { key: 'funeral', match: /hearse/, activities: ['Funeral transport', 'Collection', 'Travel to a service'] },
  { key: 'pump', match: /pump|irrigation/, activities: ['Pumping water', 'Irrigation', 'Site dewatering'] },
  { key: 'harvester', match: /harvester|combine/, activities: ['Harvesting', 'Crop collection', 'Moving between fields'] },
  { key: 'sprayer', match: /sprayer|spraying/, activities: ['Crop spraying', 'Weed control', 'Moving between fields'] },
  { key: 'hay', match: /windrow|mower|baler/, activities: ['Cutting grass', 'Hay making', 'Field maintenance'] },
  { key: 'forestry', match: /chipper|forestry|chainsaw|logger/, activities: ['Timber processing', 'Clearing vegetation', 'Forestry work'] },
  { key: 'excavator', match: /excavator|backhoe|trencher|trenching/, activities: ['Excavating', 'Digging trenches', 'Site clearing'] },
  { key: 'drill', match: /drill|piling|pile driv/, activities: ['Drilling', 'Foundation work', 'Ground investigation'] },
  { key: 'earthmoving', match: /bulldozer|grader|earthmoving/, activities: ['Earthmoving', 'Road grading', 'Site preparation'] },
  { key: 'loader', match: /loader|forklift|stacker|telehandler/, activities: ['Loading', 'Unloading', 'Moving materials'] },
  { key: 'lifting', match: /crane|boom lift|scissor lift|platform|aerial/, activities: ['Lifting materials', 'Access for maintenance', 'Installation work'] },
  { key: 'roadwork', match: /roller|compactor|compaction|rammer|paver|milling|recycler|stabiliser|bitumen|chip spreader|line marker|asphalt/, activities: ['Road construction', 'Surface preparation', 'Road maintenance'] },
  { key: 'concrete', match: /concrete|screed|power float|floor saw|early entry saw|breaker/, activities: ['Concrete work', 'Surface finishing', 'Site preparation'] },
  { key: 'crusher', match: /crusher|screen|trommel/, activities: ['Crushing material', 'Screening material', 'Aggregate production'] },
  { key: 'cleaning', match: /refuse|skip|hooklift|vacuum|jetting|jet vac|sweeper|street washing/, activities: ['Waste collection', 'Site cleaning', 'Disposal run'] },
  { key: 'emergency', match: /fire|ambulance|recovery|tow truck|rollback/, activities: ['Emergency response', 'Assistance callout', 'Recovery work'] },
  { key: 'tanker', match: /tanker/, activities: ['Liquid delivery', 'Water supply', 'Collection run'] },
  { key: 'truck', match: /truck|dumper|dump carrier/, activities: ['Delivery', 'Collecting goods', 'Hauling materials'] },
  { key: 'tractor', match: /tractor/, activities: ['Ploughing', 'Planting', 'Spraying', 'Feeding livestock', 'Towing implements', 'Field maintenance'] },
  { key: 'passenger', match: /bus|coach|people carrier|tuk tuk|game viewer/, activities: ['Transporting people', 'Staff transport', 'Passenger trip'] },
  { key: 'vehicle', match: /vehicle|sedan|hatchback|coupe|convertible|wagon|suv|bakkie|van|motorcycle|scooter|quad|side by side|trike|three wheeler|motorhome/, activities: ['Delivery', 'Transporting people', 'Travel to a meeting', 'Site visit', 'Collecting supplies'] },
];
const GENERAL = ['Maintenance', 'Equipment operation', 'Inspection'];
const choiceId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const DEFAULT_FUEL_WORK_CHOICES: FuelWorkChoice[] = [...new Set([...PROFILES.flatMap(p => p.activities), ...GENERAL])].map(name => ({ id: choiceId(name), name }));
export function fuelActivityProfile(asset?: FuelActivityAsset | null): string {
  const family = `${asset?.equipmentFamilyKey || ''} ${asset?.assetTypeLabel || ''}`.toLowerCase().replace(/[_-]/g, ' ');
  return PROFILES.find(p => p.match.test(family))?.key
    || PROFILES.find(p => p.match.test(asset?.kind || ''))?.key || 'general';
}
export function fuelActivitySuggestions(asset?: FuelActivityAsset | null): FuelWorkChoice[] {
  const profile = PROFILES.find(p => p.key === fuelActivityProfile(asset));
  return [...(profile?.activities || GENERAL), ...(profile ? ['Maintenance'] : [])].map(name => ({ id: choiceId(name), name }));
}
export function fuelActivityChoices(choices: FuelWorkChoice[], asset?: FuelActivityAsset | null): FuelWorkChoice[] {
  const profile = fuelActivityProfile(asset);
  const suggestions = fuelActivitySuggestions(asset);
  const known = new Set([...DEFAULT_FUEL_WORK_CHOICES.map(c => c.name.toLowerCase()), 'transport', 'feeding livestock']);
  const relevant = choices.filter(c => c.profile ? c.profile === profile : !known.has(c.name.toLowerCase()) || suggestions.some(s => s.name === c.name));
  return [...relevant, ...suggestions.filter(s => !relevant.some(c => c.name.toLowerCase() === s.name.toLowerCase()))];
}

export function validateFuelWorkChoices(value: unknown): FuelWorkChoice[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Keep up to 100 work choices.');
  const ids = new Set<string>(), names = new Set<string>();
  return value.map(item => {
    const id = typeof item?.id === 'string' ? item.id : '';
    const name = typeof item?.name === 'string' ? item.name.trim().replace(/\s+/g, ' ') : '';
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new Error('Invalid work choice.');
    if (name.length < 2 || name.length > 120) throw new Error('Use 2–120 characters for each work choice.');
    if (names.has(name.toLocaleLowerCase('en-ZA'))) throw new Error('That work choice already exists.');
    ids.add(id); names.add(name.toLocaleLowerCase('en-ZA'));
    const profile = typeof item?.profile === 'string' ? item.profile : undefined;
    if (profile && profile !== 'general' && !PROFILES.some(p => p.key === profile)) throw new Error('Invalid activity profile.');
    return { id, name, ...(profile ? { profile } : {}) };
  });
}
