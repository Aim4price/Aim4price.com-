import { NextRequest, NextResponse } from 'next/server';
import { listFuelLedger, saveFuelSlipTransaction } from '../../../../lib/fuel-ledger';
import {
  fieldManagerCan,
  getFieldManagerAssetForOpen,
  listFieldManagerAssets,
} from '../../../../lib/field-manager';
import { requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function requireFuelAccess(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) return access;

  if (!(await fieldManagerCan(access.session.managerId, 'record_fuel'))) {
    return {
      ok: false as const,
      status: 403,
      error: 'This Field Manager login cannot record fuel.',
    };
  }

  return access;
}

export async function GET(request: NextRequest) {
  const access = await requireFuelAccess(request);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const [ledger, availableAssets] = await Promise.all([
      listFuelLedger(access.session.ownerUserId),
      listFieldManagerAssets(access.session.ownerUserId, access.session.managerId),
    ]);
    const availableAssetIds = new Set(availableAssets.map((asset) => asset.id));
    const assets = ledger.assets.filter((asset) => availableAssetIds.has(asset.id));

    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to load fuel assets.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireFuelAccess(request);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid fuel slip save request.' }, { status: 400 });
  }

  const assetId = textValue(payload.assetId ?? payload.targetId);
  if (textValue(payload.targetType) !== 'asset' || !assetId) {
    return NextResponse.json({ ok: false, error: 'Choose the asset being fuelled.' }, { status: 400 });
  }

  try {
    const asset = await getFieldManagerAssetForOpen({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      assetId,
    });

    if (!asset) {
      return NextResponse.json(
        { ok: false, error: 'This asset is not available to this Field Manager login.' },
        { status: 403 },
      );
    }

    const result = await saveFuelSlipTransaction(access.session.ownerUserId, {
      ...payload,
      targetType: 'asset',
      targetId: asset.id,
      assetId: asset.id,
      operatorName: access.session.displayName,
      auditActorUserId: access.session.managerId,
      auditActorName: access.session.displayName,
      auditActorEmail: '',
    });

    return NextResponse.json({
      ok: true,
      fuelSlip: result.fuelSlip,
      event: result.event,
      pendingReview: result.pendingReview,
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'The fuel slip could not be saved.') },
      { status: 400 },
    );
  }
}
