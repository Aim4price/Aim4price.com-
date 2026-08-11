import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { listEquipmentBrands } from '../../../lib/equipment-catalog';
import { isEquipmentFamilyKey, isSectorKey, type EquipmentFamilyKey, type SectorKey } from '../../../lib/equipment-types';
import type { BrandRow } from '../../../lib/tractor-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorKeyParam = searchParams.get('sectorKey');
    const familyKeyParam = searchParams.get('familyKey');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (sectorKeyParam && !isSectorKey(sectorKeyParam)) {
      return NextResponse.json({ ok: false, error: 'Invalid sectorKey.' }, { status: 400 });
    }
    if (familyKeyParam && !isEquipmentFamilyKey(familyKeyParam)) {
      return NextResponse.json({ ok: false, error: 'Invalid familyKey.' }, { status: 400 });
    }

    let brands: BrandRow[];
    if (sectorKeyParam || familyKeyParam) {
      const linkedBrands = await listEquipmentBrands({
        sectorKey: (sectorKeyParam as SectorKey | null) ?? null,
        familyKey: (familyKeyParam as EquipmentFamilyKey | null) ?? null,
        includeInactive,
      });
      brands = linkedBrands.map((row) => ({ slug: row.slug, name: row.name }));
    } else {
      const db = getDb();
      const result = await db.query<{ slug: string; name: string }>(`select slug, name from brands where is_active = true order by name asc`);
      brands = result.rows.map((row) => ({ slug: row.slug, name: row.name }));
    }

    return NextResponse.json(
      { ok: true, count: brands.length, brands },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900' } },
    );
  } catch (error) {
    console.error('brands route failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load brands' }, { status: 500 });
  }
}
