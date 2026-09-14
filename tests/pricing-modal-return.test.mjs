import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const client=readFileSync(new URL('../app/asset-register/asset-register-client.tsx',import.meta.url),'utf8');
function extract(name){const a=client.indexOf(`  function ${name}(`);return client.slice(a,client.indexOf('\n  function ',a+1));}
const source=['openPricingTool','returnToPricingMenu','closeSaleabilityDialog','closePricingPreviewDialog','closeProjectionModal'].map(extract).join('\n');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
function harness(){return new Function(`
 const state={menu:true,active:null,tool:null};
 const pricingReturnAssetRef={current:null},projectionRequestRef={current:0};
 let isLoadingPricingPreview=false,isSavingPricingPreview=false;
 const setIsPricingModalOpen=v=>state.menu=v,setActiveAsset=v=>state.active=v;
 const setSaleabilityAsset=v=>state.saleability=v;
 const openRevalueGuidedDialog=v=>{state.tool='recalculate';state.preview=v;};
 const openProjectionModal=v=>{pricingReturnAssetRef.current=null;state.active=null;state.tool='future';state.projection=v;};
 const setPricingPreview=v=>state.preview=v,setProjectionAsset=v=>state.projection=v;
 const setRevalueReplacementPriceError=()=>{},setRevalueAdvancedError=()=>{},setSaveReplacementPriceWithRevalue=()=>{};
 const setProjectionResult=()=>{},setProjectionError=()=>{},setProjectionForm=()=>{},createDefaultProjectionForm=()=>({}),setShouldScrollToProjectionResult=()=>{},setIsLoadingProjection=()=>{};
 ${js}
 return {state,open:openPricingTool,close:{recalculate:closePricingPreviewDialog,future:closeProjectionModal,saleability:closeSaleabilityDialog},returnRef:pricingReturnAssetRef};
 `)();}
for(const tool of ['recalculate','future','saleability'])test(`${tool} closes back to pricing for the same asset`,()=>{
 const h=harness(),asset={id:'asset-a',title:'Tractor'};
 h.open(asset,tool);assert.equal(h.state.menu,false);
 h.close[tool]();assert.equal(h.state.menu,true);assert.equal(h.state.active,asset);assert.equal(h.returnRef.current,null);
 // A second close callback (e.g. an Escape listener) cannot consume another destination.
 h.close[tool]();assert.equal(h.state.active,asset);
});
test('closing a directly opened tool does not invent a pricing parent',()=>{
 for(const tool of ['recalculate','future','saleability']){const h=harness();h.state.menu=false;h.close[tool]();assert.equal(h.state.menu,false);assert.equal(h.state.active,null);}
});
