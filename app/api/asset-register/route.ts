import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../lib/admin-usage-events';
import { getServerSession, isAdminSupportSession } from '../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../lib/asset-register-account-access';
import { listAssetGroups } from '../../../lib/asset-groups';
import { projectAssetGroupsToAssets, registerValueForAssets } from '../../../lib/asset-groups-shared';
import { disposeOrDeleteAsset, recordManualAssetLifecycle, type AssetDisposalReason } from '../../../lib/asset-lifecycle';
import { attachOpenPartnerNotesToAssets } from '../../../lib/partner-access';
import { attachOpenIssueNoteStatusToAssets } from '../../../lib/asset-issue-notes';
import { attachLatestMaintenanceStatusToAssets } from '../../../lib/scan-assets';
import { attachUpcomingMaintenanceAlertsToAssets } from '../../../lib/asset-maintenance';
import { attachUpcomingLicenseRenewalAlertsToAssets } from '../../../lib/asset-license-renewal';
import {
  normalizeAssetDocumentCategory,
  normalizeAssetDocumentType,
} from '../../../lib/asset-document-permissions';
import { resolveOwnerWorkspaceContext } from '../../../lib/owner-workspace-access';
import {
  listOwnerAssetCorrectionAlerts,
  type DealerAssetCorrectionRequest,
} from '../../../lib/dealer-asset-corrections';
import {
  getAssetRegisterForUser,
  getSelectedAssetRegister,
  listAssetRegisters,
} from '../../../lib/asset-registers';
import {
  deleteUnreferencedAssetRegisterUploads,
  listInternalAssetRegisterUploadIds,
  MAX_ASSET_REGISTER_PHOTOS,
  MAX_ASSET_REGISTER_DOCUMENTS,
} from '../../../lib/asset-register-uploads';
import {
  createManualAssetRegisterItem,
  getAssetRegisterItemById,
  listAssetRegisterItems,
  updateAssetRegisterItem,
  updateAssetRegisterItemFlag,
  updateAssetRegisterItemMedia,
  updateAssetRegisterItemYearModel,
  type AssetRegisterDocument,
  type AssetRegisterItemKind,
  type CreateManualAssetInput,
  type UpdateAssetRegisterItemInput,
} from '../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIFETIME_PERCENT_SETTINGS_ERROR =
  'The new lifetime worked percentage cannot be lower than the percentage already saved on this asset. Please go to Settings to override this.';
const USAGE_READING_SETTINGS_ERROR =
  'The new usage reading cannot be lower than the reading already saved on this asset. Please go to Settings to override this.';

type ErrorLike = {
  message?: unknown;
  detail?: unknown;
  hint?: unknown;
  code?: unknown;
  table?: unknown;
  column?: unknown;
  constraint?: unknown;
};

type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function getUsageUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user?.id || isAdminSupportSession(session)) {
    return null;
  }

  return session.user.id;
}


async function attachOpenAssetAlerts<T extends { id: string }>(
  ownerUserId: string,
  items: T[],
): Promise<Array<T & {
  openPartnerNote: unknown;
  maintenanceAlert: unknown;
  licenseRenewalAlert: unknown;
  latestMaintenanceStatus: unknown;
  latestIssueNoteStatus: unknown;
  dealerAssetCorrection: DealerAssetCorrectionRequest | null;
}>> {
  const itemsWithPartnerNotes = await attachOpenPartnerNotesToAssets(ownerUserId, items);
  const itemsWithScheduledMaintenance = await attachUpcomingMaintenanceAlertsToAssets(ownerUserId, itemsWithPartnerNotes);
  const itemsWithLicenseRenewals = await attachUpcomingLicenseRenewalAlertsToAssets(ownerUserId, itemsWithScheduledMaintenance);
  const itemsWithMaintenanceStatus = await attachLatestMaintenanceStatusToAssets(itemsWithLicenseRenewals);
  const itemsWithIssueStatus = await attachOpenIssueNoteStatusToAssets(itemsWithMaintenanceStatus);
  const corrections = await listOwnerAssetCorrectionAlerts(ownerUserId, items.map((item) => item.id));
  const correctionByAssetId = new Map(corrections.map((correction) => [correction.assetId, correction]));

  return itemsWithIssueStatus.map((item) => ({
    ...item,
    dealerAssetCorrection: correctionByAssetId.get(item.id) ?? null,
  }));
}

