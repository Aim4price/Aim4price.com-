import { NextRequest, NextResponse } from 'next/server';
import {
  completeAssetMaintenanceRecord,
  unknownMaintenanceCompletionNote,
} from '../../../../../lib/asset-maintenance';
import { markAssetIssueNoteStatusNoted } from '../../../../../lib/asset-issue-notes';
import {
  dismissFieldManagerOverviewItem,
  listFieldManagerOverview,
  type FieldManagerOverviewRange,
} from '../../../../../lib/field-manager-overview';
import { requireActiveFieldManagerSession } from '../../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OverviewClearOutcome = 'clear' | 'completed' | 'problem_done';

type DismissOverviewBody = {
  range?: unknown;
  itemId?: unknown;
  sourceId?: unknown;
  outcome?: unknown;
};

function asText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readRange(value: unknown): FieldManagerOverviewRange | null {
  if (value === 'week') return 'week';
  if (value === 'upcoming' || value === 'month') return 'upcoming';
  return null;
}

function readOutcome(value: unknown): OverviewClearOutcome | null {
  if (value === 'clear' || value === 'completed' || value === 'problem_done') return value;
  return null;
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
  const outcome = readOutcome(body.outcome);

  if (!range || !itemId || !sourceId || !outcome) {
    return NextResponse.json(
      { ok: false, error: 'The Overview item could not be cleared.' },
      { status: 400 },
    );
  }

  try {
    const currentOverview = await listFieldManagerOverview({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      range,
    });
    const item = currentOverview.items.find(
      (candidate) => candidate.id === itemId && candidate.sourceId === sourceId,
    );
    if (!item) throw new Error('OVERVIEW_ITEM_NOT_FOUND');

    if (outcome === 'completed') {
      if (item.type !== 'service' && item.type !== 'checkup') {
        throw new Error('OVERVIEW_MAINTENANCE_REQUIRED');
      }
      await completeAssetMaintenanceRecord(
        access.session.ownerUserId,
        item.sourceId,
        {
          completedNotes: unknownMaintenanceCompletionNote(item.type),
          completedBy: access.session.displayName,
        },
        {
          assetId: item.assetId,
          maintenanceType: item.type,
          allowUnknownDetails: true,
        },
      );
    } else if (outcome === 'problem_done') {
      if (item.type !== 'problem') throw new Error('OVERVIEW_PROBLEM_REQUIRED');
      await markAssetIssueNoteStatusNoted({
        currentUserId: access.session.ownerUserId,
        issueNoteStatusId: item.sourceId,
      });
    } else {
      if (item.type === 'problem') throw new Error('OVERVIEW_PROBLEM_NOT_DONE');
      await dismissFieldManagerOverviewItem({
        ownerUserId: access.session.ownerUserId,
        managerId: access.session.managerId,
        range,
        itemId,
        sourceId,
      });
    }

    const overview = await listFieldManagerOverview({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      range,
    });
    return NextResponse.json({ ...overview, outcome });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'OVERVIEW_ITEM_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: 'This Overview item is no longer available. Refresh and try again.' },
        { status: 404 },
      );
    }
    if (code === 'OVERVIEW_PROBLEM_NOT_DONE') {
      return NextResponse.json(
        { ok: false, error: 'A problem can only be cleared after it has been marked done.' },
        { status: 400 },
      );
    }

    console.error('Failed to clear Field Manager Overview item.', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to clear the Overview item.' },
      { status: 500 },
    );
  }
}
