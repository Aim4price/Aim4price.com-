import { getDb } from './db';
import { ensureFuelLedgerTables, listFuelLedger, type FuelLedgerEvent } from './fuel-ledger';
import {
  listPendingAssetDiscoveryEnquiriesForOwner,
  listRecentAssetDiscoveryEnquiriesForRequester,
} from './asset-discovery';
import {
  ensurePartnerAccessTables,
  listAssetLeadsForUser,
  type AccountRole,
  type AssetLead,
  type AssetLeadStatus,
  type LeadType,
} from './partner-access';
import { listAssetMaintenanceRecords, type AssetMaintenanceRecord } from './asset-maintenance';
import {
  listOwnerAssetCorrectionAlerts,
  type DealerAssetCorrectionRequest,
} from './dealer-asset-corrections';
import {
  listPendingOwnerDealerMaintenanceScheduleProposals,
  type DealerMaintenanceScheduleProposal,
} from './dealer-maintenance-tracker';
import {
  listPendingOwnerDealerCostDeletions,
  listPendingOwnerDealerCosts,
} from './dealer-costs';
import { listCaptureRequests } from './capture-requests';
import { listCurrentCostBudgetAlertEvents } from './cost-budgets';
import { listMarketplaceSourcingRequestNotifications } from './marketplace-sourcing-requests';

export type HeaderNotificationCategory =
  | 'admin_message'
  | 'partner_note'
  | 'lead'
  | 'qr_scan'
  | 'fuel'
  | 'maintenance'
  | 'dealer_schedule'
  | 'dealer_cost'
  | 'licensing'
  | 'listings'
  | 'cost_budget'
  | 'capture'
  | 'dealer_correction'
  | 'asset_discovery'
  | 'marketplace_sourcing';

export type HeaderNotificationTone = 'neutral' | 'success' | 'warning' | 'info';

export type HeaderNotificationItem = {
  id: string;
  category: HeaderNotificationCategory;
  tone: HeaderNotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  assetId?: string;
  assetDiscoveryEnquiryId?: string;
  marketplaceSourcingRequestId?: string;
  dealerAssetCorrectionId?: string;
  dealerAssetCorrectionAction?: 'decision' | 'retry' | 'pending';
  dealerMaintenanceScheduleProposalId?: string;
  dealerCostInvoiceId?: string;
  dealerCostAction?: 'store' | 'delete';
  captureRequestId?: string;
  actionRequired?: boolean;
  priority?: boolean;
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
  includeCostBudgetNotifications?: boolean;
};

const MAX_COMPUTED_NOTIFICATIONS = 120;
const RECENT_SCAN_DAYS = 14;
const RECENT_FUEL_DAYS = 14;
const RECENT_LEAD_DAYS = 45;
const RECENT_MAINTENANCE_DAYS = 45;

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

function isShareOpportunityLead(lead: AssetLead): boolean {
  const sections = asRecord(lead.includedSections);
  const source = asText(sections.source).toLowerCase();

  return source === 'asset_register_options'
    || source === 'full_asset_register'
    || source === 'asset_qr_share'
    || source === 'qr_dealer_help'
    || source === 'scan_share';
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

function maintenanceDueText(record: AssetMaintenanceRecord): string {
  if (record.triggerType === 'date' && record.dueDate) {
    const dueDate = new Date(`${record.dueDate.slice(0, 10)}T00:00:00Z`);
    const label = new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dueDate);
    return `Due ${label}.`;
  }

  if (record.triggerType === 'usage' && record.dueUsage !== null) {
    const unit = record.usageMetric === 'km'
      ? 'km'
      : record.usageMetric === 'percentage'
        ? '%'
        : 'hours';
    return `Due at ${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(record.dueUsage)} ${unit}.`;
  }

  return 'Open the schedule to review its next due target.';
}

function proposedScheduleDueText(proposal: DealerMaintenanceScheduleProposal): string {
  if (proposal.triggerType === 'date' && proposal.dueDate) {
    const dueDate = new Date(`${proposal.dueDate.slice(0, 10)}T00:00:00Z`);
    const label = new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dueDate);
    return `Due ${label}.`;
  }
  if (proposal.triggerType === 'usage' && proposal.dueUsage !== null) {
    const unit = proposal.usageMetric === 'km'
      ? 'km'
      : proposal.usageMetric === 'percentage'
        ? '%'
        : 'hours';
    return `Due at ${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(proposal.dueUsage)} ${unit}.`;
  }
  return 'Open the proposal to review its due target.';
}

