import { NextRequest, NextResponse } from 'next/server';
import {
  listFieldManagerOverview,
  type FieldManagerOverviewRange,
} from '../../../../lib/field-manager-overview';
import { requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readRange(request: NextRequest): FieldManagerOverviewRange | null {
  const requestedRange = request.nextUrl.searchParams.get('range');

  if (!requestedRange) return 'week';
  if (requestedRange === 'week' || requestedRange === 'month') return requestedRange;
  return null;
}

export async function GET(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  const range = readRange(request);
  if (!range) {
    return NextResponse.json(
      { ok: false, error: 'Range must be either week or month.' },
      { status: 400 },
    );
  }

  try {
    const overview = await listFieldManagerOverview({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      range,
    });

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Failed to load Field Manager overview.', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to load the Field Manager overview.' },
      { status: 500 },
    );
  }
}
