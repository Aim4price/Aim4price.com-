import { NextRequest, NextResponse } from 'next/server';
import { loadTeamScope, requireTeamAsset, lockTeamScope, teamDocuments } from '../../../../../lib/team-access';
import { teamJson, teamError, TEAM_HEADERS } from '../../../../../lib/team-access-http';
import { TeamAccessError } from '../../../../../lib/team-access-policy';
import { createAccountDocument, getAccountDocumentUploadReference, removeUnusedAccountDocumentUpload } from '../../../../../lib/account-documents';
import { createAssetRegisterUpload, isAllowedAssetRegisterDocument, MAX_DOCUMENT_VAULT_UPLOAD_BYTES, resolveAssetRegisterUploadBytes } from '../../../../../lib/asset-register-uploads';
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
        const scope = await loadTeamScope(params.membershipId);
        const docs = await teamDocuments(scope);
        const id = request.nextUrl.searchParams.get('id');
        if (!id)
            return teamJson({ documents: docs.map(d => ({ id: d.id, title: d.title, fileName: d.fileName, expiryDate: d.expiryDate, assetIds: d.assetLinks.map(a => a.id) })) });
        if (!docs.some(d => d.id === id))
            throw new TeamAccessError('Document unavailable.', 404);
        const ref = await getAccountDocumentUploadReference(scope.grant.ownerId, id);
        if (!ref)
            throw new TeamAccessError('Document unavailable.', 404);
        const resolved = await resolveAssetRegisterUploadBytes(ref.uploadId);
        if (resolved.status !== 'ready')
            throw new TeamAccessError('Document temporarily unavailable.', 503);
        return new NextResponse(resolved.upload.data, { headers: { ...TEAM_HEADERS, 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(ref.fileName.replace(/[\r\n"\\/]/g, '-'))}"` } });
    }
    catch (error) {
        return teamError(error);
    }
}
export async function POST(request: NextRequest, { params }: Context) {
    let uploadId = '', ownerId = '';
    try {
        requireBusinessOrigin(request);
        const scope = await loadTeamScope(params.membershipId, 'uploadDocuments');
        ownerId = scope.grant.ownerId;
        await limitBusinessAction('team-documents:' + scope.actor.id, 30);
        if (Number(request.headers.get('content-length') || 0) > MAX_DOCUMENT_VAULT_UPLOAD_BYTES + 1024 * 1024)
            throw new TeamAccessError('Document is too large.', 413);
        const form = await request.formData();
        const file = form.get('file');
        const assetId = String(form.get('assetId') || '');
        const key = String(form.get('requestId') || '');
        if (!/^[a-f0-9-]{36}$/i.test(key))
            throw new TeamAccessError('Invalid upload identifier.', 400);
        await requireTeamAsset(scope, assetId);
        if (!(file instanceof File) || file.size === 0 || file.size > MAX_DOCUMENT_VAULT_UPLOAD_BYTES || !isAllowedAssetRegisterDocument(file))
            throw new TeamAccessError('Choose a supported document up to 25 MB.', 400);
        const upload = await createAssetRegisterUpload({ userId: ownerId, file, category: 'document' });
        uploadId = upload.id;
        let reused = false;
        await createAccountDocument(ownerId, { title: String(form.get('title') || file.name).slice(0, 180), category: 'other', documentType: 'other', assetIds: [assetId], uploadId: upload.id, fileName: upload.fileName, contentType: upload.contentType, byteSize: upload.byteSize }, {
            before: async (client) => {
                await lockTeamScope(client, scope, assetId, 'uploadDocuments');
                await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
                const row = (await client.query('SELECT membership_id,actor_id,asset_id,action,details FROM team_access_activity WHERE id=$1::uuid', [key])).rows[0];
                if (row) {
                    if (row.membership_id !== scope.grant.id || row.actor_id !== scope.actor.id || row.asset_id !== assetId || row.action !== 'Document uploaded')
                        throw new TeamAccessError('Invalid upload identifier.', 400);
                    reused = true;
                    return String(row.details.documentId);
                }
            },
            after: async (client, documentId) => {
                await client.query(`INSERT INTO team_access_activity(id,owner_id,membership_id,actor_id,actor_email,asset_id,action,details) VALUES($1,$2,$3,$4,$5,$6,'Document uploaded',$7::jsonb)`, [key, ownerId, scope.grant.id, scope.actor.id, scope.actor.email, assetId, JSON.stringify({ documentId })]);
            },
        });
        if (reused)
            await removeUnusedAccountDocumentUpload(ownerId, uploadId);
        uploadId = '';
        return teamJson({ ok: true, message: 'Document uploaded. The owner can approve it for team viewing.' });
    }
    catch (error) {
        if (uploadId)
            await removeUnusedAccountDocumentUpload(ownerId, uploadId).catch(() => { });
        return teamError(error);
    }
}
