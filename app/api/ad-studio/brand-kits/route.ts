import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import {
  deleteAdBrandKit,
  listAdBrandKits,
  saveAdBrandKit,
} from '../../../../lib/ad-studio-db';
import type { SaveAdBrandKitInput } from '../../../../lib/ad-studio';
import { getServerSession } from '../../../../lib/auth-session';
import { dealerRoleCan } from '../../../../lib/dealer-app-access';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAccess() {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return null;

  const [profile, dealerSession] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    getDealerAppSession(),
  ]);

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') return null;
  if (dealerSession && !dealerRoleCan(dealerSession.role, 'ad_studio')) return null;

  return {
    userId: session.user.id,
    profile,
    canManage: !dealerSession || dealerSession.role === 'owner',
  };
}

export async function GET() {
  const access = await resolveAccess();
  if (!access) {
    return NextResponse.json({ ok: false, error: 'Ad Studio is not available for this account.' }, { status: 403 });
  }

  try {
    const kits = await listAdBrandKits(access.userId);
    return NextResponse.json({
      ok: true,
      kits,
      selectedBrandKitId: kits.find((kit) => kit.isDefault)?.id ?? kits[0]?.id ?? null,
      canManage: access.canManage,
      profileDefaults: {
        logoUrl: access.profile.logoUrl,
        businessName: access.profile.businessName,
        contactName: access.profile.marketplaceSellerName || access.profile.displayName || access.profile.name,
        phone: access.profile.marketplacePhone || access.profile.phone,
        email: access.profile.marketplaceEmail || access.profile.email,
        website: access.profile.websiteUrl,
      },
    });
  } catch (error) {
    console.error('ad brand kits GET failed', error);
    return NextResponse.json({ ok: false, error: 'Brand Kits could not be loaded.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const access = await resolveAccess();
  if (!access) {
    return NextResponse.json({ ok: false, error: 'Ad Studio is not available for this account.' }, { status: 403 });
  }
  if (!access.canManage) {
    return NextResponse.json({ ok: false, error: 'Only the Dealer Owner can change company Brand Kits.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as SaveAdBrandKitInput | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Send valid Brand Kit details.' }, { status: 400 });
  }

  try {
    const kit = await saveAdBrandKit(access.userId, body);
    return NextResponse.json({ ok: true, kit });
  } catch (error) {
    console.error('ad brand kits PUT failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Brand Kit could not be saved.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const access = await resolveAccess();
  if (!access) {
    return NextResponse.json({ ok: false, error: 'Ad Studio is not available for this account.' }, { status: 403 });
  }
  if (!access.canManage) {
    return NextResponse.json({ ok: false, error: 'Only the Dealer Owner can remove company Brand Kits.' }, { status: 403 });
  }

  const brandKitId = String(request.nextUrl.searchParams.get('brandKitId') ?? '').trim();
  if (!brandKitId) {
    return NextResponse.json({ ok: false, error: 'Choose a Brand Kit to remove.' }, { status: 400 });
  }

  try {
    await deleteAdBrandKit(access.userId, brandKitId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('ad brand kits DELETE failed', error);
    return NextResponse.json({ ok: false, error: 'Brand Kit could not be removed.' }, { status: 400 });
  }
}
