import { NextRequest, NextResponse } from 'next/server';
import {
  createAssetMaintenanceRecord,
  listAssetMaintenanceData,
  type AssetMaintenanceDraftInput,
} from '../../../../../../lib/asset-maintenance';
import { fieldManagerCan, getFieldManagerAssetForOpen } from '../../../../../../lib/field-manager';
import { requireActiveFieldManagerSession } from '../../../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function message(error: unknown): string {
  const value = error instanceof Error ? error.message : '';
  if (value === 'DUE_DATE_REQUIRED') return 'Select the maintenance due date.';
  if (value === 'DUE_USAGE_REQUIRED') return 'Enter the maintenance usage target.';
  if (value === 'RECURRING_INTERVAL_REQUIRED') return 'Enter the recurring maintenance interval.';
  return value && !/^[A-Z0-9_]+$/.test(value) ? value : 'Failed to create the maintenance schedule.';
}

export async function GET(request: NextRequest, { params }: { params: { assetId: string } }) {
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  const asset = await getFieldManagerAssetForOpen({
    ownerUserId: access.session.ownerUserId,
    managerId: access.session.managerId,
    assetId: String(params.assetId ?? '').trim(),
  });
  if (!asset) {
    return NextResponse.json({ ok: false, error: 'This asset is not available to this Field Manager login.' }, { status: 403 });
  }

  try {
    const data = await listAssetMaintenanceData(access.session.ownerUserId, { assetId: asset.id });
    return NextResponse.json({ ok: true, records: data.records });
  } catch (error) {
    console.error('Field Manager maintenance schedule GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load the maintenance schedule.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { assetId: string } }) {
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  if (!(await fieldManagerCan(access.session.managerId, 'schedule_maintenance'))) {
    return NextResponse.json({ ok: false, error: 'This Field Manager login cannot create maintenance schedules.' }, { status: 403 });
  }

  const asset = await getFieldManagerAssetForOpen({
    ownerUserId: access.session.ownerUserId,
    managerId: access.session.managerId,
    assetId: String(params.assetId ?? '').trim(),
  });
  if (!asset) {
    return NextResponse.json({ ok: false, error: 'This asset is not available to this Field Manager login.' }, { status: 403 });
  }

  let body: AssetMaintenanceDraftInput;
  try {
    body = (await request.json()) as AssetMaintenanceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid maintenance schedule.' }, { status: 400 });
  }

  try {
    const record = await createAssetMaintenanceRecord(access.session.ownerUserId, {
      ...body,
      assetId: asset.id,
      assignedFieldManagerId: access.session.managerId,
      assignedName: access.session.displayName,
    });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    console.error('Field Manager maintenance schedule POST failed.', error);
    return NextResponse.json({ ok: false, error: message(error) }, { status: 400 });
  }
}
