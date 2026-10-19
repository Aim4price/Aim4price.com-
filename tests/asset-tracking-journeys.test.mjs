import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=(file,mocks={})=>{const exports={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n],exports);return exports;};
const math=load('lib/asset-tracking-math.ts');
const {trackingJourneys}=load('lib/asset-tracking-journeys.ts',{'./asset-tracking-math':math});
const base=Date.parse('2026-10-19T08:00:00Z');
const point=(minute,longitude,extra={})=>({capturedAt:new Date(base+minute*60000).toISOString(),latitude:0,longitude,accuracy:5,sessionId:'same-activation',deviceId:'phone',sampleId:'sample-'+minute,...extra});
test('one activation becomes two journeys and a stationary record after a confirmed 15 minute stop',()=>{
 const points=[point(0,0),point(1,.001),...Array.from({length:20},(_,i)=>point(i+2,.001)),point(22,.002),point(23,.003)];
 const entries=trackingJourneys(points);
 assert.deepEqual(entries.map(e=>e.kind),['journey','stationary','journey']);
 assert.equal(new Set(entries.map(e=>e.id)).size,3);
 for(const p of points)assert.equal(entries.filter(e=>p.capturedAt>=e.startAt&&p.capturedAt<=e.endAt).length,1,'every raw reading has exactly one owning entry');
 assert.equal(entries[0].startAt,point(22,0).capturedAt);
 assert.equal(entries[2].endAt,point(1,0).capturedAt);
});
test('a short stop stays within a journey, while missing signal splits records without inventing a parked period',()=>{
 const short=trackingJourneys([point(0,0),point(1,.001),point(2,.001),point(3,.002)]);
 assert.equal(short.length,1);assert.equal(short[0].kind,'journey');
 const gap=trackingJourneys([point(0,0),point(1,.001),point(30,.001),point(31,.002)]);
 assert.equal(gap.length,2);assert(gap.every(e=>e.kind==='journey'));
 assert.equal(gap[0].gapBeforeSeconds,29*60);
});
test('late uploads sort by capture time and two phones or activations never merge',()=>{
 const entries=trackingJourneys([point(2,.002),point(1,.001),point(0,0),point(1,.001,{deviceId:'another'}),point(3,.003,{sessionId:'new'})]);
 assert.equal(entries.length,3);
 assert.equal(entries.find(e=>e.deviceId==='phone'&&e.sessionId==='same-activation').readings,3);
});
test('poor GPS is retained for audit but cannot join a route',()=>{
 const entries=trackingJourneys([point(0,0),point(1,1,{accuracy:100}),point(2,.002),point(3,.003)]);
 assert.equal(entries.length,2);assert.equal(entries[0].gapBeforeSeconds,120);
 assert.equal(entries.reduce((sum,e)=>sum+e.readings,0),3);
});
