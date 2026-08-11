import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventsSafely, type AdminUsageEventInput } from '../../../lib/admin-usage-events';
import { getServerSession, isAdminSupportSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import {
  createAssetRegisterItemFromGenericValuation,
  createAssetRegisterItemFromValuation,
  getAssetRegisterItemById,
  updateAssetRegisterItemFromGenericValuation,
  updateAssetRegisterItemFromValuation,
} from '../../../lib/asset-register-db';
import { MAX_ASSET_REGISTER_PHOTOS } from '../../../lib/asset-register-uploads';
import { runServerValuation } from '../../../lib/server-valuation';
import {
  getSelectedMethodValue,
  deleteValuationRunById,
  saveGenericValuationRunFromResult,
  saveValuationRunFromResult,
  type MethodKey,
  type SaveValuationRunInput,
} from '../../../lib/valuation-runs';
import type { ConditionKey } from '../../../lib/tractor-data';
import type { GpsType, RunValuationInput } from '../../../lib/tractor-logic';
import { isSectorKey, type SectorKey } from '../../../lib/equipment-types';
import { runGenericValuation, type GenericCondition, type GenericSelectedMethod } from '../../../lib/generic-valuation';
import {
  advancedAssumptionsWereRequested,
  dealerAssessmentWasRequestedFromAssumptions,
} from '../../../lib/valuation/shared';
import { getAccountantRegisterAccess } from '../../../lib/accountant-workspace';
import { getAssetRegisterForUser } from '../../../lib/asset-registers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SaveValuationRunApiResponse = {
  ok: boolean;
  runId?: number;
  assetId?: string;
  createdAtIso?: string;
  selectedValueExVat?: number;
  warning?: string;
  error?: string;
};

type ErrorLike = {
  message?: unknown;
  detail?: unknown;
  hint?: unknown;
  code?: unknown;
  table?: unknown;
  column?: unknown;
  constraint?: unknown;
  schema?: unknown;
};

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const item of value) {
    const url = String(item ?? '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_ASSET_REGISTER_PHOTOS) break;
  }

  return urls;
}

function normalizeCondition(value: unknown): ConditionKey | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (
    normalized === 'excellent' ||
    normalized === 'good' ||
    normalized === 'fair' ||
    normalized === 'used' ||
    normalized === 'serious'
  ) {
    return normalized;
  }

  return null;
}

function normalizeMethod(value: unknown): MethodKey | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'aim4price' || normalized === 'market') return 'aim4price';
  return null;
}

function normalizeGenericCondition(value: unknown): GenericCondition | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (
    normalized === 'excellent' ||
    normalized === 'good' ||
    normalized === 'fair' ||
    normalized === 'used' ||
    normalized === 'serious'
  ) {
    return normalized;
  }

  return null;
}

function normalizeGenericSelectedMethod(value: unknown): GenericSelectedMethod | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'aim4price' || normalized === 'market') return 'aim4price';
  return null;
}

function normalizeGpsType(value: unknown): GpsType | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'full-autosteer' || normalized === 'guidance-only') {
    return normalized;
  }

  return null;
}

