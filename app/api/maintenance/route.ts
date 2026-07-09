import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import {
  createAssetMaintenanceRecord,
  listAssetMaintenanceData,
  type AssetMaintenanceDraftInput,
  type AssetMaintenanceListFilters,
  type AssetMaintenanceType,
} from '../../../lib/asset-maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ErrorWithMessage = {
  message?: string;
};

function parseType(value: string | null): AssetMaintenanceType | 'all' | null {
  if (value === 'service' || value === 'checkup') return value;
  return null;
}

function parseStatus(value: string | null): 'upcoming' | 'done' | 'all' | null {
  if (value === 'upcoming' || value === 'done') return value;
  return null;
}

function parseFilters(request: NextRequest): AssetMaintenanceListFilters {
  const searchParams = request.nextUrl.searchParams;
  const assetId = searchParams.get('assetId');
  const assignedTo = searchParams.get('assignedTo');

  return {
    assetId: assetId && assetId !== 'all' ? assetId : null,
    type: parseType(searchParams.get('type')),
    status: parseStatus(searchParams.get('status')),
    assignedTo: assignedTo && assignedTo !== 'all' ? assignedTo : null,
  };
}

function errorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null ? (error as ErrorWithMessage).message : '';

  if (message === 'ASSET_NOT_FOUND') return 'The selected asset could not be found for this account.';
  if (message === 'FIELD_MANAGER_NOT_FOUND') return 'The selected Field Manager could not be found for this account.';
  if (message === 'DUE_DATE_REQUIRED') return 'Select a due date for date-based maintenance.';
  if (message === 'DUE_USAGE_REQUIRED') return 'Enter the next service or checkup usage target.';
  if (message === 'RECURRING_INTERVAL_REQUIRED') return 'Enter a recurring interval before saving recurring maintenance.';
  if (typeof message === 'string' && message.trim()) return message;

  return 'The Asset Maintenance request could not be completed.';
}

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

export async function GET(request: NextRequest) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to view Asset Maintenance.' }, { status: 401 });
  }

  try {
    const data = await listAssetMaintenanceData(userId, parseFilters(request));
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error('Aim4price Asset Maintenance GET failed.', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to save maintenance records.' }, { status: 401 });
  }

  let body: AssetMaintenanceDraftInput;

  try {
    body = (await request.json()) as AssetMaintenanceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid maintenance payload.' }, { status: 400 });
  }

  try {
    const record = await createAssetMaintenanceRecord(userId, body);
    const data = await listAssetMaintenanceData(userId, {});

    return NextResponse.json({ ok: true, record, ...data });
  } catch (error) {
    console.error('Aim4price Asset Maintenance POST failed.', error);
    const message = errorMessage(error);
    const status = message.includes('asset') || message.includes('Field Manager') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
