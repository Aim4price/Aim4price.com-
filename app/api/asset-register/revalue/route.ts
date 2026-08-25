import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { revalueAssetRegisterItem } from '../../../../lib/asset-register-revaluation';
import { attachOpenPartnerNotesToAssets } from '../../../../lib/partner-access';
import type { AdvancedAssumptionsInput } from '../../../../lib/valuation/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIFETIME_PERCENT_SETTINGS_ERROR =
  'The new lifetime worked percentage cannot be lower than the percentage already saved on this asset. Please go to Settings to override this.';
const USAGE_READING_SETTINGS_ERROR =
  'The new usage reading cannot be lower than the reading already saved on this asset. Please go to Settings to override this.';

type RevalueAssetResponse = {
  ok: boolean;
  item?: unknown;
  valuationRunId?: number;
  selectedMethod?: string;
  oldValueExVat?: number;
  newValueExVat?: number;
  warning?: string;
  previewOnly?: boolean;
  marketAverageExVat?: number | null;
  marketLowExVat?: number | null;
  marketHighExVat?: number | null;
  marketCount?: number;
  marketSources?: unknown[];
  marketMatchStrategy?: string;
  marketAdjustmentExVat?: number | null;
  marketRawAverageExVat?: number | null;
  marketValueMode?: string;
  replacementPriceUsedExVat?: number | null;
  error?: string;
};

function badRequest(message: string) {
  return NextResponse.json<RevalueAssetResponse>({ ok: false, error: message }, { status: 400 });
}

function normalizeReplacementPrice(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return null;
    const parsed = Number(digits);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  }

  return null;
}

function normalizeLifeWorkedPercent(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
}

function normalizeUsageAmount(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }

  const text = String(value).trim();
  if (!text || text.replace(/\s+/g, '').startsWith('-')) {
    return null;
  }

  const numeric = Number(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric);
}

function normalizeAdvancedScalar(value: unknown): number | string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'string') return value;
  return undefined;
}

function normalizeAdvancedAssumptionsRequest(value: unknown): AdvancedAssumptionsInput {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;

  return {
    maxLifetimeUsage: normalizeAdvancedScalar(source.maxLifetimeUsage),
    maxLifetimeHours: normalizeAdvancedScalar(source.maxLifetimeHours),
    conditionFactorPercent: normalizeAdvancedScalar(source.conditionFactorPercent),
  };
}


