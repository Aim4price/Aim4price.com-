import { randomUUID } from 'node:crypto';
import { getDb, withDatabaseClient } from './db';
import { basicCatalogueEnabled, listBasicCatalogueFamilies } from './basic-catalogue';
import { listEquipmentFamilies, type EquipmentFamilyRecord } from './equipment-catalog';
import { isSectorKey } from './equipment-types';
import type { AssetOption } from './asset-options';

let ready: Promise<void> | undefined;
function ensureOptions() {
  return ready ??= getDb().query(`create table if not exists public.valuation_asset_options (
    id text primary key, label text not null, sector text not null, mode text not null,
    archived boolean not null, version integer not null
  )`).then(() => undefined).catch(error => { ready = undefined; throw error; });
}

function optionFor(family: EquipmentFamilyRecord, overrides: Map<string, AssetOption>): AssetOption {
  const basic = Boolean(family.basicCatalogue);
  const id = [basic ? 'basic' : 'public', family.sectorKey, family.familyKey].join('/');
  return overrides.get(id) ?? {
    id, label: family.familyLabel, sector: family.sectorKey,
    mode: basic ? 'basic' : basicCatalogueEnabled() ? 'advanced' : 'both',
    archived: false, version: 0,
  };
}

async function readOptions(includeBasic = true) {
  // Get Value can still read its original catalogue before the first admin edit.
  const exists = await getDb().query("select to_regclass('public.valuation_asset_options') as table_name");
  const [equipment, basic, stored] = await Promise.all([
    listEquipmentFamilies({ includeInactive: true }),
    includeBasic && basicCatalogueEnabled() ? listBasicCatalogueFamilies(null) : [],
    exists.rows[0]?.table_name
      ? getDb().query<AssetOption>('select * from public.valuation_asset_options')
      : { rows: [] as AssetOption[] },
  ]);
  const overrides = new Map(stored.rows.map(row => [row.id, row]));
  return [...equipment, ...basic].map(family => ({ family, option: optionFor(family, overrides) }));
}

export async function listAssetOptions() {
  return (await readOptions()).map(row => row.option).sort((a,b) => a.label.localeCompare(b.label));
}

export async function listValuationOptions(mode: 'basic' | 'advanced', sector: string | null, includeInactive: boolean) {
  return (await readOptions(mode === 'basic')).filter(({ family, option }) =>
    !option.archived && (includeInactive || family.isActive) &&
    (!sector || option.sector === sector) && (option.mode === mode || option.mode === 'both')
  ).map(({ family, option }) => ({ ...family, familyLabel: option.label, optionId: option.id,
    managedOption: option.version > 0,
    basicCatalogue: family.basicCatalogue && { ...family.basicCatalogue, familyLabel: option.label },
  }));
}

export class OptionError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export async function saveAssetOption(input: AssetOption) {
  const label = typeof input?.label === 'string' ? input.label.trim() : '';
  if (!label || label.length > 120 || !isSectorKey(input.sector) ||
      !['basic','advanced','both'].includes(input.mode) || typeof input.archived !== 'boolean' ||
      typeof input.id !== 'string' || !Number.isInteger(input.version))
    throw new OptionError('Enter an asset name, sector and estimate type.');
  await ensureOptions();
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(481172040)');
    const options = await withDatabaseClient(client, listAssetOptions);
    const current = options.find(row => row.id === input.id);
    if ((input.id && !current) || (current?.version ?? 0) !== input.version)
      throw new OptionError('This option changed. Reload the page to see the latest version.', 409);
    if (input.id.startsWith('basic/') && input.mode !== 'basic')
      throw new OptionError('This family uses the Basic catalogue. Choose Basic.');
    const originalSector = current?.id.split('/')[1];
    if (input.mode !== 'basic' && (input.sector === 'motor' || originalSector === 'motor') &&
        (!current || originalSector !== input.sector || current.id.includes('/custom_')))
      throw new OptionError('Advanced Motor uses the model catalogue. Choose Basic for this option.');
    if (!input.archived && options.some(row => row.id !== input.id && !row.archived && row.sector === input.sector &&
        row.label.toLowerCase() === label.toLowerCase() && (row.mode === input.mode || row.mode === 'both' || input.mode === 'both')))
      throw new OptionError('An option with this name already exists in this sector and estimate type.');
    let id = input.id;
    if (!current) {
      const key = 'custom_' + randomUUID().replaceAll('-', '');
      const inserted = await client.query(`insert into public.equipment_families
        (sector_id,family_key,family_label,is_propelled,usage_metric_type,valuation_mode,catalog_mode,sort_order,is_active)
        select id,$2,$3,false,'wear_class','percent_used','generic_specs',999,true from public.sectors where sector_key=$1`,
        [input.sector, key, label]);
      if (!inserted.rowCount) throw new OptionError('Sector unavailable.');
      id = ['public',input.sector,key].join('/');
    }
    const { rows } = await client.query<AssetOption>(`insert into public.valuation_asset_options
      (id,label,sector,mode,archived,version) values ($1,$2,$3,$4,$5,1)
      on conflict (id) do update set label=excluded.label, sector=excluded.sector, mode=excluded.mode,
      archived=excluded.archived, version=valuation_asset_options.version+1 returning *`,
      [id,label,input.sector,input.mode,input.archived]);
    await client.query('commit');
    return rows[0];
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
