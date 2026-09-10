import { withAppNotificationHistory } from './app-notification-history';
import { listPushEvents, type PushEvent } from './push-events';
import { markAppNotificationKeys } from './app-notification-state';
import { resolvePushAccess } from './push-access';
import type { PushIdentity } from './push-store';
export async function listAppNotificationInbox(who: PushIdentity): Promise<PushEvent[]> {
  const access = await resolvePushAccess(who);
  if (!access) throw new Error('Please sign in again.');
  return withAppNotificationHistory(who,access,await listPushEvents(who,access,{includeRead:true}));
}
export async function markAppNotificationsRead(who: PushIdentity, ids: string[]) {
  const allowed = new Set((await listAppNotificationInbox(who)).map(event => event.id));
  await markAppNotificationKeys(who,ids.filter(id => allowed.has(id)).slice(0,250));
}
