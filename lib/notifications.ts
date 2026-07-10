import { getDb } from './db';
import { ensureFuelLedgerTables, listFuelLedger, type FuelLedgerEvent } from './fuel-ledger';
import {
  listPendingAssetDiscoveryEnquiriesForOwner,
  listRecentAssetDiscoveryEnquiriesForDealer,
} from './asset-discovery';
import {
  ensurePartnerAccessTables,
  listAssetLeadsForUser,
  type AccountRole,
  type AssetLead,
  type AssetLeadStatus,
  type LeadType,
} from './partner-access';

export type HeaderNotificationCategory =
  | 'partner_note'
  | 'lead'
  | 'qr_scan'
  | 'fuel'
  | 'asset_discovery';

export type HeaderNotificationTone = 'neutral' | 'success' | 'warning' | 'info';

export type HeaderNotificationItem = {
  id: string;
  category: HeaderNotificationCategory;
  tone: HeaderNotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  assetDiscoveryEnquiryId?: string;
};

type OpenPartnerNoteRow = {
  id: string;
  note_text: string | null;
  asset_register_item_id: string | null;
  partner_display_name: string | null;
  partner_business_name: string | null;
  asset_title: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AssetScanNotificationRow = {
  id: string;
  asset_id: string | null;
  actor_type: string | null;
  operator_name: string | null;
  field_manager_display_name: string | null;
  hours: string | number | null;
  note: string | null;
  photo_urls: unknown;
  latitude: string | number | null;
  longitude: string | number | null;
  location_text: string | null;
  asset_title: string | null;
  asset_brand_name: string | null;
  asset_model_name: string | null;
  asset_typed_model_name: string | null;
  created_at: string | null;
};

type ListHeaderNotificationsInput = {
  userId: string;
  accountType: AccountRole | string | null | undefined;
};

const MAX_NOTIFICATIONS = 12;
const RECENT_SCAN_DAYS = 14;
const RECENT_FUEL_DAYS = 14;
const RECENT_LEAD_DAYS = 45;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeAccountType(value: unknown): AccountRole {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'dealer' || normalized === 'finance' || normalized === 'insurance') {
    return normalized;
  }

  return 'owner';
}

function toTime(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoFallback(value: string | null | undefined): string {
  return toTime(value) ? new Date(value as string).toISOString() : new Date(0).toISOString();
}

function isWithinDays(value: string | null | undefined, days: number): boolean {
  const time = toTime(value);
  if (!time) return false;

  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function truncateText(value: unknown, maxLength = 112): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function hasNumericValue(value: unknown): boolean {
  if (value === null || typeof value === 'undefined' || value === '') return false;
  return Number.isFinite(Number(value));
}

function jsonArrayLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }

  return 0;
}

function scanNotificationAssetTitle(row: AssetScanNotificationRow): string {
  const title = asText(row.asset_title);
  if (title) return title;

  const brand = asText(row.asset_brand_name);
  const model = asText(row.asset_model_name) || asText(row.asset_typed_model_name);
  const combined = [brand, model].filter(Boolean).join(' ').trim();

  return combined || 'an asset';
}

function scanNotificationUpdaterName(row: AssetScanNotificationRow): string {
  return asText(row.field_manager_display_name) || asText(row.operator_name) || 'A manager';
}

function scanNotificationDetailText(row: AssetScanNotificationRow): string {
  const details: string[] = [];
  const noteText = asText(row.note);
  const photoCount = jsonArrayLength(row.photo_urls);

  if (hasNumericValue(row.hours)) {
    details.push('Usage reading saved');
  }

  if (noteText) {
    const serviceLike = /service|serviced|repair|repaired|checked|work done|notes\/problems/i.test(noteText);
    details.push(serviceLike ? 'Notes/service update saved' : 'Notes update saved');
  }

  if (photoCount > 0) {
    details.push(photoCount === 1 ? 'Photo added' : 'Photos added');
  }

  if (asText(row.location_text) || hasNumericValue(row.latitude) || hasNumericValue(row.longitude)) {
    details.push('GPS/location captured');
  }

  if (!details.length) {
    details.push('Asset details saved');
  }

  return `${details.slice(0, 4).join('. ')}.`;
}

function partnerDisplayName(row: OpenPartnerNoteRow): string {
  return asText(row.partner_business_name) || asText(row.partner_display_name) || 'A partner';
}

