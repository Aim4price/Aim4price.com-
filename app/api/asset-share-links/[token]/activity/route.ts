import { NextRequest, NextResponse } from 'next/server';
import { readLeadPage } from '../../../../../lib/guest-leads';
import { externalLeadAccess } from '../../../../../lib/external-lead-access';
import { getServerSession } from '../../../../../lib/auth-session';
import { recordSharingUsage } from '../../../../../lib/sharing-foundation';
import { isTrustedRequestOrigin } from '../../../../../lib/trusted-request-origin';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: {
    params: {
        token: string;
    };
}) {
    if (!isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin))
        return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
    const lead = await readLeadPage(params.token);
    if (!lead)
        return NextResponse.json({ error: 'Share unavailable.' }, { status: 404 });
    const { access, user } = await externalLeadAccess(lead);
    if (!user || !['active', 'read-only', 'owner'].includes(access))
        return NextResponse.json({ error: 'Sign in with authorised access.' }, { status: 403 });
    if (access !== 'owner') {
        const session = await getServerSession({ requireActive: false });
        if (!session || session.user.id !== user.id)
            return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
        await recordSharingUsage({ accountId: user.id, actorId: user.id, sessionId: session.session.id, token: params.token, metric: 'enquiry_opened', eventKey: `${params.token}:${session.session.id}` });
        for (const asset of lead.share.assets)
            if (asset.assetId)
                await recordSharingUsage({ accountId: user.id, actorId: user.id, sessionId: session.session.id, token: params.token, assetId: asset.assetId, metric: 'asset_received', eventKey: asset.assetId });
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
