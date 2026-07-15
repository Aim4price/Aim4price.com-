export type OwnerNotificationTimestamp = {
  createdAtIso: string;
};

export const OWNER_NOTIFICATION_SEEN_EVENT = 'aim4price-owner-notifications-seen';

export function ownerNotificationSeenStorageKey(viewerId: string): string {
  return `aim4price-header-notifications-seen-${viewerId}`;
}

export function parseOwnerNotificationTime(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function readOwnerNotificationsSeenAt(viewerId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(ownerNotificationSeenStorageKey(viewerId));
  } catch {
    return null;
  }
}

export function isOwnerNotificationNew(
  createdAtIso: string,
  seenAtIso: string | null,
): boolean {
  return parseOwnerNotificationTime(createdAtIso) > parseOwnerNotificationTime(seenAtIso);
}

export function markOwnerNotificationsSeen(
  viewerId: string,
  notifications: OwnerNotificationTimestamp[],
): string {
  const latestNotificationTime = notifications.reduce(
    (latest, item) => Math.max(latest, parseOwnerNotificationTime(item.createdAtIso)),
    0,
  );
  const seenAtIso = new Date(latestNotificationTime || Date.now()).toISOString();

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ownerNotificationSeenStorageKey(viewerId), seenAtIso);
    } catch {
      // The checked state still updates for this screen when storage is unavailable.
    }

    window.dispatchEvent(new CustomEvent(OWNER_NOTIFICATION_SEEN_EVENT, {
      detail: { viewerId, seenAtIso },
    }));
  }

  return seenAtIso;
}
