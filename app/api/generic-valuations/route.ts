import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../lib/admin-usage-events';
import { getAnyServerSession } from '../../../lib/auth-session';
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

function normalizeReplacementPrice(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;

  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
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
      userReplacementPriceExVat,
      userReplacementPriceYear: resolvedReplacementPriceYear,
    });

    await recordAdminUsageEventSafely({
      userId: await getUsageUserId(),
      eventType: 'free_estimate_completed',
      eventSource: 'generic-valuations',
      metadata: { sectorKey, familyKey, brandSlug },
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
