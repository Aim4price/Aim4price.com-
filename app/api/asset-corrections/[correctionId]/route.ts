import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession, isOwnerAppSession } from '../../../../lib/auth-session';
import { resolveDealerAssetCorrection } from '../../../../lib/dealer-asset-corrections';

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowOwnerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
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
    const correction = await resolveDealerAssetCorrection({
      ownerUserId: session.user.id,
      correctionId: String(context.params.correctionId ?? '').trim(),
      decision,
      resolvedByUserId: isOwnerAppSession(session) ? session.ownerApp.ownerAppUserId : session.user.id,
    });
    return NextResponse.json({ ok: true, correction });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'CORRECTION_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'This dealer correction was not found.' }, { status: 404 });
    }
    if (message === 'CORRECTION_ALREADY_RESOLVED') {
      return NextResponse.json({ ok: false, error: 'This dealer correction has already been decided.' }, { status: 409 });
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

    console.error('Owner dealer asset correction PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to save the correction decision.' }, { status: 500 });
  }
}
