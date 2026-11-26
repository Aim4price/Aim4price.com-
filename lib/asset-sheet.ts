import { pricingInputExVat } from './pricing-vat';
export const assetColumns = {
  title: 'Asset name', category: 'Asset type', make: 'Brand', model: 'Model', year: 'Year', serial: 'Serial / VIN',
  condition: 'Condition', usage: 'Usage', unit: 'Usage unit', value: 'Current value', replacement: 'Replacement price',
  registration: 'Registration number', license: 'Licence status', finance: 'Finance status', financeNote: 'Finance notes',
  insurance: 'Insurance status', insuredValue: 'Insured value', insuranceNote: 'Insurance notes', note: 'Asset notes',
};
export type BuiltInColumn = keyof typeof assetColumns;
export type CustomColumn = `custom:${string}`;
export type Column = BuiltInColumn | CustomColumn;
export type AssetRow = Record<Column, string>;
export const columns = Object.keys(assetColumns) as BuiltInColumn[];
export const coreColumns: BuiltInColumn[] = ['title', 'category', 'make', 'model', 'year', 'serial', 'condition', 'usage', 'unit', 'value', 'replacement'];
const originalColumns: BuiltInColumn[] = ['title', 'make', 'model', 'category', 'year', 'serial', 'usage', 'unit', 'value'];
export const moneyColumns = ['value', 'replacement', 'insuredValue'] as const;
export const sheetTypes = ['Vehicle', 'Equipment', 'Property', 'Tools', 'Stock', 'Tractor', 'Manual'];
export const sheetConditions = { excellent: 'Excellent', good: 'Good', fair: 'Fair', used: 'Used', serious: 'Requires attention' } as const;
export function conditionKey(input: string) {
  const text = input.trim().toLowerCase();
  return (Object.keys(sheetConditions) as (keyof typeof sheetConditions)[]).find(k =>
    k === text || sheetConditions[k].toLowerCase() === text || (k === 'serious' && text === 'serious wear'));
}
export const paperworkChoices = {
  finance: ['Financed', 'Not financed', 'Paid off', 'Not sure', 'Not applicable'],
  insurance: ['Insured', 'Not insured', 'Not sure', 'Not applicable'],
  license: ['Licensed', 'Not licensed', 'Not sure', 'Not applicable'],
} as const;
export const sheetChoices: Partial<Record<BuiltInColumn, readonly string[]>> = {
  category: sheetTypes, condition: Object.values(sheetConditions), unit: ['hours', 'km', '%'], ...paperworkChoices,
};
type StatusField = keyof typeof paperworkChoices;
export function sheetStatus(row: AssetRow, field: StatusField) {
  const text = row[field].trim().toLowerCase().replace('licenced', 'licensed');
  const [yes, no] = paperworkChoices[field];
  if (!text) return 'unknown';
  if (field === 'finance' && ['paid off', 'paid', 'settled'].includes(text)) return 'paid';
  if (text === yes.toLowerCase() || text === 'yes') return 'yes';
  if (text === no.toLowerCase() || text === 'no') return 'no';
  if (['not applicable', 'n/a'].includes(text)) return 'not_applicable';
  if (['not sure', 'unknown'].includes(text)) return 'unknown';
  return null;
}
export function sheetAssetKind(category: string) {
  const text = category.trim().toLowerCase();
  if (['tractor', 'tractors'].includes(text)) return 'tractor';
  if (['vehicle', 'vehicles', 'truck', 'trucks', 'trailer', 'trailers'].includes(text)) return 'vehicle';
  if (['property', 'property / land / building'].includes(text)) return 'property';
  if (text === 'tool' || text === 'tools') return 'tools';
  if (text === 'equipment' || text === 'stock') return text;
  return 'manual';
}
export const maxCustomColumns = 12;
export const isCustomColumn = (key: string): key is CustomColumn => key.startsWith('custom:');
export const columnLabel = (key: Column) => isCustomColumn(key) ? key.slice(7) : assetColumns[key];
export const hasAssetData = (row: AssetRow) => Object.values(row).some(value => value.trim());

