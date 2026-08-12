import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession, isOwnerAppSession } from '../../../../lib/auth-session';
import { resolveDealerAssetCorrection } from '../../../../lib/dealer-asset-corrections';
import { getOwnerAppAccess, ownerAppCan } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    correctionId: string;
  };
};

type DecisionBody = {
  decision?: unknown;
};

type DatabaseError = {
  code?: unknown;
  constraint?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowOwnerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  }

  if (isOwnerAppSession(session)) {
    const access = await getOwnerAppAccess();
    if (!access || access.ownerUserId !== session.user.id || !ownerAppCan(access, 'manage_assets')) {
      return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can decide this update.' }, { status: 403 });
    }
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Only the asset owner can decide this correction.' }, { status: 403 });
  }

  let body: DecisionBody;
  try {
    body = (await request.json()) as DecisionBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Choose whether to accept or decline this correction.' }, { status: 400 });
  }

  const decision = String(body.decision ?? '').trim().toLowerCase();
  if (decision !== 'accept' && decision !== 'reject') {
    return NextResponse.json({ ok: false, error: 'Choose whether to accept or decline this correction.' }, { status: 400 });
  }

  try {
    const result = await resolveDealerAssetCorrection({
      ownerUserId: session.user.id,
      correctionId: String(context.params.correctionId ?? '').trim(),
      decision,
      resolvedByUserId: isOwnerAppSession(session) ? session.ownerApp.ownerAppUserId : session.user.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'CORRECTION_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'This asset update was not found.' }, { status: 404 });
    }
    if (message === 'CORRECTION_ALREADY_RESOLVED') {
      return NextResponse.json({ ok: false, error: 'This asset update has already been decided.' }, { status: 409 });
    }
    if (message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'The asset is no longer available.' }, { status: 404 });
    }
    if (message === 'ASSET_UPDATE_UNSUPPORTED') {
      return NextResponse.json(
        { ok: false, error: 'This Asset Register item could not be updated. Refresh the page and try again.' },
        { status: 409 },
      );
    }
    const databaseError = error && typeof error === 'object' ? error as DatabaseError : null;
    if (databaseError?.code === '23505') {
      return NextResponse.json(
        { ok: false, error: 'This corrected value conflicts with another saved asset. Check the value and try again.' },
        { status: 409 },
      );
    }
    if (databaseError?.code === '23514' || databaseError?.code === '23502') {
      return NextResponse.json(
        { ok: false, error: 'The corrected value does not meet the Asset Register requirements. Check the value and try again.' },
        { status: 409 },
      );
    }

    console.error('Owner asset correction PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to save the correction decision.' }, { status: 500 });
  }
}
