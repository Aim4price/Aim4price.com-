import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAssetRegisterItemById } from '../../../lib/asset-register-db';
import { getServerSession, isOwnerAppSession } from '../../../lib/auth-session';
import {
  grantDealerMaintenanceTracking,
  type DealerMaintenancePermissions,
} from '../../../lib/dealer-maintenance-tracker';
import { createAssetLead, listAssetLeadsForUser, normalizeLeadType } from '../../../lib/partner-access';
import { syncAccountantShareSettingsFromLead } from '../../../lib/accountant-workspace';
import { listLicensingWorkspaceLeads } from '../../../lib/licensing-workspace-leads';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';
import {
  AIM4PRICE_PROVIDER_APPROVAL_NOTICE,
  createAssistanceRequest,
  isAssistanceMasterAccountUserId,
  resolveAssistanceSelection,
} from '../../../lib/assistance-network';

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
  assetIds?: unknown;
  assistanceLocationId?: unknown;
  assetGroupId?: unknown;
  assetGroupName?: unknown;
};

const MAX_DEALER_SHARE_ASSETS = 250;

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

function readDealerShareAssetIds(value: unknown): string[] | null {
  if (typeof value === 'undefined') return [];
  if (!Array.isArray(value)) return null;

  const assetIds = Array.from(new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean)));
  if (!assetIds.length || assetIds.length > MAX_DEALER_SHARE_ASSETS) return null;
  return assetIds;
}

function hasLicenceRenewalDate(asset: Awaited<ReturnType<typeof getAssetRegisterItemById>>): boolean {
  if (!asset?.isLicensed) return false;
  const specs = asset.specsJson ?? {};
  return [
    specs.licenseRenewalDate,
    specs.license_renewal_date,
    specs.licenceRenewalDate,
    specs.licence_renewal_date,
  ].some((value) => String(value ?? '').trim());
}

function isAssetGroupShareRequest(sections: Record<string, unknown> | null): boolean {
  if (!sections) return false;
  const registerSnapshot = asRecord(sections.registerSnapshot);
  return (
    String(sections.source ?? '').trim().toLowerCase() === 'asset_group'
    || String(registerSnapshot?.snapshotType ?? '').trim().toLowerCase() === 'asset_group'
    || Boolean(String(registerSnapshot?.groupId ?? '').trim())
  );
}

