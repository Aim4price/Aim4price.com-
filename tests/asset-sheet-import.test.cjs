const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const { blankAsset, mapHeading, mapAssetRow, assetTitle, rowErrors } = load('lib/asset-sheet.ts');
const { readPartsExcel } = load('lib/parts-network-excel.ts');
const { Workbook } = require('exceljs');

test('a name is sufficient, and compatible make and model columns can supply it', () => {
  assert.deepEqual(rowErrors({...blankAsset(), title: 'Workshop compressor'}, ''), {});
  const row = mapAssetRow(['Case IH', 'JXM 90'], ['make','model']);
  assert.equal(assetTitle(row), 'Case IH JXM 90');
  assert.ok(rowErrors(blankAsset(), '').title);
  assert.ok(rowErrors({...blankAsset(), make: 'Case IH'}, '').title);
  assert.ok(rowErrors({...blankAsset(), model: 'JXM 90'}, '').title);
});

test('values require a stated VAT basis and unrelated monetary headings stay unmapped', () => {
  for (const label of ['Book value', 'Insured value', 'Replacement cost', 'Value']) assert.equal(mapHeading(label), '');
  const row = {...blankAsset(), title: 'Tractor', value: 'R 115 000'};
  assert.ok(rowErrors(row,'').value);
  assert.deepEqual(rowErrors(row,'included'), {});
});

test('usage needs a unit, accepts a zero reading and rejects invalid years and percentages', () => {
  const row = {...blankAsset(), title:'Pivot', usage:'0'};
  assert.ok(rowErrors(row,'').unit);
  assert.deepEqual(rowErrors({...row,unit:'%'},''),{});
  assert.ok(rowErrors({...row,unit:'%',usage:'101'},'').usage);
  assert.ok(rowErrors({...row,year:'18'},'').year);
});

test('Excel preserves zero-padded serials and translates percentage-formatted readings', async () => {
  const wb = new Workbook(), sheet = wb.addWorksheet('Assets');
  sheet.addRow(['Description','Serial/VIN','Usage']);
  sheet.addRow(['Pivot',123,0.35]);
  sheet.getCell('B2').numFmt='000000';
  sheet.getCell('C2').numFmt='0%';
  const [{rows}] = await readPartsExcel(await wb.xlsx.writeBuffer(),'assets');
  const asset = mapAssetRow(rows[1],rows[0].map(mapHeading));
  assert.equal(asset.serial,'000123');
  assert.equal(asset.unit,'percentage');
  assert.equal(asset.usage,'35');
});
