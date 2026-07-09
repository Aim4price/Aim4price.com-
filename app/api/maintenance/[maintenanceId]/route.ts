import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import {
  cancelAssetMaintenanceRecord,
  listAssetMaintenanceData,
  updateAssetMaintenanceRecord,
  type AssetMaintenanceDraftInput,
} from '../../../../lib/asset-maintenance';

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

  if (message === 'MAINTENANCE_NOT_FOUND') return 'The maintenance record could not be found.';
  if (message === 'FIELD_MANAGER_NOT_FOUND') return 'The selected Field Manager could not be found for this account.';
  if (message === 'DUE_DATE_REQUIRED') return 'Select a due date for date-based maintenance.';
  if (message === 'DUE_USAGE_REQUIRED') return 'Enter the next service or checkup usage target.';
  if (message === 'RECURRING_INTERVAL_REQUIRED') return 'Enter a recurring interval before saving recurring maintenance.';
  if (typeof message === 'string' && message.trim()) return message;

  return 'The maintenance record could not be updated.';
}

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await currentUserId();
  const maintenanceId = context.params.maintenanceId ?? '';

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to update maintenance records.' }, { status: 401 });
  }

  if (!maintenanceId) {
    return NextResponse.json({ ok: false, error: 'Maintenance record id is required.' }, { status: 400 });
  }

  let body: AssetMaintenanceDraftInput;

  try {
    body = (await request.json()) as AssetMaintenanceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid maintenance payload.' }, { status: 400 });
  }

  try {
    const record = await updateAssetMaintenanceRecord(userId, maintenanceId, body);
    const data = await listAssetMaintenanceData(userId, {});
    return NextResponse.json({ ok: true, record, ...data });
  } catch (error) {
    console.error('Aim4price Asset Maintenance PATCH failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const userId = await currentUserId();
  const maintenanceId = context.params.maintenanceId ?? '';

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to delete maintenance records.' }, { status: 401 });
  }

  if (!maintenanceId) {
    return NextResponse.json({ ok: false, error: 'Maintenance record id is required.' }, { status: 400 });
  }

  try {
    const record = await cancelAssetMaintenanceRecord(userId, maintenanceId);
    const data = await listAssetMaintenanceData(userId, {});
    return NextResponse.json({ ok: true, record, ...data });
  } catch (error) {
    console.error('Aim4price Asset Maintenance DELETE failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
