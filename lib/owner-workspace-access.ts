import { getDb } from './db';
import { NextResponse } from 'next/server';
import { getServerSession } from './auth-session';
import { getAssetRegisterAccountAccess } from './asset-register-account-access';
import type { FuelLedgerData } from './fuel-ledger';
import { calculateMyInvoiceSummary, type MyInvoiceListResult } from './my-invoices';
import { getDesktopScope } from './desktop-workspace';
import { requireTeamAsset, listTeamOwnerAssets, type TeamScope } from './team-access';
import { teamCanAccessAsset, TeamAccessError } from './team-access-policy';
import { assertTeamWorkspaceRequest, projectTeamFuelLedger, projectTeamCosts } from './team-workspace-policy';
export type OwnerWorkspaceContext = { team?: TeamScope; assetIds?: Promise<Set<string>>; ownerUserId: string; actorUserId: string; actorName: string; actorEmail: string };
type ResolveOptions = { ledger?: 'fuel' | 'cost'; requireWrite?: boolean };
type OwnerWorkspaceResolution = { ok: true; context: OwnerWorkspaceContext } | { ok: false; response: NextResponse };
export async function resolveOwnerWorkspaceContext(
  request: Request,
  options: ResolveOptions = {},
): Promise<OwnerWorkspaceResolution> {
  try {
    const url = new URL(request.url);
    const team = await getDesktopScope(url.searchParams.get('desktopMembershipId') || undefined);
    if (team) {
      assertTeamWorkspaceRequest(team.grant.permissions, url, request.method);
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const origin = request.headers.get('origin');
        if (!origin || origin !== url.origin) throw new TeamAccessError('Reload this page before saving.');
      }
      return { ok: true, context: { team, ownerUserId: team.grant.ownerId, actorUserId: team.actor.id, actorName: team.grant.displayName, actorEmail: team.actor.username || team.actor.email } };
    }
  } catch (error) {
    return { ok: false, response: NextResponse.json({ ok: false, error: error instanceof TeamAccessError ? error.message : 'Workspace unavailable.' }, { status: error instanceof TeamAccessError ? error.status : 503 }) };
  }
  const session = await getServerSession({ requireActive: true, allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 }),
    };
  }

  if (new URL(request.url).searchParams.has('accountantShareId') || new URL(request.url).searchParams.has('accountantRegisterId')) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Specialist workspaces have been retired.' }, { status: 410 }) };
  }
  if (!await getAssetRegisterAccountAccess(session)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'This Asset Register is not available to this account.' }, { status: 403 }) };
  }
  return { ok: true, context: {
    ownerUserId: session.user.id, actorUserId: session.user.id,
    actorName: String(session.user.name ?? '').trim(), actorEmail: String(session.user.email ?? '').trim(),
  } };
}

export async function assertWorkspaceAssetAccess(context: OwnerWorkspaceContext, assetId: unknown): Promise<void> {
  if (context.team) await requireTeamAsset(context.team, String(assetId || ''));
}
export async function getWorkspaceAssetIds(context: OwnerWorkspaceContext): Promise<Set<string> | null> {
  if (!context.team) return null;
  const team = context.team;
  context.assetIds ||= listTeamOwnerAssets(context.ownerUserId).then(assets => new Set(assets.filter(asset => teamCanAccessAsset(team.grant, asset)).map(asset => asset.id)));
  return context.assetIds;
}
export async function filterFuelLedgerForWorkspace(context: OwnerWorkspaceContext, ledger: FuelLedgerData): Promise<FuelLedgerData> {
  if (!context.team) return ledger;
  const ids = (await getWorkspaceAssetIds(context))!;
  const projected = projectTeamFuelLedger(ledger,ids,context.team.grant.permissions,context.team.grant.id);
  const totals = (await getDb().query(`SELECT
    coalesce(sum(CASE WHEN event_type='asset_issue' THEN litres ELSE 0 END),0) AS issued,
    coalesce(sum(CASE WHEN event_type IN ('opening_balance','stock_in') THEN litres ELSE 0 END),0) AS filled
    FROM fuel_storage_events WHERE user_id=$1 AND created_at>=now()-interval '30 days'
    AND (asset_register_item_id::text=ANY($2::text[]) OR (asset_register_item_id IS NULL AND $3=true))`,
    [context.ownerUserId,[...ids],context.team.grant.permissions.viewFuelStorage])).rows[0];
  projected.summary.issuedLitres30Days = Number(totals?.issued || 0);
  projected.summary.filledLitres30Days = Number(totals?.filled || 0);
  return projected;
}
export async function filterCostLedgerForWorkspace(context: OwnerWorkspaceContext, data: MyInvoiceListResult): Promise<MyInvoiceListResult> {
  return context.team ? projectTeamCosts(data, (await getWorkspaceAssetIds(context))!, context.team.grant.permissions, calculateMyInvoiceSummary) : data;
}
export async function assertTeamFuelTarget(context: OwnerWorkspaceContext, value: { [key: string]: unknown }): Promise<void> {
  if (!context.team) return;
  if (value.targetType === 'asset') await assertWorkspaceAssetAccess(context, value.assetId || value.targetId);
  else if (value.targetType !== 'storage_tank' || !context.team.grant.permissions.viewFuelStorage)
    throw new TeamAccessError('This fuel target is not available.');
}