export function customColumn(name: string, existing: readonly CustomColumn[], saved = false): CustomColumn {
  const label = name.trim().replace(/\s+/g, ' ');
  if (!label || label.length > 60 || /[\u0000-\u001f\u007f]/.test(label)) throw Error('Use a field name between 1 and 60 characters.');
  if ((!saved && mapHeading(label))
    || existing.some(k => columnLabel(k).toLowerCase() === label.toLowerCase())) throw Error('A column with this name already exists.');
  if (existing.length >= maxCustomColumns) throw Error(`Use up to ${maxCustomColumns} custom columns per sheet.`);
  return `custom:${label}`;
}

export type AssetSheetDetail = { name: string; value: string };
export function savedSheetDetails(specs: Record<string, unknown> | null | undefined): AssetSheetDetail[] {
  const details = specs?.assetSheetFields;
  return Array.isArray(details) ? details.filter((d): d is AssetSheetDetail =>
    d && typeof d.name === 'string' && typeof d.value === 'string') : [];
}

export function readSheetColumns(input: unknown): CustomColumn[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > maxCustomColumns) throw Error('Invalid custom columns.');
  const result: CustomColumn[] = [];
  for (const key of input) {
    if (typeof key !== 'string' || !isCustomColumn(key) || customColumn(columnLabel(key), result, true) !== key) throw Error('Invalid custom column name.');
    result.push(key);
  }
  return result.sort();
}

export function readSheetRow(input: unknown, custom: CustomColumn[]): AssetRow {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid asset row.');
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some(k => isCustomColumn(k) && !custom.some(id => id === k))) throw Error('Unknown custom column.');
  const row = blankAsset();
  for (const key of [...columns, ...custom]) {
    const value = raw[key];
    if (value === undefined && !originalColumns.includes(key as BuiltInColumn)) { row[key] = ''; continue; }
    if (typeof value !== 'string') throw Error('Invalid asset row.');
    row[key] = value.trim();
  }
  return row;
}
export const maxAssets = 250;
export const blankAsset = (): AssetRow => Object.fromEntries(columns.map(k => [k, ''])) as AssetRow;

