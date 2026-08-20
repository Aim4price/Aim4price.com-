import { NextResponse } from 'next/server';
import {
  deleteCostBudget,
  listCostBudgetsWithProgress,
  updateCostBudget,
  type CostBudgetInput,
  type CostBudgetProgress,
} from '../../../../../lib/cost-budgets';
import {
  getOwnerAppAccess,
  ownerAppCan,
  ownerAppCanAccessAsset,
  type OwnerAppAccess,
} from '../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { budgetId?: string } };

function responseHeaders(): Record<string, string> {
  return { 'Cache-Control': 'private, no-store, max-age=0' };
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: responseHeaders() });
}

async function getBudgetAccess(): Promise<OwnerAppAccess | NextResponse> {
  const access = await getOwnerAppAccess();
  if (!access) return errorResponse('You must be signed in as an active owner.', 401);
  if (!ownerAppCan(access, 'manage_finance')) {
    return errorResponse('You do not have permission to manage Cost Ledger budgets.', 403);
  }
  return access;
}

function canAccessBudgetScope(access: OwnerAppAccess, assetId: unknown): boolean {
  const normalizedAssetId = String(assetId ?? '').trim();
  if (!normalizedAssetId || normalizedAssetId === 'all') return access.assetScope === 'all';
  return ownerAppCanAccessAsset(access, normalizedAssetId);
}

function visibleBudget(access: OwnerAppAccess, budget: CostBudgetProgress): boolean {
  return canAccessBudgetScope(access, budget.assetId);
}

function budgetError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';
  if (code === 'COST_BUDGET_DUPLICATE') {
    return errorResponse('A budget already exists for this asset scope and period.', 409);
  }
  if (code === 'COST_BUDGET_NOT_FOUND') {
    return errorResponse('This budget could not be found.', 404);
  }
  if (code === 'COST_BUDGET_ASSET_NOT_FOUND') {
    return errorResponse('The selected asset could not be found for this account.', 404);
  }
  if (
    code === 'COST_BUDGET_ID_INVALID'
    || code === 'COST_BUDGET_ASSET_INVALID'
    || code === 'COST_BUDGET_PERIOD_INVALID'
    || code === 'COST_BUDGET_AMOUNT_INVALID'
    || code === 'COST_BUDGET_WARNING_INVALID'
  ) {
    return errorResponse(
      code === 'COST_BUDGET_AMOUNT_INVALID'
        ? 'Enter a budget amount of at least R1.'
        : code === 'COST_BUDGET_WARNING_INVALID'
          ? 'Choose a warning level from 1% to 99%.'
          : code === 'COST_BUDGET_PERIOD_INVALID'
            ? 'Choose a monthly or annual budget.'
            : 'The budget details are invalid.',
      400,
    );
  }

  console.error('Cost Ledger budget item request failed.', error);
  return errorResponse('The budget request could not be completed.', 500);
}

async function findVisibleBudget(access: OwnerAppAccess, budgetId: string): Promise<CostBudgetProgress | null> {
  const budget = (await listCostBudgetsWithProgress(access.ownerUserId))
    .find((item) => item.id === budgetId);
  return budget && visibleBudget(access, budget) ? budget : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await getBudgetAccess();
  if (access instanceof NextResponse) return access;

  const budgetId = String(params.budgetId ?? '').trim();
  let current: CostBudgetProgress | null;
  try {
    current = await findVisibleBudget(access, budgetId);
  } catch (error) {
    return budgetError(error);
  }
  if (!current) return errorResponse('This budget could not be found.', 404);

  const body = await request.json().catch(() => null) as CostBudgetInput | null;
  if (!body) return errorResponse('Invalid budget payload.', 400);
  if (!canAccessBudgetScope(access, body.assetId)) {
    return errorResponse('You do not have access to that budget scope.', 403);
  }

  try {
    const budget = await updateCostBudget(access.ownerUserId, budgetId, body);
    return NextResponse.json({ ok: true, budget }, { headers: responseHeaders() });
  } catch (error) {
    return budgetError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const access = await getBudgetAccess();
  if (access instanceof NextResponse) return access;

  const budgetId = String(params.budgetId ?? '').trim();
  let current: CostBudgetProgress | null;
  try {
    current = await findVisibleBudget(access, budgetId);
  } catch (error) {
    return budgetError(error);
  }
  if (!current) return errorResponse('This budget could not be found.', 404);

  try {
    const deleted = await deleteCostBudget(access.ownerUserId, budgetId);
    if (!deleted) return errorResponse('This budget could not be found.', 404);
    return NextResponse.json({ ok: true }, { headers: responseHeaders() });
  } catch (error) {
    return budgetError(error);
  }
}
