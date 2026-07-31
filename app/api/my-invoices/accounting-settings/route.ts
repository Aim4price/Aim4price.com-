import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import {
  ACCOUNTING_SOFTWARE_OPTIONS,
  getCostLedgerAccountingSettings,
  saveCostLedgerAccountingSettings,
} from '../../../../lib/my-invoices-accounting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownerSession() {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) return null;

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  return profile.accountType === 'owner' ? session : null;
}

export async function GET() {
  const session = await ownerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'An active owner account is required to manage accounting CSV settings.' },
      { status: 401 },
    );
  }

  try {
    const settings = await getCostLedgerAccountingSettings(session.user.id);
    return NextResponse.json({
      ok: true,
      settings,
      softwareOptions: ACCOUNTING_SOFTWARE_OPTIONS,
    });
  } catch (error) {
    console.error('Aim4price accounting CSV settings GET failed.', error);
    return NextResponse.json(
      { ok: false, error: 'Accounting CSV settings could not be loaded.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await ownerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'An active owner account is required to manage accounting CSV settings.' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Send valid accounting CSV settings.' },
      { status: 400 },
    );
  }

  try {
    const settings = await saveCostLedgerAccountingSettings(session.user.id, body);
    return NextResponse.json({
      ok: true,
      settings,
      softwareOptions: ACCOUNTING_SOFTWARE_OPTIONS,
    });
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : 'Accounting CSV settings could not be saved.';
    console.error('Aim4price accounting CSV settings PUT failed.', error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
