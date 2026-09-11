import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { listPartnerDirectory, normalizePartnerType } from '../../../lib/partner-access';
import type { AssistanceMapBounds } from '../../../lib/assistance-network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function readBounds(searchParams: URLSearchParams): AssistanceMapBounds | null {
  const rawValues = ['west', 'south', 'east', 'north'].map((key) => searchParams.get(key));
  if (rawValues.some((value) => value === null || value.trim() === '')) return null;
  const values = rawValues.map((value) => Number(value));
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [west, south, east, north] = values;
  if (west < -180 || west > 180 || east < -180 || east > 180) return null;
  if (south < -90 || south > 90 || north < -90 || north > 90 || south >= north) return null;
  return { west, south, east, north };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession({ allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const partnerType = normalizePartnerType(searchParams.get('type'));
  const search = searchParams.get('search');
  const bounds = readBounds(searchParams);

  try {
    const partners = await listPartnerDirectory({
      currentUserId: session.user.id,
      partnerType,
      search,
      bounds,
      category: searchParams.get('category'),
      service: searchParams.get('service'),
    });

    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    console.error('partners GET failed', error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to load partner directory.') },
      { status: 500 },
    );
  }
}
