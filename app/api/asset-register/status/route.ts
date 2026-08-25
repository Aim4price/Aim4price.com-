import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../../lib/admin-usage-events';
import { getServerSession, isAdminSupportSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { attachOpenPartnerNotesToAssets } from '../../../../lib/partner-access';
import { attachOpenIssueNoteStatusToAssets } from '../../../../lib/asset-issue-notes';
import { attachUpcomingMaintenanceAlertsToAssets } from '../../../../lib/asset-maintenance';
import { attachUpcomingLicenseRenewalAlertsToAssets } from '../../../../lib/asset-license-renewal';
import { attachLatestMaintenanceStatusToAssets } from '../../../../lib/scan-assets';
import {
  getAssetRegisterItemById,
  updateAssetRegisterItemStatusDetails,
} from '../../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
type FinanceStatusChoice = AssetStatusChoice | 'paid';
type StatusSection = 'finance' | 'insurance' | 'license';

type StatusRequestBody = {
  assetId?: unknown;
  section?: unknown;
  financeStatus?: unknown;
  financeType?: unknown;
  financeCurrentOutstandingExVat?: unknown;
  financierName?: unknown;
  financeNote?: unknown;
  financeBoughtWhen?: unknown;
  financeBoughtForExVat?: unknown;
  financeOriginalAmountExVat?: unknown;
  financeMonthlyPaymentExVat?: unknown;
  financeInterestRatePercent?: unknown;
  financeTermMonths?: unknown;
  financeBalloonPaymentExVat?: unknown;
  financeSettlementDate?: unknown;
  financeReferenceNumber?: unknown;
  insuranceStatus?: unknown;
  insuredValueExVat?: unknown;
  insuranceInsurerName?: unknown;
  insurancePolicyNumber?: unknown;
  insuranceRenewalDate?: unknown;
  insuranceNote?: unknown;
  licenseStatus?: unknown;
  licenseRegistrationNumber?: unknown;
  licenseRenewalDate?: unknown;
  licenseNote?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function getUsageUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user?.id || isAdminSupportSession(session)) {
    return null;
  }

  return session.user.id;
}

async function requireAssetRegisterAccount(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Asset Register is available to active Owner accounts and authorised Dealer inventory staff.',
      },
      { status: 403 },
    );
  }

  return null;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeSection(value: unknown): StatusSection | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'finance' || normalized === 'insurance' || normalized === 'license') {
    return normalized;
  }

  return null;
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = 'unknown'): AssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced', 'is_financed', 'is_insured', 'is_licensed'].includes(normalized)) {
    return 'yes';
  }

  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) {
    return 'no';
  }

  if (['na', 'n_a', 'not_applicable', 'not_aplicable', 'not_relevant', 'does_not_apply'].includes(normalized)) {
    return 'not_applicable';
  }

  if (['unknown', 'not_sure', 'unsure', 'maybe', ''].includes(normalized)) {
    return normalized ? 'unknown' : fallback;
  }

  return fallback;
}

function normalizeFinanceStatusChoice(value: unknown, fallback: FinanceStatusChoice = 'unknown'): FinanceStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['paid', 'paid_off', 'settled', 'settled_in_full', 'fully_paid'].includes(normalized)) return 'paid';
  return normalizeAssetStatusChoice(value, fallback === 'paid' ? 'unknown' : fallback);
}

function normalizeOptionalText(value: unknown, maxLength = 240): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeOptionalDate(value: unknown, label = 'Date'): string {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const match = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (!match) throw new Error(`${label} must be a valid date.`);

  const [year, month, day] = match[1].split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1000 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a valid date.`);
  }

  return match[1];
}

function normalizeOptionalMoney(value: unknown, label: string): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const numeric = typeof value === 'number'
    ? value
    : Number(String(value).trim().replace(/[^0-9.-]/g, ''));

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} must be a valid amount.`);
  }

  return Math.round(numeric);
}

