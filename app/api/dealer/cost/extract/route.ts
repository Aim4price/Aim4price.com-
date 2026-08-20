import { NextResponse } from 'next/server';
import { getDealerCostRequestContext } from '../../../../../lib/dealer-cost-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Authenticated compatibility response for dealer clients using the old reader. */
export async function POST() {
  const context = await getDealerCostRequestContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Automatic invoice reading has been retired. Send the invoice for Aim4price capture instead.',
      captureEndpoint: '/api/dealer/capture-requests/invoice',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