function normalizeReplacementPrice(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;

  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function normalizeConversionAssetId(value: unknown): string {
  return String(value ?? '').trim();
}

async function getManualConversionAsset(userId: string, assetId: string) {
  const asset = await getAssetRegisterItemById(userId, assetId);

  if (!asset) {
    throw new Error('CONVERSION_ASSET_NOT_FOUND');
  }

  if (asset.valuationRunId || asset.selectedMethod === 'aim4price') {
    throw new Error('CONVERSION_ASSET_NOT_MANUAL');
  }

  return asset;
}

function buildInput(
  body: Partial<RunValuationInput> & { selectedMethod?: unknown; valuationVersion?: unknown; yearModelUnknown?: unknown },
): SaveValuationRunInput | null {
  const modelId = String(body.modelId ?? '').trim();
  const year = Number(body.year);
  const hours = Number(body.hours);
  const condition = normalizeCondition(body.condition);
  const selectedMethod = normalizeMethod(body.selectedMethod);
  const userReplacementPriceExVat = normalizeReplacementPrice(body.userReplacementPriceExVat);

  if (!modelId || !Number.isFinite(year) || !Number.isFinite(hours) || !condition || !selectedMethod) {
    return null;
  }

  return {
    modelId,
    year,
    yearModelUnknown: parseBoolean(body.yearModelUnknown),
    hours,
    condition,
    frontPto: parseBoolean(body.frontPto),
    frontLoader: parseBoolean(body.frontLoader),
    gpsEnabled: parseBoolean(body.gpsEnabled),
    gpsType: normalizeGpsType(body.gpsType),
    gpsYear: body.gpsYear ?? null,
    userReplacementPriceExVat,
    advancedAssumptions: body.advancedAssumptions ?? null,
    selectedMethod,
    valuationVersion: String(body.valuationVersion ?? 'v1').trim() || 'v1',
    userId: null,
  };
}

function badRequest(message: string) {
  return NextResponse.json<SaveValuationRunApiResponse>(
    {
      ok: false,
      error: message,
    },
    { status: 400 },
  );
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) {
    const details = error as ErrorLike;
    const parts = [
      error.message,
      typeof details.detail === 'string' ? details.detail : '',
      typeof details.hint === 'string' ? `hint: ${details.hint}` : '',
      typeof details.column === 'string' ? `column: ${details.column}` : '',
      typeof details.table === 'string' ? `table: ${details.table}` : '',
      typeof details.constraint === 'string' ? `constraint: ${details.constraint}` : '',
      typeof details.code === 'string' ? `code: ${details.code}` : '',
    ].filter(Boolean);

    return parts.join(' | ');
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

  return 'Failed to save to asset register.';
}

function getUsageUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user?.id || isAdminSupportSession(session)) {
    return null;
  }

  return session.user.id;
}

async function recordSavedValuationUsage(input: {
  userId: string | null;
  assetId: string;
  runId: number;
  selectedMethod: string;
  valuationMode: 'tractor' | 'generic';
  saveForMarketplace: boolean;
}): Promise<void> {
  if (!input.userId) {
    return;
  }

  const metadata = {
    assetId: input.assetId,
    runId: input.runId,
    selectedMethod: input.selectedMethod,
    valuationMode: input.valuationMode,
    saveForMarketplace: input.saveForMarketplace,
  };
  const events: AdminUsageEventInput[] = [
    {
      userId: input.userId,
      eventType: 'paid_estimate_completed',
      eventSource: 'valuation-runs',
      metadata,
    },
    {
      userId: input.userId,
      eventType: 'asset_saved',
      eventSource: 'valuation-runs',
      metadata,
    },
  ];

  if (input.selectedMethod === 'aim4price') {
    events.push({
      userId: input.userId,
      eventType: 'aim4price_asset_saved',
      eventSource: 'valuation-runs',
      metadata,
    });
  }

  await recordAdminUsageEventsSafely(events);
}

