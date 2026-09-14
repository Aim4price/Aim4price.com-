import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('app/asset-register/asset-register-client.tsx');
function load(code, names, bindings = {}) {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  return Function(...Object.keys(bindings), `${js}; return { ${names} };`)(...Object.values(bindings));
}
const { acknowledgeAssetNotice, noticeStack } = load(source.slice(source.indexOf('function noticeStack'), source.indexOf('function openPartnerNoteAlertCount')), 'acknowledgeAssetNotice, noticeStack');
const notes = [{id:'new', note:'New note'}, {id:'old', note:'Earlier note'}];
for (const [kind, field, latest] of [['partner','openPartnerNotes','openPartnerNote'], ['maintenance','maintenanceStatuses','latestMaintenanceStatus'], ['issue','issueNoteStatuses','latestIssueNoteStatus'], ['reminder','maintenanceAlerts','maintenanceAlert']]) {
  test(`${kind}: noting either entry removes only that ID and preserves unrelated notices`, () => {
    const asset = {id:'asset', [field]:notes, [latest]:notes[0], licenseRenewalAlert:{id:'licence'}, specsJson:{valuationNeedsUpdate:true}};
    for (const id of ['new','old']) {
      const updated = acknowledgeAssetNotice(asset,kind,id);
      assert.deepEqual(updated[field].map(n=>n.id), notes.filter(n=>n.id!==id).map(n=>n.id));
      assert.equal(updated[latest].id, updated[field][0].id);
      assert.deepEqual(updated.licenseRenewalAlert,asset.licenseRenewalAlert);
      assert.equal(updated.specsJson.valuationNeedsUpdate,true);
    }
    const first = acknowledgeAssetNotice(asset,kind,'new');
    assert.deepEqual(acknowledgeAssetNotice(first,kind,'new'),first);
    assert.deepEqual(acknowledgeAssetNotice(first,kind,'old')[field],[]);
    assert.equal(asset[field].length,2);
  });
}
test('an explicitly empty stack never revives a stale latest pointer', () => {
  assert.deepEqual(noticeStack([],notes[0]),[]);
  assert.deepEqual(noticeStack(undefined,notes[0]),[notes[0]]);
});
test('estimate responses preserve omitted notices, respect explicit clears and cannot revive a noted snapshot', () => {
  const ref={current:new Map()};
  const {preserveLicenseRenewalAlert:merge}=load(source.slice(source.indexOf('  function preserveLicenseRenewalAlert'),source.indexOf('  function syncUpdatedAsset')), 'preserveLicenseRenewalAlert', {locallyNotedAssetNoticesRef:ref, acknowledgeAssetNotice});
  const previous={id:'asset',value:100,maintenanceStatuses:notes,latestMaintenanceStatus:notes[0],issueNoteStatuses:notes,latestIssueNoteStatus:notes[0]};
  assert.deepEqual(merge(previous,{id:'asset',value:200}).maintenanceStatuses,notes);
  assert.deepEqual(merge(previous,{id:'asset',maintenanceStatuses:[],latestMaintenanceStatus:null}).maintenanceStatuses,[]);
  ref.current.set('asset',[{kind:'maintenance',id:'new'}]);
  const updated=merge(previous,{...previous,value:200});
  assert.deepEqual(updated.maintenanceStatuses.map(n=>n.id),['old']);
  assert.deepEqual(updated.issueNoteStatuses,notes);
});
test('maintenance load retains older outstanding notes even after the newest is noted', async () => {
  const scan=read('lib/scan-assets.ts');
  const a=scan.indexOf('export async function attachLatestMaintenanceStatusToAssets');
  const b=scan.indexOf('function assetMaintenanceStatusSelectSql',a);
  const {attachLatestMaintenanceStatusToAssets:attach}=load(scan.slice(a,b).replace('export ',''),'attachLatestMaintenanceStatusToAssets',{
    ensureFuelLedgerTables:async()=>{},getDb:()=>({query:async()=>({rows:[{id:'seen',assetRegisterItemId:'a',notedAtIso:'2026-09-14'}, {id:'one',assetRegisterItemId:'a'}, {id:'two',assetRegisterItemId:'a'}]})}),mapMaintenanceStatusFromScanEvent:r=>r,
  });
  const result=await attach([{id:'a'},{id:'b'}]);
  assert.deepEqual(result[0].maintenanceStatuses.map(n=>n.id),['one','two']);
  assert.equal(result[0].latestMaintenanceStatus.id,'one');
  assert.deepEqual(result[1].maintenanceStatuses,[]);
});
test('recalculation and normal loads share full alert enrichment', () => {
  assert.match(read('app/api/asset-register/revalue/route.ts'),/await attachOpenAssetAlerts\(session.user.id, \[result.item\]\)/);
  const enrichment=read('lib/asset-register-alerts.ts');
  for(const name of ['attachOpenPartnerNotesToAssets','attachUpcomingMaintenanceAlertsToAssets','attachUpcomingLicenseRenewalAlertsToAssets','attachLatestMaintenanceStatusToAssets','attachOpenIssueNoteStatusToAssets']) assert.ok(enrichment.includes(name));
});

test('actual note banners render every outstanding item with a separate Noted action', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const a=source.indexOf('                          {outstandingPartnerNotes(asset).map(');
  const b=source.indexOf('\n                        </div>',a);
  const jsx=source.slice(a,b);
  const note={id:'one',note:'Check bearing',noteText:'Please review',summary:'Service completed',heading:'Service due',body:'Due at 500 hours'};
  const pairs=[note,{...note,id:'two'}];
  const asset={id:'asset',openPartnerNotes:pairs,maintenanceStatuses:pairs,issueNoteStatuses:pairs,maintenanceAlerts:pairs};
  const {outstandingPartnerNotes}=load(source.slice(source.indexOf('function noticeStack'),source.indexOf('function openPartnerNoteAlertCount')),'outstandingPartnerNotes');
  const bindings={React,asset,noticeStack,outstandingPartnerNotes,styles:new Proxy({}, {get:(_,key)=>key}),quoteToneClassForPartnerType:()=>'',busyMaintenanceAlertId:null,busyIssueNoteStatusId:null,busyMaintenanceStatusId:null,canUseOwnerOnlyAssetActions:true,licenseRenewalAlert:null,uniquePhotoUrls:urls=>urls,formatDate:d=>d,formatByteSize:n=>String(n),handleMarkPartnerNoteNoted:()=>{},handleMarkMaintenanceAlertNoted:()=>{},handleMarkIssueNoteStatusNoted:()=>{},handleMarkMaintenanceStatusNoted:()=>{}};
  const code=ts.transpileModule(`function Banners(){ return <div>${jsx}</div>; }`,{fileName:'banners.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText;
  const Banners=Function(...Object.keys(bindings),`${code}; return Banners;`)(...Object.values(bindings));
  const html=renderToStaticMarkup(React.createElement(Banners));
  assert.equal((html.match(/<button/g)??[]).length,8);
  assert.equal((html.match(/>Noted<\/button>/g)??[]).length,8);
  assert.equal((html.match(/partnerNoteBanner/g)??[]).length,8);
});