function leadTypeLabel(leadType: LeadType): string {
  if (leadType === 'finance') return 'finance';
  if (leadType === 'insurance') return 'insurance';
  return 'replacement quote';
}

function leadStatusLabel(status: AssetLeadStatus): string {
  if (status === 'sent') return 'new';
  if (status === 'viewed') return 'viewed';
  if (status === 'accepted') return 'accepted';
  if (status === 'quoted') return 'quoted';
  if (status === 'declined') return 'declined';
  return 'closed';
}

function leadTone(status: AssetLeadStatus): HeaderNotificationTone {
  if (status === 'accepted' || status === 'quoted') return 'success';
  if (status === 'declined') return 'warning';
  return 'info';
}

function isQrDealerHelpLead(lead: AssetLead): boolean {
  const sections = asRecord(lead.includedSections);
  const source = asText(sections.source).toLowerCase();

  return source === 'asset_qr_share' || source === 'qr_dealer_help' || source === 'scan_share';
}

function qrDealerHelpOperatorName(lead: AssetLead): string {
  const sections = asRecord(lead.includedSections);
  const operatorName = asText(sections.operatorName) || asText(sections.operator_name);

  return operatorName || 'A manager';
}

function assetTitleFromLead(lead: AssetLead): string {
  const snapshot = asRecord(lead.assetSnapshot);
  const title = asText(snapshot.title);
  if (title) return title;

  const brand = asText(snapshot.brandName);
  const model = asText(snapshot.modelName) || asText(snapshot.typedModelName);
  const combined = [brand, model].filter(Boolean).join(' ').trim();

  return combined || 'Asset register item';
}

function describeFuelEvent(event: FuelLedgerEvent): string {
  if (event.eventType === 'asset_issue') {
    return `${Math.round(event.litres)} L issued${event.assetTitle ? ` to ${event.assetTitle}` : ''}.`;
  }

  if (event.eventType === 'stock_in') {
    return `${Math.round(event.litres)} L stock-in recorded for ${event.storageName}.`;
  }

  if (event.eventType === 'dip') {
    return `Dip reading recorded for ${event.storageName}.`;
  }

  if (event.eventType === 'adjustment') {
    return `Fuel adjustment recorded for ${event.storageName}.`;
  }

  return `Opening balance recorded for ${event.storageName}.`;
}

async function listOpenPartnerNoteNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    await ensurePartnerAccessTables();
    const db = getDb();
    const result = await db.query<OpenPartnerNoteRow>(
      `
        select
          n.id::text,
          n.note_text,
          n.asset_register_item_id::text,
          partner.display_name as partner_display_name,
          partner.business_name as partner_business_name,
          asset.title as asset_title,
          n.created_at::text,
          n.updated_at::text
        from public.asset_partner_notes n
        left join public.account_profiles partner on partner.user_id = n.partner_user_id
        left join public.asset_register_items asset on asset.id = n.asset_register_item_id
        where n.owner_user_id = $1
          and n.status = 'open'
        order by n.created_at desc, n.id desc
        limit 15
      `,
      [userId],
    );

    return result.rows.map((row) => {
      const assetTitle = asText(row.asset_title) || 'one of your assets';
      const noteText = truncateText(row.note_text || 'A partner left a note for you to review.');

      return {
        id: `partner-note:${row.id}`,
        category: 'partner_note',
        tone: 'info',
        title: 'Partner note left',
        body: `${partnerDisplayName(row)} left a note on ${assetTitle}: ${noteText}`,
        href: '/asset-register',
        createdAtIso: isoFallback(row.created_at || row.updated_at),
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load partner note notifications', error);
    return [];
  }
}

async function listOwnerLeadNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const leads = await listAssetLeadsForUser(userId);

    return leads
      .filter((lead) => lead.ownerUserId === userId)
      .filter((lead) => lead.status !== 'sent' || isQrDealerHelpLead(lead))
      .filter((lead) => isWithinDays(lead.updatedAtIso || lead.createdAtIso, RECENT_LEAD_DAYS))
      .map((lead) => {
        const partner = lead.partnerBusinessName || lead.partnerName || 'A partner';
        const typeLabel = leadTypeLabel(lead.leadType);
        const statusLabel = leadStatusLabel(lead.status);
        const assetTitle = assetTitleFromLead(lead);

        if (lead.status === 'sent' && isQrDealerHelpLead(lead)) {
          const managerName = qrDealerHelpOperatorName(lead);

          return {
            id: `lead-owner-qr-help:${lead.id}:${lead.updatedAtIso}`,
            category: 'lead',
            tone: 'info',
            title: 'Asset sent to dealer',
            body: `${managerName} updated ${assetTitle} and sent the asset to ${partner} for dealer help.`,
            href: '/leads',
            createdAtIso: isoFallback(lead.updatedAtIso || lead.createdAtIso),
          } satisfies HeaderNotificationItem;
        }

        return {
          id: `lead-owner:${lead.id}:${lead.status}:${lead.updatedAtIso}`,
          category: 'lead',
          tone: leadTone(lead.status),
          title: `${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)} lead ${statusLabel}`,
          body: `${partner} ${statusLabel} your ${typeLabel} request for ${assetTitle}.`,
          href: '/leads',
          createdAtIso: isoFallback(lead.updatedAtIso || lead.createdAtIso),
        } satisfies HeaderNotificationItem;
      });
  } catch (error) {
    console.error('Failed to load owner lead notifications', error);
    return [];
  }
}

