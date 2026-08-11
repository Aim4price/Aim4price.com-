import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../lib/admin-usage-events';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAnyServerSession } from '../../../lib/auth-session';
import { runServerValuation } from '../../../lib/server-valuation';
import type { ConditionKey } from '../../../lib/tractor-data';
import type { GpsType, RunValuationInput } from '../../../lib/tractor-logic';
import {
  advancedAssumptionsRequireActiveAccess,
  advancedAssumptionsWereRequested,
} from '../../../lib/valuation/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TractorValuationApiResponse = {
  ok: boolean;
  result?: Awaited<ReturnType<typeof runServerValuation>>;
  error?: string;
};

function parseBoolean(value: string | null | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function normalizeCondition(value: string | null | undefined): ConditionKey | null {
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

function normalizeGpsType(value: string | null | undefined): GpsType | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'full-autosteer' || normalized === 'guidance-only') {
    return normalized;
  }

  return null;
}

function normalizePositiveMoney(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function normalizeOtherExtraName(value: unknown): string | null {
  return String(value ?? '').trim().slice(0, 100) || null;
}

function buildInputFromSearchParams(request: NextRequest): RunValuationInput | null {
  const { searchParams } = new URL(request.url);

  const modelId = searchParams.get('modelId')?.trim();
  const year = Number(searchParams.get('year'));
  const hours = Number(searchParams.get('hours'));
  const condition = normalizeCondition(searchParams.get('condition'));

  if (!modelId || !Number.isFinite(year) || !Number.isFinite(hours) || !condition) {
    return null;
  }

  const advancedAssumptions = {
    maxLifetimeUsage: searchParams.get('maxLifetimeUsage') ?? searchParams.get('maxLifetimeHours'),
    conditionFactorPercent: searchParams.get('conditionFactorPercent'),
  };

  return {
    modelId,
    year,
    hours,
    condition,
    frontPto: parseBoolean(searchParams.get('frontPto')),
    frontLoader: parseBoolean(searchParams.get('frontLoader')),
    gpsEnabled: parseBoolean(searchParams.get('gpsEnabled')),
    gpsType: normalizeGpsType(searchParams.get('gpsType')),
    gpsYear: searchParams.get('gpsYear'),
    frontPtoReplacementPriceExVat: normalizePositiveMoney(searchParams.get('frontPtoReplacementPriceExVat')),
    frontLoaderReplacementPriceExVat: normalizePositiveMoney(searchParams.get('frontLoaderReplacementPriceExVat')),
    gpsReplacementPriceExVat: normalizePositiveMoney(searchParams.get('gpsReplacementPriceExVat')),
    otherExtraName: normalizeOtherExtraName(searchParams.get('otherExtraName')),
    otherExtraValueExVat: normalizePositiveMoney(searchParams.get('otherExtraValueExVat')),
    userReplacementPriceExVat: normalizePositiveMoney(searchParams.get('userReplacementPriceExVat')),
    advancedAssumptions: advancedAssumptionsWereRequested(advancedAssumptions) ? advancedAssumptions : null,
  };
}

function buildInputFromBody(body: Partial<RunValuationInput> | null | undefined): RunValuationInput | null {
  if (!body) return null;

  const modelId = String(body.modelId ?? '').trim();
  const year = Number(body.year);
  const hours = Number(body.hours);
  const condition = normalizeCondition(String(body.condition ?? ''));

  if (!modelId || !Number.isFinite(year) || !Number.isFinite(hours) || !condition) {
    return null;
  }

  return {
    modelId,
    year,
    hours,
    condition,
    frontPto: Boolean(body.frontPto),
    frontLoader: Boolean(body.frontLoader),
    gpsEnabled: Boolean(body.gpsEnabled),
    gpsType: body.gpsType === 'full-autosteer' || body.gpsType === 'guidance-only' ? body.gpsType : null,
    gpsYear: body.gpsYear ?? null,
    frontPtoReplacementPriceExVat: normalizePositiveMoney(body.frontPtoReplacementPriceExVat),
    frontLoaderReplacementPriceExVat: normalizePositiveMoney(body.frontLoaderReplacementPriceExVat),
    gpsReplacementPriceExVat: normalizePositiveMoney(body.gpsReplacementPriceExVat),
    otherExtraName: normalizeOtherExtraName(body.otherExtraName),
    otherExtraValueExVat: normalizePositiveMoney(body.otherExtraValueExVat),
    userReplacementPriceExVat: normalizePositiveMoney(body.userReplacementPriceExVat),
    advancedAssumptions: body.advancedAssumptions ?? null,
  };
}

function badRequest(message: string) {
  return NextResponse.json<TractorValuationApiResponse>(
    {
      ok: false,
      error: message,
    },
    { status: 400 },
  );
}


async function getAdvancedAccessProfile() {
  const session = await getAnyServerSession();
  const user = session?.user;
  if (!user?.id) return null;
  return getAccountProfile({ id: user.id, name: user.name, email: user.email });
}

function advancedAccessDenied() {
  return NextResponse.json<TractorValuationApiResponse>(
    {
      ok: false,
      error: 'Advanced assumptions are available for active Aim4price accounts.',
    },
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

async function handleValuation(input: RunValuationInput | null) {
  if (!input) {
    return badRequest('modelId, year, hours and condition are required.');
  }

  if (advancedAssumptionsRequireActiveAccess(input.advancedAssumptions)) {
    const profile = await getAdvancedAccessProfile();
    if (profile?.accountStatus !== 'active') return advancedAccessDenied();
  }

  try {
    const result = await runServerValuation(input);

    await recordAdminUsageEventSafely({
      userId: await getUsageUserId(),
      eventType: 'free_estimate_completed',
      eventSource: 'tractor-valuations',
      metadata: { modelId: input.modelId },
    });

    return NextResponse.json<TractorValuationApiResponse>({
      ok: true,
      result,
    });
  } catch (error) {
    console.error('tractor-valuations route failed', error);

    if (error instanceof Error && error.message === 'MODEL_NOT_FOUND') {
      return NextResponse.json<TractorValuationApiResponse>(
        {
          ok: false,
          error: 'Selected tractor model was not found in the database.',
        },
        { status: 404 },
      );
    }

    if (isAdvancedValidationError(error)) {
      return NextResponse.json<TractorValuationApiResponse>(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Invalid advanced assumptions.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json<TractorValuationApiResponse>(
      {
        ok: false,
        error: 'Failed to calculate valuation.',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleValuation(buildInputFromSearchParams(request));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<RunValuationInput>;
    return handleValuation(buildInputFromBody(body));
  } catch {
    return badRequest('Request body must be valid JSON.');
  }
}
