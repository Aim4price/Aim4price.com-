import { BASIC_FUEL_FAMILY_KEYS } from './basic-fuel-families';

function fuelBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function key(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[ -]+/g, '_') : '';
}

/** Shared by Manage and Fuel Ledger; propulsion and usage alone do not prove fuel use. */
export function assetCanReceiveFuel(asset: {
  kind: unknown;
  specsJson?: unknown;
  familyIsPropelled?: unknown;
  equipmentFamilyKey?: unknown;
}): boolean {
  const specs = record(asset.specsJson);
  const acceptsFuel = fuelBoolean(specs.accepts_fuel ?? specs.acceptsFuel);
  if (acceptsFuel === false) return false;

  const powerSource = key(specs.fuel_type ?? specs.fuelType ?? specs.power_source ?? specs.powerSource);
  // A known non-fuel power source overrides broad kind/family/propulsion markers.
  if (['electric', 'battery', 'battery_electric', 'electric_battery', 'bev', 'solar',
    'battery_solar', 'plug_in_electric', 'pto', 'tractor_pto', 'manual', 'pneumatic'].includes(powerSource)) return false;
  if (acceptsFuel === true) return true;
  if (['diesel', 'petrol', 'gasoline', 'gas', 'lpg', 'cng', 'lng', 'hybrid',
    'petrol_hybrid', 'diesel_hybrid', 'plug_in_hybrid', 'phev'].includes(powerSource)) return true;

  const catalogue = record(specs.basic_catalogue);
  const familyKey = key(catalogue.familyKey ?? specs.family_key ?? specs.familyKey ?? asset.equipmentFamilyKey);
  // Basic families have no public equipment-family FK. Use their saved identity,
  // including for existing assets, without changing valuation's isPropelled flag.
  if (specs.basic_catalogue_release || catalogue.familyKey) {
    return BASIC_FUEL_FAMILY_KEYS.has(familyKey);
  }
  // The legacy Motor seed incorrectly marks trailers as propelled. Warehouse
  // equipment is too broad to imply an engine; require explicit fuel evidence.
  if (['trailers', 'warehouse_equipment'].includes(familyKey)) return false;

  const explicitPropulsion = fuelBoolean(specs.is_propelled ?? specs.isPropelled
    ?? specs.self_propelled ?? specs.selfPropelled);
  if (explicitPropulsion !== null) return explicitPropulsion;
  const kind = key(asset.kind);
  if (kind === 'tractor' || kind === 'vehicle') return true;
  return fuelBoolean(asset.familyIsPropelled) ?? false;
}
