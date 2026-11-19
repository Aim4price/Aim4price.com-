import type { AssetOption } from './asset-options';
import { isSectorKey } from './equipment-types';
import { partsTableCsv, readPartsCsv } from './parts-network-csv';

const headers = ['Family name', 'Sector', 'Estimate type', 'Status', 'ID', 'Version'];
const formulaPrefix = /^['=+@-]/;

export function assetOptionsCsv(options: AssetOption[]) {
  const rows = options.map(({label,sector,mode,archived,id,version}) => [
    formulaPrefix.test(label) ? "'" + label : label, sector, mode, archived ? 'archived' : 'active', id, String(version),
  ]);
  return '\uFEFF' + partsTableCsv([headers, ...rows]);
}

export function readAssetOptionsCsv(csv: string) {
  const [header, ...rows] = readPartsCsv(csv, {preserveEmptyRows:true});
  const indexes = headers.map(name => header.findIndex(cell => cell.toLowerCase() === name.toLowerCase()));
  if (header.length !== headers.length || indexes.includes(-1))
    throw new Error('Use the six column headings from Export CSV.');
  const ids = new Set<string>();
  return rows.flatMap((cells, index) => {
    if (cells.every(cell => !cell)) return [];
    const row = index + 2;
    if (cells.length !== headers.length) throw new Error(`Row ${row} needs six columns.`);
    const [name,sectorText,modeText,statusText,id,version] = indexes.map(i => cells[i]);
    const label = name.startsWith("'") && formulaPrefix.test(name.slice(1)) ? name.slice(1) : name;
    const sector = sectorText.toLowerCase();
    const mode = modeText.toLowerCase() === 'basic and advanced' ? 'both' : modeText.toLowerCase();
    const status = statusText.toLowerCase();
    if (!label || label.length > 120) throw new Error(`Row ${row} needs a family name of up to 120 characters.`);
    if (!isSectorKey(sector)) throw new Error(`Row ${row} needs a valid sector.`);
    if (mode !== 'basic' && mode !== 'advanced' && mode !== 'both') throw new Error(`Row ${row} needs basic, advanced or both.`);
    if (status !== 'active' && status !== 'archived') throw new Error(`Row ${row} needs active or archived.`);
    if (id && ids.has(id)) throw new Error(`Row ${row} repeats a family ID.`);
    if (id) ids.add(id);
    if (id ? !/^\d+$/.test(version) || !Number.isSafeInteger(Number(version)) : version !== '' && version !== '0')
      throw new Error(`Row ${row} has an invalid version. Keep the exported ID and version together.`);
    if (!id && status === 'archived') throw new Error(`Row ${row} must be active to add a new family.`);
    const option: AssetOption = {id,label,sector,mode,archived:status === 'archived',version:Number(version)};
    return [{row,option}];
  });
}

export function planAssetOptionsCsv(csv: string, existing: AssetOption[]) {
  const byId = new Map(existing.map(option => [option.id, option]));
  const changes = readAssetOptionsCsv(csv).filter(({row,option}) => {
    if (!option.id) return true;
    const old = byId.get(option.id);
    if (!old) throw new Error(`Row ${row} has an unknown family ID. Export a fresh CSV.`);
    if (old.label === option.label && old.sector === option.sector && old.mode === option.mode && old.archived === option.archived) return false;
    if (old.version !== option.version) throw new Error(`Row ${row} changed since export. Export a fresh CSV.`);
    return true;
  });
  return changes;
}
