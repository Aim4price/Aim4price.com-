import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isOwnerAppSession } from '../../../lib/auth-session';
import {
  grantDealerMaintenanceTracking,
  type DealerMaintenancePermissions,
} from '../../../lib/dealer-maintenance-tracker';
import { createAssetLead, listAssetLeadsForUser, normalizeLeadType } from '../../../lib/partner-access';
import { syncAccountantShareSettingsFromLead } from '../../../lib/accountant-workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreateAssetLeadBody = {
  assetId?: unknown;
  partnerUserId?: unknown;
  leadType?: unknown;
  ownerMessage?: unknown;
  includedSections?: unknown;
  trackMaintenance?: unknown;
  trackingPermissions?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function readTrackingPermissions(value: unknown): DealerMaintenancePermissions | null {
  const permissions = asRecord(value);
  if (!permissions) return null;
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

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const leads = await listAssetLeadsForUser(session.user.id);
    return NextResponse.json({ ok: true, leads });
  } catch (error) {
    console.error('asset leads GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load leads.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: CreateAssetLeadBody;

  try {
    body = (await request.json()) as CreateAssetLeadBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid lead request.' }, { status: 400 });
  }

  const assetId = String(body.assetId ?? '').trim();
  const partnerUserId = String(body.partnerUserId ?? '').trim();
  const leadType = normalizeLeadType(body.leadType);
  const includedSections = asRecord(body.includedSections);
  const trackMaintenance = body.trackMaintenance === true;
  const trackingPermissions = readTrackingPermissions(body.trackingPermissions);

  if (!assetId || !partnerUserId || !leadType) {
    return NextResponse.json({ ok: false, error: 'Choose a valid asset, partner and lead type.' }, { status: 400 });
  }
  if (trackMaintenance && body.trackingPermissions && !trackingPermissions) {
    return NextResponse.json({ ok: false, error: 'Choose valid dealer tracking permissions.' }, { status: 400 });
  }

  try {
    const savedSections = {
      ...(includedSections ?? {}),
      maintenanceTrackingEnabled: trackMaintenance,
    };
    const lead = await createAssetLead({
      ownerUserId: session.user.id,
      ownerName: session.user.name,
      ownerEmail: session.user.email,
      assetId,
      partnerUserId,
      leadType,
      ownerMessage: typeof body.ownerMessage === 'string' ? body.ownerMessage : null,
      includedSections: savedSections,
    });

    if (leadType === 'finance') {
      await syncAccountantShareSettingsFromLead(lead.id, savedSections);
    }

    const trackingAccess = trackMaintenance
      ? await grantDealerMaintenanceTracking({
          ownerUserId: session.user.id,
          dealerUserId: partnerUserId,
          assetId,
          actorType: 'owner',
          actorId: isOwnerAppSession(session) ? session.ownerApp.ownerAppUserId : session.user.id,
          actorName: isOwnerAppSession(session) ? session.ownerApp.displayName : session.user.name,
          permissions: trackingPermissions,
        })
      : null;

    return NextResponse.json({ ok: true, lead, trackingAccess });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'PARTNER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Selected partner could not be found.' }, { status: 404 });
    }

    console.error('asset leads POST failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to create lead.' }, { status: 500 });
  }
}
