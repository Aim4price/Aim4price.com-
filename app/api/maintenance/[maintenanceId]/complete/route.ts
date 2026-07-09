import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  completeAssetMaintenanceRecord,
  listAssetMaintenanceData,
  type AssetMaintenanceCompleteInput,
} from '../../../../../lib/asset-maintenance';

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
  if (message === 'RECURRING_INTERVAL_REQUIRED') return 'Recurring maintenance needs an interval before it can create the next record.';
  if (typeof message === 'string' && message.trim()) return message;

  return 'The maintenance record could not be completed.';
}

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

export async function POST(request: NextRequest, context: RouteContext) {
  const userId = await currentUserId();
  const maintenanceId = context.params.maintenanceId ?? '';

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to complete maintenance records.' }, { status: 401 });
  }

  if (!maintenanceId) {
    return NextResponse.json({ ok: false, error: 'Maintenance record id is required.' }, { status: 400 });
  }

  let body: AssetMaintenanceCompleteInput;

  try {
    body = (await request.json()) as AssetMaintenanceCompleteInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid completion payload.' }, { status: 400 });
  }

  try {
    const result = await completeAssetMaintenanceRecord(userId, maintenanceId, body);
    const data = await listAssetMaintenanceData(userId, {});
    return NextResponse.json({ ok: true, ...result, ...data });
  } catch (error) {
    console.error('Aim4price Asset Maintenance complete failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
