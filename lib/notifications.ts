import { getDb } from './db';
import {
  contactRequesterName,
  listContactRequestsForRequester,
  listPendingContactRequestsForOwner,
} from './contact-requests';
import { listAssetRegisterItems } from './asset-register-db';
import { listFuelLedger, type FuelLedgerEvent } from './fuel-ledger';
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
  | 'contact_request'
  | 'account';

export type HeaderNotificationTone = 'neutral' | 'success' | 'warning' | 'info';

export type HeaderNotificationItem = {
  id: string;
  category: HeaderNotificationCategory;
  tone: HeaderNotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  contactRequestId?: string;
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


async function listOwnerContactRequestNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const requests = await listPendingContactRequestsForOwner(userId);

    return requests.map((request) => {
      const requester = contactRequesterName(request);

      return {
        id: `contact-request-owner:${request.id}:${request.updatedAtIso}`,
        category: 'contact_request',
        tone: 'info',
        title: 'Contact detail request',
        body: `${requester} wants to be in contact with you. Share contact details or deny request.`,
        href: '/users',
        createdAtIso: isoFallback(request.createdAtIso || request.updatedAtIso),
        contactRequestId: request.id,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load owner contact request notifications', error);
    return [];
  }
}

async function listPartnerContactRequestNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const requests = await listContactRequestsForRequester(userId);

    return requests
      .filter((request) => request.status === 'approved' || request.status === 'denied')
      .filter((request) => isWithinDays(request.updatedAtIso, RECENT_LEAD_DAYS))
      .map((request) => {
        const wasApproved = request.status === 'approved';

        return {
          id: `contact-request-partner:${request.id}:${request.status}:${request.updatedAtIso}`,
          category: 'contact_request',
          tone: wasApproved ? 'success' : 'warning',
          title: wasApproved ? 'Contact details unlocked' : 'Contact request denied',
          body: wasApproved
            ? `${request.ownerCompanyName} shared contact details with you.`
            : `${request.ownerCompanyName} denied your contact detail request.`,
          href: '/users',
          createdAtIso: isoFallback(request.updatedAtIso),
        } satisfies HeaderNotificationItem;
      });
  } catch (error) {
    console.error('Failed to load partner contact request notifications', error);
    return [];
  }
}

async function listQrScanNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const assets = await listAssetRegisterItems(userId);

    return assets
      .filter((asset) => isWithinDays(asset.lastScannedAtIso, RECENT_SCAN_DAYS))
      .map((asset) => {
        const locationText = asset.lastKnownLocationText ? ` Location: ${asset.lastKnownLocationText}.` : '';

        return {
          id: `qr-scan:${asset.id}:${asset.lastScannedAtIso}`,
          category: 'qr_scan',
          tone: 'neutral',
          title: 'QR code scanned',
          body: `${asset.title || 'An asset'} was scanned from its asset QR code.${locationText}`,
          href: '/asset-register',
          createdAtIso: isoFallback(asset.lastScannedAtIso),
        } satisfies HeaderNotificationItem;
      });
  } catch (error) {
    console.error('Failed to load QR scan notifications', error);
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
        listOwnerContactRequestNotifications(input.userId),
        listQrScanNotifications(input.userId),
        listFuelNotifications(input.userId),
      ])
    : await Promise.all([
        listPartnerLeadNotifications(input.userId),
        listPartnerContactRequestNotifications(input.userId),
      ]);

  return notificationGroups
    .flat()
    .sort((left, right) => toTime(right.createdAtIso) - toTime(left.createdAtIso))
    .slice(0, MAX_NOTIFICATIONS);
}
