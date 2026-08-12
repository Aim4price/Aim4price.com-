import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  getAssetDiscoveryEnquiryForUser,
  retractAssetDiscoveryEnquiry,
  updateAssetDiscoveryOwnerDecision,
} from '../../../../../lib/asset-discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { enquiryId: string } };
type PatchBody = { decision?: unknown; status?: unknown };

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return unauthorized();

  try {
    const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
    const enquiry = await getAssetDiscoveryEnquiryForUser({
      enquiryId: context.params.enquiryId,
      userId: session.user.id,
      accountType: profile.accountType,
    });
    return NextResponse.json({ ok: true, enquiry });
  } catch (error) {
    const message = errorMessage(error, 'Failed to load enquiry.');
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('not found') ? 404 : 403 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return unauthorized();

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid decision.' }, { status: 400 });
  }

  try {
    const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
    if (profile.accountType !== 'owner') {
      return NextResponse.json({ ok: false, error: 'Only the asset owner can update this enquiry.' }, { status: 403 });
    }
    const enquiry = await updateAssetDiscoveryOwnerDecision({
      enquiryId: context.params.enquiryId,
      ownerUserId: session.user.id,
      decision: asText(body.decision || body.status),
    });
    return NextResponse.json({ ok: true, enquiry });
  } catch (error) {
    const message = errorMessage(error, 'Failed to save decision.');
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('not found') ? 404 : 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return unauthorized();

  try {
    const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
    if (!['owner', 'dealer', 'licensing'].includes(profile.accountType)) {
      return NextResponse.json({ ok: false, error: 'Only the requester can retract this enquiry.' }, { status: 403 });
    }
    await retractAssetDiscoveryEnquiry({
      enquiryId: context.params.enquiryId,
      requesterUserId: session.user.id,
      requesterAccountType: profile.accountType as 'owner' | 'dealer' | 'licensing',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, 'Failed to retract enquiry.');
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('not found') ? 404 : 400 });
  }
}
