import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PgLikeError = Error & {
  code?: string;
  detail?: string;
  hint?: string;
};

export async function GET() {
  try {
    const db = getDb();

    const connection = await db.query(`
      select
        current_database() as database_name,
        current_schema() as schema_name,
        current_user as user_name
    `);

    const result = await db.query(`
      select id, slug, name, logo_path, is_active
      from brands
      where is_active = true
      order by name asc
    `);

    return NextResponse.json({
      ok: true,
      connection: connection.rows[0],
      count: result.rows.length,
      brands: result.rows,
    });
  } catch (error: unknown) {
    console.error('brands-test failed', error);

    const pgError = error as PgLikeError;

    return NextResponse.json(
      {
        ok: false,
        error: 'Database test failed',
        message: pgError?.message ?? 'Unknown database error',
        code: pgError?.code ?? null,
        detail: pgError?.detail ?? null,
        hint: pgError?.hint ?? null,
      },
      { status: 500 }
    );
  }
}
