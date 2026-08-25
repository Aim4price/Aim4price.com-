import { NextResponse } from 'next/server';
import { getServerSession } from './auth-session';
import { getAssetRegisterAccountAccess } from './asset-register-account-access';
import {
  accountantWorkspaceError,
  getAccountantRegisterAccess,
  type AccountantRegisterAccess,
} from './accountant-workspace';
import { getAssetRegisterItemById, listAssetRegisterItems } from './asset-register-db';
import type { FuelLedgerData } from './fuel-ledger';
import { getAssetRegisterForUser } from './asset-registers';
import {
  calculateMyInvoiceSummary,
  type MyInvoiceListResult,
} from './my-invoices';

export const ACCOUNTANT_SHARE_PARAM = 'accountantShareId';
export const ACCOUNTANT_REGISTER_PARAM = 'accountantRegisterId';

export type OwnerWorkspaceContext = {
  ownerUserId: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  accountantShareId: string;
  accountantRegisterId: string;
  accountantAccess: AccountantRegisterAccess | null;
};

type ResolveOptions = {
  ledger?: 'fuel' | 'cost';
  requireWrite?: boolean;
};

type OwnerWorkspaceResolution =
  | { ok: true; context: OwnerWorkspaceContext }
  | { ok: false; response: NextResponse };

function requestShareId(request: Request): string {
  try {
    return new URL(request.url).searchParams.get(ACCOUNTANT_SHARE_PARAM)?.trim() ?? '';
  } catch {
    return '';
  }
}

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

  const accountantShareId = requestShareId(request);
  if (!accountantShareId) {
    if (!await getAssetRegisterAccountAccess(session)) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'This Asset Register is not available to this account.' },
          { status: 403 },
        ),
      };
    }

    return {
      ok: true,
      context: {
        ownerUserId: session.user.id,
        actorUserId: session.user.id,
        actorName: String(session.user.name ?? '').trim(),
        actorEmail: String(session.user.email ?? '').trim(),
        accountantShareId: '',
        accountantRegisterId: '',
        accountantAccess: null,
      },
    };
  }

  try {
    const access = await getAccountantRegisterAccess({
      accountantUserId: session.user.id,
      shareId: accountantShareId,
      ledger: options.ledger,
      requireWrite: options.requireWrite,
    });
    const requestedRegisterId = (() => {
      try {
        return new URL(request.url).searchParams.get(ACCOUNTANT_REGISTER_PARAM)?.trim() || access.registerId;
      } catch {
        return access.registerId;
      }
    })();
    const register = await getAssetRegisterForUser(access.ownerUserId, requestedRegisterId);
    if (!register) throw new Error('ACCOUNTANT_REGISTER_NOT_FOUND');

    return {
      ok: true,
      context: {
        ownerUserId: access.ownerUserId,
        actorUserId: session.user.id,
        actorName: access.accountantOrganisation || access.accountantName || String(session.user.name ?? '').trim(),
        actorEmail: String(session.user.email ?? '').trim(),
        accountantShareId,
        accountantRegisterId: register.id,
        accountantAccess: access,
      },
    };
  } catch (error) {
    const mapped = accountantWorkspaceError(error);
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status }),
    };
  }
}

export async function assertWorkspaceAssetAccess(
  context: OwnerWorkspaceContext,
  assetId: unknown,
): Promise<void> {
  if (!context.accountantAccess) return;

  const normalizedAssetId = String(assetId ?? '').trim();
  const asset = normalizedAssetId
    ? await getAssetRegisterItemById(context.ownerUserId, normalizedAssetId)
    : null;

  if (!asset || asset.registerId !== context.accountantRegisterId) {
    throw new Error('The selected asset is not part of this shared Asset Register.');
  }
}

export async function getWorkspaceAssetIds(context: OwnerWorkspaceContext): Promise<Set<string> | null> {
  if (!context.accountantAccess) return null;
  const assets = await listAssetRegisterItems(context.ownerUserId, context.accountantRegisterId);
  return new Set(assets.map((asset) => asset.id));
}

export async function filterFuelLedgerForWorkspace(
  context: OwnerWorkspaceContext,
  ledger: FuelLedgerData,
): Promise<FuelLedgerData> {
  const assetIds = await getWorkspaceAssetIds(context);
  if (!assetIds) return ledger;

  return {
    ...ledger,
    assets: ledger.assets.filter((asset) => assetIds.has(asset.id)),
    recentEvents: ledger.recentEvents.filter((event) => !event.assetId || assetIds.has(event.assetId)),
    recentFuelSlips: ledger.recentFuelSlips.filter((slip) => !slip.assetId || assetIds.has(slip.assetId)),
  };
}

export async function filterCostLedgerForWorkspace(
  context: OwnerWorkspaceContext,
  data: MyInvoiceListResult,
): Promise<MyInvoiceListResult> {
  const assetIds = await getWorkspaceAssetIds(context);
  if (!assetIds) return data;

  const invoices = data.invoices.filter((invoice) => assetIds.has(invoice.assetId));
  return {
    ...data,
    assets: data.assets.filter((asset) => assetIds.has(asset.id)),
    invoices,
    summary: calculateMyInvoiceSummary(invoices),
  };
}