async function requireAssetRegisterAccount(session: Awaited<ReturnType<typeof getServerSession>>) {
  const access = await getAssetRegisterAccountAccess(session);

  if (!access) {
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

function normalizeKind(value: unknown): AssetRegisterItemKind {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'tractor') return 'tractor';
  if (normalized === 'equipment' || normalized === 'valued equipment') return 'equipment';
  if (normalized === 'property') return 'property';
  if (normalized === 'vehicle') return 'vehicle';
  if (normalized === 'tool' || normalized === 'tools') return 'tools';
  if (normalized === 'stock' || normalized === 'inventory') return 'stock';
  return 'manual';
}

function normalizeLicenseRegistrationNumber(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function normalizeHours(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const numeric = Number(text);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric);
}


function normalizeReplacementPrice(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const numeric = Number(text.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric);
}

function normalizeYearModel(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const year = Math.round(numeric);
  if (year < 1800 || year > new Date().getFullYear() + 1) {
    return null;
  }

  return year;
}

type YearModelPatchParseResult =
  | { ok: true; yearModel: number | null }
  | { ok: false; error: string };

function parseYearModelPatchValue(value: unknown, yearModelUnknownValue: unknown): YearModelPatchParseResult {
  if (normalizeBooleanFlag(yearModelUnknownValue)) {
    return { ok: true, yearModel: null };
  }

  if (value === null || typeof value === 'undefined') {
    return { ok: true, yearModel: null };
  }

  const text = String(value).trim();
  if (!text) {
    return { ok: true, yearModel: null };
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    return { ok: false, error: 'Enter a valid year model.' };
  }

  const year = Math.round(numeric);
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1800 || year > maxYear) {
    return { ok: false, error: `Year model must be between 1800 and ${maxYear}.` };
  }

  return { ok: true, yearModel: year };
}

function normalizeUsageMetric(value: unknown): 'hours' | 'km' | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') {
    return 'hours';
  }

  return null;
}

function normalizeBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on' || normalized === 'flagged';
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

function readInsuranceStatusFromSpecs(specs: Record<string, unknown>, fallback: AssetStatusChoice): AssetStatusChoice {
  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    fallback,
  );
}

const INSURED_VALUE_SPEC_KEYS = [
  'insuredValueExVat',
  'insured_value_ex_vat',
  'insuranceValueExVat',
  'insurance_value_ex_vat',
  'insuredValue',
  'insured_value',
  'insuranceValue',
  'insurance_value',
] as const;

function normalizeLifeWorkedPercent(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return null;
  }

  return Math.round(numeric * 10) / 10;
}

function readLifeWorkedPercentFromSpecs(specs: Record<string, unknown>): number | null {
  return (
    normalizeLifeWorkedPercent(specs.life_worked_percent) ??
    normalizeLifeWorkedPercent(specs.worked_percent) ??
    normalizeLifeWorkedPercent(specs.lifetime_worked_percent) ??
    normalizeLifeWorkedPercent(specs.percent_worked) ??
    normalizeLifeWorkedPercent(specs.lifetime_used_percent)
  );
}

function normalizeSpecsJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function replacementPriceNotApplicable(
  kind: AssetRegisterItemKind,
  specs: Record<string, unknown>,
): boolean {
  const explicitFlag = String(
    specs.replacementPriceNotApplicable ?? specs.replacement_price_not_applicable ?? '',
  ).trim().toLowerCase();
  const propertySubtype = String(
    specs.propertyAssetSubtype ?? specs.property_asset_subtype ?? '',
  ).trim().toLowerCase();

  return explicitFlag === 'true' || kind === 'stock' || (kind === 'property' && propertySubtype === 'land');
}

