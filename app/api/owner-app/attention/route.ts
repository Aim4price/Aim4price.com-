import { NextRequest, NextResponse } from 'next/server';
import {
  completeAssetMaintenanceRecord,
  unknownMaintenanceCompletionNote,
} from '../../../../lib/asset-maintenance';
import { markAssetIssueNoteStatusNoted } from '../../../../lib/asset-issue-notes';
import { getOwnerAppAccess } from '../../../../lib/owner-app-access';
import {
  dismissOwnerAppOverviewItem,
  getOwnerAppOverviewItem,
  listOwnerAppOverview,
  type OwnerAppOverviewRange,
} from '../../../../lib/owner-app-overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OverviewClearOutcome = 'clear' | 'completed' | 'problem_done';

function range(value: unknown): OwnerAppOverviewRange {
  return String(value ?? '') === 'week' ? 'week' : 'upcoming';
}

function outcome(value: unknown): OverviewClearOutcome | null {
  if (value === 'clear' || value === 'completed' || value === 'problem_done') return value;
  return null;
}

export async function GET(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
  try {
    const overview = await listOwnerAppOverview(
      access.ownerUserId,
      access.viewerKey,
      range(request.nextUrl.searchParams.get('range')),
      access.assetScope === 'selected' ? access.accessibleAssetIds : null,
    );
    return NextResponse.json({
      ...overview,
      canClearForEveryone: access.accessRole === 'admin',
    });
  } catch (error) {
    console.error('Owner App attention GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load Needs Attention.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const requestedRange = range(body.range);
    const itemId = String(body.itemId ?? '').trim();
    const sourceId = String(body.sourceId ?? '').trim();
    const requestedOutcome = outcome(body.outcome);
    const allowedAssetIds = access.assetScope === 'selected' ? access.accessibleAssetIds : null;
    const clearForEveryone = body.clearForEveryone === true && access.accessRole === 'admin';

    if (!itemId || !sourceId || !requestedOutcome) {
      return NextResponse.json({ ok: false, error: 'A valid Overview Clear choice is required.' }, { status: 400 });
    }

    const item = await getOwnerAppOverviewItem(
      access.ownerUserId,
      requestedRange,
      itemId,
      sourceId,
      allowedAssetIds,
    );

    if (requestedOutcome === 'completed') {
      if (item.type !== 'service' && item.type !== 'checkup') {
        throw new Error('OVERVIEW_MAINTENANCE_REQUIRED');
      }
      await completeAssetMaintenanceRecord(
        access.ownerUserId,
        item.sourceId,
        {
          completedNotes: unknownMaintenanceCompletionNote(item.type),
          completedBy: access.displayName,
        },
        {
          assetId: item.assetId,
          maintenanceType: item.type,
          allowUnknownDetails: true,
        },
      );
    } else if (requestedOutcome === 'problem_done') {
      if (item.type !== 'problem') throw new Error('OVERVIEW_PROBLEM_REQUIRED');
      await markAssetIssueNoteStatusNoted({
        currentUserId: access.ownerUserId,
        issueNoteStatusId: item.sourceId,
      });
    } else {
      if (item.type === 'problem') throw new Error('OVERVIEW_PROBLEM_NOT_DONE');
      await dismissOwnerAppOverviewItem(
        access.ownerUserId,
        access.viewerKey,
        requestedRange,
        item.id,
        item.sourceId,
        allowedAssetIds,
        clearForEveryone,
      );
    }

    const overview = await listOwnerAppOverview(
      access.ownerUserId,
      access.viewerKey,
      requestedRange,
      allowedAssetIds,
    );
    return NextResponse.json({
      ...overview,
      canClearForEveryone: access.accessRole === 'admin',
      outcome: requestedOutcome,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'OVERVIEW_PROBLEM_NOT_DONE') {
      return NextResponse.json(
        { ok: false, error: 'A problem can only be cleared after it has been marked done.' },
        { status: 400 },
      );
    }
    console.error('Owner App attention dismiss failed.', error);
    return NextResponse.json({ ok: false, error: 'This item could not be cleared.' }, { status: 400 });
  }
}
