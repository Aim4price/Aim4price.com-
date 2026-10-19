import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../components/AppHeader.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  useEffect(() => {\n    let mounted = true;\n    let inFlight = false;');
const end = source.indexOf('\n  useEffect(() => {\n    function refreshCostLedgerNotifications', start);
assert(start >= 0 && end > start);
const effect = ts.transpileModule(source.slice(start, end), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(fetcher) {
  let cleanup, timer, dependencies, notifications = [], calls = 0, signal;
  const windowEvents = new Map(), documentEvents = new Map();
  const window = { setInterval: (fn, delay) => { assert.equal(delay,30000);timer=fn;return 1; }, clearInterval: () => {timer=null;}, addEventListener:(name,fn)=>windowEvents.set(name,fn), removeEventListener:name=>windowEvents.delete(name) };
  const document = { visibilityState:'visible', addEventListener:(name,fn)=>documentEvents.set(name,fn),removeEventListener:name=>documentEvents.delete(name) };
  new Function('useEffect','session','pathname','notificationOpen','fetch','setNotifications','setNotificationOpen','setIsLoadingNotifications','window','document',effect)(
    (fn,deps)=>{dependencies=deps;cleanup=fn();},{id:'requester',accountType:'owner'},'/asset-discovery',true,
    async (_url, options)=>{calls++;signal=options.signal;assert.equal(options.cache,'no-store');return fetcher();},value=>notifications=value,()=>{},()=>{},window,document);
  return {refresh:()=>timer?.(), focus:()=>windowEvents.get('focus')?.(), document, visibility:()=>documentEvents.get('visibilitychange')?.(), cleanup:()=>cleanup(), get notifications(){return notifications;},get calls(){return calls;}, get signal(){return signal;},windowEvents,documentEvents,dependencies};
}
test('owner approval reaches a requester who stays on Discovery; focus and visible polling refresh the inbox', async()=>{
  let approved=false;
  const state=setup(async()=>({ok:true,json:async()=>({ok:true,notifications:approved?[{id:'asset-discovery-requester:enquiry:approved',title:'Asset enquiry approved'}]:[]})}));
  await tick();assert.equal(state.notifications.length,0);
  approved=true;state.refresh();await tick();assert.equal(state.notifications[0].title,'Asset enquiry approved');
  state.document.visibilityState='hidden';const before=state.calls;state.refresh();await tick();assert.equal(state.calls,before);
  state.document.visibilityState='visible';state.visibility();await tick();state.focus();await tick();assert.equal(state.calls,before+2);
  assert.equal(state.dependencies.at(-1),true,'Opening the bell is an effect dependency');
  state.cleanup();assert(state.signal.aborted);assert.equal(state.windowEvents.size,0);assert.equal(state.documentEvents.size,0);state.refresh();assert.equal(state.calls,before+2);
});
test('failed refresh retains existing notifications and overlapping requests are suppressed',async()=>{
  let fail=false,release;
  const state=setup(async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>({ok:true,notifications:[{id:'approved'}]})};});
  await tick();fail=true;state.refresh();await tick();assert.deepEqual(state.notifications,[{id:'approved'}]);state.cleanup();
  const pending=setup(()=>new Promise(resolve=>release=resolve));pending.refresh();pending.focus();assert.equal(pending.calls,1);
  pending.cleanup();release({ok:true,json:async()=>({ok:true,notifications:[{id:'stale'}]})});await tick();assert.deepEqual(pending.notifications,[]);
});
test('Discovery approval produces a new requester notification linked to the enquiry',async()=>{
  const notifications=readFileSync(new URL('../lib/notifications.ts',import.meta.url),'utf8');
  const start=notifications.indexOf('async function listRequesterAssetDiscoveryNotifications(');
  const end=notifications.indexOf('async function listMarketplaceSourcingNotifications(',start);
  const code=ts.transpileModule(notifications.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const list=new Function('listRecentAssetDiscoveryEnquiriesForRequester','isoFallback',`${code};return listRequesterAssetDiscoveryNotifications;`)(async id=>{assert.equal(id,'requester');return [{id:'enquiry',status:'approved',updatedAtIso:'2026-10-19T03:00:00Z',asset:{brand:'Toyota',model:'Hilux'}}];},value=>value);
  const [notice]=await list('requester');assert.equal(notice.title,'Asset enquiry approved');assert.equal(notice.assetDiscoveryEnquiryId,'enquiry');assert.match(notice.id,/asset-discovery-requester:enquiry:approved:/);assert.equal(notice.actionRequired,false);
});
