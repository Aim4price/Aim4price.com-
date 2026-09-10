const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={}){
  const filename=path.resolve(file), exports={};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const req=name=>{
    if(Object.hasOwn(mocks,name))return mocks[name];
    if(name.startsWith('.'))return load(path.resolve(path.dirname(filename),name+'.ts'),mocks);
    return require(name);
  };
  new Function('require','exports','module',code)(req,exports,{exports});return exports;
}
const policy=load('lib/push-policy.ts');
test('push subscriptions reject arbitrary HTTP targets and malformed keys',()=>{
  const sub=endpoint=>({endpoint,keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}});
  for(const url of ['http://fcm.googleapis.com/a','https://localhost/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://evil.test/push.apple.com','https://fcm.googleapis.com:444/a','https://user:pass@fcm.googleapis.com/a'])assert.throws(()=>policy.validatePushSubscription(sub(url)),url);
  for(const url of ['https://fcm.googleapis.com/fcm/send/a','https://updates.push.services.mozilla.com/wpush/v2/a','https://web.push.apple.com/a'])assert.equal(policy.validatePushSubscription(sub(url)).endpoint,url);
  assert.throws(()=>policy.validatePushSubscription({endpoint:'https://fcm.googleapis.com/a',keys:{auth:'x',p256dh:'x'}}));
});
test('notification links stay in the selected app even with traversal',()=>{
  for(const href of ['/dealer/leads','https://evil.test','//evil.test','/owner-app/../dealer','/owner-app/../../middleman'])assert.equal(policy.safePushHref('owner',href),'/owner-app/notifications');
  assert.equal(policy.safePushHref('owner','/owner-app/maintenance?asset=1'),'/owner-app/maintenance?asset=1');
});
test('preferences accept only complete boolean settings and keep defaults unchanged',()=>{
  assert.throws(()=>policy.parsePushPreferences({...policy.DEFAULT_PUSH_PREFERENCES,enquiries:'false'}));
  assert.throws(()=>policy.parsePushPreferences({...policy.DEFAULT_PUSH_PREFERENCES,admin:true}));
  const p=policy.parsePushPreferences({...policy.DEFAULT_PUSH_PREFERENCES,enquiries:false});
  assert.equal(p.enquiries,false);assert.equal(policy.DEFAULT_PUSH_PREFERENCES.enquiries,true);
});
function accessFixture(overrides={}){
  const member={id:'member',is_active:true,parent_owner_user_id:'account',dealer_user_id:'account',session_version:1,access_role:'operations',staff_role:'technician',...overrides.member};
  const profile={accountType:'owner',accountStatus:'active',accountSubtype:'',...overrides.profile};
  return load('lib/push-access.ts',{
    './app-realm-server':{currentAppRealm:async()=>overrides.realm||'owner'},
    './owner-app-session':{getOwnerAppSession:async()=>null},'./dealer-app-session':{getDealerAppSession:async()=>null},
    './account-profile':{getAccountProfile:async()=>profile},
    './owner-app':{getOwnerAppUserById:async()=>member,normalizeOwnerAppAccessRole:x=>x,getOwnerAppAssetAccessSettings:async()=>({assetScope:'selected'}),resolveOwnerAppAccessibleAssetIds:async()=>['allowed']},
    './dealer-app':{getDealerStaffById:async()=>member,normalizeDealerStaffRole:x=>x},
    './middleman-account':{isMiddlemanAccountSubtype:x=>x==='middleman'},
  });
}
const who={app:'owner',accountId:'account',memberId:'member',version:1};
test('selected owner access receives asset reminders without account financial decisions',async()=>{
  const access=await accessFixture().resolvePushAccess(who);
  assert.deepEqual(access.categories,['maintenance','licensing']);assert.deepEqual([...access.allowedAssets],['allowed']);
});
test('revoked, moved and session-invalidated users fail closed',async()=>{
  for(const overrides of [{member:{is_active:false}},{member:{parent_owner_user_id:'other'}},{member:{session_version:2}},{profile:{accountStatus:'suspended'}}])assert.equal(await accessFixture(overrides).resolvePushAccess(who),null);
});
test('dealer subscriptions cannot be used for a middleman account',async()=>{
  const fixture=accessFixture({profile:{accountType:'dealer',accountSubtype:'middleman'}});
  assert.equal(await fixture.resolvePushAccess({...who,app:'dealer'}),null);
});
test('technicians only get maintenance and assigned work categories',async()=>{
  const access=await accessFixture({profile:{accountType:'dealer'}}).resolvePushAccess({...who,app:'dealer'});
  assert.deepEqual(access.categories,['maintenance','assignments']);
});
function workerFixture(state){
  const handlers={},shown=[],opened=[];
  const self={location:{origin:'https://www.aim4price.com'},registration:{showNotification:async(...args)=>shown.push(args)},clients:{openWindow:async url=>opened.push(url)},addEventListener:(name,fn)=>handlers[name]=fn};
  vm.runInNewContext(fs.readFileSync('public/app-push-worker.js','utf8'),{self,URL,PUSH_APP:'owner',fetch:async()=>({ok:true,json:async()=>state})});
  async function push(payload){let promise;handlers.push({data:{json:()=>payload},waitUntil:p=>promise=p});await promise;}
  return {push,shown,opened,handlers};
}
test('worker suppresses old-account and disabled-category deliveries',async()=>{
  const state={app:'owner',enabled:true,deviceId:'current',categories:['maintenance'],preferences:{maintenance:false}};
  const worker=workerFixture(state);
  await worker.push({deviceId:'old',title:'Private old title'});
  await worker.push({deviceId:'current',category:'maintenance',title:'Muted'});
  assert.equal(worker.shown.length,0);
  state.preferences.maintenance=true;
  await worker.push({deviceId:'current',category:'maintenance',title:'Maintenance upcoming',body:'Service due.',href:'/dealer/leads'});
  assert.equal(worker.shown.length,1);assert.equal(worker.shown[0][0],'Maintenance upcoming');
  assert.equal(worker.shown[0][1].data.href,'https://www.aim4price.com/owner-app/notifications');
});
test('worker never displays private text when the app is logged out',async()=>{
  const worker=workerFixture({app:'owner',enabled:false,deviceId:null});
  await worker.push({deviceId:'old',title:'Private title'});assert.equal(worker.shown.length,0);
});
function dispatchFixture({revoked=false,fail=false,enabled=true}={}){
  const deliveries=new Set(),pushes=[];let exists=true;
  const device={id:'device',app:'owner',account_id:'account',member_id:'member',version:1,subscription:{},created_at:new Date('2026-01-01')};
  const query=async(sql,args=[])=>{
    if(sql.includes('pg_try_advisory_lock'))return {rows:[{acquired:true}]};
    if(sql.startsWith('select * from app_push_devices'))return {rows:exists?[device]:[]};
    if(sql.startsWith('delete from app_push_devices where id=')){exists=false;return {rows:[]};}
    if(sql.startsWith('select event_id'))return {rows:[...deliveries].map(event_id=>({event_id}))};
    if(sql.startsWith('select id from app_push_devices'))return {rowCount:exists?1:0,rows:[]};
    if(sql.startsWith('insert into app_push_deliveries'))deliveries.add(args[1]);
    return {rows:[]};
  };
  const client={query,release(){}};
  const fixture=load('lib/push-dispatch.ts',{
    './db':{getDb:()=>({connect:async()=>client})},
    './push-store':{ensurePushTables:async()=>{},pushPreferences:async()=>({maintenance:enabled}),sendPhonePush:async(_,payload)=>{if(fail)throw {statusCode:503};pushes.push(payload);}},
    './push-access':{resolvePushAccess:async()=>revoked?null:{categories:['maintenance']}},
    './push-events':{listPushEvents:async()=>[{id:'due',category:'maintenance',title:'Maintenance upcoming',body:'Service due.',href:'/owner-app/maintenance',createdAtIso:'2025-01-01',reminder:true},{id:'old',category:'maintenance',title:'Old transaction',body:'',href:'',createdAtIso:'2025-01-01'}]},
  });
  return {...fixture,pushes,deliveries};
}
test('background sender deduplicates reminders and avoids replaying old transactions',async()=>{
  const f=dispatchFixture();await f.dispatchPhoneNotifications();await f.dispatchPhoneNotifications();
  assert.equal(f.pushes.length,1);assert.equal(f.pushes[0].title,'Maintenance upcoming');
});
test('background sender honours disabled preferences and revoked access',async()=>{
  for(const options of [{enabled:false},{revoked:true}]){const f=dispatchFixture(options);await f.dispatchPhoneNotifications();assert.equal(f.pushes.length,0);}
});
test('failed provider delivery is not marked sent',async()=>{
  const f=dispatchFixture({fail:true});await f.dispatchPhoneNotifications();assert.equal(f.deliveries.size,0);
});
test('middleware forwards only the selected app delivery cookie',()=>{
  const {isolateAppCookies}=load('lib/app-cookie-isolation.ts');
  const result=isolateAppCookies('aim4price_push_owner=owner; aim4price_push_dealer=dealer; aim4price_push_middleman=middleman; better-auth.session_token=website','owner');
  assert.equal(result,'aim4price_push_owner=owner');
});
test('delivery capability supports session expiry but blocks a different signed-in member',async()=>{
  async function check(signedIn,access){
    const route=load('app/api/app-notifications/delivery/route.ts',{
      'next/headers':{cookies:()=>({get:()=>({value:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'})})},
      '../../../../lib/app-realm-server':{currentAppRealm:async()=>'owner'},
      '../../../../lib/push-access':{currentPushIdentity:async()=>signedIn,resolvePushAccess:async()=>access},
      '../../../../lib/push-store':{ensurePushTables:async()=>{},accountPushPreferences:async()=>({enabled:true}),pushPreferences:async()=>({maintenance:true})},
      '../../../../lib/db':{getDb:()=>({query:async()=>({rows:[{account_id:'account',member_id:'member',version:1}]})})},
    });return (await route.GET()).json();
  }
  const access={categories:['maintenance']};
  const expired=await check(null,access);assert.equal(expired.enabled,true);assert.equal(expired.accountId,undefined);
  assert.equal((await check({...who,memberId:'other'},access)).enabled,false);
  assert.equal((await check(null,null)).enabled,false);
});
test('cross-origin settings writes are rejected before identity lookup',async()=>{
  const route=load('app/api/app-notifications/route.ts',{
    'next/headers':{cookies:()=>({})},
    '../../../lib/push-access':{currentPushIdentity:()=>{throw Error('Must not read identity');}},
    '../../../lib/push-store':{},'../../../lib/db':{},
  });
  const response=await route.POST(new Request('https://www.aim4price.com/api/app-notifications',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}));
  assert.equal(response.status,403);
});
test('owner reminders link to the exact maintenance record and exclude inaccessible or completed assets',async()=>{
  const record={id:'record',assetId:'asset',assetTitle:'Tractor',status:'upcoming',computedStatus:'due',dueDate:'2026-09-10',updatedAtIso:'2026-09-10'};
  const events=load('lib/push-events.ts',{
    './notifications':{},'./notification-inbox':{},'./push-access':{},'./dealer-maintenance-notification-inbox':{},
    './listing-alerts':{listMatchingListingEvents:async()=>[]},'./app-notification-state':{readAppNotificationKeys:async()=>new Set()},
    './asset-maintenance':{listAssetMaintenanceRecords:async()=>[record,{...record,id:'done',status:'done'},{...record,id:'private',assetId:'private'}],buildAlertBody:()=> 'Service due.'},
    './asset-license-renewal':{buildAssetLicenseRenewalAlert:()=>null},
    './db':{getDb:()=>({query:async()=>({rows:[{id:'asset'},{id:'private'}]})})},
  });
  const result=await events.listPushEvents(who,{categories:['maintenance'],allowedAssets:new Set(['asset']),admin:false});
  assert.equal(result.length,1);
  assert.equal(result[0].href,'/owner-app/assets/asset/maintenance?maintenanceId=record');
});

test('desktop account limits combine with personal choices without overwriting either',()=>{
  const member={...policy.DEFAULT_PUSH_PREFERENCES,licensing:false};
  const account={enabled:true,preferences:{...policy.DEFAULT_PUSH_PREFERENCES,maintenance:false}};
  const combined=policy.combinePushPreferences(member,account);
  assert.equal(combined.maintenance,false);assert.equal(combined.licensing,false);assert.equal(combined.enquiries,true);
  assert.ok(Object.values(policy.combinePushPreferences(member,{...account,enabled:false})).every(v=>v===false));
  assert.equal(member.maintenance,true);assert.equal(account.preferences.licensing,true);
});
function desktopAccessFixture({realm=null,session={user:{id:'desktop-account'}},profile={accountStatus:'active',accountType:'owner'}}={}) {
  return load('lib/desktop-notification-access.ts',{
    './app-realm-server':{currentAppRealm:async()=>realm},
    './auth-session':{getServerSession:async()=>session,isDealerAppSession:s=>s.app==='dealer',isOwnerAppSession:s=>s.app==='owner'},
    './account-profile':{getAccountProfile:async()=>profile},
    './middleman-account':{isMiddlemanAccountSubtype:x=>x==='middleman'},
  });
}
test('desktop policy requires website credentials and an active supported account',async()=>{
  for(const realm of ['owner','dealer','middleman','field']) assert.equal(await desktopAccessFixture({realm}).desktopNotificationAccount(),null);
  assert.equal(await desktopAccessFixture({session:null}).desktopNotificationAccount(),null);
  assert.equal(await desktopAccessFixture({session:{user:{id:'app-account'},app:'owner'}}).desktopNotificationAccount(),null);
  assert.equal(await desktopAccessFixture({profile:{accountStatus:'suspended',accountType:'owner'}}).desktopNotificationAccount(),null);
  const owner=await desktopAccessFixture().desktopNotificationAccount();assert.equal(owner.accountId,'desktop-account');assert.equal(owner.app,'owner');
  const middleman=await desktopAccessFixture({profile:{accountStatus:'active',accountType:'dealer',accountSubtype:'middleman'}}).desktopNotificationAccount();
  assert.equal(middleman.app,'middleman');assert.deepEqual(middleman.categories,['enquiries','listings']);
});
test('desktop settings persist only for the authenticated account; CSRF and identity injection fail',async()=>{
  const saved=[];
  const route=load('app/api/account/notifications/route.ts',{
    '../../../../lib/desktop-notification-access':{desktopNotificationAccount:async()=>({accountId:'own-account',app:'owner',categories:['maintenance']})},
    '../../../../lib/push-store':{saveAccountPushPreferences:async(...args)=>saved.push(args),accountPushPreferences:async()=>({enabled:true,preferences:policy.DEFAULT_PUSH_PREFERENCES})},
  });
  const send=(body,origin='https://www.aim4price.com')=>route.POST(new Request('https://www.aim4price.com/api/account/notifications',{method:'POST',headers:{origin},body:JSON.stringify(body)}));
  const settings={enabled:false,preferences:policy.DEFAULT_PUSH_PREFERENCES};
  assert.equal((await send(settings,'https://evil.test')).status,403);
  assert.equal((await send({...settings,accountId:'other'})).status,400);
  assert.equal((await send({...settings,enabled:'false'})).status,400);
  assert.equal(saved.length,0);
  assert.equal((await send(settings)).status,200);assert.deepEqual(saved,[['owner','own-account',settings]]);
});
test('account master switch blocks even an uncategorized test push at display time',async()=>{
  const route=load('app/api/app-notifications/delivery/route.ts',{
    'next/headers':{cookies:()=>({get:()=>({value:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'})})},
    '../../../../lib/app-realm-server':{currentAppRealm:async()=>'owner'},
    '../../../../lib/push-access':{currentPushIdentity:async()=>null,resolvePushAccess:async()=>({categories:['maintenance']})},
    '../../../../lib/push-store':{ensurePushTables:async()=>{},accountPushPreferences:async()=>({enabled:false}),pushPreferences:async()=>policy.DEFAULT_PUSH_PREFERENCES},
    '../../../../lib/db':{getDb:()=>({query:async()=>({rows:[{account_id:'account',member_id:'member',version:1}]})})},
  });
  const state=await (await route.GET()).json();assert.equal(state.enabled,false);
  const worker=workerFixture(state);await worker.push({title:'Old test',body:'Private'});assert.equal(worker.shown.length,0);
});

test('notification writes accept the public origin behind Railway but reject forged origins',()=>{
  const {isTrustedNotificationRequest:check}=load('lib/notification-request-origin.ts');
  const request=(origin,extra={})=>new Request('http://internal-railway:3000/api/app-notifications',{method:'POST',headers:{...(origin?{origin}:{}),...extra}});
  assert.equal(check(request('https://www.aim4price.com')),true);
  assert.equal(check(request('https://aim4price.com')),true);
  for(const origin of [null,'null','https://evil.test','https://www.aim4price.com.evil.test','http://www.aim4price.com'])assert.equal(check(request(origin,{'x-forwarded-host':'www.aim4price.com','x-forwarded-proto':'https'})),false);
});
test('app preference saves and test delivery succeed through the production proxy URL',async()=>{
  let preferences={...policy.DEFAULT_PUSH_PREFERENCES};const sent=[];
  const route=load('app/api/app-notifications/route.ts',{
    'next/headers':{cookies:()=>({get:()=>({value:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'})})},
    '../../../lib/push-access':{currentPushIdentity:async()=>who,resolvePushAccess:async()=>({categories:['maintenance']})},
    '../../../lib/push-store':{
      savePushPreferences:async(identity,p)=>{assert.deepEqual(identity,who);preferences=p;},
      memberPushPreferences:async()=>preferences,accountPushPreferences:async()=>({enabled:true,preferences:policy.DEFAULT_PUSH_PREFERENCES}),
      getPushDevice:async()=>({id:'device',enabled:true,subscription:{endpoint:'https://fcm.googleapis.com/test'}}),
      pushKeys:async()=>({public_key:'public'}),sendPhonePush:async(sub,payload)=>sent.push({sub,payload}),
    },
    '../../../lib/db':{getDb:()=>({query:async()=>({rowCount:1})})},
  });
  const post=body=>route.POST(new Request('http://internal-railway:3000/api/app-notifications',{method:'POST',headers:{origin:'https://www.aim4price.com'},body:JSON.stringify(body)}));
  assert.equal((await post({action:'preferences',preferences:{...preferences,maintenance:false}})).status,200);
  assert.equal((await (await route.GET()).json()).preferences.maintenance,false);
  assert.equal((await post({action:'test'})).status,200);assert.equal(sent.length,1);assert.equal(sent[0].payload.deviceId,'device');assert.equal(sent[0].payload.href,'/owner-app/notifications');
});

