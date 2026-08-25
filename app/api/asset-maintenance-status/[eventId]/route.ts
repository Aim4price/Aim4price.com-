import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { getServerSession } from '../../../../lib/auth-session';
import { markAssetMaintenanceStatusNoted } from '../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    eventId: string;
  };
};

type UpdateMaintenanceStatusBody = {
  status?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }
  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to update this Asset Register.' }, { status: 403 });
  }

  let body: UpdateMaintenanceStatusBody = {};

  try {
    body = (await request.json()) as UpdateMaintenanceStatusBody;
  } catch {
    body = {};
  }

  const nextStatus = String(body.status ?? 'noted').trim().toLowerCase();

  if (nextStatus !== 'noted') {
    return NextResponse.json({ ok: false, error: 'Only noted status is supported.' }, { status: 400 });
  }

  try {
    const maintenanceStatus = await markAssetMaintenanceStatusNoted({
      currentUserId: session.user.id,
      maintenanceStatusId: context.params.eventId,
    });

    return NextResponse.json({ ok: true, maintenanceStatus });
  } catch (error) {
    if (error instanceof Error && error.message === 'MAINTENANCE_STATUS_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Maintenance record not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'MAINTENANCE_STATUS_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'You cannot update this maintenance record.' }, { status: 403 });
    }

    console.error('asset maintenance status PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to update maintenance record.' }, { status: 500 });
  }
}
