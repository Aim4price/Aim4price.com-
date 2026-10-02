import { saveSharedContribution } from '../../../../../lib/shared-asset-contributions-api';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  getAssetRegisterItemById,
  type AssetRegisterItem,
} from '../../../../../lib/asset-register-db';
import {
  getAssetLeadForPartner,
  type AssetLead,
} from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    leadId: string;
  };
};

type DealerLeadAssetContext = {
  dealerUserId: string;
  lead: AssetLead;
  asset: AssetRegisterItem;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function assetResponse(asset: AssetRegisterItem) {
  return {
    id: asset.id,
    title: asset.title,
    publicAssetCode: asset.publicAssetCode,
    photos: asset.photos,
  };
}

async function resolveDealerLeadAsset(
  dealerUserId: string,
  leadId: string,
): Promise<DealerLeadAssetContext | null> {
  const profile = await getAccountProfile({ id: dealerUserId });
  if (!['dealer', 'business'].includes(profile.accountType) || profile.accountStatus !== 'active') return null;

  const lead = await getAssetLeadForPartner({ dealerUserId, leadId });
  if (!lead) return null;

  const asset = await getAssetRegisterItemById(lead.ownerUserId, lead.assetRegisterItemId);
  if (!asset) return null;

  return { dealerUserId, lead, asset };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowBusiness: true, allowDealerApp: true });
  if (!session?.user?.id) return unauthorized();

  try {
    const access = await resolveDealerLeadAsset(session.user.id, context.params.leadId);
    if (!access) {
      return NextResponse.json(
        { ok: false, error: 'This asset is not currently shared with your dealership.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, asset: assetResponse(access.asset) });
  } catch (error) {
    console.error('dealer lead asset media GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load this asset.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return saveSharedContribution(request,context.params,'photos');
}
