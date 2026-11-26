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
  for (const label of ['Book value', 'Value']) assert.equal(mapHeading(label), '');
  assert.equal(mapHeading('Insured value'), 'insuredValue');
  assert.equal(mapHeading('Replacement cost'), 'replacement');
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

test('the Excel template opens on blank asset rows, offers the sheet defaults and keeps examples out of imports', async () => {
  const { buildAssetTemplate } = load('lib/asset-sheet-template.ts');
  const { coreColumns, columns, assetColumns } = load('lib/asset-sheet.ts');
  const template = buildAssetTemplate();
  const buffer = await template.xlsx.writeBuffer();
  const empty = await readPartsExcel(buffer, 'assets');
  assert.deepEqual(empty.map(s => s.name), ['Assets']);
  assert.deepEqual(empty[0].rows, [columns.map(k => assetColumns[k])]);
  assert.deepEqual(empty[0].rows[0].slice(0, 11).map(mapHeading), coreColumns);

  const wb = new Workbook();
  await wb.xlsx.load(buffer);
  const assets = wb.worksheets[0];
  assert.equal(assets.name, 'Assets');
  assert.equal(assets.views[0].state, 'frozen');
  assert.equal(assets.getCell('F2').numFmt, '@');
  assert.match(assets.getCell('G2').dataValidation.formulae[0], /Good/);
  assets.getCell('A2').value = 'Delivery truck';
  assets.getCell('F2').value = '001234';
  assets.getCell('G2').value = 'Good';
  assets.getCell('K2').value = 115000;
  wb.addWorksheet('Other assets').addRow(['Asset name']);
  const imported = await readPartsExcel(await wb.xlsx.writeBuffer(), 'assets');
  assert.deepEqual(imported.map(s => s.name), ['Assets', 'Other assets']);
  const row = mapAssetRow(imported[0].rows[1], imported[0].rows[0].map(mapHeading));
  assert.equal(row.serial, '001234');
  assert.equal(row.condition, 'Good');
  assert.equal(row.replacement, '115000');
  assert.deepEqual(rowErrors(row, 'included'), {});
});

test('older sheet payloads keep their retry keys and saved custom columns', () => {
  const { importKeyRow, readSheetRow, readSheetColumns } = load('lib/asset-sheet.ts');
  const old = { title:'Pump', make:'', model:'', category:'', year:'', serial:'', usage:'', unit:'', value:'', 'custom:Condition':'Refurbished' };
  const normalized = readSheetRow(old, readSheetColumns(['custom:Condition']));
  assert.equal(JSON.stringify(importKeyRow(normalized)), JSON.stringify(old));
  assert.notEqual(JSON.stringify(importKeyRow({...normalized, replacement:'100'})), JSON.stringify(old));
});

test('paperwork and condition mistakes are identified on their own columns', () => {
  const row = {...blankAsset(), title:'Trailer', insuredValue:'11500', insurance:'Not insured', condition:'Maybe'};
  assert.deepEqual(Object.keys(rowErrors(row,'excluded')).sort(), ['condition','insurance']);
  assert.ok(rowErrors({...blankAsset(), title:'Truck', registration:'CA123'}, '').license);
  assert.ok(rowErrors({...blankAsset(), title:'Truck', insuredValue:'11500'}, 'excluded').insurance);
  assert.deepEqual(rowErrors({...blankAsset(), title:'Truck', finance:'Paid off', financeNote:'Settled in full'}, ''), {});
  assert.ok(rowErrors({...blankAsset(), title:'Depot', category:'Property', registration:'CA123'}, '').license);
  assert.ok(rowErrors({...blankAsset(), title:'Stock', category:'Stock', replacement:'1500'},'excluded').replacement);
  assert.ok(rowErrors({...blankAsset(), title:'Trailer', replacement:'1500'},'').replacement);
});

test('custom columns keep text and validate names and custom-only rows', () => {
  const { customColumn, readSheetColumns, readSheetRow, hasAssetData } = load('lib/asset-sheet.ts');
  const key = customColumn('  Insurance   reference  ', []);
  assert.equal(key, 'custom:Insurance reference');
  assert.throws(() => customColumn('insurance reference', [key]), /already exists/);
  assert.throws(() => customColumn('Serial number', []), /already exists/);
  assert.throws(() => readSheetColumns(['custom:']), /name/);
  assert.throws(() => readSheetRow({ ...blankAsset(), [key]: '123' }, []), /Unknown/);
  const row = mapAssetRow([' 000123 '], [key]);
  assert.equal(readSheetRow(row, [key])[key], '000123');
  assert.equal(hasAssetData(row), true);
  assert.ok(rowErrors(row, '').title);
  assert.ok(rowErrors({ ...row, title:'Pump', [key]:'x'.repeat(251) }, '')[key]);
});

