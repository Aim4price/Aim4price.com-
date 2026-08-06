import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../lib/auth-session';
import { getDealerAppSession } from '../../../../../../lib/dealer-app-session';
import {
  listDealerOverview,
  updateDealerProblemAssignment,
  type DealerProblemPriority,
  type DealerProblemWorkflowStatus,
} from '../../../../../../lib/dealer-overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { problemId: string } },
) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Sign in to the Dealer App.' }, { status: 401 });
  }

  const dealerAppSession = await getDealerAppSession();
  const role = dealerAppSession?.role ?? 'owner';
  if (role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'Only an owner or manager can assign problems.' }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    await updateDealerProblemAssignment({
      dealerUserId: session.user.id,
      actorStaffId: dealerAppSession?.staffId ?? null,
      issueNoteStatusId: params.problemId,
      assignedStaffId: typeof body.assignedStaffId === 'string' && body.assignedStaffId.trim()
        ? body.assignedStaffId.trim()
        : null,
      priority: String(body.priority ?? 'normal') as DealerProblemPriority,
      workflowStatus: String(body.workflowStatus ?? 'new') as DealerProblemWorkflowStatus,
      dueDate: typeof body.dueDate === 'string' && body.dueDate.trim() ? body.dueDate.trim() : null,
    });
    const overview = await listDealerOverview({
      dealerUserId: session.user.id,
      currentStaffId: dealerAppSession?.staffId ?? null,
      role,
    });
    return NextResponse.json({ ok: true, overview });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'The problem assignment could not be saved.',
    }, { status: 400 });
  }
}
