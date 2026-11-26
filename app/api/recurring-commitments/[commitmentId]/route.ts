import { NextResponse } from 'next/server';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { getDb } from '../../../../lib/db';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from '../../../../lib/owner-app-access';
import { getDesktopScope } from '../../../../lib/desktop-workspace';
import { auditTeam, lockTeamPermission, requireTeamAsset } from '../../../../lib/team-access';
import { TeamAccessError } from '../../../../lib/team-access-policy';

export const runtime = 'nodejs';
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function PATCH(request: Request, { params }: { params: { commitmentId: string } }) {
  const url = new URL(request.url);
  if (!isTrustedRequestOrigin(request.headers.get('origin'), url.origin)) return error('Reload the page before saving.', 403);
  const team = await getDesktopScope(url.searchParams.get('desktopMembershipId') || undefined);
  const access = team ? null : await getOwnerAppAccess();
  if (!team && (!access || !ownerAppCan(access, 'manage_finance'))) return error('Finance access is required.', 403);
  const ownerId = team?.grant.ownerId ?? access!.ownerUserId;
  const actorId = team?.actor.id ?? access?.ownerAppUserId ?? ownerId;
  const body = await request.json().catch(() => null);
  if (!body || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 999999999999.99
    || Math.abs(body.amount * 100 - Math.round(body.amount * 100)) > 0.01
    || typeof body.paused !== 'boolean' || !Number.isFinite(body.previousAmount) || typeof body.previousPaused !== 'boolean') {
    return error('Enter a positive amount with up to two decimal places.', 400);
  }

  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const grant = team ? await lockTeamPermission(client, team, 'editCosts') : null;
    const args = [ownerId, params.commitmentId];
    const {rows: [current]} = await client.query(
      "select id, amount, status from public.asset_recurring_commitments where owner_user_id=$1 and id::text=$2 and status in ('active','paused') for update", args);
    if (!current) throw new TeamAccessError('Recurring cost unavailable.', 404);
    const {rows: links} = await client.query(
      'select asset_register_item_id::text as id from public.asset_recurring_commitment_assets where owner_user_id=$1 and recurring_commitment_id::text=$2 for update', args);
    if (!links.length) throw new TeamAccessError('Recurring cost unavailable.', 404);
    for (const link of links) {
      if (team && grant) await requireTeamAsset({...team, grant}, link.id, client);
      else if (!access || !ownerAppCanAccessAsset(access, link.id)) throw new TeamAccessError('Recurring cost unavailable.', 404);
    }
    if (Number(current.amount) !== body.previousAmount || (current.status === 'paused') !== body.previousPaused) {
      throw new TeamAccessError('This cost changed. Reopen it to see the latest amount.', 409);
    }
    const status = body.paused ? 'paused' : 'active';
    await client.query(`update public.asset_recurring_commitments set amount=$3, status=$4, updated_at=now(), updated_by_user_id=$5
      where owner_user_id=$1 and id::text=$2`, [...args,body.amount,status,actorId]);
    if (body.amount !== Number(current.amount) && Number(current.amount) > 0) {
      await client.query(`update public.asset_recurring_commitment_assets set annual_allocation=round(annual_allocation*$3::numeric/$4::numeric,2)
        where owner_user_id=$1 and recurring_commitment_id::text=$2 and annual_allocation is not null`, [...args,body.amount,current.amount]);
    }
    if (team && grant) await auditTeam(client,team.actor,grant,'editCosts',links.length === 1 ? links[0].id : null,{commitmentId:current.id});
    await client.query('COMMIT');
    return NextResponse.json({ok:true});
  } catch (cause) {
    await client.query('ROLLBACK');
    if (cause instanceof TeamAccessError) return error(cause.message, cause.status);
    return error('The recurring cost could not be saved.', 500);
  } finally { client.release(); }
}
