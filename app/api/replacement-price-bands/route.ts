import { NextRequest, NextResponse } from 'next/server';
import { isSectorKey, type SectorKey } from '../../../lib/equipment-types';
import { listReplacementPriceBands } from '../../../lib/generic-valuation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorKeyParam = searchParams.get('sectorKey');
    const familyKey = searchParams.get('familyKey')?.trim() ?? '';
    const brandSlug = searchParams.get('brandSlug')?.trim() ?? '';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (sectorKeyParam && !isSectorKey(sectorKeyParam)) {
      return NextResponse.json({ ok: false, error: 'Invalid sectorKey.' }, { status: 400 });
    }

    if (!familyKey) {
      return NextResponse.json({ ok: false, error: 'familyKey is required.' }, { status: 400 });
    }

    const bands = await listReplacementPriceBands({
      sectorKey: (sectorKeyParam as SectorKey | null) ?? null,
      familyKey,
      brandSlug: brandSlug || null,
      includeInactive,
    });

    return NextResponse.json({ ok: true, count: bands.length, bands });
  } catch (error) {
    console.error('replacement-price-bands route failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load replacement price bands.' },
      { status: 500 },
    );
  }
}
