const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const moduleValue={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/asset-history-presentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleValue,moduleValue.exports);
const {display,visibleHistoryKeys,matchesHistorySearch}=moduleValue.exports;
test('maintenance snapshots show work and parts without internal JSON',()=>{
 const value=[{version:1,profileKey:'earthmoving',family:{label:'TLBs / Backhoe Loaders',familyId:151},mode:'repaired',items:[{id:'part-1',label:'Radiator',action:'repaired',parts:[{name:'Radiator',brand:'Example',partNumber:'RAD-42'}]}]}];
 const result=display(value,'maintenance_work');
 for(const text of ['Repaired','TLBs / Backhoe Loaders','Radiator','RAD-42'])assert.ok(result.includes(text));
 assert.ok(!result.includes('profileKey'));assert.ok(!result.includes('familyId'));assert.ok(!result.includes('[{'));
 assert.equal(display(JSON.stringify(value),'maintenance_work'),result);
});
test('dates are readable in SAST and blank rows do not hide removals or false values',()=>{
 assert.match(display('2026-10-14T15:04:25.981+00:00','completed_at'),/17:04.*SAST/);
 assert.equal(display('done','status'),'Done');assert.equal(display(false),'No');
 assert.deepEqual(visibleHistoryKeys({note:'Old note'},{note:null,empty:null,blank:'',enabled:false,amount:0}),['note','enabled','amount']);
});
test('history search finds human-readable maintenance and part details',()=>{
 const item={action:'Maintenance added',actorName:'Gerald',source:'owner',category:'maintenance',createdAt:'2026-10-14T15:04:25Z',before:{},after:{maintenance_work:[{mode:'repaired',items:[{label:'Radiator',parts:[{partNumber:'RAD-42'}]}]}]}};
 assert.equal(matchesHistorySearch(item,'rad-42'),true);assert.equal(matchesHistorySearch(item,'repaired'),true);assert.equal(matchesHistorySearch(item,'unknown part'),false);
});