function buildAssetGroupChildSections(input: {
  sections: Record<string, unknown>;
  batchId: string;
  groupId: string;
  groupName: string;
  assetCount: number;
  childIndex: number;
  assetId: string;
}): Record<string, unknown> {
  const {
    registerSnapshot: _registerSnapshot,
    registerLead: _registerLead,
    registerLeadType: _registerLeadType,
    pdfReport: _pdfReport,
    registerId: _registerId,
    groupId: _groupId,
    liveAccess: _liveAccess,
    allowDirectUpdates: _allowDirectUpdates,
    includeFuelLedger: _includeFuelLedger,
    includeCostLedger: _includeCostLedger,
    ...assetSections
  } = input.sections;

  return {
    ...assetSections,
    assetDetails: true,
    valuationSummary: true,
    mainPhoto: true,
    source: 'asset_group_child',
    assetGroupShare: {
      batchId: input.batchId,
      groupId: input.groupId || null,
      name: input.groupName || 'Asset umbrella',
      assetCount: input.assetCount,
      childIndex: input.childIndex,
      assetId: input.assetId,
    },
  };
}

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const profile = await getAccountProfile(session.user);
    if (isMiddlemanAccountSubtype(profile.accountSubtype)) {
      return NextResponse.json({ ok: false, error: 'Leads are available to paid dealer accounts.' }, { status: 403 });
    }
    const leads = profile.accountType === 'licensing'
      ? await listLicensingWorkspaceLeads(session.user.id)
      : await listAssetLeadsForUser(session.user.id);
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

  const requesterProfile = await getAccountProfile(session.user);
  if (isMiddlemanAccountSubtype(requesterProfile.accountSubtype)) {
    return NextResponse.json({ ok: false, error: 'Leads are available to paid dealer accounts.' }, { status: 403 });
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
  const assetGroupShare = isAssetGroupShareRequest(includedSections);
  const trackMaintenance = body.trackMaintenance === true;
  const trackingPermissions = readTrackingPermissions(body.trackingPermissions);
  const dealerShareAssetIds = readDealerShareAssetIds(body.assetIds);
  const assistanceLocationId = String(body.assistanceLocationId ?? '').trim();

  if (!assetId || !partnerUserId || !leadType) {
    return NextResponse.json({ ok: false, error: 'Choose a valid asset, partner and lead type.' }, { status: 400 });
  }
  if (isAssistanceMasterAccountUserId(partnerUserId) && !assistanceLocationId) {
    return NextResponse.json({ ok: false, error: 'Choose an Aim4price assistance service area.' }, { status: 400 });
  }
  if (trackMaintenance && body.trackingPermissions && !trackingPermissions) {
    return NextResponse.json({ ok: false, error: 'Choose valid dealer tracking permissions.' }, { status: 400 });
  }
  if (dealerShareAssetIds === null) {
    return NextResponse.json(
      { ok: false, error: `Choose between 1 and ${MAX_DEALER_SHARE_ASSETS} valid assets.` },
      { status: 400 },
    );
  }
  if (dealerShareAssetIds.length && !dealerShareAssetIds.includes(assetId)) {
    return NextResponse.json({ ok: false, error: 'The lead asset must be included in the dealer share.' }, { status: 400 });
  }

  try {
    const assistanceSelection = assistanceLocationId
      ? await resolveAssistanceSelection({
          assistanceLocationId,
          masterAccountUserId: partnerUserId,
          leadType,
        })
      : null;
    const effectivePartnerUserId = assistanceSelection?.masterAccountUserId ?? partnerUserId;

    if (
      dealerShareAssetIds.length
      && !assistanceSelection
      && !assetGroupShare
      && leadType !== 'replacement_quote'
      && leadType !== 'license_renewal'
    ) {
      return NextResponse.json({ ok: false, error: 'Bulk asset sharing is only available for dealers and licence renewal experts.' }, { status: 400 });
    }

    const leadAssetIds = dealerShareAssetIds.length && (
      assistanceSelection
      || assetGroupShare
      || leadType === 'license_renewal'
    )
      ? dealerShareAssetIds
      : [assetId];

    if (dealerShareAssetIds.length) {
      const profile = await getAccountProfile(session.user);
      if (profile.accountType !== 'owner' || isOwnerAppSession(session)) {
        return NextResponse.json(
          { ok: false, error: 'Bulk partner sharing is only available from the owner Asset Register.' },
          { status: 403 },
        );
      }

      const ownedAssets = await Promise.all(
        dealerShareAssetIds.map((selectedAssetId) => getAssetRegisterItemById(session.user.id, selectedAssetId)),
      );
      if (ownedAssets.some((selectedAsset) => !selectedAsset)) {
        return NextResponse.json({ ok: false, error: 'One or more selected assets could not be found.' }, { status: 404 });
      }
      if (leadType === 'license_renewal' && ownedAssets.some((selectedAsset) => !hasLicenceRenewalDate(selectedAsset))) {
        return NextResponse.json({
          ok: false,
          error: 'Every selected asset must be licensed and have a renewal date.',
        }, { status: 400 });
      }
    }

    if (leadType === 'license_renewal' && !dealerShareAssetIds.length) {
      const ownedAsset = await getAssetRegisterItemById(session.user.id, assetId);
      if (!ownedAsset) {
        return NextResponse.json({ ok: false, error: 'The selected asset could not be found.' }, { status: 404 });
      }
      if (!hasLicenceRenewalDate(ownedAsset)) {
        return NextResponse.json({
          ok: false,
          error: 'Add the asset licence status and renewal date before sharing it.',
        }, { status: 400 });
      }
    }

    const savedSections: Record<string, unknown> = {
      ...(includedSections ?? {}),
      maintenanceTrackingEnabled: trackMaintenance,
    };
    const registerSnapshot = asRecord(savedSections.registerSnapshot);
    const assetGroupBatchId = assetGroupShare ? randomUUID() : '';
    const assetGroupId = String(body.assetGroupId ?? registerSnapshot?.groupId ?? '').trim();
    const assetGroupName = String(
      body.assetGroupName
      ?? registerSnapshot?.groupName
      ?? registerSnapshot?.title
      ?? 'Asset umbrella',
    ).trim();
    const leads = [];
    for (const [selectedAssetIndex, selectedAssetId] of leadAssetIds.entries()) {
      const leadSections = assetGroupShare
        ? buildAssetGroupChildSections({
            sections: savedSections,
            batchId: assetGroupBatchId,
            groupId: assetGroupId,
            groupName: assetGroupName,
            assetCount: leadAssetIds.length,
            childIndex: selectedAssetIndex + 1,
            assetId: selectedAssetId,
          })
        : savedSections;
      leads.push(await createAssetLead({
        ownerUserId: session.user.id,
        ownerName: session.user.name,
        ownerEmail: session.user.email,
        assetId: selectedAssetId,
        partnerUserId: effectivePartnerUserId,
        leadType,
        ownerMessage: typeof body.ownerMessage === 'string' ? body.ownerMessage : null,
        includedSections: leadSections,
        allowAim4priceAssistance: Boolean(assistanceSelection),
      }));
    }
    const lead = leads[0];

    if (leadType === 'finance') {
      await Promise.all(leads.map((savedLead) => syncAccountantShareSettingsFromLead(
        savedLead.id,
        savedLead.includedSections,
      )));
    }

    const trackingAssetIds = dealerShareAssetIds.length ? dealerShareAssetIds : [assetId];
    const trackingAccesses: Array<{ id: string }> = [];
    if (trackMaintenance) {
      for (let index = 0; index < trackingAssetIds.length; index += 10) {
        const batch = trackingAssetIds.slice(index, index + 10);
        const grantedBatch = await Promise.all(
          batch.map((trackingAssetId) => grantDealerMaintenanceTracking({
            ownerUserId: session.user.id,
            dealerUserId: effectivePartnerUserId,
            assetId: trackingAssetId,
            actorType: 'owner',
            actorId: isOwnerAppSession(session) ? session.ownerApp.ownerAppUserId : session.user.id,
            actorName: isOwnerAppSession(session) ? session.ownerApp.displayName : session.user.name,
            permissions: trackingPermissions,
          })),
        );
        trackingAccesses.push(...grantedBatch);
      }
    }

    const assistanceRequest = assistanceSelection
      ? await createAssistanceRequest({
          selection: assistanceSelection,
          ownerUserId: session.user.id,
          ownerName: session.user.name,
          ownerEmail: session.user.email,
          selectedAssetIds: dealerShareAssetIds.length ? dealerShareAssetIds : [assetId],
          assetLeadIds: leads.map((savedLead) => savedLead.id),
          assetGroupId: typeof body.assetGroupId === 'string' ? body.assetGroupId : null,
          assetGroupName: typeof body.assetGroupName === 'string' ? body.assetGroupName : null,
          includedSections: savedSections,
          ownerMessage: typeof body.ownerMessage === 'string' ? body.ownerMessage : null,
        })
      : null;

    return NextResponse.json({
      ok: true,
      lead,
      leads,
      trackingAccess: trackingAccesses[0] ?? null,
      trackingAccesses,
      sharedAssetCount: dealerShareAssetIds.length || 1,
      assistanceRequest,
      confirmation: assistanceRequest ? AIM4PRICE_PROVIDER_APPROVAL_NOTICE : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'PARTNER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Selected partner could not be found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'LICENSE_RENEWAL_DETAILS_REQUIRED') {
      return NextResponse.json({
        ok: false,
        error: 'Every selected asset must be licensed and have a renewal date.',
      }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'ASSISTANCE_LOCATION_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Selected Aim4price assistance area is unavailable.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'ASSISTANCE_NOTIFICATION_FAILED') {
      return NextResponse.json({ ok: false, error: 'The assets were saved, but Aim4price could not be notified. Please try again or contact Aim4price.' }, { status: 502 });
    }

    console.error('asset leads POST failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to create lead.' }, { status: 500 });
  }
}