function formatCostAmount(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

async function listOwnerCostBudgetNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const alerts = await listCurrentCostBudgetAlertEvents(userId);
    return alerts.map((alert) => {
      const params = new URLSearchParams({
        budgetId: alert.budgetId,
        year: alert.periodKey.slice(0, 4),
      });
      if (alert.assetId) params.set('assetId', alert.assetId);
      if (alert.period === 'monthly') {
        params.set('month', String(Number(alert.periodKey.slice(5, 7))));
      }

      const overBy = Math.max(0, alert.spent - alert.amount);
      return {
        id: `cost-budget:${alert.budgetId}:r${alert.budgetRevision}:${alert.periodKey}:${alert.alertKind}`,
        category: 'cost_budget',
        tone: 'warning',
        title: alert.alertKind === 'over_budget' ? 'Cost budget exceeded' : 'Cost budget warning',
        body: alert.alertKind === 'over_budget'
          ? `${alert.assetTitle} is ${formatCostAmount(overBy)} over its ${alert.period} budget (${formatCostAmount(alert.spent)} spent).`
          : `${alert.assetTitle} has reached the ${alert.warningPercent}% alert for its ${alert.period} budget (${formatCostAmount(alert.spent)} of ${formatCostAmount(alert.amount)} spent).`,
        href: `/my-invoices?${params.toString()}`,
        createdAtIso: alert.triggeredAtIso,
        assetId: alert.assetId || undefined,
        priority: true,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load Cost Ledger budget notifications', error);
    return [];
  }
}

function correctionActor(correction: DealerAssetCorrectionRequest): string {
  const dealerName = asText(correction.dealerName) || 'the partner';
  const actorName = asText(correction.actorName);
  if (!actorName || actorName.toLowerCase() === dealerName.toLowerCase()) return dealerName;
  return `${actorName} at ${dealerName}`;
}

function correctionValueSummary(correction: DealerAssetCorrectionRequest): string {
  const changes: string[] = [];

  if (correction.serialNumberChanged && correction.proposedSerialNumber) {
    const previous = correction.currentSerialNumber || 'not saved';
    changes.push(`serial number from ${previous} to ${correction.proposedSerialNumber}`);
  }

  if (correction.replacementPriceChanged && correction.proposedReplacementPriceExVat !== null) {
    const currency = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: 0,
    });
    const previous = correction.currentReplacementPriceExVat === null
      ? 'not saved'
      : currency.format(correction.currentReplacementPriceExVat);
    changes.push(`replacement price from ${previous} to ${currency.format(correction.proposedReplacementPriceExVat)} excl. VAT`);
  }

  if (correction.licenseRenewalDateChanged && correction.proposedLicenseRenewalDate) {
    const formatter = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' });
    const formatDate = (value: string) => {
      const parsed = new Date(`${value}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? value || 'not saved' : formatter.format(parsed);
    };
    changes.push(`licence renewal date from ${formatDate(correction.currentLicenseRenewalDate)} to ${formatDate(correction.proposedLicenseRenewalDate)}`);
  }

  return changes.join(' and ');
}

async function listOwnerDealerAssetCorrectionNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const corrections = await listOwnerAssetCorrectionAlerts(userId);

    return corrections.map((correction) => {
      if (correction.status === 'accepted') {
        const retryable = correction.revaluationRetryable;
        return {
          id: `dealer-correction-revaluation:${correction.id}:${correction.updatedAtIso}`,
          category: 'dealer_correction',
          tone: 'warning',
          title: correction.revaluationStatus === 'failed'
            ? 'Aim4price recalculation needs attention'
            : 'Aim4price recalculation pending',
          body: correction.revaluationStatus === 'failed'
            ? correction.revaluationFailureMessage || 'The replacement price was saved, but Aim4price could not recalculate this asset automatically.'
            : retryable
              ? 'The replacement price was saved, but the pending recalculation can now be retried safely.'
              : 'The replacement price was saved and Aim4price is still recalculating this asset.',
          href: '',
          createdAtIso: correction.updatedAtIso,
          assetId: correction.assetId,
          dealerAssetCorrectionId: correction.id,
          dealerAssetCorrectionAction: retryable ? 'retry' : 'pending',
          priority: true,
        } satisfies HeaderNotificationItem;
      }

      return {
        id: `dealer-correction:${correction.id}:${correction.updatedAtIso}`,
        category: 'dealer_correction',
        tone: 'warning',
        title: correction.licenseRenewalDateChanged ? 'Licence expert updated renewal date' : 'Dealer updated asset details',
        body: `${correctionActor(correction)} updated the ${correctionValueSummary(correction)} for ${correction.assetTitle}. Accept the change to update your Asset Register.`,
        href: '',
        createdAtIso: correction.updatedAtIso,
        assetId: correction.assetId,
        dealerAssetCorrectionId: correction.id,
        dealerAssetCorrectionAction: 'decision',
        priority: true,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load asset correction notifications', error);
    return [];
  }
}

async function listOwnerDealerMaintenanceScheduleNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const proposals = await listPendingOwnerDealerMaintenanceScheduleProposals(userId);
    return proposals.map((proposal) => ({
      id: `dealer-maintenance-schedule:${proposal.id}:${proposal.updatedAtIso}`,
      category: 'dealer_schedule',
      tone: 'warning',
      title: 'Dealer proposed a maintenance schedule',
      body: `${proposal.dealerName} proposed ${proposal.title} for ${proposal.assetTitle}. ${proposedScheduleDueText(proposal)}`,
      href: '',
      createdAtIso: proposal.createdAtIso,
      assetId: proposal.assetId,
      dealerMaintenanceScheduleProposalId: proposal.id,
      priority: true,
    } satisfies HeaderNotificationItem));
  } catch (error) {
    console.error('Failed to load dealer maintenance schedule notifications', error);
    return [];
  }
}

async function listOwnerDealerCostNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const [storageInvoices, deletionInvoices] = await Promise.all([
      listPendingOwnerDealerCosts(userId),
      listPendingOwnerDealerCostDeletions(userId),
    ]);
    const storageNotifications = storageInvoices.map((invoice) => {
      const dealerName = asText(invoice.createdByDisplayName) || 'A dealer';
      const supplier = asText(invoice.supplierName);
      const invoiceReference = asText(invoice.invoiceNumber);
      const costDetail = [
        formatCostAmount(invoice.totalIncVat),
        supplier ? `from ${supplier}` : '',
        invoiceReference ? `(invoice ${invoiceReference})` : '',
      ].filter(Boolean).join(' ');

      return {
        id: `dealer-cost:${invoice.id}:${invoice.updatedAtIso}`,
        category: 'dealer_cost',
        tone: 'warning',
        title: 'Dealer added an asset cost',
        body: `${dealerName} added ${costDetail || 'a cost'} for ${invoice.assetTitle}. View it and choose whether it must be stored in your Cost Ledger.`,
        href: '',
        createdAtIso: invoice.updatedAtIso || invoice.createdAtIso,
        assetId: invoice.assetId,
        dealerCostInvoiceId: invoice.id,
        dealerCostAction: 'store',
        priority: true,
      } satisfies HeaderNotificationItem;
    });
    const deletionNotifications = deletionInvoices.map((invoice) => {
      const dealerName = asText(invoice.createdByDisplayName) || 'A dealer';
      const supplier = asText(invoice.supplierName);
      const invoiceReference = asText(invoice.invoiceNumber);
      const costDetail = [
        formatCostAmount(invoice.totalIncVat),
        supplier ? `from ${supplier}` : '',
        invoiceReference ? `(invoice ${invoiceReference})` : '',
      ].filter(Boolean).join(' ');

      return {
        id: `dealer-cost-deletion:${invoice.id}:${invoice.dealerDeletionRequestedAtIso || invoice.updatedAtIso}`,
        category: 'dealer_cost',
        tone: 'warning',
        title: 'Dealer removed an asset cost',
        body: `${dealerName} removed ${costDetail || 'a cost'} for ${invoice.assetTitle}. Review it and choose whether to keep your copy in the Cost Ledger or delete it permanently.`,
        href: '',
        createdAtIso: invoice.dealerDeletionRequestedAtIso || invoice.updatedAtIso || invoice.createdAtIso,
        assetId: invoice.assetId,
        dealerCostInvoiceId: invoice.id,
        dealerCostAction: 'delete',
        priority: true,
      } satisfies HeaderNotificationItem;
    });

    return [...deletionNotifications, ...storageNotifications];
  } catch (error) {
    console.error('Failed to load dealer cost notifications', error);
    return [];
  }
}

async function listOwnerCaptureNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const requests = await listCaptureRequests({
      ownerUserId: userId,
      requestTypes: ['invoice'],
      statuses: ['awaiting_owner'],
      limit: 50,
    });

    return requests.map((request) => {
      const reference = request.assetReference || request.publicReference;
      return {
        id: `capture-owner:${request.id}`,
        category: 'capture',
        tone: 'warning',
        title: 'Captured invoice ready to review',
        body: `Aim4price captured ${reference || 'an invoice'} and needs your approval before it is saved to your Cost Ledger.`,
        href: `/my-invoices?captureRequestId=${encodeURIComponent(request.id)}`,
        createdAtIso: isoFallback(request.updatedAtIso || request.submittedAtIso),
        assetId: request.assetId || undefined,
        captureRequestId: request.id,
        priority: true,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load assisted capture notifications', error);
    return [];
  }
}

async function listOwnerRecurringMaintenanceNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const records = await listAssetMaintenanceRecords(userId, { status: 'upcoming' });

    return records
      .filter((record) => Boolean(record.generatedFromMaintenanceId))
      .filter((record) => isWithinDays(record.createdAtIso, RECENT_MAINTENANCE_DAYS))
      .map((record) => ({
        id: `maintenance-recurring:${record.id}`,
        category: 'maintenance',
        tone: 'warning',
        title: 'Next recurring maintenance',
        body: `${record.title} for ${record.assetTitle} was scheduled automatically. ${maintenanceDueText(record)}`,
        href: `/owner-app/assets/${encodeURIComponent(record.assetId)}/maintenance?maintenanceId=${encodeURIComponent(record.id)}`,
        createdAtIso: isoFallback(record.createdAtIso),
        assetId: record.assetId,
      } satisfies HeaderNotificationItem));
  } catch (error) {
    console.error('Failed to load recurring maintenance notifications', error);
    return [];
  }
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
        assetId: asText(row.asset_register_item_id),
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
            assetId: lead.assetRegisterItemId,
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
          assetId: lead.assetRegisterItemId,
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
        const shareOpportunity = isShareOpportunityLead(lead);
        const assetTitle = assetTitleFromLead(lead);
        const ownerMessage = truncateText(lead.ownerMessage, 96);
        const bodySuffix = ownerMessage ? ` Message: ${ownerMessage}` : '';

        return {
          id: `lead-partner:${lead.id}:${lead.status}:${lead.updatedAtIso}`,
          category: 'lead',
          tone: lead.status === 'sent' ? 'info' : leadTone(lead.status),
          title: lead.status === 'sent'
            ? shareOpportunity ? 'New opportunity' : 'New lead opportunity'
            : `${shareOpportunity ? 'Opportunity' : 'Lead'} ${leadStatusLabel(lead.status)}`,
          body: shareOpportunity
            ? `${owner} sent an opportunity for ${assetTitle}.${bodySuffix}`
            : `${owner} sent a ${typeLabel} opportunity for ${assetTitle}.${bodySuffix}`,
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

    return enquiries.map((enquiry) => {
      const licensingOffer = enquiry.requesterAccountType === 'licensing';
      const assetName = `${enquiry.asset.brand} ${enquiry.asset.model}`.trim();

      return {
        id: `asset-discovery-owner:${enquiry.id}:${enquiry.updatedAtIso}`,
        actionRequired: true,
        category: 'asset_discovery',
        tone: 'warning',
        title: licensingOffer ? 'Licence renewal help offered' : '#1 priority · Discovery enquiry',
        body: licensingOffer
          ? `A licence renewal expert offered to help with your ${assetName}${enquiry.asset.renewalWindow ? `, due ${enquiry.asset.renewalWindow}` : ''}.`
          : `Another user is looking for a machine like your ${assetName}. Interested in selling it?`,
        href: '',
        createdAtIso: isoFallback(enquiry.createdAtIso || enquiry.updatedAtIso),
        assetId: enquiry.assetId,
        assetDiscoveryEnquiryId: enquiry.id,
        priority: true,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load owner Discovery notifications', error);
    return [];
  }
}

async function listRequesterAssetDiscoveryNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const enquiries = await listRecentAssetDiscoveryEnquiriesForRequester(userId);

    return enquiries.map((enquiry) => {
      const approved = enquiry.status === 'approved';
      const licensingOffer = enquiry.requesterAccountType === 'licensing';
      const assetName = `${enquiry.asset.brand} ${enquiry.asset.model}`.trim();
      const retryDate = enquiry.status === 'temporarily_denied'
        && enquiry.requestAgainAtIso
        ? new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(enquiry.requestAgainAtIso))
        : '';

      return {
        id: `asset-discovery-requester:${enquiry.id}:${enquiry.status}:${enquiry.updatedAtIso}`,
        actionRequired: false,
        category: 'asset_discovery',
        tone: approved ? 'success' : 'warning',
        title: licensingOffer
          ? approved ? 'Renewal help approved' : 'Renewal help declined'
          : approved ? 'Asset enquiry approved' : 'Asset unavailable for 90 days',
        body: licensingOffer
          ? approved
            ? `The owner approved renewal help for ${assetName}. It is marked Won in Discovery.`
            : `The owner declined renewal help for ${assetName}. You cannot offer again for this asset.`
          : approved
            ? `Your enquiry for ${assetName} was approved.`
            : `The owner is not interested in selling ${assetName} right now.${retryDate ? ` You can enquire again after ${retryDate}.` : ''}`,
        href: '',
        createdAtIso: isoFallback(enquiry.updatedAtIso),
        assetDiscoveryEnquiryId: enquiry.id,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load requester Discovery notifications', error);
    return [];
  }
}

async function listMarketplaceSourcingNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  try {
    const requests = await listMarketplaceSourcingRequestNotifications(userId);

    return requests.map((request) => {
      const pending = request.status === 'pending';
      const requesterName = asText(request.requesterName) || 'An Aim4price user';
      const equipmentTitle = asText(request.title) || 'similar equipment';

      return {
        id: `marketplace-sourcing:${request.id}`,
        category: 'marketplace_sourcing',
        tone: pending ? 'warning' : 'info',
        title: pending ? 'New Marketplace sourcing request' : 'Marketplace sourcing request opened',
        body: `${requesterName} asked whether you can help source equipment similar to ${equipmentTitle}.`,
        href: `/marketplace/sourcing-requests/${encodeURIComponent(request.id)}`,
        createdAtIso: isoFallback(request.updatedAtIso || request.createdAtIso),
        marketplaceSourcingRequestId: request.id,
        priority: pending,
      } satisfies HeaderNotificationItem;
    });
  } catch (error) {
    console.error('Failed to load Marketplace sourcing request notifications', error);
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
        assetId: asText(row.asset_id),
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
          assetId: event.assetId || undefined,
        } satisfies HeaderNotificationItem;
      });
  } catch (error) {
    console.error('Failed to load fuel notifications', error);
    return [];
  }
}

export async function listComputedHeaderNotifications(input: ListHeaderNotificationsInput): Promise<HeaderNotificationItem[]> {
  const accountType = normalizeAccountType(input.accountType);
  const notificationGroups = accountType === 'owner'
    ? await Promise.all([
        listOwnerDealerAssetCorrectionNotifications(input.userId),
        listOwnerDealerMaintenanceScheduleNotifications(input.userId),
        listOwnerDealerCostNotifications(input.userId),
        listOwnerCaptureNotifications(input.userId),
        input.includeCostBudgetNotifications === false
          ? Promise.resolve([])
          : listOwnerCostBudgetNotifications(input.userId),
        listOpenPartnerNoteNotifications(input.userId),
        listOwnerLeadNotifications(input.userId),
        listOwnerAssetDiscoveryNotifications(input.userId),
        listRequesterAssetDiscoveryNotifications(input.userId),
        listMarketplaceSourcingNotifications(input.userId),
        listOwnerRecurringMaintenanceNotifications(input.userId),
        listQrScanNotifications(input.userId),
        listFuelNotifications(input.userId),
      ])
    : await Promise.all([
        listPartnerLeadNotifications(input.userId),
        accountType === 'dealer' || accountType === 'licensing'
          ? listRequesterAssetDiscoveryNotifications(input.userId)
          : Promise.resolve([]),
        accountType === 'dealer'
          ? listMarketplaceSourcingNotifications(input.userId)
          : Promise.resolve([]),
      ]);

  return notificationGroups
    .flat()
    .sort(
      (left, right) =>
        Number(Boolean(right.priority)) - Number(Boolean(left.priority)) ||
        toTime(right.createdAtIso) - toTime(left.createdAtIso),
    )
    .slice(0, MAX_COMPUTED_NOTIFICATIONS);
}

