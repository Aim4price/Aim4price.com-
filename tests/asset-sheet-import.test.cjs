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
});
