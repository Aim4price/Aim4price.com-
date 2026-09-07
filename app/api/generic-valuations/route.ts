import { NextRequest, NextResponse } from 'next/server';
import { recordGenericValuationForAdminSafely } from '../../../lib/admin-valuation-events';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAnyServerSession } from '../../../lib/auth-session';
import { isSectorKey, type SectorKey } from '../../../lib/equipment-types';
import {
  runGenericValuation,
  type GenericCondition,
  type GenericValuationInput,
} from '../../../lib/generic-valuation';
import {
  advancedAssumptionsRequireActiveAccess,
} from '../../../lib/valuation/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  sectorKey?: unknown;
  familyKey?: unknown;
  brandSlug?: unknown;
  equipmentModelId?: unknown;
  typedModelName?: unknown;
  saveModelCandidate?: unknown;
  specsJson?: unknown;
  year?: unknown;
  yearModelUnknown?: unknown;
  usageAmount?: unknown;
  lifeWorkedPercent?: unknown;
  condition?: unknown;
  userReplacementPriceExVat?: unknown;
  userReplacementPriceYear?: unknown;
  advancedAssumptions?: unknown;
};

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function normalizeCondition(value: unknown): GenericCondition | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['excellent', 'good', 'fair', 'used', 'serious'].includes(normalized)) return normalized as GenericCondition;
  return null;
}

function normalizePositiveInteger(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeUsageNumber(value: unknown, strict = false): number | null {
  if (value == null) return null;
  // Basic must not turn an empty string or boolean into a zero meter reading.
  if (strict && typeof value !== 'number') return Number.NaN;
  return Number(value);
}

function normalizeReplacementPrice(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;

  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}


async function getAdvancedAccessProfile() {
  const session = await getAnyServerSession();
  const user = session?.user;
  if (!user?.id) return null;
  return getAccountProfile({ id: user.id, name: user.name, email: user.email });
}

function advancedAccessDenied() {
  return NextResponse.json(
    { ok: false, error: 'Advanced assumptions are available for active Aim4price accounts.' },
    { status: 403 },
  );
}

function isAdvancedValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.startsWith('Expected lifetime')
    || error.message.startsWith('Condition retained value')
    || error.message.includes('detailed asset assessment')
    || error.message.startsWith('Popularity must');
}

async function getUsageUserId(): Promise<string | null> {
  try {
    const session = await getAnyServerSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const sectorKey = String(body.sectorKey ?? '').trim();
    const familyKey = String(body.familyKey ?? '').trim();
    const brandSlug = String(body.brandSlug ?? '').trim();
    const year = Number(body.year);
    const yearModelUnknown = parseBoolean(body.yearModelUnknown);
    const condition = normalizeCondition(body.condition);
    const userReplacementPriceExVat = normalizeReplacementPrice(body.userReplacementPriceExVat);
    const userReplacementPriceYear = Number(body.userReplacementPriceYear);
    const resolvedReplacementPriceYear = userReplacementPriceExVat === null
      ? null
      : Number.isInteger(userReplacementPriceYear) && userReplacementPriceYear > 1900
        ? userReplacementPriceYear
        : new Date().getFullYear();

    if (!isSectorKey(sectorKey)) {
      return NextResponse.json({ ok: false, error: 'Valid sectorKey is required.' }, { status: 400 });
    }

    if (!familyKey || !brandSlug || !Number.isInteger(year) || !condition) {
      return NextResponse.json(
        { ok: false, error: 'familyKey, brandSlug, year and condition are required.' },
        { status: 400 },
      );
    }

    if (advancedAssumptionsRequireActiveAccess(body.advancedAssumptions)) {
      const profile = await getAdvancedAccessProfile();
      if (profile?.accountStatus !== 'active') return advancedAccessDenied();
    }

    const specsJson = body.specsJson && typeof body.specsJson === 'object' ? (body.specsJson as Record<string, unknown>) : {};
    const basicCatalogue = Boolean(specsJson.basic_catalogue_release);
    const valuationInput: GenericValuationInput = {
      sectorKey: sectorKey as SectorKey,
      familyKey,
      brandSlug,
      equipmentModelId: normalizePositiveInteger(body.equipmentModelId),
      typedModelName: String(body.typedModelName ?? '').trim() || null,
      saveModelCandidate: parseBoolean(body.saveModelCandidate),
      specsJson,
      year,
      yearModelUnknown,
      usageAmount: normalizeUsageNumber(body.usageAmount, basicCatalogue),
      lifeWorkedPercent: normalizeUsageNumber(body.lifeWorkedPercent, basicCatalogue),
      condition,
      userReplacementPriceExVat,
      userReplacementPriceYear: resolvedReplacementPriceYear,
      advancedAssumptions: body.advancedAssumptions ?? null,
    };
    const result = await runGenericValuation(valuationInput);

    await recordGenericValuationForAdminSafely({
      userId: await getUsageUserId(),
      valuationInput,
      result,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('generic-valuations route failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to calculate generic valuation.' },
      { status: isAdvancedValidationError(error) ? 400 : 500 },
    );
  }
}