function buildManualSpecsJson(
  value: unknown,
  usageMetric: 'hours' | 'km' | null,
  lifeWorkedPercent: number | null,
  replacementPriceExVat: number | null = null,
  insuredValueExVat: number | null = null,
  brandName = '',
  modelName = '',
): Record<string, unknown> {
  const specs = normalizeSpecsJson(value);
  const resolvedLifeWorkedPercent = lifeWorkedPercent ?? readLifeWorkedPercentFromSpecs(specs);
  const cleanBrandName = String(brandName ?? '').trim();
  const cleanModelName = String(modelName ?? '').trim();
  const insuranceStatus = readInsuranceStatusFromSpecs(
    specs,
    insuredValueExVat !== null ? 'yes' : 'no',
  );
  const insuredValueForSave = insuranceStatus === 'yes' ? insuredValueExVat : null;

  if (insuredValueForSave === null) {
    for (const key of INSURED_VALUE_SPEC_KEYS) {
      delete specs[key];
    }
  }

  return {
    ...specs,
    insuranceStatus,
    insurance_status: insuranceStatus,
    insuredStatus: insuranceStatus,
    insured_status: insuranceStatus,
    ...(usageMetric
      ? {
          usageMetric,
          usage_metric: usageMetric,
          usage_unit: usageMetric,
        }
      : {}),
    ...(resolvedLifeWorkedPercent !== null
      ? {
          life_worked_percent: resolvedLifeWorkedPercent,
          worked_percent: resolvedLifeWorkedPercent,
          percent_worked: resolvedLifeWorkedPercent,
          lifetime_worked_percent: resolvedLifeWorkedPercent,
        }
      : {}),
    ...(cleanBrandName
      ? {
          brandName: cleanBrandName,
          brand_name: cleanBrandName,
          brand: cleanBrandName,
        }
      : {}),
    ...(cleanModelName
      ? {
          modelName: cleanModelName,
          model_name: cleanModelName,
          model: cleanModelName,
          typedModelName: cleanModelName,
          typed_model_name: cleanModelName,
        }
      : {}),
    ...(insuredValueForSave !== null
      ? {
          insuredValueExVat: insuredValueForSave,
          insured_value_ex_vat: insuredValueForSave,
          insuranceValueExVat: insuredValueForSave,
          insurance_value_ex_vat: insuredValueForSave,
          insuredValue: insuredValueForSave,
          insured_value: insuredValueForSave,
          insuranceValue: insuredValueForSave,
          insurance_value: insuredValueForSave,
        }
      : {}),
    ...(replacementPriceExVat !== null
      ? {
          replacementPriceExVat,
          replacement_price_ex_vat: replacementPriceExVat,
          replacementPrice: replacementPriceExVat,
          replacement_price: replacementPriceExVat,
          replacementPriceUsedExVat: replacementPriceExVat,
          replacement_price_used_ex_vat: replacementPriceExVat,
          userReplacementPriceExVat: replacementPriceExVat,
          user_replacement_price_ex_vat: replacementPriceExVat,
          officialReplacementPriceExVat: replacementPriceExVat,
          official_replacement_price_ex_vat: replacementPriceExVat,
          replacementPriceBasis: 'user',
          replacement_price_basis: 'user',
        }
      : {}),
  };
}

function normalizeCondition(value: unknown): UpdateAssetRegisterItemInput['condition'] {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') {
    return 'serious';
  }

  if (normalized === 'good') return 'good';
  return null;
}

function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    })
    .slice(0, MAX_ASSET_REGISTER_PHOTOS);
}


function normalizeDocuments(value: unknown): AssetRegisterDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const documents: AssetRegisterDocument[] = [];

  value.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const url = String(record.url ?? '').trim();
    const fileName = String(record.fileName ?? record.name ?? '').trim();

    if (!url) {
      return;
    }

    const document: AssetRegisterDocument = {
      id: String(record.id ?? record.uploadId ?? url).trim() || url,
      url,
      fileName: fileName || `Document ${index + 1}`,
      contentType: String(record.contentType ?? record.mimeType ?? 'application/octet-stream').trim() || 'application/octet-stream',
      byteSize: Math.max(0, Math.round(Number(record.byteSize ?? record.sizeBytes ?? 0) || 0)),
      uploadedAtIso: String(record.uploadedAtIso ?? record.uploadedAt ?? '').trim() || new Date().toISOString(),
      category: normalizeAssetDocumentCategory(record.category ?? record.documentCategory),
      documentType: normalizeAssetDocumentType(record.documentType ?? record.type),
    };

    const duplicateKey = document.url || document.id;
    if (seen.has(duplicateKey)) {
      return;
    }

    seen.add(duplicateKey);
    documents.push(document);
  });

  return documents.slice(0, MAX_ASSET_REGISTER_DOCUMENTS);
}

function documentUrls(documents: AssetRegisterDocument[]): string[] {
  return documents.map((document) => String(document.url ?? '').trim()).filter(Boolean);
}

