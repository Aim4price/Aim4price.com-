import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';
import { getServerSession, isOwnerAppSession } from '../../../../lib/auth-session';
import {
  getActiveInvoiceDropCode,
  issueInvoiceDropCode,
  revealActiveInvoiceDropCode,
  revokeInvoiceDropCode,
  type CaptureEventActor,
} from '../../../../lib/capture-requests';
import {
  assertWorkspaceAssetAccess,
  resolveOwnerWorkspaceContext,
  type OwnerWorkspaceContext,
} from '../../../../lib/owner-workspace-access';
import {
  getOwnerAppAccess,
  ownerAppCan,
  ownerAppCanAccessAsset,
  type OwnerAppAccess,
} from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: {
    assetId: string;
  };
};

type OwnerAccess = {
  context: OwnerWorkspaceContext;
  actor: CaptureEventActor;
  ownerAppAccess: OwnerAppAccess;
};

type InvoiceDropCodeTarget = {
  scope: 'all' | 'asset';
  assetId: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
function forbidden() {
  return json(
    { ok: false, error: 'Only the signed-in asset owner can manage Invoice Drop codes.' },
    403,
  );
}

async function requireOwnerAccess(
  request: NextRequest,
  options: { requireFinanceMutation?: boolean } = {},
): Promise<{ ok: true; access: OwnerAccess } | { ok: false; response: NextResponse }> {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved;

  const { context } = resolved;
  if (context.accountantAccess || context.ownerUserId !== context.actorUserId) {
    return { ok: false, response: forbidden() };
  }

  const session = await getServerSession({ requireActive: true, allowOwnerApp: true });
  if (!session?.user?.id) {
    return { ok: false, response: forbidden() };
  }
  const ownerAppAccess = await getOwnerAppAccess();
  if (!ownerAppAccess || ownerAppAccess.ownerUserId !== context.ownerUserId) {
    return { ok: false, response: forbidden() };
  }
  if (
    options.requireFinanceMutation
    && isOwnerAppSession(session)
    && !ownerAppCan(ownerAppAccess, 'manage_finance')
  ) {
    return { ok: false, response: forbidden() };
  }

  const profile = await getAccountProfile({
    id: context.ownerUserId,
    name: context.actorName,
    email: context.actorEmail,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') {
    return { ok: false, response: forbidden() };
  }

  return {
    ok: true,
    access: {
      context,
      ownerAppAccess,
      actor: {
        actorType: 'owner',
        userId: context.ownerUserId,
        displayName: ownerAppAccess.displayName || profile.displayName || profile.businessName || context.actorName || 'Asset owner',
      },
    },
  };
}

async function requireCodeTarget(
  access: OwnerAccess,
  assetIdInput: string,
): Promise<{ ok: true; target: InvoiceDropCodeTarget } | { ok: false; response: NextResponse }> {
  const assetId = String(assetIdInput ?? '').trim();
  if (assetId === 'all') {
    return { ok: true, target: { scope: 'all', assetId: null } };
  }
  if (!UUID_PATTERN.test(assetId)) {
    return { ok: false, response: json({ ok: false, error: 'Choose all assets or one valid saved asset.' }, 400) };
  }

  try {
    if (
      access.ownerAppAccess.sessionKind === 'owner-app-user'
      && !ownerAppCanAccessAsset(access.ownerAppAccess, assetId)
    ) {
      return { ok: false, response: json({ ok: false, error: 'That asset could not be found in your Asset Register.' }, 404) };
    }
    await assertWorkspaceAssetAccess(access.context, assetId);
    const asset = await getAssetRegisterItemById(access.context.ownerUserId, assetId);
    if (!asset) {
      return { ok: false, response: json({ ok: false, error: 'That asset could not be found in your Asset Register.' }, 404) };
    }
    return { ok: true, target: { scope: 'asset', assetId } };
  } catch {
    return { ok: false, response: json({ ok: false, error: 'That asset could not be found in your Asset Register.' }, 404) };
  }
}

function dropCodeError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : '';
  if (message === 'INVOICE_DROP_CODE_SECRET_MISSING') {
    return json({ ok: false, error: 'Invoice Drop codes are not configured yet.' }, 503);
  }
  if (message === 'CAPTURE_ASSET_NOT_FOUND') {
    return json({ ok: false, error: 'That asset could not be found in your Asset Register.' }, 404);
  }
  if (message === 'CAPTURE_ASSET_INVALID' || message === 'INVOICE_DROP_CODE_INVALID') {
    return json({ ok: false, error: 'Choose a valid saved asset.' }, 400);
  }
  console.error('Aim4price Invoice Drop code request failed.', error);
  return json({ ok: false, error: 'The Invoice Drop code could not be updated. Please try again.' }, 500);
}

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const reveal = request.nextUrl.searchParams.get('reveal') === '1';
  const owner = await requireOwnerAccess(request, { requireFinanceMutation: reveal });
  if (!owner.ok) return owner.response;
  const target = await requireCodeTarget(owner.access, routeContext.params.assetId);
  if (!target.ok) return target.response;

  try {
    if (reveal) {
      const dropCode = await revealActiveInvoiceDropCode(
        owner.access.context.ownerUserId,
        target.target.assetId,
      );
      if (dropCode && !dropCode.code) {
        return json({
          ok: false,
          error: 'This existing code was created before secure viewing was enabled. Change the code once, then it can be viewed here.',
        }, 409);
      }
      return json({ ok: true, dropCode });
    }

    const dropCode = await getActiveInvoiceDropCode(owner.access.context.ownerUserId, target.target.assetId);
    // The normal management view deliberately returns the last four characters
    // only. Full-code access is an explicit, owner-authorized reveal action.
    return json({ ok: true, dropCode });
  } catch (error) {
    return dropCodeError(error);
  }
}

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const owner = await requireOwnerAccess(request, { requireFinanceMutation: true });
  if (!owner.ok) return owner.response;
  const target = await requireCodeTarget(owner.access, routeContext.params.assetId);
  if (!target.ok) return target.response;

  try {
    const dropCode = await issueInvoiceDropCode(
      { ownerUserId: owner.access.context.ownerUserId, assetId: target.target.assetId },
      owner.access.actor,
    );
    // The database stores only a keyed hash + last four. A newly issued code is
    // returned here and can later be reconstructed by the owner-only reveal action.
    return json({ ok: true, dropCode }, 201);
  } catch (error) {
    return dropCodeError(error);
  }
}

export async function DELETE(request: NextRequest, routeContext: RouteContext) {
  const owner = await requireOwnerAccess(request, { requireFinanceMutation: true });
  if (!owner.ok) return owner.response;
  const target = await requireCodeTarget(owner.access, routeContext.params.assetId);
  if (!target.ok) return target.response;

  try {
    const active = await getActiveInvoiceDropCode(owner.access.context.ownerUserId, target.target.assetId);
    if (!active) return json({ ok: true, dropCode: null });

    const revoked = await revokeInvoiceDropCode(active.id, owner.access.actor);
    if (!revoked) {
      return json({ ok: false, error: 'That Invoice Drop code is no longer available.' }, 404);
    }
    return json({ ok: true, dropCode: null });
  } catch (error) {
    return dropCodeError(error);
  }
}
