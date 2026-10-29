const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),load=require('./helpers/load-ts.cjs');
const source=fs.readFileSync('app/api/asset-register/export/route.ts','utf8')+'\nexports.fixture={buildAssetRow,buildSourceAssetRow,buildPdfAssetLines,buildRegisterBasicExportSummary,buildWorkbookSheet,TABLE_HEADERS};';
const exportsFixture={};
new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name.endsWith('asset-groups-shared')?load('lib/asset-groups-shared.ts'):new Proxy({},{get:()=>()=>undefined}),exportsFixture);
const f=exportsFixture.fixture;
const asset={id:'a',title:'Test tractor',kind:'equipment',value:100000,yearModel:2020,condition:'good',hours:200,specsJson:{},photos:[],documents:[],selectedMethod:'aim4price'};
test('PDF/HTML asset lines always show realistic selling price, with N/A for missing and review labels for stale',()=>{
 assert.match(f.buildPdfAssetLines(asset,0).map(line=>line.text).join('\n'),/Realistic selling price: N\/A/);
 const saved={priceExVat:80000,assessedAt:'2026-10-29T10:00:00Z',needsReview:false};
 assert.match(f.buildPdfAssetLines({...asset,realisticSellingAssessment:saved},0).map(line=>line.text).join('\n'),/Realistic selling price: R 80\s000/);
 assert.match(f.buildPdfAssetLines({...asset,realisticSellingAssessment:{...saved,needsReview:true}},0).map(line=>line.text).join('\n'),/R 80\s000 excl. VAT \| Update needed/);
});
test('Excel exports retain column alignment and missing estimates are not zero',()=>{
 for(const item of [asset,{...asset,realisticSellingAssessment:{priceExVat:80000,assessedAt:'2026-10-29',needsReview:false}}]){
  const cells=f.buildAssetRow(item,0);
  assert.equal(cells.length,f.TABLE_HEADERS.length);
  assert.equal(cells[f.TABLE_HEADERS.indexOf('Realistic selling price ex VAT')].value,item.realisticSellingAssessment?80000:'N/A');
  assert.equal(f.buildSourceAssetRow({item,register:{businessName:'Farm'}},0).length,f.TABLE_HEADERS.length+1);
 }
 const summary=f.buildRegisterBasicExportSummary([asset,{...asset,id:'b',realisticSellingAssessment:{priceExVat:80000,needsReview:false}}]);
 assert.deepEqual(summary.realistic,{value:80000,count:1,eligible:2});
 const sheet=f.buildWorkbookSheet({name:'Test',description:'Test',items:[asset],tabColor:'10382F'},null,new Date());
 const headerIndex=sheet.rows.findIndex(row=>row[0]?.value==='Asset title');
 const formula=sheet.rows.flat().find(cell=>cell.formula?.startsWith('COUNTA('));
 assert.equal(formula.formula,`COUNTA(A${headerIndex+2}:A${headerIndex+2})`);
});
test('printed asset cards put ideal value above the saved realistic selling price',()=>{
 const reportSource=fs.readFileSync('lib/report-print.ts','utf8')+'\nexports.fixtureRows=renderFullRegisterAssetRows;';
 const report={};
 new Function('require','exports',ts.transpileModule(reportSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>new Proxy({},{get:()=>()=>''}),report);
 const html=report.fixtureRows([{asset:'2017 JCB 3DX',value:'R 307 450',realisticSellingPrice:'R 252 000',method:'Aim4price'}]);
 assert.match(html,/Ideal value<\/span>\s*<strong>R 307 450<\/strong>\s*<b[^>]*>Realistic selling price: R 252 000<\/b>/);
 const missing=report.fixtureRows([{asset:'Unassessed',value:'R 307 450',method:'Aim4price'}]);
 assert.match(missing,/Realistic selling price: N\/A/);
 assert.match(missing,/<strong>R 307 450<\/strong>/);
});
