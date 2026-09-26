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
        if (!Number.isInteger(index) || Number(index) < 0 || Number(index) >= lead.share.assets.length)
            return businessJson({ error: 'Choose a shared asset.' }, 400);
        await limitBusinessAction(`external-correction:${user.id}`, 30);
        const profile = await getAccountProfile(user);
        const correction = await createOrUpdateDealerAssetCorrection({ dealerUserId: user.id, dealerName: profile.businessName || user.name, actorName: user.name, sourceType: 'external', sourceId: `${params.token}:${index}`, field, value: body.value });
        return businessJson({ correction });
    }
    catch (e) {
        if (e && typeof e === 'object' && 'status' in e && [401, 403, 404].includes(Number(e.status)))
            return businessJson({ error: e instanceof Error ? e.message : 'Access required.' }, Number(e.status));
        const code = e instanceof Error ? e.message : '';
        const messages: Record<string, string> = { CORRECTION_NO_CHANGES: 'Enter a value different from the current value.', CORRECTION_SERIAL_PENDING: 'A serial update is already waiting for owner approval.', CORRECTION_REPLACEMENT_PENDING: 'A price update is already waiting for owner approval.', SERIAL_NUMBER_REQUIRED: 'Enter the corrected serial number.', REPLACEMENT_PRICE_INVALID: 'Enter a valid replacement price greater than zero.', CORRECTION_FORBIDDEN: 'This asset is not shared with your account.' };
        return messages[code] ? businessJson({ error: messages[code] }, 400) : businessError(e);
    }
}
