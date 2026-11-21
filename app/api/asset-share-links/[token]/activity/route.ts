import { NextRequest, NextResponse } from 'next/server';
import { markSharedAssetViewed, readLeadPage } from '../../../../../lib/guest-leads';
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
    const selected = request.nextUrl.searchParams.get('asset');
    if (selected) {
        if (!lead.share.assets.some(asset => asset.assetId === selected)) return NextResponse.json({error:'Share unavailable.'},{status:404});
        await markSharedAssetViewed(user.id, params.token, selected);
        return NextResponse.json({ok:true});
    }
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

/** Revalidate a displayed asset without recording an open or consuming credit. */
export async function HEAD(request: NextRequest, { params }: { params: { token: string } }) {
    const assetId = request.nextUrl.searchParams.get('asset');
    const lead = await readLeadPage(params.token);
    if (!lead || !lead.share.assets.some(asset => asset.assetId === assetId)) return new NextResponse(null, { status: 404 });
    const reports = request.nextUrl.searchParams.getAll('report');
    if (reports.some(id => !lead.reports.some(report => report.id === id))) return new NextResponse(null, {status:404});
    const { access, user } = await externalLeadAccess(lead);
    const details = lead.details;
    const standard = !details || (details.accessMode === 'signed-in' && !details.recipientUserId && !details.recipientEmail && !details.recipientWhatsApp && !details.recipientName);
    const allowed = ['active', 'read-only', 'owner'].includes(access) || (!user && standard && access === 'sign-in');
    return new NextResponse(null, { status: allowed ? 204 : 403, headers: { 'Cache-Control': 'private, no-store' } });
}
