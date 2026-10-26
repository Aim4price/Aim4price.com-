import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { loadTeamScope, requireTeamAsset, lockTeamScope } from '../../../../../lib/team-access';
import { teamJson, teamError, TEAM_HEADERS } from '../../../../../lib/team-access-http';
import { TeamAccessError } from '../../../../../lib/team-access-policy';
import { appendSharedAssetPhotos } from '../../../../../lib/asset-register-db';
import { createAssetRegisterUpload, listInternalAssetRegisterUploadIds, resolveAssetRegisterUploadBytes, ALLOWED_ASSET_REGISTER_IMAGE_TYPES, MAX_ASSET_REGISTER_UPLOAD_BYTES, deleteUnreferencedAssetRegisterUploads, buildAssetRegisterUploadUrl } from '../../../../../lib/asset-register-uploads';
import { requireBusinessOrigin } from '../../../../../lib/business-network-api';
import { limitBusinessAction } from '../../../../../lib/business-network';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {
    params: {
        membershipId: string;
    };
};
export async function GET(request: NextRequest, { params }: Context) {
    try {
        const scope = await loadTeamScope(params.membershipId, 'viewPhotos');
        const asset = await requireTeamAsset(scope, request.nextUrl.searchParams.get('assetId') || '');
        const index = Number(request.nextUrl.searchParams.get('index'));
        if (!Number.isInteger(index) || index < 0 || index >= asset.photos.length)
            throw new TeamAccessError('Photo unavailable.', 404);
        const [id] = listInternalAssetRegisterUploadIds([asset.photos[index]]);
        if (!id)
            throw new TeamAccessError('Photo unavailable.', 404);
        const result = await resolveAssetRegisterUploadBytes(id);
        if (result.status !== 'ready' || !ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(result.upload.mimeType))
            throw new TeamAccessError('Photo unavailable.', 404);
        return new NextResponse(result.upload.data, { headers: { ...TEAM_HEADERS, 'Content-Type': result.upload.mimeType } });
    }
    catch (error) {
        return teamError(error);
    }
}
export async function POST(request: NextRequest, { params }: Context) {
    let uploadId = '', ownerId = '';
    try {
        requireBusinessOrigin(request);
        const scope = await loadTeamScope(params.membershipId, 'uploadPhotos');
        ownerId = scope.grant.ownerId;
        await limitBusinessAction('team-photos:' + scope.actor.id, 30);
        if (Number(request.headers.get('content-length') || 0) > MAX_ASSET_REGISTER_UPLOAD_BYTES + 1024 * 1024)
            throw new TeamAccessError('Photo is too large.', 413);
        const form = await request.formData();
        const file = form.get('file');
        const assetId = String(form.get('assetId') || '');
        const key = String(form.get('requestId') || '');
        if (!/^[a-f0-9-]{36}$/i.test(key))
            throw new TeamAccessError('Invalid upload identifier.', 400);
        await requireTeamAsset(scope, assetId);
        if (!(file instanceof File) || file.size === 0 || file.size > MAX_ASSET_REGISTER_UPLOAD_BYTES || !ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(file.type))
            throw new TeamAccessError('Choose a JPG, PNG or WebP photo up to 5 MB.', 400);
        const upload = await createAssetRegisterUpload({ userId: ownerId, file, category: 'photo' });
        uploadId = upload.id;
        const client = await getDb().connect();
        let reused = false;
        try {
            await client.query('BEGIN');
            await lockTeamScope(client, scope, assetId, 'uploadPhotos');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
            const row = (await client.query('SELECT membership_id,actor_id,asset_id,action FROM team_access_activity WHERE id=$1::uuid', [key])).rows[0];
            if (row) {
                if (row.membership_id !== scope.grant.id || row.actor_id !== scope.actor.id || row.asset_id !== assetId || row.action !== 'Photo uploaded')
                    throw new TeamAccessError('Invalid upload identifier.', 400);
                reused = true;
            }
            else {
                await appendSharedAssetPhotos(client, ownerId, assetId, [upload.url]);
                await client.query(`INSERT INTO team_access_activity(id,owner_id,membership_id,actor_id,actor_email,asset_id,action) VALUES($1,$2,$3,$4,$5,$6,'Photo uploaded')`, [key, ownerId, scope.grant.id, scope.actor.id, scope.actor.email, assetId]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        if (reused)
            await deleteUnreferencedAssetRegisterUploads({ userId: ownerId, uploadIds: [buildAssetRegisterUploadUrl(uploadId)] });
        uploadId = '';
        return teamJson({ ok: true });
    }
    catch (error) {
        if (uploadId)
            await deleteUnreferencedAssetRegisterUploads({ userId: ownerId, uploadIds: [buildAssetRegisterUploadUrl(uploadId)] }).catch(() => { });
        return teamError(error);
    }
}
