import { withAppNotificationHistory } from './app-notification-history';
import { listNotificationInbox, updateNotificationInboxState, type NotificationInboxAction, type NotificationInboxItem } from './notification-inbox';
import { ownerAppCan, type OwnerAppAccess } from './owner-app-access';
import { currentPushIdentity, resolvePushAccess } from './push-access';
import { listPushEvents } from './push-events';
import { markAppNotificationKeys } from './app-notification-state';
function visibleToOwner(access:OwnerAppAccess,item:NotificationInboxItem) {
  if(access.assetScope==='selected' && (!item.assetId || !access.accessibleAssetIds.includes(item.assetId)))return false;
  if(['dealer_cost','capture','cost_budget'].includes(item.category))return ownerAppCan(access,'manage_finance');
  if(['lead','asset_discovery','marketplace_sourcing'].includes(item.category))return ownerAppCan(access,'manage_marketplace');
  if(['dealer_correction','dealer_schedule'].includes(item.category))return ownerAppCan(access,'manage_assets');
  return true;
}
export async function listOwnerNotificationInbox(access:OwnerAppAccess):Promise<NotificationInboxItem[]> {
  const inbox=await listNotificationInbox({userId:access.ownerUserId,accountType:'owner',viewerKey:access.viewerKey,
    includeCostBudgetNotifications:ownerAppCan(access,'manage_finance')&&access.assetScope==='all'});
  const result=inbox.filter(item=>visibleToOwner(access,item)).map(item=>({...item,
    href:item.assetDiscoveryEnquiryId ? `/owner-app/notifications/enquiry/${encodeURIComponent(item.assetDiscoveryEnquiryId)}`
      :item.marketplaceSourcingRequestId ? `/owner-app/notifications/sourcing/${encodeURIComponent(item.marketplaceSourcingRequestId)}`:item.href}));
  const who=await currentPushIdentity();
  if(who?.app==='owner' && who.accountId===access.ownerUserId && who.memberId===access.ownerAppUserId) {
    const pushAccess=await resolvePushAccess(who);
    if(pushAccess) {
      const events=await withAppNotificationHistory(who,pushAccess,await listPushEvents(who,pushAccess,{includeRead:true,remindersOnly:true}));
      for(const event of events) result.push({ ...event, id:`app-event:${event.id}`,
        category:event.category as NotificationInboxItem['category'], tone:'info',state:event.isRead?'history':'new',
        actionRequired:false,isRead:Boolean(event.isRead),isArchived:false,readAtIso:null,archivedAtIso:null,resolvedAtIso:null });
    }
  }
  return result.sort((a,b)=>Number(a.state==='history')-Number(b.state==='history')||Number(b.state==='needs_action')-Number(a.state==='needs_action')||Date.parse(b.createdAtIso)-Date.parse(a.createdAtIso));
}
export async function markOwnerNotificationsRead(access:OwnerAppAccess,action:NotificationInboxAction,ids:string[]) {
  if(ids.length>250 || ids.some(id=>id.length>500))throw new Error('Too many notifications.');
  const visible=new Set((await listOwnerNotificationInbox(access)).map(item=>item.id));
  const allowed=ids.filter(id=>visible.has(id));
  await updateNotificationInboxState({userId:access.viewerKey,action,notificationIds:allowed.filter(id=>!id.startsWith('app-event:'))});
  const who=await currentPushIdentity();
  if(who?.app==='owner'&&who.accountId===access.ownerUserId&&who.memberId===access.ownerAppUserId)
    await markAppNotificationKeys(who,allowed.filter(id=>id.startsWith('app-event:')).map(id=>id.slice(10)));
}
