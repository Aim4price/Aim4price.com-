import type { PushEvent } from './push-events';
import type { PushApp, PushPreferences } from './push-policy';
import { PUSH_APPS } from './push-policy';
export function southAfricanDay(date:Date) { return new Date(date.getTime()+2*60*60*1000).toISOString().slice(0,10); }
export function notificationDeliveryPlan(events:PushEvent[],sent:Set<string>,preferences:PushPreferences,registeredAt:Date,app:PushApp,now=new Date()) {
  const eligible=events.filter(event=>!event.isRead&&preferences[event.category]&&!sent.has(event.id)
    &&(event.reminder||Date.parse(event.createdAtIso)>=registeredAt.getTime()));
  const immediate=eligible.filter(event=>event.category!=='listings'||event.delivery!=='daily')
    .sort((a,b)=>Number(a.category==='listings')-Number(b.category==='listings')||Date.parse(a.createdAtIso)-Date.parse(b.createdAtIso));
  const today=southAfricanDay(now),digestId=`listing-digest:${today}`;
  // Send yesterday's matches together during daytime in South Africa, at most once per day.
  const hour=(now.getUTCHours()+2)%24;
  const daily=eligible.filter(event=>event.category==='listings'&&event.delivery==='daily'&&southAfricanDay(new Date(event.createdAtIso))<today);
  const batches=immediate.slice(0,3).map(event=>({event,ids:[event.id]}));
  if(daily.length&&!sent.has(digestId)&&hour>=8&&hour<20) {
    batches.push({event:{id:digestId,category:'listings',title:`${daily.length} new ${daily.length===1?'listing':'listings'} matching your interests`,
      body:'Open your notifications to view the matching assets.',href:PUSH_APPS[app].root+'/notifications?category=listings',createdAtIso:now.toISOString()},ids:[digestId,...daily.map(event=>event.id)]});
  }
  return batches;
}