function buildFriendlyError(error: unknown): { status: number; message: string } {
  const message = formatUnknownError(error);

  if (message.includes('MODEL_NOT_FOUND')) {
    return {
      status: 404,
      message: 'Selected tractor model was not found in the database.',
    };
  }

  if (message.includes('SELECTED_METHOD_NOT_AVAILABLE')) {
    return {
      status: 400,
      message: 'The selected valuation method is not available for this machine profile.',
    };
  }

  if (message.includes('REPLACEMENT_PRICE_REQUIRED')) {
    return {
      status: 400,
      message: 'Confirm a replacement price on the results page before saving this asset.',
    };
  }

  if (message.includes('CONVERSION_ASSET_NOT_FOUND')) {
    return {
      status: 404,
      message: 'The manual asset being converted could not be found.',
    };
  }

  if (message.includes('CONVERSION_ASSET_NOT_MANUAL')) {
    return {
      status: 400,
      message: 'Only saved manual assets can be converted to Aim4price valued assets.',
    };
  }

  if (message.startsWith('Expected lifetime') || message.startsWith('Condition retained value')) {
    return {
      status: 400,
      message,
    };
  }

  if (
    message.includes('valuation_runs_cab_type_check') ||
    message.includes('valuation_runs_drive_type_check') ||
    message.includes('valuation_runs_tractor_type_check') ||
    message.includes('asset_register_items_kind_check')
  ) {
    return {
      status: 500,
      message: 'The valuation calculated correctly, but the database still has an older tractor-only save constraint. Run database/migrations/05-asset-register-marketplace-save-hardening.sql once in DBeaver, then save again.',
    };
  }

  if (
    message.includes('valuation_runs_year_model_check') ||
    message.includes('asset_register_items_year_model_check')
  ) {
    return {
      status: 500,
      message: 'The valuation calculated correctly, but the database still has an older year-model constraint. Run database/migrations/36-year-model-unknown-nullable.sql once in DBeaver, then save again.',
    };
  }

  return {
    status: 500,
    message,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

    if (!session?.user?.id) {
      return NextResponse.json<SaveValuationRunApiResponse>(
        {
          ok: false,
          error: 'You must be signed in to save to your asset register.',
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Partial<RunValuationInput> & {
      selectedMethod?: unknown;
      valuationVersion?: unknown;
      catalogModeUsed?: unknown;
      sectorKey?: unknown;
      familyKey?: unknown;
      brandSlug?: unknown;
      typedModelName?: unknown;
      specsJson?: unknown;
      yearModelUnknown?: unknown;
      usageAmount?: unknown;
      lifeWorkedPercent?: unknown;
      userReplacementPriceExVat?: unknown;
      userReplacementPriceYear?: unknown;
      advancedAssumptions?: unknown;
      saveForMarketplace?: unknown;
      photos?: unknown;
      conversionAssetId?: unknown;
      conversionMode?: unknown;
      accountantShareId?: unknown;
      registerId?: unknown;
    };

    const saveForMarketplace = parseBoolean(body.saveForMarketplace);
    const photoUrls = saveForMarketplace ? normalizePhotos(body.photos) : [];
    const requestedConversionAssetId = normalizeConversionAssetId(body.conversionAssetId);
    const accountantShareId = String(body.accountantShareId ?? '').trim();
    const requestedRegisterId = String(body.registerId ?? '').trim();

    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    if (advancedAssumptionsWereRequested(body.advancedAssumptions) && profile.accountStatus !== 'active') {
      return NextResponse.json<SaveValuationRunApiResponse>(
        {
          ok: false,
          error: 'Advanced assumptions are available for active Aim4price accounts.',
        },
        { status: 403 },
      );
    }

    if (dealerAssessmentWasRequestedFromAssumptions(body.advancedAssumptions) && profile.accountType !== 'dealer') {
      return NextResponse.json<SaveValuationRunApiResponse>(
        { ok: false, error: 'Dealer assessments are available for active dealer accounts.' },
        { status: 403 },
      );
    }

    const accountType = String(profile.accountType ?? '').trim().toLowerCase();
    const accountantAccess = accountantShareId
      ? await getAccountantRegisterAccess({ accountantUserId: session.user.id, shareId: accountantShareId })
      : null;
    const effectiveOwnerUserId = accountantAccess?.ownerUserId ?? session.user.id;
    const targetRegisterId = requestedRegisterId || accountantAccess?.registerId || '';
    const targetRegister = targetRegisterId
      ? await getAssetRegisterForUser(effectiveOwnerUserId, targetRegisterId)
      : null;
    if (targetRegisterId && !targetRegister) {
      return NextResponse.json<SaveValuationRunApiResponse>({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }
    if (accountantAccess && (saveForMarketplace || requestedConversionAssetId)) {
      return NextResponse.json<SaveValuationRunApiResponse>({ ok: false, error: 'Client workspace estimates can only be saved as new client assets.' }, { status: 400 });
    }
    const canSaveAssetRegister = accountType === 'owner' || Boolean(accountantAccess);
    const canSaveMarketplaceAsset = !requestedConversionAssetId && saveForMarketplace && (accountType === 'owner' || accountType === 'dealer');

    if (!canSaveAssetRegister && !canSaveMarketplaceAsset) {
      return NextResponse.json<SaveValuationRunApiResponse>(
        {
          ok: false,
          error: 'Only owner accounts can save to the Asset Register. Dealer and auctioneer accounts can create marketplace listings by saving directly from Get Estimate.',
        },
        { status: 403 },
      );
    }

    const conversionAssetId = requestedConversionAssetId;
    const conversionAsset = conversionAssetId
      ? await getManualConversionAsset(effectiveOwnerUserId, conversionAssetId)
      : null;
    const effectiveSaveForMarketplace = conversionAsset ? false : saveForMarketplace;
    const effectivePhotoUrls = effectiveSaveForMarketplace ? photoUrls : [];

    const catalogModeUsed = String(body.catalogModeUsed ?? '').trim();

    if (catalogModeUsed === 'generic_specs' || catalogModeUsed === 'hybrid_generic') {
      const sectorKey = String(body.sectorKey ?? '').trim();
      const familyKey = String(body.familyKey ?? '').trim();
      const brandSlug = String(body.brandSlug ?? '').trim();
      const year = Number(body.year);
      const yearModelUnknown = parseBoolean(body.yearModelUnknown);
      const condition = normalizeGenericCondition(body.condition);
      const selectedMethod = normalizeGenericSelectedMethod(body.selectedMethod);
      const userReplacementPriceExVat = normalizeReplacementPrice(body.userReplacementPriceExVat);
      const userReplacementPriceYear = Number(body.userReplacementPriceYear);
      const resolvedReplacementPriceYear = userReplacementPriceExVat === null
        ? null
        : Number.isInteger(userReplacementPriceYear) && userReplacementPriceYear > 1900
          ? userReplacementPriceYear
          : new Date().getFullYear();

      if (!isSectorKey(sectorKey) || !familyKey || !brandSlug || !Number.isInteger(year) || !condition || !selectedMethod) {
        return badRequest('sectorKey, familyKey, brandSlug, year, condition and selectedMethod are required.');
      }

      const genericResult = await runGenericValuation({
        sectorKey: sectorKey as SectorKey,
        familyKey,
        brandSlug,
        typedModelName: String(body.typedModelName ?? '').trim() || null,
        specsJson: body.specsJson && typeof body.specsJson === 'object' ? (body.specsJson as Record<string, unknown>) : {},
        year,
        yearModelUnknown,
        usageAmount: body.usageAmount === null || typeof body.usageAmount === 'undefined' ? null : Number(body.usageAmount),
        lifeWorkedPercent:
          body.lifeWorkedPercent === null || typeof body.lifeWorkedPercent === 'undefined'
            ? null
            : Number(body.lifeWorkedPercent),
        condition,
        userReplacementPriceExVat,
        userReplacementPriceYear: resolvedReplacementPriceYear,
        advancedAssumptions: body.advancedAssumptions ?? null,
      });

      const savedRun = await saveGenericValuationRunFromResult({
        userId: effectiveOwnerUserId,
        result: genericResult,
        selectedMethod,
        valuationVersion: String(body.valuationVersion ?? 'generic-v1').trim() || 'generic-v1',
      });

      try {
        const asset = conversionAsset
          ? await updateAssetRegisterItemFromGenericValuation({
              userId: effectiveOwnerUserId,
              assetId: conversionAsset.id,
              valuationRunId: savedRun.runId,
              result: genericResult,
              selectedMethod,
              selectedValueExVat: savedRun.selectedValueExVat,
              saveReplacementPrice: true,
            })
          : await createAssetRegisterItemFromGenericValuation({
              userId: effectiveOwnerUserId,
              registerId: targetRegister?.id ?? null,
              valuationRunId: savedRun.runId,
              result: genericResult,
              selectedMethod,
              selectedValueExVat: savedRun.selectedValueExVat,
              note: '',
              photos: effectivePhotoUrls,
            });

        await recordSavedValuationUsage({
          userId: getUsageUserId(session),
          assetId: asset.id,
          runId: savedRun.runId,
          selectedMethod,
          valuationMode: 'generic',
          saveForMarketplace: effectiveSaveForMarketplace,
        });

        return NextResponse.json<SaveValuationRunApiResponse>({
          ok: true,
          runId: savedRun.runId,
          assetId: asset.id,
          createdAtIso: savedRun.createdAtIso,
          selectedValueExVat: savedRun.selectedValueExVat,
        });
      } catch (assetSaveError) {
        console.error('generic asset register save failed after valuation run save', assetSaveError);

        try {
          await deleteValuationRunById(effectiveOwnerUserId, savedRun.runId);
        } catch (rollbackError) {
          console.error('generic valuation run rollback failed after asset save failure', rollbackError);
        }

        throw assetSaveError instanceof Error
          ? assetSaveError
          : new Error(formatUnknownError(assetSaveError));
      }
    }

    const input = buildInput(body);
    if (!input) {
      return badRequest('modelId, year, hours, condition and selectedMethod are required.');
    }

    const valuationResult = await runServerValuation(input);
    const selectedValueExVat = getSelectedMethodValue(valuationResult, input.selectedMethod);

    if (selectedValueExVat === null) {
      return NextResponse.json<SaveValuationRunApiResponse>(
        {
          ok: false,
          error: 'The selected valuation method is not available for this tractor profile.',
        },
        { status: 400 },
      );
    }

    const savedRun = await saveValuationRunFromResult(
      {
        ...input,
        userId: effectiveOwnerUserId,
      },
      valuationResult,
    );

    try {
      const asset = conversionAsset
        ? await updateAssetRegisterItemFromValuation({
            userId: effectiveOwnerUserId,
            assetId: conversionAsset.id,
            valuationRunId: savedRun.runId,
            result: valuationResult,
            selectedMethod: input.selectedMethod,
            selectedValueExVat,
            year: input.year,
            yearModelUnknown: input.yearModelUnknown,
            hours: input.hours,
            condition: input.condition,
            saveReplacementPrice: true,
          })
        : await createAssetRegisterItemFromValuation({
            userId: effectiveOwnerUserId,
            registerId: targetRegister?.id ?? null,
            valuationRunId: savedRun.runId,
            result: valuationResult,
            selectedMethod: input.selectedMethod,
            selectedValueExVat,
            year: input.year,
            yearModelUnknown: input.yearModelUnknown,
            hours: input.hours,
            note: '',
            photos: effectivePhotoUrls,
          });

      await recordSavedValuationUsage({
        userId: getUsageUserId(session),
        assetId: asset.id,
        runId: savedRun.runId,
        selectedMethod: input.selectedMethod,
        valuationMode: 'tractor',
        saveForMarketplace: effectiveSaveForMarketplace,
      });

      return NextResponse.json<SaveValuationRunApiResponse>({
        ok: true,
        runId: savedRun.runId,
        assetId: asset.id,
        createdAtIso: savedRun.createdAtIso,
        selectedValueExVat,
      });
    } catch (assetSaveError) {
      console.error('asset register save failed after valuation run save', assetSaveError);

      try {
        await deleteValuationRunById(effectiveOwnerUserId, savedRun.runId);
      } catch (rollbackError) {
        console.error('valuation run rollback failed after asset save failure', rollbackError);
      }

      throw assetSaveError instanceof Error
        ? assetSaveError
        : new Error(formatUnknownError(assetSaveError));
    }
  } catch (error) {
    console.error('valuation-runs route failed', error);

    const friendly = buildFriendlyError(error);

    return NextResponse.json<SaveValuationRunApiResponse>(
      {
        ok: false,
        error: friendly.message,
      },
      { status: friendly.status },
    );
  }
}
