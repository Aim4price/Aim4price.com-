import { NextRequest, NextResponse } from 'next/server';
import {
  createMyInvoice,
  listMyInvoicesData,
  type MyInvoiceDraftInput,
  type MyInvoiceListFilters,
} from '../../../lib/my-invoices';
import {
  assertWorkspaceAssetAccess,
  filterCostLedgerForWorkspace,
  resolveOwnerWorkspaceContext,
} from '../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ErrorWithMessage = {
  message?: string;
};

function parseYear(value: string | null): number | null {
  if (!value || value === 'all') return null;
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

function parseMonth(value: string | null): number | null {
  if (!value || value === 'all') return null;
  if (!/^\d{1,2}$/.test(value)) return null;
  const month = Number(value);
  return month >= 1 && month <= 12 ? month : null;
}

function parseFilters(request: NextRequest): MyInvoiceListFilters {
  const searchParams = request.nextUrl.searchParams;
  const assetId = searchParams.get('assetId');

  return {
    assetId: assetId && assetId !== 'all' ? assetId : null,
    year: parseYear(searchParams.get('year')),
    month: parseMonth(searchParams.get('month')),
  };
}

function errorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null ? (error as ErrorWithMessage).message : '';

  if (message === 'ASSET_NOT_FOUND') return 'The selected asset could not be found for this account.';
  if (message === 'INVOICE_DOCUMENT_NOT_FOUND') return 'The selected invoice/photo document could not be found for this asset.';
  if (message === 'INVOICE_CREATE_FAILED') return 'The cost record could not be saved. Please try again.';
  if (typeof message === 'string' && message.trim()) return message;

  return 'The My Cost Ledger request could not be completed.';
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  const { context } = resolved;

  try {
    const data = await filterCostLedgerForWorkspace(
      context,
      await listMyInvoicesData(context.ownerUserId, parseFilters(request)),
    );
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error('Aim4price My Cost Ledger GET failed.', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  const { context } = resolved;

  let body: MyInvoiceDraftInput;

  try {
    body = (await request.json()) as MyInvoiceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid cost record payload.' }, { status: 400 });
  }

  try {
    await assertWorkspaceAssetAccess(context, body.assetId);
    const result = await createMyInvoice(context.ownerUserId, body, {
      displayName: context.accountantAccess ? context.actorName : null,
    });
    const data = await filterCostLedgerForWorkspace(
      context,
      await listMyInvoicesData(context.ownerUserId, {}),
    );

    return NextResponse.json({
      ok: true,
      invoice: result.invoice,
      duplicateWarnings: result.duplicateWarnings,
      ...data,
    });
  } catch (error) {
    console.error('Aim4price My Cost Ledger POST failed.', error);
    const message = errorMessage(error);
    const status = message.includes('asset') || message.includes('document') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
