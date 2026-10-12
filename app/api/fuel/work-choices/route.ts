import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';
import { getFuelWorkChoices, saveFuelWorkChoices } from '../../../../lib/fuel-work-choices';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const access = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!access.ok) return access.response;
  return NextResponse.json(await getFuelWorkChoices(access.context.ownerUserId), { headers: { 'Cache-Control': 'no-store' } });
}
export async function PUT(request: NextRequest) {
  const access = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel', requireWrite: true });
  if (!access.ok) return access.response;
  try {
    const body = await request.json();
    const saved = await saveFuelWorkChoices(access.context.ownerUserId, body.choices, body.revision);
    if (!saved) return NextResponse.json({ error: 'Work choices changed elsewhere. Close and reopen this form before saving.' }, { status: 409 });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save work choices.' }, { status: 400 });
  }
}
