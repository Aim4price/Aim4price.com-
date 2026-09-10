import { listMatchingListingEvents } from './listing-alerts';
import { readAppNotificationKeys } from './app-notification-state';
import { listComputedHeaderNotifications } from './notifications';
import { listNotificationInbox } from './notification-inbox';
import { listAssetMaintenanceRecords, buildAlertBody } from './asset-maintenance';
import { buildAssetLicenseRenewalAlert } from './asset-license-renewal';
import { listDealerMaintenanceNotificationsForViewer } from './dealer-maintenance-notification-inbox';
import { getDb } from './db';
import { PUSH_APPS, type PushCategory } from './push-policy';
import type { PushIdentity } from './push-store';
import { resolvePushAccess } from './push-access';
export type PushEvent = { id: string; category: PushCategory; title: string; body: string; href: string; createdAtIso: string; reminder?: boolean; assetId?: string; isRead?: boolean; delivery?: 'daily' | 'instant'; actionRequired?: boolean; sourceCategory?: string };
export async function listPushEvents(who: PushIdentity, access: NonNullable<Awaited<ReturnType<typeof resolvePushAccess>>>, options: { includeRead?: boolean; remindersOnly?: boolean } = {}): Promise<PushEvent[]> {
  const root = PUSH_APPS[who.app].root;
  const events: PushEvent[] = [];
  if (who.app === 'field') {
    const { listFieldManagerNotifications } = await import('./field-manager-notifications');
    const notifications = await listFieldManagerNotifications({ ownerUserId: who.accountId, managerId: who.memberId });
    for (const item of notifications) {
      if (!access.allowedAssets?.has(item.assetId)) continue;
      events.push({ ...item, category: item.assignedToViewer ? 'assignments' : 'maintenance', reminder: !item.assignedToViewer });
    }
  } else if (who.app === 'owner') {
    const assets = await getDb().query(`select id::text, kind, is_licensed, license_registration_number, specs_json,
      license_renewal_alert_noted_for_date::text from public.asset_register_items where user_id=$1 and coalesce(to_jsonb(asset_register_items)->>'lifecycle_state','active')='active'`, [who.accountId]);
    const activeAssets = new Set(assets.rows.map(row => row.id));
    const records = await listAssetMaintenanceRecords(who.accountId);
    for (const record of records) {
      if (!activeAssets.has(record.assetId) || record.status !== 'upcoming' || record.alertNotedAtIso || !['due_soon','due','overdue'].includes(record.computedStatus)) continue;
      if (access.allowedAssets && !access.allowedAssets.has(record.assetId)) continue;
      events.push({ id: `maintenance:${record.id}:${record.dueDate ?? record.dueUsage}:${record.computedStatus}`, category: 'maintenance', assetId: record.assetId,
        title: 'Maintenance upcoming', body: `${record.assetTitle}: ${buildAlertBody(record)}`,
        href: `${root}/assets/${encodeURIComponent(record.assetId)}/maintenance?maintenanceId=${encodeURIComponent(record.id)}`, createdAtIso: record.updatedAtIso, reminder: true });
    }
    for (const row of assets.rows) {
      if (access.allowedAssets && !access.allowedAssets.has(row.id)) continue;
      const alert = buildAssetLicenseRenewalAlert({ id: row.id, kind: row.kind, isLicensed: row.is_licensed,
        licenseRegistrationNumber: row.license_registration_number, specsJson: row.specs_json }, row.license_renewal_alert_noted_for_date);
      if (alert) events.push({ id: `${alert.id}:${alert.computedStatus}`, category: 'licensing', assetId: row.id, title: alert.heading,
        body: alert.body, href: `${root}/assets/${encodeURIComponent(row.id)}`, createdAtIso: new Date().toISOString(), reminder: true });
    }
    // Only current source events, intersected with unread inbox state. Resolved historical snapshots never trigger pushes.
    if (access.admin && !options.remindersOnly) {
      const [current, inbox] = await Promise.all([
        listComputedHeaderNotifications({ userId: who.accountId, accountType: 'owner' }),
        listNotificationInbox({ userId: who.accountId, accountType: 'owner', viewerKey: access.viewerKey }),
      ]);
      const unread = new Set(inbox.filter(item => !item.isRead && !item.isArchived && !item.resolvedAtIso).map(item => item.id));
      for (const item of current) {
        if (!unread.has(item.id)) continue;
        const category = ['lead','asset_discovery','marketplace_sourcing'].includes(item.category) ? 'enquiries'
          : ['dealer_correction','dealer_schedule','dealer_cost','capture'].includes(item.category) ? 'approvals'
          : item.category === 'cost_budget' ? 'costs' : null;
        if (category) events.push({ ...item, category, href: root + '/notifications' });
      }
    }
  } else {
    if (who.app === 'dealer' && access.categories.includes('maintenance')) {
      const notifications = await listDealerMaintenanceNotificationsForViewer({ dealerUserId: who.accountId, staffId: who.memberId, viewerKey: access.viewerKey });
      for (const item of notifications) events.push({ ...item,
        category: item.status === 'assigned_problem' ? 'assignments' : 'maintenance',
        href: `${root}/maintenance/${encodeURIComponent(item.accessId)}`, reminder: item.status !== 'assigned_problem' });
    }
    if (access.categories.includes('enquiries')) {
      const current = await listComputedHeaderNotifications({ userId: who.accountId, accountType: 'dealer' });
      for (const item of current) {
        if (!['asset_discovery','marketplace_sourcing','lead'].includes(item.category)) continue;
        // Middleman currently exposes Discovery and Marketplace, but has no Leads module.
        if (item.category === 'lead' && (!access.canLead || who.app === 'middleman')) continue;
        if (item.category === 'marketplace_sourcing' && !access.canSource) continue;
        if (item.category === 'asset_discovery' && !access.canDiscover) continue;
        events.push({ ...item, category: 'enquiries', sourceCategory: item.category, href: item.category === 'asset_discovery' && item.assetDiscoveryEnquiryId
          ? `${root}/notifications/enquiry/${encodeURIComponent(item.assetDiscoveryEnquiryId)}`
          : item.category === 'marketplace_sourcing' && item.marketplaceSourcingRequestId
            ? `${root}/notifications/sourcing/${encodeURIComponent(item.marketplaceSourcingRequestId)}` : root + '/leads' });
      }
    }
  }
  if (access.categories.includes('listings')) events.push(...await listMatchingListingEvents(who));
  const allowed = events.filter(event => access.categories.includes(event.category));
  const read = await readAppNotificationKeys(who, allowed.map(event => event.id));
  return allowed.map(event => ({ ...event, isRead: Boolean(event.isRead || read.has(event.id)) }))
    .filter(event => options.includeRead || !event.isRead)
    .sort((a,b) => Date.parse(b.createdAtIso)-Date.parse(a.createdAtIso));
}

