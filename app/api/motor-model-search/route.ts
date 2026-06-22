import { NextRequest, NextResponse } from 'next/server';
import { searchMotorCanonicalModels } from '../../../lib/motor-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';
    const limit = searchParams.get('limit');

    const models = await searchMotorCanonicalModels({
      search,
      limit: limit ? Number(limit) : 20,
    });

    return NextResponse.json({ ok: true, count: models.length, models });
  } catch (error) {
    console.error('motor-model-search route failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to search Motor models.',
      },
      { status: 500 },
    );
  }
}
