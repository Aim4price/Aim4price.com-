import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { ensureGuestLeadSchema } from '../../../../lib/guest-lead-schema';
import { getDb } from '../../../../lib/db';
import { parseShareAssetIds } from '../../../../lib/asset-share-snapshot';
import { requireBusinessOrigin, businessBody } from '../../../../lib/business-network-api';
import { normalizeExternalPermissions } from '../../../../lib/external-share-permissions';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
    const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
    if (!session || !await getAssetRegisterAccountAccess(session))
        return NextResponse.json({ error: 'Owner access required.' }, { status: 403 });
    try {
        const ids = parseShareAssetIds(request.nextUrl.searchParams.getAll('assetId'));
        const umbrella = request.nextUrl.searchParams.get('umbrellaId') || null;
        if (umbrella && !/^[0-9a-f-]{36}$/i.test(umbrella))
            throw Error('Invalid umbrella.');
        const offset = Math.max(0, Math.min(10000, Number(request.nextUrl.searchParams.get('offset')) || 0));
        await ensureGuestLeadSchema();
        const rows = (await getDb().query(`SELECT token,created_at,revoked_at,umbrella_name,
    lead_details->'permissions' AS permissions,lead_details->>'recipientName' AS recipient_name,lead_details->>'recipientEmail' AS recipient_email
    FROM asset_share_links WHERE user_id=$1 AND history_deleted_at IS NULL AND (asset_ids && $2::uuid[] OR ($3::uuid IS NOT NULL AND umbrella_id=$3::uuid))
    ORDER BY created_at DESC,token LIMIT 6 OFFSET $4`, [session.user.id, ids, umbrella, Math.floor(offset)])).rows;
        return NextResponse.json({ shares: rows.slice(0, 5), hasMore: rows.length > 5 }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch {
        return NextResponse.json({ error: 'Select saved assets to view sharing history.' }, { status: 400 });
    }
}

/** Remove a revoked link from its owner's History, retaining its denial and audit records. */
export async function DELETE(request: NextRequest) {
    const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
    if (!session || !await getAssetRegisterAccountAccess(session))
        return NextResponse.json({ error: 'Owner access required.' }, { status: 403 });
    try {
        requireBusinessOrigin(request);
        const { token } = await businessBody(request);
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
            return NextResponse.json({ error: 'Choose a valid shared link.' }, { status: 400 });
        await ensureGuestLeadSchema();
        const result = await getDb().query(`UPDATE asset_share_links
            SET history_deleted_at=coalesce(history_deleted_at,now())
            WHERE token=$1 AND user_id=$2 AND revoked_at IS NOT NULL RETURNING token`, [token, session.user.id]);
        if (!result.rows.length)
            return NextResponse.json({ error: 'Only your revoked links can be deleted from History.' }, { status: 409 });
        return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch {
        return NextResponse.json({ error: 'Unable to delete this link from History.' }, { status: 400 });
    }
}

/** Update permissions on an existing owner-controlled link without replacing its token. */
export async function PATCH(request: NextRequest) {
    const session = await getServerSession({ requireActive: true, allowDealerApp: true, allowOwnerApp: true });
    if (!session || !await getAssetRegisterAccountAccess(session))
        return NextResponse.json({ error: 'Owner access required.' }, { status: 403 });
    try {
        requireBusinessOrigin(request);
        const { token, permissions } = await businessBody(request);
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) || !permissions || typeof permissions !== 'object' || Array.isArray(permissions))
            return NextResponse.json({ error: 'Choose a valid shared link and permissions.' }, { status: 400 });
        const normalized = normalizeExternalPermissions(permissions);
        // Only the capabilities exposed by the settings picker can change. Preserve
        // report delivery, recipient identity, approval mode and direct-update policy.
        const { reports, documents, allReports, directUpdates, ...editable } = normalized;
        await ensureGuestLeadSchema();
        const result = await getDb().query(`UPDATE asset_share_links
            SET lead_details=jsonb_set(
                coalesce(lead_details, '{"accessMode":"owner-approval"}'::jsonb),
                '{permissions}', coalesce(lead_details->'permissions','{}'::jsonb) || $3::jsonb)
            WHERE token=$1 AND user_id=$2 AND revoked_at IS NULL AND history_deleted_at IS NULL
            RETURNING lead_details->'permissions' AS permissions`, [token, session.user.id, JSON.stringify(editable)]);
        if (!result.rows.length)
            return NextResponse.json({ error: 'This link is unavailable or its access has been revoked.' }, { status: 409 });
        return NextResponse.json({ permissions: normalizeExternalPermissions(result.rows[0].permissions) }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch {
        return NextResponse.json({ error: 'Unable to update link settings. Please try again.' }, { status: 400 });
    }
}
