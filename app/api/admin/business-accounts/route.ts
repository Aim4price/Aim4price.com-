import { NextRequest } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { verifyBusinessAccount } from '../../../../lib/business-accounts';
import { businessBody, businessError, businessJson, requireBusinessOrigin } from '../../../../lib/business-network-api';
export const runtime = 'nodejs';
export async function PATCH(request: NextRequest) {
    try {
        requireBusinessOrigin(request);
        const s = await getAnyServerSession();
        if (!s?.user || !isAim4priceAdminEmail(s.user.email))
            return businessJson({ error: 'Admin access required.' }, 403);
        await verifyBusinessAccount(s.user.id, await businessBody(request));
        return businessJson({ ok: true });
    }
    catch (e) {
        return businessError(e);
    }
}
