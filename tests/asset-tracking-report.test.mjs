import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',source)(name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):native(name),m,m.exports);return m.exports;}
const {summarizeTracking}=load('lib/asset-tracking-math.ts');
const {buildMovementHtml,buildMovementWorkbook}=load('lib/asset-movement-report.ts');
const p=(m,l=0,s='a')=>({capturedAt:new Date(Date.UTC(2026,9,18,8,m)).toISOString(),latitude:0,longitude:l,accuracy:5,sessionId:s});
const options={title:'Tractor <script>alert(1)</script>',serial:'ABC',assetId:'asset',from:'2026-10-18',to:'2026-10-18',generatedAt:new Date('2026-10-18T10:00:00Z')};
test('stops span observed stationary readings and never cross gaps or sessions',()=>{const r=summarizeTracking([p(0),p(10),p(20),p(21,.001),p(40,.001),p(50,.001,'b'),p(60,.001,'b')]);assert.equal(r.stops.length,1);assert.equal(r.stops[0].seconds,1200);assert.equal(r.readings.length,7);assert.equal(r.readings[1].speedKmh,0);assert.equal(r.readings[4].speedKmh,null);assert.ok(r.readings[3].speedKmh>0);});
test('PDF keeps route gaps, all accepted dots, endpoints and observed stop markers',()=>{const r=summarizeTracking([p(0),p(1,.001),p(11,.001),p(21,.001),p(40,.002),p(41,.003)]);const html=buildMovementHtml(r,options);assert.equal((html.match(/data-route-segment/g)||[]).length,2);assert.equal((html.match(/data-reading /g)||[]).length,6);assert.equal((html.match(/data-stop>/g)||[]).length,1);assert.ok(html.includes('>Start</text>'));assert.ok(html.includes('>End</text>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));assert.ok(html.includes('map-warning'));assert.ok(html.includes('10:00'));assert.ok(buildMovementWorkbook(r,options).length>1000);});
test('empty and single reading reports render without invented routes or speed',()=>{const empty=summarizeTracking([]);assert.ok(buildMovementHtml(empty,options).includes('No tracking readings'));const single=summarizeTracking([p(0)]);assert.equal(single.readings[0].speedKmh,null);assert.equal(single.stops.length,0);assert.ok(!buildMovementHtml(single,options).includes('data-route-segment'));});
test('tracking exports carry photo references, quality evidence, asset identity and audit IDs',()=>{
 const input=[{...p(0),sampleId:'read-1',deviceId:'phone-1'},{...p(1,.001),sampleId:'read-2',deviceId:'phone-1'},{...p(2,.002),accuracy:100,sampleId:'bad-3',deviceId:'phone-1'},{...p(10,.003),sampleId:'read-4',deviceId:'phone-1'}];
 const r=summarizeTracking(input),o={...options,registration:'CA 123',year:2020,brand:'Toyota & Co',model:'GD-6',category:'Vehicle',assetCode:'REF-42',photos:['https://www.aim4price.com/photo.jpg','javascript:alert(1)'],deviceId:'phone-1',sessionId:'a'};
 const html=buildMovementHtml(r,o),xlsx=buildMovementWorkbook(r,o).toString();
 for(const value of ['@font-face','/field-manager/montserrat-latin.woff','Toyota &amp; Co','GD-6','Vehicle','REF-42','Asset photo reference','CA 123','2020','Coverage gaps','Excluded readings','read-1','phone-1','Recording reference','photo.jpg'])assert.ok(html.includes(value),value);
 assert.ok(!html.includes('javascript:'));assert.equal((html.match(/class="assetPhoto"/g)||[]).length,1);
 for(const value of ['Asset photos','photo.jpg','bad-3','Excluded','Reading status','read-1','CA 123'])assert.ok(xlsx.includes(value),value);
});