async function listPartnerLeadNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const activeStatuses = new Set<AssetLeadStatus>(['sent', 'viewed', 'accepted', 'quoted']);
    const leads = await listAssetLeadsForUser(userId);

    return leads
      .filter((lead) => lead.partnerUserId === userId)
      .filter((lead) => activeStatuses.has(lead.status))
      .filter((lead) => isWithinDays(lead.updatedAtIso || lead.createdAtIso, RECENT_LEAD_DAYS))
      .map((lead) => {
        const owner = lead.ownerBusinessName || lead.ownerName || 'An asset owner';
        const typeLabel = leadTypeLabel(lead.leadType);
        const assetTitle = assetTitleFromLead(lead);
        const ownerMessage = truncateText(lead.ownerMessage, 96);
        const bodySuffix = ownerMessage ? ` Message: ${ownerMessage}` : '';

        return {
          id: `lead-partner:${lead.id}:${lead.status}:${lead.updatedAtIso}`,
          category: 'lead',
          tone: lead.status === 'sent' ? 'info' : leadTone(lead.status),
          title: lead.status === 'sent' ? 'New lead opportunity' : `Lead ${leadStatusLabel(lead.status)}`,
          body: `${owner} sent a ${typeLabel} opportunity for ${assetTitle}.${bodySuffix}`,
          href: '/leads',
          createdAtIso: isoFallback(lead.updatedAtIso || lead.createdAtIso),
        } satisfies HeaderNotificationItem;
      });
  } catch (error) {
    console.error('Failed to load partner lead notifications', error);
    return [];
  }
}

async function listOwnerAssetDiscoveryNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const enquiries = await listPendingAssetDiscoveryEnquiriesForOwner(userId);

    return enquiries.map((enquiry) => ({
      id: `asset-discovery-owner:${enquiry.id}:${enquiry.updatedAtIso}`,
      category: 'asset_discovery',
      tone: 'info',
      title: 'Discovery enquiry',
      body: `A dealer is interested in your ${enquiry.asset.brand} ${enquiry.asset.model}. Are you interested in selling?`,
      href: '',
      createdAtIso: isoFallback(enquiry.createdAtIso || enquiry.updatedAtIso),
      assetDiscoveryEnquiryId: enquiry.id,
    } satisfies HeaderNotificationItem));
  } catch (error) {
    console.error('Failed to load owner Discovery notifications', error);
    return [];
  }
}

async function listDealerAssetDiscoveryNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const enquiries = await listRecentAssetDiscoveryEnquiriesForDealer(userId);

    return enquiries.map((enquiry) => {
      const approved = enquiry.status === 'approved';
      const retryDate = enquiry.status === 'temporarily_denied'
        ? new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(enquiry.updatedAtIso))
        : '';

      return {
        id: `asset-discovery-dealer:${enquiry.id}:${enquiry.status}:${enquiry.updatedAtIso}`,
        category: 'asset_discovery',
        tone: approved ? 'success' : 'warning',
        title: approved ? 'Asset enquiry approved' : 'Asset enquiry temporarily denied',
        body: approved
          ? `Your enquiry for ${enquiry.asset.brand} ${enquiry.asset.model} was approved.`
          : `Your enquiry for ${enquiry.asset.brand} ${enquiry.asset.model} was temporarily denied.${retryDate ? ` Updated: ${retryDate}.` : ''}`,
        href: '',
        createdAtIso: isoFallback(enquiry.updatedAtIso),
        assetDiscoveryEnquiryId: enquiry.id,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load dealer Discovery notifications', error);
    return [];
  }
}

