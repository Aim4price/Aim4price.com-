import { NextResponse } from 'next/server';
import {
  createCostBudget,
  listCostBudgetsWithProgress,
  type CostBudgetInput,
  type CostBudgetProgress,
} from '../../../../lib/cost-budgets';
import { listMyInvoiceAssets } from '../../../../lib/my-invoices';
import {
  getOwnerAppAccess,
  ownerAppCan,
  ownerAppCanAccessAsset,
  type OwnerAppAccess,
} from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function responseHeaders(): Record<string, string> {
  return { 'Cache-Control': 'private, no-store, max-age=0' };
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'You must be signed in as an active owner.' },
    { status: 401, headers: responseHeaders() },
  );
}

function forbidden() {
  return NextResponse.json(
    { ok: false, error: 'You do not have permission to manage Cost Ledger budgets.' },
    { status: 403, headers: responseHeaders() },
  );
}

async function getBudgetAccess(): Promise<OwnerAppAccess | NextResponse> {
  const access = await getOwnerAppAccess();
  if (!access) return unauthorized();
  if (!ownerAppCan(access, 'manage_finance')) return forbidden();
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
    return NextResponse.json(
      { ok: false, error: 'A budget already exists for this asset scope and period.' },
      { status: 409, headers: responseHeaders() },
    );
  }
  if (code === 'COST_BUDGET_ASSET_NOT_FOUND') {
    return NextResponse.json(
      { ok: false, error: 'The selected asset could not be found for this account.' },
      { status: 404, headers: responseHeaders() },
    );
  }
  if (
    code === 'COST_BUDGET_ASSET_INVALID'
    || code === 'COST_BUDGET_PERIOD_INVALID'
    || code === 'COST_BUDGET_AMOUNT_INVALID'
    || code === 'COST_BUDGET_WARNING_INVALID'
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: code === 'COST_BUDGET_AMOUNT_INVALID'
          ? 'Enter a budget amount of at least R1.'
          : code === 'COST_BUDGET_WARNING_INVALID'
            ? 'Choose a warning level from 1% to 99%.'
            : code === 'COST_BUDGET_PERIOD_INVALID'
              ? 'Choose a monthly or annual budget.'
              : 'Choose a valid asset.',
      },
      { status: 400, headers: responseHeaders() },
    );
  }

  console.error('Cost Ledger budget request failed.', error);
  return NextResponse.json(
    { ok: false, error: 'The budget request could not be completed.' },
    { status: 500, headers: responseHeaders() },
  );
}

export async function GET() {
  const access = await getBudgetAccess();
  if (access instanceof NextResponse) return access;

  try {
    const [allBudgets, allAssets] = await Promise.all([
      listCostBudgetsWithProgress(access.ownerUserId),
      listMyInvoiceAssets(access.ownerUserId),
    ]);
    const budgets = allBudgets.filter((budget) => visibleBudget(access, budget));
    const assets = allAssets.filter((asset) => ownerAppCanAccessAsset(access, asset.id));
    return NextResponse.json({ ok: true, budgets, assets }, { headers: responseHeaders() });
  } catch (error) {
    return budgetError(error);
  }
}

export async function POST(request: Request) {
  const access = await getBudgetAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null) as CostBudgetInput | null;
  if (!body) {
    return NextResponse.json(
      { ok: false, error: 'Invalid budget payload.' },
      { status: 400, headers: responseHeaders() },
    );
  }
  if (!canAccessBudgetScope(access, body.assetId)) return forbidden();

  try {
    const budget = await createCostBudget(access.ownerUserId, body);
    return NextResponse.json({ ok: true, budget }, { status: 201, headers: responseHeaders() });
  } catch (error) {
    return budgetError(error);
  }
}

