const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
// Exercise the real Asset Register handoff, including the selection boundary.
const client=fs.readFileSync('app/asset-register/asset-register-client.tsx','utf8');
const start=client.indexOf('  const directoryInvitationAssetIds =');
const end=client.indexOf('  const availableAssetQuoteOptions',start);
const source=ts.transpileModule(client.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function handoff({selected=['a'],group=null,register=false,sendLink=false}={}){
 const calls=[],completion={current:null},assets=['a','b','c'].map(id=>({id,title:id}));
 const context={assetShareDestination:sendLink?'link':'inside',isRegisterShareModalOpen:register,assets,isFullRegisterQuoteLead:register,selectedQuoteOption:{leadType:'replacement_quote'},selectedDealerShareAssetIds:selected,activeShareAssets:assets,quoteAsset:assets[0],assetGroupShareTarget:group,directoryReportCompletion:completion,setExternalShareReportScope:scope=>calls.push(['scope',scope]),openAssetGroupReports:group=>calls.push(['group',group.id]),openSharedAssetReportDialog:asset=>calls.push(['asset',asset.id])};
 const open=new Function(...Object.keys(context),source+';return openDirectoryReport;')(...Object.values(context));
 return{open,calls,completion};
}
test('single asset invitation opens the same report modal and cannot export another asset',()=>{
 const x=handoff(),done=[];
 x.open('b',value=>done.push(value));assert.deepEqual(x.calls,[]);assert.deepEqual(done,[null]);
 x.open('a',value=>done.push(value));assert.deepEqual(x.calls,[['scope','asset'],['asset','a']]);
 const source={id:'valuation',label:'Asset valuation'};x.completion.current(source);assert.equal(done.at(-1),source);
});
test('complete umbrellas reuse their report chooser; partial selections cannot export unselected members',()=>{
 const group={id:'fleet',members:[{assetId:'a'},{assetId:'b'}]};
 const full=handoff({selected:['a','b'],group,register:true});full.open(null,()=>{});assert.deepEqual(full.calls,[['scope','group'],['group','fleet']]);
 const partial=handoff({selected:['a'],group,register:true}),results=[];partial.open(null,value=>results.push(value));partial.open('b',value=>results.push(value));assert.deepEqual(partial.calls,[]);assert.deepEqual(results,[null,null]);
 partial.open('a',()=>{});assert.deepEqual(partial.calls,[['scope','asset'],['asset','a']]);
});

test('Send link includes the register selection and preserves its report boundary',()=>{
 const x=handoff({register:true,sendLink:true,selected:[]});
 x.open('c',()=>{});assert.deepEqual(x.calls,[['scope','asset'],['asset','c']]);
 const single=handoff({sendLink:true});const done=[];
 single.open('b',v=>done.push(v));assert.deepEqual(done,[null]);
});
