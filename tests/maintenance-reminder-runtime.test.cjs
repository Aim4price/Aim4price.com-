const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
test('pilot timer polls every minute, prevents overlap and recovers from failures',async()=>{
 const callbacks=[];let calls=0,release,fail=false,unrefs=0;
 const state={},env={NODE_ENV:'production'};let enabled=true;
 const code=ts.transpileModule(fs.readFileSync('lib/maintenance-reminder-runtime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};
 new Function('require','module','exports','process','globalThis','setInterval','console',code)(()=>({maintenanceReminderTestEnabled:()=>enabled,sendMaintenanceReminderBatch:async()=>{calls++;if(fail)throw Error('test');await new Promise(resolve=>release=resolve);return {sent:0,failed:0};}}),m,m.exports,{env},state,(callback,delay)=>{assert.equal(delay,60000);callbacks.push(callback);return {unref:()=>unrefs++};},{info(){},warn(){}});
 env.NODE_ENV='development';await m.exports.startMaintenanceReminderTestSender();assert.equal(callbacks.length,0);
 env.NODE_ENV='production';enabled=false;await m.exports.startMaintenanceReminderTestSender();assert.equal(callbacks.length,0);
 enabled=true;await m.exports.startMaintenanceReminderTestSender();await m.exports.startMaintenanceReminderTestSender();assert.equal(callbacks.length,1);assert.equal(unrefs,1);
 const pending=callbacks[0]();await callbacks[0]();assert.equal(calls,1);release();await pending;
 fail=true;await callbacks[0]();assert.equal(calls,2);await callbacks[0]();assert.equal(calls,3);
});