function normalizeOptionalNumber(value: unknown, label: string): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const numeric = typeof value === 'number'
    ? value
    : Number(String(value).trim().replace(/[^0-9.-]/g, ''));

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} must be a valid number.`);
  }

  return numeric;
}

function normalizeOptionalWholeNumber(value: unknown, label: string): number | null {
  const numeric = normalizeOptionalNumber(value, label);
  if (numeric === null) return null;

  const rounded = Math.round(numeric);
  if (Math.abs(rounded - numeric) > 0.000001) {
    throw new Error(`${label} must be a whole number.`);
  }

  return rounded;
}

function normalizeFinanceType(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized === 'asset_specific' || normalized === 'asset_specific_finance') return 'asset_specific';
  if (normalized === 'bulk_group' || normalized === 'bulk' || normalized === 'group' || normalized === 'group_finance') return 'bulk_group';
  if (normalized === 'unknown' || normalized === 'not_sure' || normalized === 'unsure') return 'unknown';

  return null;
}

function normalizeLicenseRegistrationNumber(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 80);
}

function applyPair(target: Record<string, unknown>, camelKey: string, snakeKey: string, value: unknown): void {
  target[camelKey] = value;
  target[snakeKey] = value;
}

function buildFinanceSpecsUpdate(body: StatusRequestBody, financeStatus: FinanceStatusChoice): Record<string, unknown> {
  const isFinanced = financeStatus === 'yes';
  const hasFinanceHistory = isFinanced || financeStatus === 'paid';
  const financeType = hasFinanceHistory ? normalizeFinanceType(body.financeType) : null;
  const currentOutstanding = isFinanced ? normalizeOptionalMoney(body.financeCurrentOutstandingExVat, 'Current outstanding amount') : null;
  const boughtFor = normalizeOptionalMoney(body.financeBoughtForExVat, 'Acquisition amount');
  const originalAmount = hasFinanceHistory ? normalizeOptionalMoney(body.financeOriginalAmountExVat, 'Original financed amount') : null;
  const monthlyPayment = hasFinanceHistory ? normalizeOptionalMoney(body.financeMonthlyPaymentExVat, 'Monthly payment') : null;
  const balloonPayment = hasFinanceHistory ? normalizeOptionalMoney(body.financeBalloonPaymentExVat, 'Balloon / residual amount') : null;
  const interestRate = hasFinanceHistory ? normalizeOptionalNumber(body.financeInterestRatePercent, 'Interest rate') : null;
  const termMonths = hasFinanceHistory ? normalizeOptionalWholeNumber(body.financeTermMonths, 'Finance term months') : null;
  const financierName = hasFinanceHistory ? normalizeOptionalText(body.financierName) : '';
  const financeNote = hasFinanceHistory ? normalizeOptionalText(body.financeNote, 1000) : '';
  const boughtWhen = normalizeOptionalDate(body.financeBoughtWhen, 'Acquisition date');
  const settlementDate = hasFinanceHistory ? normalizeOptionalDate(body.financeSettlementDate, 'Settlement date') : '';
  const referenceNumber = hasFinanceHistory ? normalizeOptionalText(body.financeReferenceNumber) : '';

  const specs: Record<string, unknown> = {};

  applyPair(specs, 'financeStatus', 'finance_status', financeStatus);
  applyPair(specs, 'financeType', 'finance_type', financeType);
  applyPair(specs, 'financeCurrentOutstandingExVat', 'finance_current_outstanding_ex_vat', currentOutstanding);
  applyPair(specs, 'financierName', 'financier_name', financierName);
  applyPair(specs, 'financeNote', 'finance_note', financeNote);
  applyPair(specs, 'financeBoughtWhen', 'finance_bought_when', boughtWhen);
  applyPair(specs, 'financeBoughtForExVat', 'finance_bought_for_ex_vat', boughtFor);
  applyPair(specs, 'financeOriginalAmountExVat', 'finance_original_amount_ex_vat', originalAmount);
  applyPair(specs, 'financeMonthlyPaymentExVat', 'finance_monthly_payment_ex_vat', monthlyPayment);
  applyPair(specs, 'financeInterestRatePercent', 'finance_interest_rate_percent', interestRate);
  applyPair(specs, 'financeTermMonths', 'finance_term_months', termMonths);
  applyPair(specs, 'financeBalloonPaymentExVat', 'finance_balloon_payment_ex_vat', balloonPayment);
  applyPair(specs, 'financeSettlementDate', 'finance_settlement_date', settlementDate);
  applyPair(specs, 'financeReferenceNumber', 'finance_reference_number', referenceNumber);

  return specs;
}

function buildInsuranceSpecsUpdate(body: StatusRequestBody, insuranceStatus: AssetStatusChoice): Record<string, unknown> {
  const isInsured = insuranceStatus === 'yes';
  const insuredValue = isInsured ? normalizeOptionalMoney(body.insuredValueExVat, 'Insured amount') : null;
  const insurerName = isInsured ? normalizeOptionalText(body.insuranceInsurerName) : '';
  const policyNumber = isInsured ? normalizeOptionalText(body.insurancePolicyNumber) : '';
  const renewalDate = isInsured ? normalizeOptionalDate(body.insuranceRenewalDate, 'Insurance renewal date') : '';
  const insuranceNote = isInsured ? normalizeOptionalText(body.insuranceNote, 1000) : '';
  const specs: Record<string, unknown> = {};

  applyPair(specs, 'insuranceStatus', 'insurance_status', insuranceStatus);
  applyPair(specs, 'insuredStatus', 'insured_status', insuranceStatus);
  applyPair(specs, 'insuredValueExVat', 'insured_value_ex_vat', insuredValue);
  applyPair(specs, 'insuranceValueExVat', 'insurance_value_ex_vat', insuredValue);
  applyPair(specs, 'insuredValue', 'insured_value', insuredValue);
  applyPair(specs, 'insuranceValue', 'insurance_value', insuredValue);
  applyPair(specs, 'insuranceInsurerName', 'insurance_insurer_name', insurerName);
  applyPair(specs, 'insurancePolicyNumber', 'insurance_policy_number', policyNumber);
  applyPair(specs, 'insuranceRenewalDate', 'insurance_renewal_date', renewalDate);
  applyPair(specs, 'insuranceNote', 'insurance_note', insuranceNote);
  applyPair(specs, 'insuredNote', 'insured_note', insuranceNote);

  return specs;
}

function buildLicenseSpecsUpdate(body: StatusRequestBody, licenseStatus: AssetStatusChoice, isPropertyAsset: boolean): Record<string, unknown> {
  const resolvedStatus: AssetStatusChoice = isPropertyAsset ? 'not_applicable' : licenseStatus;
  const isLicensed = resolvedStatus === 'yes';
  const registrationNumber = isLicensed ? normalizeLicenseRegistrationNumber(body.licenseRegistrationNumber) : '';
  const renewalDate = isLicensed ? normalizeOptionalDate(body.licenseRenewalDate, 'License renewal date') : '';
  const licenseNote = isLicensed ? normalizeOptionalText(body.licenseNote, 1000) : '';

  const specs: Record<string, unknown> = {};

  applyPair(specs, 'licenseStatus', 'license_status', resolvedStatus);
  applyPair(specs, 'licensedStatus', 'licensed_status', resolvedStatus);
  applyPair(specs, 'licenceStatus', 'licence_status', resolvedStatus);
  applyPair(specs, 'licencedStatus', 'licenced_status', resolvedStatus);
  applyPair(specs, 'licenseRegistrationNumber', 'license_registration_number', registrationNumber);
  applyPair(specs, 'licenceRegistrationNumber', 'licence_registration_number', registrationNumber);
  applyPair(specs, 'registrationNumber', 'registration_number', registrationNumber);
  applyPair(specs, 'numberPlate', 'number_plate', registrationNumber);
  applyPair(specs, 'licenseRenewalDate', 'license_renewal_date', renewalDate);
  applyPair(specs, 'licenseNote', 'license_note', licenseNote);

  specs.licenseRegistration = registrationNumber;
  specs.license_registration = registrationNumber;

  return specs;
}

function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message && !error.message.includes('duplicate key') && !error.message.includes('violates')) {
    return error.message;
  }

  return fallback;
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  const rawBody = (await request.json().catch(() => null)) as unknown;
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? rawBody as StatusRequestBody
    : null;

  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const assetId = String(body.assetId ?? '').trim();
  const section = normalizeSection(body.section);

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  if (!section) {
    return NextResponse.json({ ok: false, error: 'Valid status section is required.' }, { status: 400 });
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  try {
    const isPropertyAsset = existing.kind === 'property';
    let item: Awaited<ReturnType<typeof updateAssetRegisterItemStatusDetails>>;
    let statusMetadata: Record<string, unknown> = { assetId, section };

    if (section === 'finance') {
      const financeStatus = normalizeFinanceStatusChoice(body.financeStatus, existing.isFinanced ? 'yes' : 'unknown');
      const specsJson = buildFinanceSpecsUpdate(body, financeStatus);

      item = await updateAssetRegisterItemStatusDetails(session.user.id, {
        assetId,
        isFinanced: financeStatus === 'yes',
        financeNote: ['yes', 'paid'].includes(financeStatus) ? normalizeOptionalText(body.financeNote, 1000) : null,
        specsJson,
      });
      statusMetadata = { ...statusMetadata, financeStatus };
    } else if (section === 'insurance') {
      const insuranceStatus = normalizeAssetStatusChoice(body.insuranceStatus, existing.isInsured ? 'yes' : 'unknown');
      const insuredValueExVat = insuranceStatus === 'yes'
        ? normalizeOptionalMoney(body.insuredValueExVat, 'Insured amount')
        : null;
      const specsJson = buildInsuranceSpecsUpdate(body, insuranceStatus);

      item = await updateAssetRegisterItemStatusDetails(session.user.id, {
        assetId,
        isInsured: insuranceStatus === 'yes',
        insuredValueExVat,
        specsJson,
      });
      statusMetadata = { ...statusMetadata, insuranceStatus };
    } else {
      const requestedLicenseStatus = normalizeAssetStatusChoice(body.licenseStatus, existing.isLicensed ? 'yes' : 'unknown');
      const licenseStatus: AssetStatusChoice = isPropertyAsset ? 'not_applicable' : requestedLicenseStatus;
      const licenseRegistrationNumber = licenseStatus === 'yes'
        ? normalizeLicenseRegistrationNumber(body.licenseRegistrationNumber)
        : '';
      const specsJson = buildLicenseSpecsUpdate(body, licenseStatus, isPropertyAsset);

      item = await updateAssetRegisterItemStatusDetails(session.user.id, {
        assetId,
        isLicensed: licenseStatus === 'yes',
        licenseRegistrationNumber,
        specsJson,
      });
      statusMetadata = { ...statusMetadata, licenseStatus };
    }

    const itemsWithPartnerNotes = await attachOpenPartnerNotesToAssets(session.user.id, [item]);
    const itemsWithScheduledMaintenance = await attachUpcomingMaintenanceAlertsToAssets(session.user.id, itemsWithPartnerNotes);
    const itemsWithLicenseRenewals = await attachUpcomingLicenseRenewalAlertsToAssets(session.user.id, itemsWithScheduledMaintenance);
    const itemsWithMaintenanceStatus = await attachLatestMaintenanceStatusToAssets(itemsWithLicenseRenewals);
    const itemsWithIssueNotes = await attachOpenIssueNoteStatusToAssets(itemsWithMaintenanceStatus);
    const itemWithAlerts = itemsWithIssueNotes[0] ?? item;

    const usageUserId = getUsageUserId(session);
    if (usageUserId) {
      await recordAdminUsageEventSafely({
        userId: usageUserId,
        eventType: 'asset_updated',
        eventSource: 'asset-register-status',
        metadata: statusMetadata,
      });
    }

    return NextResponse.json({ ok: true, item: itemWithAlerts });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && /must be a valid|must be a whole/.test(error.message)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    console.error('asset register status PATCH failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to update asset status.') },
      { status: 500 },
    );
  }
}
