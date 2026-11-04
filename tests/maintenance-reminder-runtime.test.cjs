const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
test('server sender supports production, timing, pagination, overlap prevention and recovery',async()=>{
 const callbacks=[],batches=[],queries=[];let release,fail=false,unrefs=0,hour=4;
 const state={},env={NODE_ENV:'development'},rollout={enabled:true,test:false};
 const code=ts.transpileModule(fs.readFileSync('lib/maintenance-reminder-runtime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}},db={query:async(...args)=>{queries.push(args);return {rows:[]};}};
 new Function('require','module','exports','process','globalThis','setInterval','console','Date',code)(n=>n==='./db'?{getDb:()=>db}:{emailRollout:()=>rollout,ensureAssetEmailDelivery:async()=>{},sendAssetEmailBatch:async(cursor,reminders)=>{batches.push({cursor,reminders});if(fail)throw Error('test failure');await new Promise(resolve=>release=resolve);return {sent:0,failed:0,next:reminders?'next-owner':null};}},m,m.exports,{env},state,(callback,delay)=>{assert.equal(delay,60000);callbacks.push(callback);return {unref:()=>unrefs++};},{info(){},error(){}},class{getUTCHours(){return hour;}});
 await m.exports.startMaintenanceReminderTestSender();assert.equal(callbacks.length,0);
 env.NODE_ENV='production';rollout.enabled=false;await m.exports.startMaintenanceReminderTestSender();assert.equal(callbacks.length,0);
 rollout.enabled=true;await m.exports.startMaintenanceReminderTestSender();await m.exports.startMaintenanceReminderTestSender();assert.equal(callbacks.length,1);assert.equal(unrefs,1);
 const tick=async()=>{const p=callbacks[0]();while(!release)await new Promise(r=>setImmediate(r));const r=release;release=null;r();await p;};
 await tick();assert.deepEqual(batches[0],{cursor:'',reminders:false});
 hour=5;await tick();await tick();assert.deepEqual(batches[2],{cursor:'next-owner',reminders:true});
 const pending=callbacks[0]();while(!release)await new Promise(r=>setImmediate(r));await callbacks[0]();assert.equal(batches.length,4);release();release=null;await pending;
 fail=true;await callbacks[0]();assert.ok(queries.some(([sql,args])=>sql.includes('last_error=$1')&&args[0]==='test failure'));
 fail=false;rollout.test=true;hour=0;await tick();assert.equal(batches.at(-1).reminders,true);
 rollout.enabled=false;const count=batches.length;await callbacks[0]();assert.equal(batches.length,count);
});
