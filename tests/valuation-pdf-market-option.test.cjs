const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('app/api/valuation/report/route.ts','utf8');
const compiled=ts.transpileModule(source+'\nexport { renderValuationReportHtml, normalizePayload };',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};new Function('require','module','exports',compiled)(()=>({REPORT_THEME_CSS:''}),mod,mod.exports);
const base={heroTitle:'Test tractor',fileName:'estimate.pdf',logoUrl:'',generatedLabel:'25 October 2026',assetBadge:'Tractor',heroMeta:'2021',selectedValue:'R 180 000',assetDetailRows:[{label:'Replacement Value',value:'R 350 000'}],clientRows:[],recordRows:[],saleabilityRows:[{label:'Realistic Market Value',value:'R 150 000'}]};
test('opting out removes the entire market section and explanation but keeps base values',()=>{
 const html=mod.exports.renderValuationReportHtml({...base,includeMarketValue:false});
 assert.doesNotMatch(html,/<h2>Realistic Market Value<\/h2>|Neither value guarantees a sale|Market value not calculated/);
 assert.match(html,/R 180 000/);assert.match(html,/R 350 000/);
});
test('opting in includes the assessed amount and selling circumstances explanation',()=>{
 const html=mod.exports.renderValuationReportHtml({...base,includeMarketValue:true});
 assert.match(html,/<h2>Realistic Market Value<\/h2>/);assert.match(html,/R 150 000/);assert.match(html,/Neither value guarantees a sale/);
});
test('normalization preserves explicit omission and older report requests remain compatible',()=>{
 const request={selectedValueExVat:180000,saleabilityRows:base.saleabilityRows};
 assert.equal(mod.exports.normalizePayload({...request,includeMarketValue:false},'').includeMarketValue,false);
 assert.equal(mod.exports.normalizePayload({...request,includeMarketValue:true},'').includeMarketValue,true);
 assert.equal(mod.exports.normalizePayload(request,'').includeMarketValue,true);
});
const client=fs.readFileSync('app/valuation/valuation-client.tsx','utf8');
const download=client.slice(client.indexOf('  async function downloadValuationPdf('),client.indexOf('  function buildDefaultMarketplaceDraft()'));
test('download refuses an outdated market assessment before preparing a PDF',async()=>{
 const resultState={};let message='';
 const js=ts.transpileModule(download,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const run=new Function('resultState','completedMarketAssessment','headlineValue','setPdfError',js+';return downloadValuationPdf;')(resultState,{result:{},value:180000},180000,value=>message=value);
 await run(true);assert.match(message,/Update the market value/);
});
