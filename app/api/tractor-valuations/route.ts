import { NextRequest, NextResponse } from 'next/server';
import { runServerValuation } from '../../../lib/server-valuation';
import type { ConditionKey } from '../../../lib/tractor-data';
import type { GpsType, RunValuationInput } from '../../../lib/tractor-logic';

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

function buildInputFromSearchParams(request: NextRequest): RunValuationInput | null {
  const { searchParams } = new URL(request.url);

  const modelId = searchParams.get('modelId')?.trim();
  const year = Number(searchParams.get('year'));
  const hours = Number(searchParams.get('hours'));
  const condition = normalizeCondition(searchParams.get('condition'));

  if (!modelId || !Number.isFinite(year) || !Number.isFinite(hours) || !condition) {
    return null;
  }

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
    userReplacementPriceExVat: Number(searchParams.get('userReplacementPriceExVat')) || null,
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
    userReplacementPriceExVat:
      typeof body.userReplacementPriceExVat === 'number' && Number.isFinite(body.userReplacementPriceExVat) && body.userReplacementPriceExVat > 0
        ? body.userReplacementPriceExVat
        : null,
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

async function handleValuation(input: RunValuationInput | null) {
  if (!input) {
    return badRequest('modelId, year, hours and condition are required.');
  }

  try {
    const result = await runServerValuation(input);

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
