import { withAppNotificationHistory } from './app-notification-history';
import { listNotificationInbox, updateNotificationInboxState, type NotificationInboxAction, type NotificationInboxItem } from './notification-inbox';
import { ownerAppCan, type OwnerAppAccess } from './owner-app-access';
import { currentPushIdentity, resolvePushAccess } from './push-access';
import { listPushEvents } from './push-events';
import { markAppNotificationKeys } from './app-notification-state';
// Inbox reminders and push reminders describe the same maintenance record.
// Preserve the inbox identity/read state; never deduplicate by asset or wording.
function maintenanceReminderIdentity(id: string): string | null {
  const match = id.match(/^(?:app-event:)?maintenance-reminder:([^:]+):(soon|due)$/);
  if (match) return `${match[1]}:${match[2]}`;
  const push = id.match(/^(?:app-event:)?maintenance:([^:]+):.+:(due_soon|due|overdue)$/);
  return push ? `${push[1]}:${push[2] === 'due_soon' ? 'soon' : 'due'}` : null;
}
function visibleToOwner(access:OwnerAppAccess,item:NotificationInboxItem) {
  if(item.category==='billing')return access.sessionKind==='account';
  if(access.assetScope==='selected' && (!item.assetId || !access.accessibleAssetIds.includes(item.assetId)))return false;
  if(['dealer_cost','capture','cost_budget'].includes(item.category))return ownerAppCan(access,'manage_finance');
  if(['lead','asset_discovery','marketplace_sourcing'].includes(item.category))return ownerAppCan(access,'manage_marketplace');
  if(['dealer_correction','dealer_schedule'].includes(item.category))return ownerAppCan(access,'manage_assets');
  if (!ownerAppCan(access,'manage_assets')) return ownerAppCan(access,'viewMaintenance') && ['maintenance','maintenance_reminder','qr_scan','licensing'].includes(item.category);
  return true;
}
export async function listOwnerNotificationInbox(access:OwnerAppAccess):Promise<NotificationInboxItem[]> {
  const inbox=await listNotificationInbox({userId:access.ownerUserId,accountType:'owner',viewerKey:access.viewerKey,
    includeCostBudgetNotifications:ownerAppCan(access,'manage_finance')&&access.assetScope==='all'});
  const result=inbox.filter(item=>visibleToOwner(access,item)).map(item=>({...item,
    href:item.id.startsWith('maintenance-reminder:') && item.assetId
      ? `/owner-app/assets/${encodeURIComponent(item.assetId)}/maintenance?maintenanceId=${encodeURIComponent(item.id.split(':')[1])}`
      :item.category === 'qr_scan' && item.title === 'Problem reported' ? '/owner-app/attention'
      :item.assetDiscoveryEnquiryId ? `/owner-app/notifications/enquiry/${encodeURIComponent(item.assetDiscoveryEnquiryId)}`
      :item.marketplaceSourcingRequestId ? `/owner-app/notifications/sourcing/${encodeURIComponent(item.marketplaceSourcingRequestId)}`:item.href}));
  const who=await currentPushIdentity();
  if(who?.app==='owner' && who.accountId===access.ownerUserId && who.memberId===access.ownerAppUserId) {
    const pushAccess=await resolvePushAccess(who);
    if(pushAccess) {
      const events=await withAppNotificationHistory(who,pushAccess,await listPushEvents(who,pushAccess,{includeRead:true,remindersOnly:true}));
      const inboxReminderKeys = new Set(result.map(item => maintenanceReminderIdentity(item.id)).filter(Boolean));
      for(const event of events.filter(item => !inboxReminderKeys.has(maintenanceReminderIdentity(item.id)))) result.push({ ...event, id:`app-event:${event.id}`,
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
  if(who?.app==='owner'&&who.accountId===access.ownerUserId&&who.memberId===access.ownerAppUserId) {
    const keys = allowed.filter(id=>id.startsWith('app-event:')).map(id=>id.slice(10));
    // Reading the single inbox item also reads its push-channel counterpart.
    // New reminder stages retain their own keys and can still notify later.
    const reminders = new Set(allowed.map(maintenanceReminderIdentity).filter(Boolean));
    if (reminders.size && action !== 'archive') {
      const pushAccess = await resolvePushAccess(who);
      if (pushAccess) {
        const events = await listPushEvents(who, pushAccess, { includeRead: true, remindersOnly: true });
        keys.push(...events.filter(event => reminders.has(maintenanceReminderIdentity(event.id))).map(event => event.id));
      }
    }
    await markAppNotificationKeys(who, [...new Set(keys)]);
  }
}
