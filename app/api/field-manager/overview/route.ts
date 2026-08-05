import { NextRequest, NextResponse } from 'next/server';
import {
  listFieldManagerOverview,
  type FieldManagerOverviewRange,
  type FieldManagerOverviewView,
} from '../../../../lib/field-manager-overview';
import { requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readView(request: NextRequest): FieldManagerOverviewView | null {
  const requestedView = request.nextUrl.searchParams.get('view');
  if (!requestedView || requestedView === 'active') return 'active';
  if (requestedView === 'history') return 'history';
  return null;
}

function readRange(request: NextRequest): FieldManagerOverviewRange | null {
  const requestedRange = request.nextUrl.searchParams.get('range');

  if (!requestedRange || requestedRange === 'upcoming' || requestedRange === 'month') {
    return 'upcoming';
  }
  if (requestedRange === 'week') return 'week';
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
  const view = readView(request);
  if (!range || !view) {
    return NextResponse.json(
      { ok: false, error: 'Range or notification view is invalid.' },
      { status: 400 },
    );
  }

  try {
    const overview = await listFieldManagerOverview({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      range,
      view,
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
