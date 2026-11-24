import { pricingInputExVat } from './pricing-vat';
export const assetColumns = {
  title: 'Asset name', make: 'Make', model: 'Model', category: 'Category', year: 'Year',
  serial: 'Serial / VIN', usage: 'Usage', unit: 'Usage unit', value: 'Current value',
};
export type Column = keyof typeof assetColumns;
export type AssetRow = Record<Column, string>;
export const columns = Object.keys(assetColumns) as Column[];
export const maxAssets = 250;
export const blankAsset = (): AssetRow => ({ title: '', make: '', model: '', category: '', year: '', serial: '', usage: '', unit: '', value: '' });
export type Basis = '' | 'included' | 'excluded';
export type Mapping = Column | '' | 'hours' | 'km' | 'percentage';
const aliases: Record<string, Mapping> = {
  asset: 'title', assetname: 'title', assetdescription: 'title', description: 'title', name: 'title', title: 'title',
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
  return Object.hasOwn(aliases, key) ? aliases[key] : '';
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
  return row.title.trim() || [row.make.trim(), row.model.trim()].filter(Boolean).join(' ');
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
    errors.title = 'Enter an asset name or make and model.';
  if (row.year && (!/^\d{4}$/.test(row.year) || +row.year < 1800 || +row.year > new Date().getFullYear() + 1))
    errors.year = 'Enter a four-digit year or leave blank.';
  const metric = usageUnit(row.unit);
  if ((row.usage || row.unit) && !metric)
    errors.unit = 'Choose hours, km or %.';
  if (row.usage && (!/^\d+$/.test(row.usage.replace(/\s/g, '')) || !Number.isSafeInteger(parseAmount(row.usage)) || parseAmount(row.usage) > (metric === 'percentage' ? 100 : 2147483647)))
    errors.usage = metric === 'percentage' ? 'Enter 0 to 100.' : 'Enter a whole number of hours or km.';
  if (row.value && (!Number.isFinite(parseAmount(row.value)) || pricingInputExVat(parseAmount(row.value), basis === 'included') < 1 || parseAmount(row.value) > 2147483647))
    errors.value = 'Enter a positive rand amount, e.g. 125000.50.';
  if (row.value && !basis)
    errors.value = 'Choose the VAT basis for current values.';
  for (const key of columns)
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
