import { NextRequest, NextResponse } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { listBillingInvoices } from '../../../../lib/billing';
import { getDb } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  const session = await getAnyServerSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to view your invoices.' }, { status: 401, headers });
  const page = Number(request.nextUrl.searchParams.get('page') || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000) return NextResponse.json({ error: 'Invalid page.' }, { status: 400, headers });
  try {
    // Always scope the account view to the signed-in user, including administrators.
    const result = await listBillingInvoices(session.user.id, false, page);
    const preparing = (await getDb().query('select 1 from aim4price_billing_signup_jobs where user_id=$1 and processed_at is null', [session.user.id])).rowCount;
    return NextResponse.json({ ...result, preparing: Boolean(preparing) }, { headers });
  } catch (error) {
    console.error('Account invoice list failed', error);
    return NextResponse.json({ error: 'Invoices could not be loaded. Please try again.' }, { status: 500, headers });
  }
}
