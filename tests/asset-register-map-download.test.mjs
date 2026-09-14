import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../app/asset-register/asset-register-client.tsx',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  async function handleDownloadIndividualAssetMap('),source.indexOf('  async function handleDownloadFilteredMaintenanceReport('));
function handler(download) {
 const notices=[],busy=[],ref={current:false};let closed=0;
 const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const run=Function('individualAssetMapDownloadRef','hasAssetGpsCoordinates','setNotice','setIsDownloadingIndividualAssetMap','downloadAssetMapReport','closeAssetReportDialog',`${js};return handleDownloadIndividualAssetMap;`)(ref,a=>a.mapped,n=>notices.push(n),s=>busy.push(s),download,()=>closed++);
 return {run,notices,busy,ref,get closed(){return closed;}};
}
test('the sixth report action uses the same downloader and scopes the PDF to one asset',async()=>{
 const calls=[];const h=handler(async(...args)=>calls.push(args));
 await h.run({id:'asset & one',mapped:true});
 const url=new URL(calls[0][0],'https://aim4price.com');
 assert.equal(url.pathname,'/api/asset-map/report');
 assert.equal(url.searchParams.get('assetId'),'asset & one');
 assert.equal(url.searchParams.get('format'),'pdf');
 assert.equal(url.searchParams.has('registerId'),false);
 assert.equal(calls[0][1],'pdf');assert.equal(h.closed,1);assert.deepEqual(h.busy,[true,false]);
 assert.match(source,/import \{ downloadAssetMapReport \} from '\.\.\/\.\.\/lib\/asset-map-download'/);
 assert.match(source,/onClick=\{\(\) => void handleDownloadIndividualAssetMap\(reportAsset\)\}/);
});
test('unmapped assets do not download or broaden to all assets',async()=>{
 const h=handler(async()=>assert.fail('unexpected download'));
 await h.run({id:'unmapped',mapped:false});
 assert.equal(h.closed,0);assert.match(h.notices[0].message,/map location/);
});
test('failed downloads retain the report dialog and clear the busy state',async()=>{
 const h=handler(async()=>{throw Error('Session expired');});
 await h.run({id:'one',mapped:true});
 assert.equal(h.closed,0);assert.equal(h.notices[0].message,'Session expired');assert.equal(h.ref.current,false);
});
test('repeated clicks cannot start overlapping downloads',async()=>{
 let resolve;let calls=0;const h=handler(()=>{calls++;return new Promise(r=>resolve=r);});
 const first=h.run({id:'one',mapped:true});await h.run({id:'one',mapped:true});
 assert.equal(calls,1);resolve();await first;
});
