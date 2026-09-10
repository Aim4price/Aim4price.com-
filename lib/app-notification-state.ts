import { listReadNotificationEventKeys, markNotificationEventKeysRead } from './app-notification-read-state';
import type { PushIdentity } from './push-store';
export function appNotificationViewer(who: PushIdentity) { return `${who.app}:${who.accountId}:${who.memberId}`; }
export async function readAppNotificationKeys(who: PushIdentity, ids: string[]) {
  const result = new Set<string>();
  for (let i=0;i<ids.length;i+=250) for (const id of await listReadNotificationEventKeys(appNotificationViewer(who),ids.slice(i,i+250))) result.add(id);
  return result;
}
export function markAppNotificationKeys(who: PushIdentity, ids: string[]) {
  return markNotificationEventKeysRead(appNotificationViewer(who), ids);
}
