import { NextResponse } from 'next/server';
import { resolveOwnerWorkspaceContext } from '../../../lib/owner-workspace-access';
import { getDealerCostRequestContext } from '../../../lib/dealer-cost-request';
import { getDealerCostAssetAccess } from '../../../lib/dealer-costs';
import { getOwnerAppAccess, ownerAppCan } from '../../../lib/owner-app-access';
import { getCaptureAdminActor } from '../../../lib/capture-admin-actor';
import { getCaptureAllowance, recordCaptureAssistance } from '../../../lib/capture-allowance';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolve(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  if (type !== 'invoice' && type !== 'fuel_slip') return { response: NextResponse.json({ error: 'Invalid ledger.' }, { status: 400 }) };
  const admin = await getCaptureAdminActor();
  if (params.get('dealer') === '1') {
    const context = await getDealerCostRequestContext();
    if (!context || type !== 'invoice') return { response: NextResponse.json({ error: 'Dealer access required.' }, { status: 403 }) };
    const assetId = params.get('assetId') || '';
    const access = assetId ? await getDealerCostAssetAccess(context.actor.dealerUserId, assetId) : null;
    if (!access) return { response: NextResponse.json({ error: 'Choose a shared asset first.' }, { status: 404 }) };
    return { ownerUserId: access.owner_user_id, actorUserId: context.actor.dealerUserId, type, bypass: !!admin };
  }
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: type === 'invoice' ? 'cost' : 'fuel', requireWrite: true });
  if (!resolved.ok) return { response: resolved.response };
  const { context } = resolved;
  if (!context.accountantAccess) {
    const access = await getOwnerAppAccess();
    if (!access || !ownerAppCan(access, 'manage_finance')) return { response: NextResponse.json({ error: 'Capture access required.' }, { status: 403 }) };
  }
  return { ownerUserId: context.ownerUserId, actorUserId: context.actorUserId, type, bypass: !!admin };
}
export async function GET(request: Request) {
  try {
    const context = await resolve(request);
    if (context.response) return context.response;
    return NextResponse.json({ ok: true, ...await getCaptureAllowance(context.ownerUserId!, context.type as 'invoice' | 'fuel_slip', context.bypass) });
  } catch (error) {
    console.error('Capture allowance lookup failed', error);
    return NextResponse.json({ error: 'The allowance could not be checked. Please try again.' }, { status: 503 });
  }
}
export async function POST(request: Request) {
  try {
    const context = await resolve(request);
    if (context.response) return context.response;
    const body = await request.json();
    if (body.action !== 'shown' && body.action !== 'request') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    const allowance = await getCaptureAllowance(context.ownerUserId!, context.type as 'invoice' | 'fuel_slip', context.bypass);
    if (!allowance.blocked) return NextResponse.json({ error: 'The daily allowance is available.', ...allowance }, { status: 409 });
    await recordCaptureAssistance(context.ownerUserId!, context.actorUserId!, context.type as 'invoice' | 'fuel_slip', body.action === 'request', String(body.note || '').slice(0, 1000));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Capture assistance request failed', error);
    return NextResponse.json({ error: 'Your request could not be saved. Please try again.' }, { status: 503 });
  }
}
