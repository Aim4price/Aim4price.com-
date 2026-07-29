import { NextRequest, NextResponse } from 'next/server';
import { getDealerCostRequestContext } from '../../../../lib/dealer-cost-request';
import {
  createDealerCost,
  listDealerCostsData,
} from '../../../../lib/dealer-costs';
import type {
  MyInvoiceDraftInput,
  MyInvoiceListFilters,
} from '../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseYear(value: string | null): number | null {
  if (!value || value === 'all' || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

function parseMonth(value: string | null): number | null {
  if (!value || value === 'all' || !/^\d{1,2}$/.test(value)) return null;
  const month = Number(value);
  return month >= 1 && month <= 12 ? month : null;
}

function parseFilters(request: NextRequest): MyInvoiceListFilters {
  const assetId = String(request.nextUrl.searchParams.get('assetId') ?? '').trim();
  const ownerUserId = String(request.nextUrl.searchParams.get('ownerId') ?? '').trim();
  return {
    assetId: assetId && assetId !== 'all' ? assetId : null,
    ownerUserId: ownerUserId && ownerUserId !== 'all' ? ownerUserId : null,
    year: parseYear(request.nextUrl.searchParams.get('year')),
    month: parseMonth(request.nextUrl.searchParams.get('month')),
  };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'DEALER_COST_ASSET_FORBIDDEN') {
    return 'This asset is not currently shared with your dealership.';
  }
  if (message === 'INVOICE_DOCUMENT_NOT_FOUND') {
    return 'The selected invoice/photo could not be found for this shared asset.';
  }
  if (message === 'INVOICE_CREATE_FAILED') {
    return 'The cost record could not be saved. Please try again.';
  }
  if (message === 'DEALER_FUEL_COST_NOT_ALLOWED') {
    return 'Fuel slips cannot be saved from the dealer cost screen.';
  }
  return message || 'The dealer Costs request could not be completed.';
}

export async function GET(request: NextRequest) {
  const context = await getDealerCostRequestContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  try {
    const data = await listDealerCostsData(context.actor.dealerUserId, parseFilters(request));
    return NextResponse.json({
      ok: true,
      ...data,
      dealerDefaults: {
        supplierName: context.actor.supplierName,
        vatNumber: context.vatNumber,
        address: context.address,
      },
    });
  } catch (error) {
    console.error('Aim4price Dealer Costs GET failed.', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = await getDealerCostRequestContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  let body: MyInvoiceDraftInput;
  try {
    body = (await request.json()) as MyInvoiceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid cost record payload.' }, { status: 400 });
  }

  try {
    const result = await createDealerCost(context.actor, body);
    const data = await listDealerCostsData(context.actor.dealerUserId, {});
    return NextResponse.json({
      ok: true,
      invoice: result.invoice,
      duplicateWarnings: result.duplicateWarnings,
      ...data,
    });
  } catch (error) {
    console.error('Aim4price Dealer Costs POST failed.', error);
    const message = errorMessage(error);
    const status = message.includes('not currently shared') || message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
