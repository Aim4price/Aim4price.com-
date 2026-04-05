import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await db.query(`
      select id, slug, name, logo_path, is_active
      from brands
      where is_active = true
      order by name asc
    `);

    return NextResponse.json({
      ok: true,
      count: result.rows.length,
      brands: result.rows,
    });
  } catch (error) {
    console.error('brands-test failed', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Database test failed',
      },
      { status: 500 }
    );
  }
}
