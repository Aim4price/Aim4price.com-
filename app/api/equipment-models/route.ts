import { NextRequest, NextResponse } from 'next/server';
import { listEquipmentModels } from '../../../lib/equipment-catalog';
import {
  isEquipmentFamilyKey,
  isSectorKey,
  type EquipmentFamilyKey,
  type SectorKey,
} from '../../../lib/equipment-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorKeyParam = searchParams.get('sectorKey');
    const familyKeyParam = searchParams.get('familyKey');
    const brandSlug = searchParams.get('brandSlug');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeGenericFallback = searchParams.get('includeGenericFallback') === 'true';
    const limit = searchParams.get('limit');

    if (sectorKeyParam && !isSectorKey(sectorKeyParam)) {
      return NextResponse.json({ ok: false, error: 'Invalid sectorKey.' }, { status: 400 });
    }

    if (familyKeyParam && !isEquipmentFamilyKey(familyKeyParam)) {
      return NextResponse.json({ ok: false, error: 'Invalid familyKey.' }, { status: 400 });
    }

    const models = await listEquipmentModels({
      sectorKey: (sectorKeyParam as SectorKey | null) ?? null,
      familyKey: (familyKeyParam as EquipmentFamilyKey | null) ?? null,
      brandSlug,
      search,
      includeInactive,
      includeGenericFallback,
      limit: limit ? Number(limit) : null,
    });

    return NextResponse.json(
      { ok: true, count: models.length, models },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900' } },
    );
  } catch (error) {
    console.error('equipment-models route failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load equipment models.',
      },
      { status: 500 },
    );
  }
}