function formatError(error: unknown): { status: number; message: string } {
  if (error instanceof Error) {
    if (error.message === 'ASSET_NOT_FOUND') {
      return { status: 404, message: 'Asset not found.' };
    }

    if (error.message === 'ASSET_NOT_REVALUEABLE') {
      return {
        status: 400,
        message: 'This asset was saved as a manual asset. It needs an Aim4price valuation before the estimate can be updated automatically.',
      };
    }

    if (error.message === 'VALUATION_RUN_NOT_FOUND') {
      return {
        status: 404,
        message: 'The original valuation run could not be found for this asset.',
      };
    }

    if (error.message === 'MODEL_NOT_FOUND') {
      return {
        status: 404,
        message: 'The linked model could not be found in the current equipment database.',
      };
    }

    if (error.message === 'SELECTED_METHOD_NOT_AVAILABLE') {
      return {
        status: 400,
        message: 'The selected valuation method is not available for the latest asset details.',
      };
    }

    if (error.message === 'REPLACEMENT_PRICE_REQUIRED') {
      return {
        status: 400,
        message: 'A replacement price is required before this asset can be recalculated.',
      };
    }

    if (error.message === 'LIFE_WORKED_PERCENT_CANNOT_DECREASE') {
      return { status: 400, message: LIFETIME_PERCENT_SETTINGS_ERROR };
    }

    if (error.message === 'USAGE_READING_CANNOT_DECREASE') {
      return { status: 400, message: USAGE_READING_SETTINGS_ERROR };
    }

    if (error.message === 'ASSET_DOES_NOT_USE_LIFE_WORKED_PERCENT') {
      return { status: 400, message: 'This asset does not use lifetime worked percentage.' };
    }

    if (error.message === 'ASSET_DOES_NOT_USE_USAGE_READING') {
      return { status: 400, message: 'This asset does not use machine hours or kilometres.' };
    }

    if (
      error.message.startsWith('This asset is missing') ||
      error.message.startsWith('This tractor is missing') ||
      error.message.startsWith('Expected lifetime') ||
      error.message.startsWith('Condition retained value')
    ) {
      return { status: 400, message: error.message };
    }

    if (error.message === 'No valuation method is available for this asset right now.') {
      return { status: 400, message: error.message };
    }

    return { status: 500, message: error.message || 'Failed to update estimate.' };
  }

  return { status: 500, message: 'Failed to update estimate.' };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return NextResponse.json<RevalueAssetResponse>({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json<RevalueAssetResponse>(
      { ok: false, error: 'You do not have permission to update this Asset Register.' },
      { status: 403 },
    );
  }

  let body: {
    assetId?: unknown;
    selectedMethod?: unknown;
    previewOnly?: unknown;
    replacementPriceExVat?: unknown;
    saveReplacementPrice?: unknown;
    advancedAssumptions?: unknown;
    lifeWorkedPercentOverride?: unknown;
    usageAmountOverride?: unknown;
    allowUsageDecrease?: unknown;
    usageOverrideConfirmed?: unknown;
  };
  try {
    body = (await request.json()) as {
      assetId?: unknown;
      selectedMethod?: unknown;
      previewOnly?: unknown;
      replacementPriceExVat?: unknown;
      saveReplacementPrice?: unknown;
      advancedAssumptions?: unknown;
      lifeWorkedPercentOverride?: unknown;
      usageAmountOverride?: unknown;
      allowUsageDecrease?: unknown;
      usageOverrideConfirmed?: unknown;
    };
  } catch {
    return badRequest('Enter a valid estimate update request.');
  }

  const assetId = String(body.assetId ?? '').trim();

  if (!assetId) {
    return badRequest('Valid asset id is required.');
  }

  const hasReplacementPriceOverride = Object.prototype.hasOwnProperty.call(body, 'replacementPriceExVat');
  const replacementPriceExVat = normalizeReplacementPrice(body.replacementPriceExVat);

  if (hasReplacementPriceOverride && replacementPriceExVat === null) {
    return badRequest('Enter a valid replacement price excluding VAT.');
  }

  const saveReplacementPrice = body.saveReplacementPrice === true;
  const hasAdvancedAssumptionsOverride = Object.prototype.hasOwnProperty.call(body, 'advancedAssumptions');
  const advancedAssumptions = hasAdvancedAssumptionsOverride
    ? normalizeAdvancedAssumptionsRequest(body.advancedAssumptions)
    : undefined;

  if (saveReplacementPrice && replacementPriceExVat === null) {
    return badRequest('Enter a valid replacement price excluding VAT before saving it as the new replacement price.');
  }

  const hasLifeWorkedPercentOverride = Object.prototype.hasOwnProperty.call(body, 'lifeWorkedPercentOverride');
  const lifeWorkedPercentOverride = hasLifeWorkedPercentOverride
    ? normalizeLifeWorkedPercent(body.lifeWorkedPercentOverride)
    : undefined;

  if (hasLifeWorkedPercentOverride && lifeWorkedPercentOverride === null) {
    return badRequest('Lifetime worked must be between 0% and 100%.');
  }

  const hasUsageAmountOverride = Object.prototype.hasOwnProperty.call(body, 'usageAmountOverride');
  const usageAmountOverride = hasUsageAmountOverride
    ? normalizeUsageAmount(body.usageAmountOverride)
    : undefined;

  if (hasUsageAmountOverride && usageAmountOverride === null) {
    return badRequest('Usage reading must be zero or greater.');
  }

  const allowUsageDecrease = body.allowUsageDecrease === true || body.usageOverrideConfirmed === true;

  try {
    const result = await revalueAssetRegisterItem({
      userId: session.user.id,
      assetId,
      selectedMethod: body.selectedMethod,
      previewOnly: body.previewOnly === true,
      replacementPriceExVat,
      saveReplacementPrice,
      ...(hasAdvancedAssumptionsOverride ? { advancedAssumptions } : {}),
      ...(hasLifeWorkedPercentOverride ? { lifeWorkedPercentOverride } : {}),
      ...(hasUsageAmountOverride ? { usageAmountOverride } : {}),
      allowUsageDecrease,
    });

    const [itemWithPartnerNote] = await attachOpenPartnerNotesToAssets(session.user.id, [result.item]);

    return NextResponse.json<RevalueAssetResponse>({
      ok: true,
      item: itemWithPartnerNote ?? result.item,
      valuationRunId: result.valuationRunId,
      selectedMethod: result.selectedMethod,
      oldValueExVat: result.oldValueExVat,
      newValueExVat: result.newValueExVat,
      warning: result.warning,
      previewOnly: result.previewOnly,
      marketAverageExVat: result.marketAverageExVat,
      marketLowExVat: result.marketLowExVat,
      marketHighExVat: result.marketHighExVat,
      marketCount: result.marketCount,
      marketSources: result.marketSources,
      marketMatchStrategy: result.marketMatchStrategy,
      marketAdjustmentExVat: result.marketAdjustmentExVat,
      marketRawAverageExVat: result.marketRawAverageExVat,
      marketValueMode: result.marketValueMode,
      replacementPriceUsedExVat: result.replacementPriceUsedExVat,
    });
  } catch (error) {
    console.error('asset register revalue failed', error);
    const formatted = formatError(error);
    return NextResponse.json<RevalueAssetResponse>({ ok: false, error: formatted.message }, { status: formatted.status });
  }
}
