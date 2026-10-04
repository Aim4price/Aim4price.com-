import { NextRequest } from 'next/server';
import { businessJson, businessError, requireBusinessOrigin, businessBody } from '../../../../../lib/business-network-api';
import { requireExternalLeadAction } from '../../../../../lib/external-lead-access';
import { createOrUpdateDealerAssetCorrection } from '../../../../../lib/dealer-asset-corrections';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { limitBusinessAction } from '../../../../../lib/business-network';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: {
    params: {
        token: string;
    };
}) {
    try {
        requireBusinessOrigin(request);
        const body = await businessBody(request);
        const field = body.field;
        if (field !== 'serialNumber' && field !== 'replacementPriceExVat')
            return businessJson({ error: 'Choose the serial number or replacement price.' }, 400);
        const index = body.assetIndex;
        const { lead, user } = await requireExternalLeadAction(params.token, field === 'serialNumber' ? 'serialNumber' : 'replacementPrice');
        // New clients send a stable ID. Numeric indexes remain only for older links.
        const asset = typeof body.assetId === 'string'
            ? lead.share.assets.find(asset => asset.assetId === body.assetId)
            : Number.isInteger(index) ? lead.share.assets[Number(index)] : undefined;
        if (!asset?.assetId) return businessJson({ error: 'Choose a currently shared asset.' }, 400);
        await limitBusinessAction(`external-correction:${user.id}`, 30);
        const profile = await getAccountProfile(user);
        const correction = await createOrUpdateDealerAssetCorrection({ dealerUserId: user.id, dealerName: profile.businessName || user.name, actorName: user.name, sourceType: 'external', sourceId: `${params.token}:${asset.assetId}`, field, confirmed:body.confirmed===true,revision:typeof body.revision==='string'?body.revision:undefined,reason: typeof body.reason==='string'?body.reason.trim().slice(0,1500):undefined, value: body.value });
        return businessJson({ correction });
    }
    catch (e) {
        if (e && typeof e === 'object' && 'status' in e && [401, 403, 404].includes(Number(e.status)))
            return businessJson({ error: e instanceof Error ? e.message : 'Access required.' }, Number(e.status));
        const code = e instanceof Error ? e.message : '';
        const messages: Record<string, string> = { CORRECTION_RELOAD_CONFIRM:'Reload the latest asset and confirm the manual price change.', CORRECTION_NO_CHANGES: 'Enter a value different from the current value.', CORRECTION_SERIAL_PENDING: 'A serial update is already waiting for owner approval.', CORRECTION_REPLACEMENT_PENDING: 'A price update is already waiting for owner approval.', SERIAL_NUMBER_REQUIRED: 'Enter the corrected serial number.', REPLACEMENT_PRICE_INVALID: 'Enter a valid replacement price greater than zero.', CORRECTION_FORBIDDEN: 'This asset is not shared with your account.' };
        return messages[code] ? businessJson({ error: messages[code] }, 400) : businessError(e);
    }
}
