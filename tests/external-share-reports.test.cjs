const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PDFDocument}=require('pdf-lib');
const exportsObject={};
new Function('require','exports',ts.transpileModule(fs.readFileSync('lib/external-share-reports.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,exportsObject);
const {shareReportUrl,prepareShareReports}=exportsObject;
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
test('each selected report uses its own timeline and exact asset scope',async()=>{
 const previous=global.fetch,calls=[];
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
 try{
  global.fetch=async(url)=>{calls.push(new URL(url,'https://local.test'));return new Response(bytes,{headers:{'content-type':'application/pdf'}});};
  const files=await prepareShareReports([A,B],[{kind:'maintenance',year:'2025',month:'3',maintenanceType:'serviced'},{kind:'ownership',year:'all',month:'all',maintenanceType:'all'}]);
  assert.equal(files.length,2);assert.equal(calls.length,4);
  assert.deepEqual(calls.map(u=>u.searchParams.get('assetId')),[A,B,A,B]);
  for(const u of calls.slice(0,2)){assert.equal(u.searchParams.get('year'),'2025');assert.equal(u.searchParams.get('month'),'3');assert.equal(u.searchParams.get('maintenanceType'),'serviced');}
  assert.equal(calls[2].pathname,'/api/my-invoices/report');assert.equal(calls[2].searchParams.has('year'),false);
  for(const file of files)assert.equal((await PDFDocument.load(await file.arrayBuffer())).getPageCount(),2);
  assert.match(files[0].name,/2025-03/);
  global.fetch=async()=>new Response('Sign in',{status:401});
  await assert.rejects(prepareShareReports([A],[{kind:'fuel',year:'all',month:'all',maintenanceType:'all'}]),/Unable to prepare/);
 }finally{global.fetch=previous;}
});
test('invalid report types and periods do not silently expand report scope',()=>{
 const choice={kind:'fuel',year:'2025',month:'3',maintenanceType:'all'};
 assert.throws(()=>shareReportUrl(A,{...choice,kind:'all-private-data'}));
 assert.throws(()=>shareReportUrl(A,{...choice,year:'garbage'}));
 assert.throws(()=>shareReportUrl(A,{...choice,month:'13'}));
 assert.throws(()=>shareReportUrl('all',choice));
});
