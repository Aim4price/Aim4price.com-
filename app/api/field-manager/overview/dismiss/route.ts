import { NextRequest, NextResponse } from 'next/server';
import {
  dismissFieldManagerOverviewItem,
  type FieldManagerOverviewRange,
} from '../../../../../lib/field-manager-overview';
import { requireActiveFieldManagerSession } from '../../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DismissOverviewBody = {
  range?: unknown;
  itemId?: unknown;
  sourceId?: unknown;
};

function asText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readRange(value: unknown): FieldManagerOverviewRange | null {
  return value === 'week' || value === 'month' ? value : null;
}

export async function POST(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  let body: DismissOverviewBody;

  try {
    body = (await request.json()) as DismissOverviewBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid Overview Clear request.' },
      { status: 400 },
    );
  }

  const range = readRange(body.range);
  const itemId = asText(body.itemId, 500);
  const sourceId = asText(body.sourceId, 500);

  if (!range || !itemId || !sourceId) {
    return NextResponse.json(
      { ok: false, error: 'The Overview item could not be cleared.' },
      { status: 400 },
    );
  }

  try {
    const dismissed = await dismissFieldManagerOverviewItem({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      range,
      itemId,
      sourceId,
    });

    return NextResponse.json({ ok: true, ...dismissed });
  } catch (error) {
    if (error instanceof Error && error.message === 'OVERVIEW_ITEM_NOT_FOUND') {
      return NextResponse.json(
        {
          ok: false,
          error: 'This Overview item is no longer available. Refresh and try again.',
        },
        { status: 404 },
      );
    }

    console.error('Failed to clear Field Manager Overview item.', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to clear the Overview item.' },
      { status: 500 },
    );
  }
}