async function listQrScanNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    await ensureFuelLedgerTables();
    const db = getDb();
    const result = await db.query<AssetScanNotificationRow>(
      `
        select
          e.id::text,
          e.asset_id::text,
          e.actor_type,
          e.operator_name,
          to_jsonb(e)->>'field_manager_display_name' as field_manager_display_name,
          e.hours,
          e.note,
          e.photo_urls,
          e.latitude,
          e.longitude,
          e.location_text,
          coalesce(nullif(trim(coalesce(to_jsonb(asset)->>'title', to_jsonb(asset)->>'name', '')), ''), '') as asset_title,
          coalesce(to_jsonb(asset)->>'brand_name', to_jsonb(asset)->>'brand', '') as asset_brand_name,
          coalesce(to_jsonb(asset)->>'model_name', to_jsonb(asset)->>'model', '') as asset_model_name,
          coalesce(to_jsonb(asset)->>'typed_model_name', '') as asset_typed_model_name,
          e.created_at::text
        from public.asset_scan_events e
        inner join public.asset_register_items asset on asset.id = e.asset_id
        where to_jsonb(asset)->>'user_id' = $1
          and e.actor_type in ('scan_pin', 'field_manager')
          and e.created_at >= now() - ($2::int * interval '1 day')
          and nullif(coalesce(to_jsonb(e)->>'fuel_storage_event_id', ''), '') is null
          and nullif(coalesce(to_jsonb(e)->>'fuel_storage_id', ''), '') is null
          and nullif(coalesce(to_jsonb(e)->>'fuel_slip_id', ''), '') is null
        order by e.created_at desc, e.id desc
        limit 15
      `,
      [userId, RECENT_SCAN_DAYS],
    );

    return result.rows.map((row) => {
      const createdAtIso = isoFallback(row.created_at);
      const assetTitle = scanNotificationAssetTitle(row);
      const updaterName = scanNotificationUpdaterName(row);

      return {
        id: `asset-update:${row.id}:${createdAtIso}`,
        category: 'qr_scan',
        tone: 'neutral',
        title: 'Asset updated',
        body: `${updaterName} updated ${assetTitle}. ${scanNotificationDetailText(row)}`,
        href: '/asset-register',
        createdAtIso,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load QR asset update notifications', error);
    return [];
  }
}


async function listFuelNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const ledger = await listFuelLedger(userId);

    return ledger.recentEvents
      .filter((event) => isWithinDays(event.createdAtIso, RECENT_FUEL_DAYS))
      .slice(0, 8)
      .map((event) => {
        const operator = event.operatorName ? ` by ${event.operatorName}` : '';
        const note = event.note ? ` Note: ${truncateText(event.note, 74)}` : '';

        return {
          id: `fuel:${event.id}:${event.createdAtIso}`,
          category: 'fuel',
          tone: 'neutral',
          title: 'Fuel ledger update',
          body: `${describeFuelEvent(event)}${operator}.${note}`,
          href: '/fuel',
          createdAtIso: isoFallback(event.createdAtIso),
        } satisfies HeaderNotificationItem;
      });
  } catch (error) {
    console.error('Failed to load fuel notifications', error);
    return [];
  }
}

export async function listHeaderNotifications(input: ListHeaderNotificationsInput): Promise<HeaderNotificationItem[]> {
  const accountType = normalizeAccountType(input.accountType);
  const notificationGroups = accountType === 'owner'
    ? await Promise.all([
        listOpenPartnerNoteNotifications(input.userId),
        listOwnerLeadNotifications(input.userId),
        listOwnerAssetDiscoveryNotifications(input.userId),
        listQrScanNotifications(input.userId),
        listFuelNotifications(input.userId),
      ])
    : await Promise.all([
        listPartnerLeadNotifications(input.userId),
        accountType === 'dealer' ? listDealerAssetDiscoveryNotifications(input.userId) : Promise.resolve([]),
      ]);

  return notificationGroups
    .flat()
    .sort((left, right) => toTime(right.createdAtIso) - toTime(left.createdAtIso))
    .slice(0, MAX_NOTIFICATIONS);
}
