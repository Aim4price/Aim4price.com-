import { NextResponse } from 'next/server';
import { getServerSession } from './auth-session';
import { getAssetRegisterAccountAccess } from './asset-register-account-access';
import type { FuelLedgerData } from './fuel-ledger';
import type { MyInvoiceListResult } from './my-invoices';
export type OwnerWorkspaceContext = { ownerUserId: string; actorUserId: string; actorName: string; actorEmail: string };
type ResolveOptions = { ledger?: 'fuel' | 'cost'; requireWrite?: boolean };
type OwnerWorkspaceResolution = { ok: true; context: OwnerWorkspaceContext } | { ok: false; response: NextResponse };
export async function resolveOwnerWorkspaceContext(
  request: Request,
  options: ResolveOptions = {},
): Promise<OwnerWorkspaceResolution> {
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

export async function assertWorkspaceAssetAccess(_context: OwnerWorkspaceContext, _assetId: unknown): Promise<void> {}
export async function getWorkspaceAssetIds(_context: OwnerWorkspaceContext): Promise<Set<string> | null> { return null; }
export async function filterFuelLedgerForWorkspace(_context: OwnerWorkspaceContext, ledger: FuelLedgerData): Promise<FuelLedgerData> { return ledger; }
export async function filterCostLedgerForWorkspace(_context: OwnerWorkspaceContext, data: MyInvoiceListResult): Promise<MyInvoiceListResult> { return data; }
