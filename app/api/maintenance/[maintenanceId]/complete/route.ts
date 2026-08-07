import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  completeAssetMaintenanceRecord,
  listAssetMaintenanceData,
  reopenAssetMaintenanceRecord,
  type AssetMaintenanceCompleteInput,
  type AssetMaintenanceListFilters,
  type AssetMaintenanceType,
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

type StatusToggleInput = AssetMaintenanceCompleteInput & {
  status?: unknown;
  confirmedComplete?: unknown;
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

  if (message === 'MAINTENANCE_NOT_FOUND') return 'The maintenance record could not be found.';
  if (message === 'COMPLETION_DATE_INVALID') return 'Enter a valid service completion date.';
  if (message === 'COMPLETION_DATE_IN_FUTURE') return 'The service completion date cannot be in the future.';
  if (message === 'COMPLETION_USAGE_LOWER_THAN_CURRENT') return 'The completed usage reading cannot be lower than the current saved reading.';
  if (message === 'COMPLETION_DETAILS_REQUIRED') return 'Select completed work or add notes/problems before saving.';
  if (message === 'COMPLETION_PERFORMER_REQUIRED') return 'Enter who completed the maintenance.';
  if (message === 'COMPLETION_SERVICE_PROVIDER_REQUIRED') return 'Enter the service company and mechanic before saving.';
  if (message === 'RECURRING_INTERVAL_REQUIRED') return 'Recurring maintenance needs an interval before it can create the next record.';
  if (message === 'RECURRING_FOLLOWUP_ALREADY_COMPLETED') return 'This maintenance record cannot be reopened because its next recurring service has already been completed.';
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
    const data = await listAssetMaintenanceData(userId, parseFilters(request));
    return NextResponse.json({ ok: true, ...result, ...data });
  } catch (error) {
    console.error('Aim4price Asset Maintenance complete failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
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

  let body: StatusToggleInput;

  try {
    body = (await request.json()) as StatusToggleInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid maintenance status payload.' }, { status: 400 });
  }

  const requestedStatus = String(body.status ?? '').trim().toLowerCase();
  if (requestedStatus !== 'done' && requestedStatus !== 'upcoming') {
    return NextResponse.json({ ok: false, error: 'Maintenance status must be done or upcoming.' }, { status: 400 });
  }
  if (requestedStatus === 'done' && body.confirmedComplete !== true) {
    return NextResponse.json({
      ok: false,
      error: 'Confirm that the maintenance has physically been completed before marking it done.',
    }, { status: 400 });
  }

  try {
    const result = requestedStatus === 'done'
      ? await completeAssetMaintenanceRecord(userId, maintenanceId, body)
      : { reopened: await reopenAssetMaintenanceRecord(userId, maintenanceId) };
    const data = await listAssetMaintenanceData(userId, parseFilters(request));
    return NextResponse.json({ ok: true, ...result, ...data });
  } catch (error) {
    console.error('Aim4price Asset Maintenance status toggle failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
