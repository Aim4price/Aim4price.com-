import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterItemById } from '../../../lib/asset-register-db';
import {
  listOwnerDealerMaintenanceAccess,
  revokeDealerMaintenanceTracking,
  updateDealerMaintenancePermissions,
  type DealerMaintenancePermissions,
} from '../../../lib/dealer-maintenance-tracker';
import { getOwnerAppAccess } from '../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readPermissions(value: unknown): DealerMaintenancePermissions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const permissions = value as Record<string, unknown>;
  const keys = [
    'canViewLoggedProblems',
    'canViewMaintenanceReports',
    'canViewCostOfOwnership',
    'canCreateMaintenanceSchedules',
    'canUpdateSerial',
    'canUpdateReplacementPrice',
  ] as const;
  if (keys.some((key) => typeof permissions[key] !== 'boolean')) return null;
  return {
    canViewLoggedProblems: permissions.canViewLoggedProblems as boolean,
    canViewMaintenanceReports: permissions.canViewMaintenanceReports as boolean,
    canViewCostOfOwnership: permissions.canViewCostOfOwnership as boolean,
    canCreateMaintenanceSchedules: permissions.canCreateMaintenanceSchedules as boolean,
    canUpdateSerial: permissions.canUpdateSerial as boolean,
    canUpdateReplacementPrice: permissions.canUpdateReplacementPrice as boolean,
  };
}

export async function GET(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'Owner App login is required.' }, { status: 401 });
  const assetId = String(request.nextUrl.searchParams.get('assetId') ?? '').trim();
  if (!assetId || !(await getAssetRegisterItemById(access.ownerUserId, assetId))) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }
  try {
    const trackingAccess = await listOwnerDealerMaintenanceAccess(access.ownerUserId, assetId);
    return NextResponse.json({ ok: true, trackingAccess });
  } catch (error) {
    console.error('Owner dealer maintenance access GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load dealer tracking settings.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    assetId?: unknown;
    accessId?: unknown;
    permissions?: unknown;
  } | null;
  const assetId = String(body?.assetId ?? '').trim();
  const accessId = String(body?.accessId ?? '').trim();
  const permissions = readPermissions(body?.permissions);
  if (!assetId || !accessId || !permissions || !(await getAssetRegisterItemById(access.ownerUserId, assetId))) {
    return NextResponse.json({ ok: false, error: 'Tracked asset, dealer or permissions are invalid.' }, { status: 400 });
  }
  try {
    const trackingAccess = await updateDealerMaintenancePermissions({
      ownerUserId: access.ownerUserId,
      assetId,
      accessId,
      permissions,
    });
    if (!trackingAccess) {
      return NextResponse.json({ ok: false, error: 'This dealer tracking access was not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, trackingAccess });
  } catch (error) {
    console.error('Owner dealer maintenance permissions PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to save dealer tracking permissions.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'Owner App login is required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    assetId?: unknown;
    dealerUserId?: unknown;
    accessId?: unknown;
  } | null;
  const assetId = String(body?.assetId ?? '').trim();
  const dealerUserId = String(body?.dealerUserId ?? '').trim();
  const accessId = String(body?.accessId ?? '').trim();
  if (!assetId || (!dealerUserId && !accessId) || !(await getAssetRegisterItemById(access.ownerUserId, assetId))) {
    return NextResponse.json({ ok: false, error: 'Tracked asset or dealer not found.' }, { status: 404 });
  }
  try {
    const revoked = await revokeDealerMaintenanceTracking({
      ownerUserId: access.ownerUserId,
      assetId,
      dealerUserId,
      accessId,
    });
    return NextResponse.json({ ok: true, revoked });
  } catch (error) {
    console.error('Owner dealer maintenance access DELETE failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to stop dealer tracking.' }, { status: 500 });
  }
}
