import { NextRequest, NextResponse } from 'next/server';
import {
  ACCOUNTING_SOFTWARE_OPTIONS,
  getCostLedgerAccountingSettings,
  saveCostLedgerAccountingSettings,
} from '../../../../lib/my-invoices-accounting';
import { resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;

  try {
    const settings = await getCostLedgerAccountingSettings(resolved.context.ownerUserId);
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
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;

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
    const settings = await saveCostLedgerAccountingSettings(resolved.context.ownerUserId, body);
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