// Retain the original field order and omit empty extensions so older imports still match on retry.
export function importKeyRow(row: AssetRow) {
  const extras = Object.keys(row).filter(k => !originalColumns.includes(k as BuiltInColumn) && (isCustomColumn(k) || row[k as Column]));
  return Object.fromEntries([...originalColumns, ...extras].map(k => [k, row[k as Column]]));
}
export type Basis = '' | 'included' | 'excluded';
export type Mapping = Column | '' | 'hours' | 'km' | 'percentage';
const aliases: Record<string, Mapping> = {
  assettitle: 'title', modeldescription: 'model', usagevalue: 'usage',
  replacementcost: 'replacement', replacementvalue: 'replacement',
  licenseregistration: 'registration', licenceregistration: 'registration',
  licensestatus: 'license', notes: 'note', asset: 'title', assetname: 'title', assetdescription: 'title', description: 'title', name: 'title', title: 'title',
  make: 'make', brand: 'make', manufacturer: 'make', model: 'model', modelname: 'model',
  category: 'category', assettype: 'category', type: 'category', year: 'year', yearmodel: 'year', modelyear: 'year',
  serial: 'serial', serialno: 'serial', serialnumber: 'serial', serialnumbervin: 'serial', serialvin: 'serial', vin: 'serial', chassisnumber: 'serial',
  usage: 'usage', reading: 'usage', unit: 'unit', usageunit: 'unit', hours: 'hours', enginehours: 'hours',
  km: 'km', kilometres: 'km', kilometers: 'km', odometer: 'km', usagepercentage: 'percentage', percentage: 'percentage', lifeworked: 'percentage',
  currentvalue: 'value', marketvalue: 'value', manualvalue: 'value',
};
export function mapHeading(label: string): Mapping {
  const key = label.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (label.trim() === '%')
    return 'percentage';
  return Object.hasOwn(aliases, key) ? aliases[key] : columns.find(k => assetColumns[k].toLowerCase().replace(/[^a-z0-9]/g, '') === key) ?? '';
}
export function targetColumn(key: Mapping) {
  return key === 'hours' || key === 'km' || key === 'percentage' ? 'usage' : key;
}
export function mapAssetRow(cells: string[], mapping: Mapping[]) {
  const row = blankAsset();
  mapping.forEach((key, i) => {
    const cell = cells[i]?.trim();
    const column = targetColumn(key);
    if (!column || !cell)
      return;
    row[column] = cell;
    if (key === 'hours' || key === 'km' || key === 'percentage')
      row.unit = key;
  });
  if (/^\d+(?:\.\d+)?%$/.test(row.usage) && (!row.unit || usageUnit(row.unit) === 'percentage')) {
    row.usage = row.usage.slice(0, -1);
    row.unit = 'percentage';
  }
  return row;
}
export function assetTitle(row: AssetRow) {
  const make = row.make.trim();
  const model = row.model.trim();
  return row.title.trim() || (make && model ? [make, model].join(' ') : '');
}
export function usageUnit(raw: string) {
  const value = raw.trim().toLowerCase();
  if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(value))
    return 'hours';
  if (['km', 'kilometres', 'kilometers'].includes(value))
    return 'km';
  if (['%', 'percent', 'percentage'].includes(value))
    return 'percentage';
  return '';
}
export function parseAmount(raw: string) {
  const value = raw.trim().replace(/^R\s*/i, '').replace(/[\s\u00a0]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    return NaN;
  return Number(value);
}
export function rowErrors(row: AssetRow, basis: Basis) {
  const errors: Partial<Record<Column, string>> = {};
  if (!assetTitle(row))
    errors.title = 'Enter an asset name or both brand and model.';
  if (row.year && (!/^\d{4}$/.test(row.year) || +row.year < 1800 || +row.year > new Date().getFullYear() + 1))
    errors.year = 'Enter a four-digit year or leave blank.';
  const metric = usageUnit(row.unit);
  if ((row.usage || row.unit) && !metric)
    errors.unit = 'Choose hours, km or %.';
  if (row.usage && (!/^\d+$/.test(row.usage.replace(/\s/g, '')) || !Number.isSafeInteger(parseAmount(row.usage)) || parseAmount(row.usage) > (metric === 'percentage' ? 100 : 2147483647)))
    errors.usage = metric === 'percentage' ? 'Enter 0 to 100.' : 'Enter a whole number of hours or km.';
  if (row.condition && !conditionKey(row.condition))
    errors.condition = 'Choose Excellent, Good, Fair, Used or Requires attention.';
  for (const field of moneyColumns) {
    if (!row[field]) continue;
    const amount = parseAmount(row[field]);
    if (!Number.isFinite(amount) || pricingInputExVat(amount, basis === 'included') < 1 || amount > 2147483647)
      errors[field] = 'Enter a positive rand amount, e.g. 125000.50.';
    else if (!basis) errors[field] = 'Choose whether sheet values include VAT.';
  }
  for (const field of Object.keys(paperworkChoices) as StatusField[]) {
    if (!sheetStatus(row, field)) errors[field] = 'Choose ' + paperworkChoices[field].join(', ') + '.';
  }
  if (row.replacement && sheetAssetKind(row.category) === 'stock') errors.replacement = 'Replacement price does not apply to stock.';
  if (row.insuredValue && sheetStatus(row, 'insurance') !== 'yes') errors.insurance = 'Choose Insured or clear the insured value.';
  const finance = sheetStatus(row, 'finance');
  if (row.financeNote && finance !== 'yes' && finance !== 'paid') errors.finance = 'Choose Financed or Paid off to include finance notes.';
  if (row.insuranceNote && sheetStatus(row, 'insurance') !== 'yes') errors.insurance = 'Choose Insured to include insurance notes.';
  if (row.registration && sheetStatus(row, 'license') !== 'yes') errors.license = 'Choose Licensed or clear the registration number.';
  if (sheetAssetKind(row.category) === 'property' && (row.registration || (row.license && sheetStatus(row, 'license') !== 'not_applicable')))
    errors.license = 'Vehicle licensing does not apply to property. Clear the registration number and licence status.';
  for (const key of Object.keys(row) as Column[])
    if (row[key].length > 250)
      errors[key] = 'Use 250 characters or fewer.';
  return errors;
}
export function importPending(asset: {
  value: number;
  specsJson?: Record<string, unknown> | null;
} | null | undefined) {
  return Boolean(asset?.specsJson?.assetImportKey && !asset.value);
}
