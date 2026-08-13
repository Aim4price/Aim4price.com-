import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import {
  completeAssetMaintenanceRecord,
  unknownMaintenanceCompletionNote,
} from '../../../../../lib/asset-maintenance';
import { markAssetIssueNoteStatusNoted } from '../../../../../lib/asset-issue-notes';
import { getServerSession } from '../../../../../lib/auth-session';
import { getDealerAppSession } from '../../../../../lib/dealer-app-session';
import { getDealerTrackedAsset } from '../../../../../lib/dealer-maintenance-tracker';
import {
  dismissDealerOverviewItem,
  listDealerOverview,
  resolveDealerOverviewProblemAssignment,
} from '../../../../../lib/dealer-overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OverviewClearOutcome = 'clear' | 'completed' | 'problem_done';

function readOutcome(value: unknown): OverviewClearOutcome | null {
  if (value === 'clear' || value === 'completed' || value === 'problem_done') return value;
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Sign in to the Dealer App.' }, { status: 401 });
  }

  const [profile, dealerAppSession] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    getDealerAppSession(),
  ]);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Sign in to the Dealer App.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const itemId = String(body?.itemId ?? '').trim();
    const sourceId = String(body?.sourceId ?? '').trim();
    const outcome = readOutcome(body?.outcome);
    if (!itemId || !sourceId || !outcome) {
      return NextResponse.json({ ok: false, error: 'Choose a valid Overview Clear option.' }, { status: 400 });
    }

    const context = {
      dealerUserId: session.user.id,
      currentStaffId: dealerAppSession?.staffId ?? null,
      role: dealerAppSession?.role ?? 'owner' as const,
    };
    const currentOverview = await listDealerOverview(context);
    const item = currentOverview.items.find(
      (candidate) => candidate.id === itemId && candidate.sourceId === sourceId,
    );
    if (!item) throw new Error('OVERVIEW_ITEM_NOT_FOUND');

    const asset = await getDealerTrackedAsset(session.user.id, item.accessId);
    if (!asset || asset.assetId !== item.assetId) throw new Error('OVERVIEW_ITEM_NOT_FOUND');

    if (outcome === 'completed') {
      if (item.type !== 'service' && item.type !== 'checkup') {
        throw new Error('OVERVIEW_MAINTENANCE_REQUIRED');
      }
      await completeAssetMaintenanceRecord(
        asset.ownerUserId,
        item.sourceId,
        {
          completedNotes: unknownMaintenanceCompletionNote(item.type),
          completedBy: dealerAppSession?.displayName
            || profile.displayName
            || profile.businessName
            || session.user.name
            || 'Dealer App user',
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
        currentUserId: asset.ownerUserId,
        issueNoteStatusId: item.sourceId,
      });
      await resolveDealerOverviewProblemAssignment(session.user.id, item.sourceId);
    } else {
      if (item.type === 'problem') throw new Error('OVERVIEW_PROBLEM_NOT_DONE');
      await dismissDealerOverviewItem({ dealerUserId: session.user.id, item });
    }

    return NextResponse.json({
      ok: true,
      overview: await listDealerOverview(context),
      outcome,
    });
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
    console.error('Dealer Overview Clear failed.', error);
    return NextResponse.json({ ok: false, error: 'The Overview item could not be cleared.' }, { status: 400 });
  }
}
