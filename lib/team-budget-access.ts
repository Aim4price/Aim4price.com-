import { NextResponse } from 'next/server';
import { getDesktopScope } from './desktop-workspace';
import { resolveOwnerWorkspaceContext, getWorkspaceAssetIds, assertWorkspaceAssetAccess } from './owner-workspace-access';
import { listCostBudgetsWithProgress, createCostBudget, updateCostBudget, deleteCostBudget, type CostBudgetInput } from './cost-budgets';
import { listMyInvoiceAssets } from './my-invoices';
import { teamWriteGuard } from './team-write-guard';
/** Return null for ordinary owner/app callers; preserve their existing access logic. */
export async function teamBudgetResponse(request: Request, budgetId?: string): Promise<NextResponse | null> {
  const scope = await getDesktopScope(new URL(request.url).searchParams.get('desktopMembershipId') || undefined);
  if (!scope) return null;
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;
  if (!scope.grant.permissions.viewBudgets) return NextResponse.json({ok:false,error:'Budget access is not enabled.'},{status:403});
  try {
    const ids = (await getWorkspaceAssetIds(workspace))!;
    const budgets = (await listCostBudgetsWithProgress(workspace.ownerUserId, {recordAlerts:false})).filter(budget => budget.assetId ? ids.has(budget.assetId) : scope.grant.scope === 'all');
    if (request.method === 'GET') {
      const assets = (await listMyInvoiceAssets(workspace.ownerUserId)).filter(asset => ids.has(asset.id)).map(asset => ({...asset,value:scope.grant.permissions.viewValues ? asset.value : 0}));
      return NextResponse.json({ok:true,budgets,assets},{headers:{'Cache-Control':'private, no-store'}});
    }
    if (budgetId && !budgets.some(budget => budget.id === budgetId)) return NextResponse.json({ok:false,error:'Budget unavailable.'},{status:404});
    if (request.method === 'DELETE') {
      await deleteCostBudget(workspace.ownerUserId, budgetId, teamWriteGuard(workspace,'manageBudgets',{budgetId}));
      return NextResponse.json({ok:true});
    }
    const body = await request.json() as CostBudgetInput;
    if (body.assetId && body.assetId !== 'all') await assertWorkspaceAssetAccess(workspace,body.assetId);
    else if (scope.grant.scope !== 'all') return NextResponse.json({ok:false,error:'Choose an accessible asset.'},{status:403});
    const assetId = body.assetId && body.assetId !== 'all' ? String(body.assetId) : undefined;
    const guard = teamWriteGuard(workspace,'manageBudgets',{budgetId,assetId,globalBudget:!assetId});
    const budget = budgetId ? await updateCostBudget(workspace.ownerUserId,budgetId,body,guard) : await createCostBudget(workspace.ownerUserId,body,guard);
    return NextResponse.json({ok:true,budget});
  } catch { return NextResponse.json({ok:false,error:'The budget could not be saved. Check the asset, amount and period.'},{status:400}); }
}
