import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterAccountAccess } from '../../../../../lib/asset-register-account-access';
import { getServerSession } from '../../../../../lib/auth-session';
import { markAssetMaintenanceAlertNoted } from '../../../../../lib/asset-maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    maintenanceId?: string;
  };
};

type ErrorWithMessage = {
  message?: string;
};

function errorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null ? (error as ErrorWithMessage).message : '';

  if (message === 'MAINTENANCE_NOT_FOUND') return 'The maintenance alert could not be found.';
  if (typeof message === 'string' && message.trim()) return message;

  return 'The maintenance alert could not be noted.';
}

async function currentUserId() {
  const session = await getServerSession({ requireActive: true, allowDealerApp: true });
  if (!session?.user?.id || !await getAssetRegisterAccountAccess(session)) return '';
  return session.user.id;
}

export async function PATCH(_request: NextRequest, context: RouteContext) {
  const userId = await currentUserId();
  const maintenanceId = context.params.maintenanceId ?? '';

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to note maintenance alerts.' }, { status: 401 });
  }

  if (!maintenanceId) {
    return NextResponse.json({ ok: false, error: 'Maintenance alert id is required.' }, { status: 400 });
  }

  try {
    const record = await markAssetMaintenanceAlertNoted(userId, maintenanceId);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    console.error('Aim4price Asset Maintenance alert note failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
