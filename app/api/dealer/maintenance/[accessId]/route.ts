import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  completeDealerTrackedMaintenance,
  getDealerTrackedAsset,
  revokeDealerMaintenanceTracking,
} from '../../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Dealer App access is not available.' }, { status: 403 });
  }

  try {
    const asset = await getDealerTrackedAsset(session.user.id, String(params.accessId ?? '').trim());
    if (!asset) {
      return NextResponse.json({ ok: false, error: 'This tracked asset is no longer available.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    console.error('Dealer tracked asset GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load the tracked asset.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer login is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Dealer maintenance access is not available.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid service completion payload.' }, { status: 400 });
  }

  const maintenanceId = String(body.maintenanceId ?? '').trim();
  if (!maintenanceId) {
    return NextResponse.json({ ok: false, error: 'Maintenance record id is required.' }, { status: 400 });
  }
  if (body.confirmedComplete !== true) {
    return NextResponse.json({ ok: false, error: 'Confirm that the service has physically been completed.' }, { status: 400 });
  }

  const dealerName = profile.businessName || profile.displayName || session.user.name || 'Dealer';
  const technicianName = String(body.completedBy ?? '').replace(/\s+/g, ' ').trim();

  try {
    const result = await completeDealerTrackedMaintenance({
      dealerUserId: session.user.id,
      accessId: String(params.accessId ?? '').trim(),
      maintenanceId,
      completion: {
        completedAt: body.completedAt,
        completedUsage: body.completedUsage,
        completedNotes: body.completedNotes,
        completedBy: technicianName
          ? `${technicianName} · Dealer entry by ${dealerName}`
          : `Dealer entry by ${dealerName}`,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'DEALER_MAINTENANCE_ACCESS_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'This tracked asset is no longer available.' }, { status: 404 });
    }
    if (code === 'DEALER_MAINTENANCE_RECORD_NOT_FOUND' || code === 'MAINTENANCE_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'This maintenance record is no longer available.' }, { status: 404 });
    }
    if (code === 'COMPLETION_DATE_INVALID') {
      return NextResponse.json({ ok: false, error: 'Enter a valid service completion date.' }, { status: 400 });
    }
    if (code === 'COMPLETION_DATE_IN_FUTURE') {
      return NextResponse.json({ ok: false, error: 'The service completion date cannot be in the future.' }, { status: 400 });
    }
    if (code === 'COMPLETION_USAGE_LOWER_THAN_CURRENT') {
      return NextResponse.json({ ok: false, error: 'The completed usage reading cannot be lower than the current saved reading.' }, { status: 400 });
    }
    if (code === 'COMPLETION_USAGE_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Enter the final usage reading before completing this maintenance.' }, { status: 400 });
    }
    if (code === 'COMPLETION_DETAILS_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Select completed work or add notes/problems before saving.' }, { status: 400 });
    }
    if (code === 'COMPLETION_PERFORMER_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Enter who completed the maintenance.' }, { status: 400 });
    }
    if (code === 'COMPLETION_SERVICE_PROVIDER_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Enter the service company and mechanic before saving.' }, { status: 400 });
    }
    console.error('Dealer tracked maintenance completion failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to save the completed service.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Dealer App access is not available.' }, { status: 403 });
  }

  try {
    const accessId = String(params.accessId ?? '').trim();
    const asset = await getDealerTrackedAsset(session.user.id, accessId);
    if (!asset) {
      return NextResponse.json({ ok: false, error: 'This tracked asset is no longer available.' }, { status: 404 });
    }

    const revoked = await revokeDealerMaintenanceTracking({
      ownerUserId: asset.ownerUserId,
      assetId: asset.assetId,
      accessId: asset.accessId,
    });
    if (!revoked) {
      return NextResponse.json({ ok: false, error: 'This tracked asset is no longer available.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Dealer tracked asset DELETE failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete the tracked asset.' }, { status: 500 });
  }
}
