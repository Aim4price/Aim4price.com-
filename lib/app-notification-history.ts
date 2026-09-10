import { getDb } from './db';
import { appNotificationViewer, readAppNotificationKeys } from './app-notification-state';
import type { PushIdentity } from './push-store';
import type { PushEvent } from './push-events';
import type { resolvePushAccess } from './push-access';
let ready:Promise<void>|undefined;
function ensureHistory(){
  if(!ready)ready=getDb().query(`create table if not exists app_notification_history (
    viewer_key text not null,event_id text not null,event jsonb not null,first_seen_at timestamptz not null default now(),
    primary key(viewer_key,event_id));`).then(()=>undefined).catch(error=>{ready=undefined;throw error;});
  return ready;
}
export async function withAppNotificationHistory(who:PushIdentity,access:NonNullable<Awaited<ReturnType<typeof resolvePushAccess>>>,current:PushEvent[]):Promise<PushEvent[]> {
  await ensureHistory();
  const viewer=appNotificationViewer(who);
  if(current.length)await getDb().query(`insert into app_notification_history(viewer_key,event_id,event)
    select $1,value->>'id',value from jsonb_array_elements($2::jsonb)
    on conflict(viewer_key,event_id) do update set event=excluded.event`,[viewer,JSON.stringify(current)]);
  const stored=await getDb().query<{event:PushEvent}>(`select event from app_notification_history where viewer_key=$1
    and first_seen_at>now()-interval '30 days' order by first_seen_at desc,event_id limit 500`,[viewer]);
  const currentIds=new Set(current.map(item=>item.id));
  const events=new Map(current.map(item=>[item.id,item]));
  let allowedMaintenanceAssets:Set<string>|null=null;
  if(who.app==='dealer'&&access.categories.includes('maintenance')){
    const shares=await getDb().query<{asset_id:string}>(`select asset_register_item_id::text as asset_id from dealer_maintenance_access where dealer_user_id=$1 and is_active=true`,[who.accountId]);
    allowedMaintenanceAssets=new Set(shares.rows.map(row=>row.asset_id));
  }
  for(const {event} of stored.rows){
    if(events.has(event.id)||!access.categories.includes(event.category))continue;
    if(access.allowedAssets&&(!event.assetId||!access.allowedAssets.has(event.assetId)))continue;
    if(who.app!=='owner'){
      if(event.sourceCategory==='lead'&&!access.canLead)continue;
      if(event.sourceCategory==='marketplace_sourcing'&&!access.canSource)continue;
      if(event.sourceCategory==='asset_discovery'&&!access.canDiscover)continue;
      if(['maintenance','assignments'].includes(event.category)&&(!event.assetId||!allowedMaintenanceAssets?.has(event.assetId)))continue;
    }
    events.set(event.id,{...event,isRead:true});
  }
  const read=await readAppNotificationKeys(who,[...events.keys()]);
  return [...events.values()].map(item=>({...item,isRead:Boolean(item.isRead||read.has(item.id)||!currentIds.has(item.id))}))
    .sort((a,b)=>Date.parse(b.createdAtIso)-Date.parse(a.createdAtIso));
}
