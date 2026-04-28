import { NextRequest, NextResponse } from 'next/server';
import { isSectorKey, type SectorKey } from '../../../lib/equipment-types';
import { runGenericValuation, type GenericCondition } from '../../../lib/generic-valuation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  sectorKey?: unknown;
  familyKey?: unknown;
  brandSlug?: unknown;
  typedModelName?: unknown;
  specsJson?: unknown;
  year?: unknown;
  yearModelUnknown?: unknown;
  usageAmount?: unknown;
  lifeWorkedPercent?: unknown;
  condition?: unknown;
  userReplacementPriceExVat?: unknown;
  userReplacementPriceYear?: unknown;
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const sectorKey = String(body.sectorKey ?? '').trim();
    const familyKey = String(body.familyKey ?? '').trim();
    const brandSlug = String(body.brandSlug ?? '').trim();
    const year = Number(body.year);
    const yearModelUnknown = parseBoolean(body.yearModelUnknown);
    const condition = normalizeCondition(body.condition);

    if (!isSectorKey(sectorKey)) {
      return NextResponse.json({ ok: false, error: 'Valid sectorKey is required.' }, { status: 400 });
    }

    if (!familyKey || !brandSlug || !Number.isInteger(year) || !condition) {
      return NextResponse.json(
        { ok: false, error: 'familyKey, brandSlug, year and condition are required.' },
        { status: 400 },
      );
    }

    const result = await runGenericValuation({
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
      userReplacementPriceExVat:
        body.userReplacementPriceExVat === null || typeof body.userReplacementPriceExVat === 'undefined'
          ? null
          : Number(body.userReplacementPriceExVat),
      userReplacementPriceYear:
        body.userReplacementPriceYear === null || typeof body.userReplacementPriceYear === 'undefined'
          ? null
          : Number(body.userReplacementPriceYear),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('generic-valuations route failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to calculate generic valuation.' },
      { status: 500 },
    );
  }
}
