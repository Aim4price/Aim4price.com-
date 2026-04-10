import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import type { BrandRow } from '../../../lib/tractor-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();

    const result = await db.query<{
      slug: string;
      name: string;
    }>(`
      select slug, name
      from brands
      where is_active = true
      order by name asc
    `);

    const brands: BrandRow[] = result.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
    }));

    return NextResponse.json({
      ok: true,
      count: brands.length,
      brands,
    });
  } catch (error) {
    console.error('brands route failed', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load brands',
      },
      { status: 500 }
    );
  }
}