test('preview and save preserve custom fields on each asset and retries skip saved rows', async () => {
  const id = '3292cc39-60aa-4923-a6b2-d126154ef650';
  const assets = [];
  const session = { user: {id:'owner'} };
  const mocks = {
    '../../../../lib/auth-session': {getServerSession: async () => session},
    '../../../../lib/asset-register-account-access': {getAssetRegisterAccountAccess: async () => ({accountType:'owner'})},
    '../../../../lib/owner-workspace-access': {resolveOwnerWorkspaceContext: async () => ({ok:true,context:{ownerUserId:'owner'}})},
    '../../../../lib/asset-registers': {getAssetRegisterForUser: async () => ({id})},
    '../../../../lib/asset-register-db': {
      listAssetRegisterItemsForRegisters: async () => assets,
      withAssetInputTransaction: fn => fn({query:async () => {}}),
      prepareAssetRegisterRevaluation: async () => {},
      createManualAssetRegisterItem: async (owner, item) => { assert.equal(owner,'owner'); assets.push(item); return item; }
    },
    '../../../../lib/business-credits': {}, '../../../../lib/billing': {}, '../../../../lib/hosting-pricing': {},
    '../../../../lib/db': {withDatabaseClient: (_,fn) => fn()},
    '../../../../lib/asset-lifecycle': {ensureAssetLifecycleSchema:async () => {},recordManualAssetLifecycle:async () => {}}
  };
  const { POST } = load('app/api/asset-register/import/route.ts', mocks);
  const { savedSheetDetails } = load('lib/asset-sheet.ts');
  const customColumns = ['custom:Insurance reference','custom:Cost centre'];
  const rows = [mapAssetRow(['Pump','000012','Dairy'],['title',...customColumns]), {...blankAsset(),title:'Tank'}];
  const send = async (action, token, body = {}) => {
    const response = await POST({json: async () => ({registerId:id, basis:'',customColumns,rows,action,token,...body})});
    return {status:response.status, data:await response.json()};
  };
  const preview = await send('preview');
  assert.ok(preview.data.token);
  assert.equal((await send('save', preview.data.token, {rows:[{...rows[0],'custom:Cost centre':'Workshop'},rows[1]]})).status,409);
  assert.deepEqual((await send('save',preview.data.token,{customColumns:[...customColumns].reverse()})).data,{added:2,skipped:0});
  assert.deepEqual(savedSheetDetails(assets[0].specsJson),[{name:'Cost centre',value:'Dairy'},{name:'Insurance reference',value:'000012'}]);
  assert.deepEqual(savedSheetDetails(assets[1].specsJson).map(d=>d.value),['','']);
  assert.deepEqual((await send('save',preview.data.token)).data,{added:0,skipped:2});
  assert.equal(assets.length,2);

  const truck = {...blankAsset(), make:'Isuzu', model:'FTR 850', category:'Truck', year:'2021', serial:'001204',
    condition:'Requires attention', usage:'186000', unit:'km', value:'115000', replacement:'230000', registration:'CA123', license:'Licensed', insurance:'Insured',
    finance:'Financed', financeNote:'Vehicle finance', insuredValue:'172500', insuranceNote:'Fleet policy', note:'Delivery vehicle'};
  const body = {basis:'included', customColumns:[], rows:[truck]};
  const checked = await send('preview', undefined, body);
  assert.equal(checked.status, 200);
  assert.deepEqual((await send('save', checked.data.token, body)).data, {added:1, skipped:0});
  const saved = assets[2];
  assert.equal(saved.kind, 'vehicle');
  assert.equal(saved.title, 'Isuzu FTR 850');
  assert.equal(saved.condition, 'serious');
  assert.equal(saved.yearModel, 2021);
  assert.equal(saved.serialNumber, '001204');
  assert.equal(saved.usageMetric, 'km');
  assert.equal(saved.hours, 186000);
  assert.equal(saved.value, 100000);
  assert.equal(saved.replacementPriceExVat, 200000);
  assert.equal(saved.insuredValueExVat, 150000);
  assert.equal(saved.isInsured, true);
  assert.equal(saved.isFinanced, true);
  assert.equal(saved.isLicensed, true);
  assert.equal(saved.licenseRegistrationNumber, 'CA123');
  assert.equal(saved.specsJson.insuranceNote, 'Fleet policy');
  assert.equal(saved.financeNote, 'Vehicle finance');
  assert.equal(saved.note, 'Delivery vehicle');
});