function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const details = error as ErrorLike;
    return [
      error.message,
      typeof details.detail === 'string' ? details.detail : '',
      typeof details.hint === 'string' ? `hint: ${details.hint}` : '',
      typeof details.column === 'string' ? `column: ${details.column}` : '',
      typeof details.table === 'string' ? `table: ${details.table}` : '',
      typeof details.constraint === 'string' ? `constraint: ${details.constraint}` : '',
      typeof details.code === 'string' ? `code: ${details.code}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  if (typeof error === 'object' && error !== null) {
    const details = error as ErrorLike;
    const parts = [
      typeof details.message === 'string' ? details.message : '',
      typeof details.detail === 'string' ? details.detail : '',
      typeof details.hint === 'string' ? `hint: ${details.hint}` : '',
      typeof details.column === 'string' ? `column: ${details.column}` : '',
      typeof details.table === 'string' ? `table: ${details.table}` : '',
      typeof details.constraint === 'string' ? `constraint: ${details.constraint}` : '',
      typeof details.code === 'string' ? `code: ${details.code}` : '',
    ].filter(Boolean);

    if (parts.length) {
      return parts.join(' | ');
    }
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const ownerError = await requireAssetRegisterAccount(session);
    if (ownerError) return ownerError;

    const { searchParams } = new URL(request.url);
    const scope = String(searchParams.get('scope') ?? '').trim().toLowerCase();
    if (scope === 'combined') {
      const registers = await listAssetRegisters(session.user.id);
      if (!registers.length) {
        return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
      }

      const itemGroups = await Promise.all(registers.map(async (sourceRegister) => {
        const registerItems = await listAssetRegisterItems(session.user.id, sourceRegister.id);
        return registerItems.map((item) => ({
          ...item,
          registerId: item.registerId || sourceRegister.id,
          registerName: sourceRegister.businessName,
        }));
      }));
      const baseItems = itemGroups.flat();
      const items = await attachOpenAssetAlerts(session.user.id, baseItems);
      const groups = await listAssetGroups(session.user.id);
      const combinedValue = registerValueForAssets(items, projectAssetGroupsToAssets(groups, items));
      const combinedRegister = {
        id: '__combined_asset_registers__',
        userId: session.user.id,
        businessName: 'Combined Asset Registers',
        email: '',
        phone: '',
        addressLine1: 'All asset registers on this account',
        logoUrls: [],
        showLogosOnRegister: false,
        isPrimary: false,
        isSelected: false,
        assetCount: items.length,
        totalValue: combinedValue,
        totalReplacementPrice: items.reduce((sum, item) => sum + Number(item.replacementPriceExVat || 0), 0),
        createdAtIso: registers[0]?.createdAtIso ?? new Date().toISOString(),
        updatedAtIso: registers.reduce(
          (latest, entry) => entry.updatedAtIso > latest ? entry.updatedAtIso : latest,
          registers[0]?.updatedAtIso ?? new Date().toISOString(),
        ),
      };

      return NextResponse.json({
        ok: true,
        register: combinedRegister,
        registers,
        items,
        groups,
        summary: {
          count: items.length,
          totalValue: combinedRegister.totalValue,
        },
      });
    }

    const requestedRegisterId = String(searchParams.get('registerId') ?? '').trim();
    const register = requestedRegisterId
      ? await getAssetRegisterForUser(session.user.id, requestedRegisterId)
      : await getSelectedAssetRegister(session.user.id);

    if (!register) {
      return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }

    const baseItems = await listAssetRegisterItems(session.user.id, register.id);
    const items = await attachOpenAssetAlerts(session.user.id, baseItems);
    const [registers, groups] = await Promise.all([
      listAssetRegisters(session.user.id),
      listAssetGroups(session.user.id, register.id),
    ]);

    return NextResponse.json({
      ok: true,
      register,
      registers,
      items,
      groups,
      summary: {
        count: items.length,
        totalValue: registerValueForAssets(items, projectAssetGroupsToAssets(groups, items)),
      },
    });
  } catch (error) {
    console.error('asset register GET failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to load asset register.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const workspace = await resolveOwnerWorkspaceContext(request);
  if (!workspace.ok) return workspace.response;
  if (!workspace.context.accountantAccess) {
    const ownerError = await requireAssetRegisterAccount(session);
    if (ownerError) return ownerError;
  }
  const ownerUserId = workspace.context.ownerUserId;

  const body = (await request.json()) as Partial<CreateManualAssetInput>;
  const kind = normalizeKind(body.kind);
  const title = String(body.title ?? '').trim();
  const value = Math.round(Number(body.value) || 0);
  const usageMetric = normalizeUsageMetric(body.usageMetric);
  const licenseRegistrationNumber = Boolean(body.isLicensed)
    ? normalizeLicenseRegistrationNumber((body as { licenseRegistrationNumber?: unknown }).licenseRegistrationNumber)
    : null;
  const lifeWorkedPercent = normalizeLifeWorkedPercent((body as { lifeWorkedPercent?: unknown }).lifeWorkedPercent);
  const replacementPriceExVat = normalizeReplacementPrice(
    (body as { replacementPriceExVat?: unknown; replacementPrice?: unknown }).replacementPriceExVat ??
      (body as { replacementPrice?: unknown }).replacementPrice,
  );
  const insuredValueExVat = normalizeReplacementPrice(
    (body as { insuredValueExVat?: unknown; insuredValue?: unknown; insuranceValue?: unknown }).insuredValueExVat ??
      (body as { insuredValue?: unknown; insuranceValue?: unknown }).insuredValue ??
      (body as { insuranceValue?: unknown }).insuranceValue,
  );
  const brandName = String((body as { brandName?: unknown }).brandName ?? '').trim();
  const modelName = String((body as { modelName?: unknown }).modelName ?? '').trim();
  const normalizedSpecsJson = normalizeSpecsJson(body.specsJson);
  const insuranceStatus = readInsuranceStatusFromSpecs(
    normalizedSpecsJson,
    Boolean(body.isInsured) || insuredValueExVat !== null ? 'yes' : 'no',
  );
  const specsJsonWithInsuranceStatus = {
    ...normalizedSpecsJson,
    insuranceStatus,
    insurance_status: insuranceStatus,
    insuredStatus: insuranceStatus,
    insured_status: insuranceStatus,
  };
  const insuredValueForSave = insuranceStatus === 'yes' ? insuredValueExVat : null;

  if (!title || value <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'title and value are required.',
      },
      { status: 400 },
    );
  }

  if (replacementPriceExVat === null && !replacementPriceNotApplicable(kind, normalizedSpecsJson)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Replacement price is required and must be greater than zero.',
      },
      { status: 400 },
    );
  }

  try {
    const item = await createManualAssetRegisterItem(ownerUserId, {
      registerId: String((body as { registerId?: unknown }).registerId ?? '').trim() || null,
      kind,
      title,
      value,
      note: body.note ?? null,
      serialNumber: body.serialNumber ?? null,
      brandName,
      modelName,
      isFinanced: Boolean(body.isFinanced),
      isInsured: insuranceStatus === 'yes',
      insuredValueExVat: insuredValueForSave,
      isLicensed: Boolean(body.isLicensed),
      licenseRegistrationNumber,
      financeNote: body.financeNote ?? null,
      photos: normalizePhotos(body.photos),
      documents: normalizeDocuments(body.documents),
      yearModel: normalizeYearModel(body.yearModel),
      hours: normalizeHours(body.hours),
      usageMetric,
      lifeWorkedPercent,
      replacementPriceExVat,
      specsJson: buildManualSpecsJson(specsJsonWithInsuranceStatus, usageMetric, lifeWorkedPercent, replacementPriceExVat, insuredValueForSave, brandName, modelName),
      condition: normalizeCondition(body.condition),
    });

    const usageUserId = getUsageUserId(session);
    if (usageUserId) {
      await recordAdminUsageEventSafely({
        userId: usageUserId,
        eventType: 'asset_saved',
        eventSource: 'asset-register',
        metadata: { assetId: item.id, kind: item.kind, selectedMethod: 'manual' },
      });
    }

    await recordManualAssetLifecycle({
      ownerUserId,
      asset: item,
      newlyAcquired: (body as { newlyAcquired?: unknown }).newlyAcquired === true,
      acquisitionDate: (body as { acquisitionDate?: unknown }).acquisitionDate,
      acquisitionAmountExVat: (body as { acquisitionAmountExVat?: unknown }).acquisitionAmountExVat,
      note: (body as { acquisitionNote?: unknown }).acquisitionNote,
      sourceDocumentReference:
        (body as { acquisitionSourceDocumentReference?: unknown }).acquisitionSourceDocumentReference
        ?? (body as { acquisitionSourceReference?: unknown }).acquisitionSourceReference,
      actorName: session.user.name,
    });

    const [itemWithAlertStatus] = await attachOpenAssetAlerts(ownerUserId, [item]);
    return NextResponse.json({ ok: true, item: itemWithAlertStatus ?? item });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_REGISTER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'REPLACEMENT_PRICE_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Replacement price is required and must be greater than zero.' }, { status: 400 });
    }

    console.error('asset register POST failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to create asset.') },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  const body = (await request.json()) as Partial<UpdateAssetRegisterItemInput>;
  const assetId = String(body.assetId ?? '').trim();
  const title = String(body.title ?? '').trim();
  const value = Math.round(Number(body.value) || 0);
  const usageMetric = normalizeUsageMetric(body.usageMetric);
  const licenseRegistrationNumber = Boolean(body.isLicensed)
    ? normalizeLicenseRegistrationNumber((body as { licenseRegistrationNumber?: unknown }).licenseRegistrationNumber)
    : null;
  const lifeWorkedPercent = normalizeLifeWorkedPercent((body as { lifeWorkedPercent?: unknown }).lifeWorkedPercent);
  const replacementPriceExVat = normalizeReplacementPrice(
    (body as { replacementPriceExVat?: unknown; replacementPrice?: unknown }).replacementPriceExVat ??
      (body as { replacementPrice?: unknown }).replacementPrice,
  );
  const insuredValueExVat = normalizeReplacementPrice(
    (body as { insuredValueExVat?: unknown; insuredValue?: unknown; insuranceValue?: unknown }).insuredValueExVat ??
      (body as { insuredValue?: unknown; insuranceValue?: unknown }).insuredValue ??
      (body as { insuranceValue?: unknown }).insuranceValue,
  );
  const brandName = String((body as { brandName?: unknown }).brandName ?? '').trim();
  const modelName = String((body as { modelName?: unknown }).modelName ?? '').trim();
  const normalizedSpecsJson = normalizeSpecsJson(body.specsJson);
  const insuranceStatus = readInsuranceStatusFromSpecs(
    normalizedSpecsJson,
    Boolean(body.isInsured) || insuredValueExVat !== null ? 'yes' : 'no',
  );
  const specsJsonWithInsuranceStatus = {
    ...normalizedSpecsJson,
    insuranceStatus,
    insurance_status: insuranceStatus,
    insuredStatus: insuranceStatus,
    insured_status: insuranceStatus,
  };
  const insuredValueForSave = insuranceStatus === 'yes' ? insuredValueExVat : null;

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  if (!title || value <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'title and value are required.',
      },
      { status: 400 },
    );
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const kind = existing.valuationRunId ? existing.kind : normalizeKind(body.kind);
  const canOmitReplacementPrice = replacementPriceNotApplicable(kind, normalizedSpecsJson);
  const effectiveReplacementPriceExVat = canOmitReplacementPrice
    ? replacementPriceExVat
    : replacementPriceExVat ?? normalizeReplacementPrice(existing.replacementPriceExVat);

  if (effectiveReplacementPriceExVat === null && !canOmitReplacementPrice) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Replacement price is required and must be greater than zero.',
      },
      { status: 400 },
    );
  }

  const nextPhotos = normalizePhotos(body.photos);
  const nextDocuments = normalizeDocuments(body.documents);
  const nextDocumentUrls = documentUrls(nextDocuments);
  const removedUploadIds = listInternalAssetRegisterUploadIds([
    ...existing.photos.filter((photo) => !nextPhotos.includes(photo)),
    ...documentUrls(existing.documents).filter((documentUrl) => !nextDocumentUrls.includes(documentUrl)),
  ]);

  try {
    const item = await updateAssetRegisterItem(session.user.id, {
      assetId,
      kind,
      title,
      value,
      note: body.note ?? null,
      serialNumber: body.serialNumber ?? null,
      brandName,
      modelName,
      isFinanced: Boolean(body.isFinanced),
      isInsured: insuranceStatus === 'yes',
      insuredValueExVat: insuredValueForSave,
      isLicensed: Boolean(body.isLicensed),
      licenseRegistrationNumber,
      financeNote: body.financeNote ?? null,
      photos: nextPhotos,
      documents: nextDocuments,
      yearModel: normalizeYearModel(body.yearModel),
      hours: normalizeHours(body.hours),
      usageMetric,
      lifeWorkedPercent,
      replacementPriceExVat: effectiveReplacementPriceExVat,
      specsJson: buildManualSpecsJson(specsJsonWithInsuranceStatus, usageMetric, lifeWorkedPercent, effectiveReplacementPriceExVat, insuredValueForSave, brandName, modelName),
      condition: normalizeCondition(body.condition),
    });

    await deleteUnreferencedAssetRegisterUploads({
      userId: session.user.id,
      uploadIds: removedUploadIds,
      excludeAssetId: assetId,
    });

    const [itemWithAlertStatus] = await attachOpenAssetAlerts(session.user.id, [item]);

    const usageUserId = getUsageUserId(session);
    if (usageUserId) {
      await recordAdminUsageEventSafely({
        userId: usageUserId,
        eventType: 'asset_updated',
        eventSource: 'asset-register',
        metadata: { assetId: item.id, kind: item.kind },
      });
    }


    return NextResponse.json({ ok: true, item: itemWithAlertStatus ?? item });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'USAGE_READING_CANNOT_DECREASE') {
      return NextResponse.json({ ok: false, error: USAGE_READING_SETTINGS_ERROR }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'LIFE_WORKED_PERCENT_CANNOT_DECREASE') {
      return NextResponse.json({ ok: false, error: LIFETIME_PERCENT_SETTINGS_ERROR }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'REPLACEMENT_PRICE_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Replacement price is required and must be greater than zero.' }, { status: 400 });
    }

    console.error('asset register PUT failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to update asset.') },
      { status: 500 },
    );
  }
}


export async function PATCH(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  const body = (await request.json()) as {
    assetId?: unknown;
    assetFlagged?: unknown;
    isFlagged?: unknown;
    flagged?: unknown;
    photos?: unknown;
    documents?: unknown;
    yearModel?: unknown;
    yearModelUnknown?: unknown;
    year_model_unknown?: unknown;
  };
  const assetId = String(body.assetId ?? '').trim();

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const hasYearModelRequest =
    Object.prototype.hasOwnProperty.call(body, 'yearModel') ||
    Object.prototype.hasOwnProperty.call(body, 'yearModelUnknown') ||
    Object.prototype.hasOwnProperty.call(body, 'year_model_unknown');

  if (hasYearModelRequest) {
    const parsedYearModel = parseYearModelPatchValue(
      body.yearModel,
      Object.prototype.hasOwnProperty.call(body, 'yearModelUnknown') ? body.yearModelUnknown : body.year_model_unknown,
    );

    if (!parsedYearModel.ok) {
      return NextResponse.json({ ok: false, error: parsedYearModel.error }, { status: 400 });
    }

    try {
      const item = await updateAssetRegisterItemYearModel(session.user.id, {
        assetId,
        yearModel: parsedYearModel.yearModel,
      });

      const [itemWithAlertStatus] = await attachOpenAssetAlerts(session.user.id, [item]);

      const usageUserId = getUsageUserId(session);
      if (usageUserId) {
        await recordAdminUsageEventSafely({
          userId: usageUserId,
          eventType: 'asset_updated',
          eventSource: 'asset-register-year-model',
          metadata: {
            assetId: item.id,
            yearModel: parsedYearModel.yearModel,
            yearModelUnknown: parsedYearModel.yearModel === null,
          },
        });
      }

      return NextResponse.json({ ok: true, item: itemWithAlertStatus ?? item });
    } catch (error) {
      if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
      }

      console.error('asset register year-model PATCH failed', error);
      return NextResponse.json(
        { ok: false, error: formatUnknownError(error, 'Failed to update year model.') },
        { status: 500 },
      );
    }
  }

  const hasFlagRequest =
    Object.prototype.hasOwnProperty.call(body, 'assetFlagged') ||
    Object.prototype.hasOwnProperty.call(body, 'isFlagged') ||
    Object.prototype.hasOwnProperty.call(body, 'flagged');

  if (hasFlagRequest) {
    const flagValue = Object.prototype.hasOwnProperty.call(body, 'assetFlagged')
      ? body.assetFlagged
      : Object.prototype.hasOwnProperty.call(body, 'isFlagged')
        ? body.isFlagged
        : body.flagged;

    try {
      const item = await updateAssetRegisterItemFlag(session.user.id, {
        assetId,
        isFlagged: normalizeBooleanFlag(flagValue),
      });

      const [itemWithAlertStatus] = await attachOpenAssetAlerts(session.user.id, [item]);

      const usageUserId = getUsageUserId(session);
      if (usageUserId) {
        await recordAdminUsageEventSafely({
          userId: usageUserId,
          eventType: 'asset_updated',
          eventSource: 'asset-register-flag',
          metadata: { assetId: item.id, assetFlagged: normalizeBooleanFlag(flagValue) },
        });
      }

      return NextResponse.json({ ok: true, item: itemWithAlertStatus ?? item });
    } catch (error) {
      if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
      }

      console.error('asset register flag PATCH failed', error);
      return NextResponse.json(
        { ok: false, error: formatUnknownError(error, 'Failed to update asset flag.') },
        { status: 500 },
      );
    }
  }

  const nextPhotos = Array.isArray(body.photos) ? normalizePhotos(body.photos) : existing.photos;
  const nextDocuments = Array.isArray(body.documents) ? normalizeDocuments(body.documents) : existing.documents;
  const nextDocumentUrls = documentUrls(nextDocuments);
  const removedUploadIds = listInternalAssetRegisterUploadIds([
    ...existing.photos.filter((photo) => !nextPhotos.includes(photo)),
    ...documentUrls(existing.documents).filter((documentUrl) => !nextDocumentUrls.includes(documentUrl)),
  ]);

  try {
    const item = await updateAssetRegisterItemMedia(session.user.id, {
      assetId,
      photos: nextPhotos,
      documents: nextDocuments,
    });

    await deleteUnreferencedAssetRegisterUploads({
      userId: session.user.id,
      uploadIds: removedUploadIds,
      excludeAssetId: assetId,
    });

    const [itemWithAlertStatus] = await attachOpenAssetAlerts(session.user.id, [item]);

    const usageUserId = getUsageUserId(session);
    if (usageUserId) {
      await recordAdminUsageEventSafely({
        userId: usageUserId,
        eventType: 'asset_updated',
        eventSource: 'asset-register-media',
        metadata: { assetId: item.id },
      });
    }

    return NextResponse.json({ ok: true, item: itemWithAlertStatus ?? item });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    console.error('asset register media PATCH failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to update asset files.') },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  const { searchParams } = new URL(request.url);
  const assetId = String(searchParams.get('id') ?? '').trim();

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const uploadIds = listInternalAssetRegisterUploadIds([...existing.photos, ...documentUrls(existing.documents)]);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    body = {};
  }
  const reason = String(body.reason ?? '').trim() as AssetDisposalReason;
  if (!reason) {
    return NextResponse.json({ ok: false, error: 'Choose what happened to the asset before continuing.' }, { status: 400 });
  }
  const aim4priceOutcomeInfluence = String(body.aim4priceOutcomeInfluence ?? body.aim4priceSaleInfluence ?? '').trim().toLowerCase();
  const impactQuestionRequired = ['sold', 'traded_in', 'scrapped'].includes(reason);
  if (impactQuestionRequired && !['yes', 'no', 'unsure'].includes(aim4priceOutcomeInfluence)) {
    return NextResponse.json({ ok: false, error: 'Tell us whether Aim4price helped with this outcome.' }, { status: 400 });
  }
  const transferRequested = String(body.transferAction ?? '').trim().toLowerCase() === 'claim_code';

  let outcome: Awaited<ReturnType<typeof disposeOrDeleteAsset>>;
  try {
    outcome = await disposeOrDeleteAsset({
      ownerUserId: session.user.id,
      assetId,
      reason,
      disposalDate: body.disposalDate,
      disposalAmountExVat: body.disposalAmountExVat,
      note: body.note,
      aim4priceOutcomeInfluence: impactQuestionRequired
        ? aim4priceOutcomeInfluence as 'yes' | 'no' | 'unsure'
        : null,
      transferRequested,
      actorUserId: session.user.id,
      actorName: session.user.name,
    });
  } catch (error) {
    console.error('asset register delete failed', error);
    if (error instanceof Error && error.message === 'ASSET_DELETE_HAS_DEPENDENCIES') {
      return NextResponse.json(
        { ok: false, error: 'This record has linked financial information or files. Resolve those links, or dispose the genuine asset instead.' },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === 'ASSET_TRANSFER_ALREADY_PENDING') {
      return NextResponse.json(
        { ok: false, error: 'A transfer is already waiting for this asset. Open Account → Claim or send an asset to manage it.' },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === 'ASSET_TRANSFER_IDENTIFIER_REQUIRED') {
      return NextResponse.json(
        { ok: false, error: 'Add a serial number to this asset before creating a transfer.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'The asset could not be archived. Please try again.' },
      { status: 500 },
    );
  }

  if (outcome.mode === 'deleted') {
    try {
      await deleteUnreferencedAssetRegisterUploads({
        userId: session.user.id,
        uploadIds,
        excludeAssetId: assetId,
      });
    } catch (error) {
      console.error('asset register upload cleanup failed after delete', error);
    }
  }

  return NextResponse.json({ ok: true, mode: outcome.mode, transfer: outcome.transfer });
}
