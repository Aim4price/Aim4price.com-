import { NextRequest, NextResponse } from 'next/server';
import { basicCatalogueEnabled, listBasicCatalogueFamilies } from '../../../lib/basic-catalogue';
import { listEquipmentFamilies } from '../../../lib/equipment-catalog';
import { isSectorKey, type SectorKey } from '../../../lib/equipment-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorKeyParam = searchParams.get('sectorKey');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (sectorKeyParam && !isSectorKey(sectorKeyParam)) {
      return NextResponse.json({ ok: false, error: 'Invalid sectorKey.' }, { status: 400 });
    }

    const families = searchParams.get('experience') === 'basic' && basicCatalogueEnabled()
      ? await listBasicCatalogueFamilies((sectorKeyParam as SectorKey | null) ?? null)
      : await listEquipmentFamilies({
      sectorKey: (sectorKeyParam as SectorKey | null) ?? null,
      includeInactive,
    });

    return NextResponse.json({ ok: true, count: families.length, families });
  } catch (error) {
    console.error('equipment-families route failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load equipment families.',
      },
      { status: 500 },
    );
  }
}

