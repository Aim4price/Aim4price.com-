export type FuelWorkChoice = { id: string; name: string };
export const DEFAULT_FUEL_WORK_CHOICES: FuelWorkChoice[] = [
  ['ploughing', 'Ploughing'], ['planting', 'Planting'], ['spraying', 'Spraying'],
  ['harvesting', 'Harvesting'], ['irrigation', 'Irrigation'], ['feeding', 'Feeding livestock'],
  ['loading', 'Loading'], ['transport', 'Transport'], ['earthmoving', 'Earthmoving'],
  ['maintenance', 'Maintenance'], ['generator', 'Generator operation'],
].map(([id, name]) => ({ id, name }));

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
    return { id, name };
  });
}
