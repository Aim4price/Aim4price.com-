import { NextRequest } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { saveBusinessDetails } from '../../../lib/business-accounts';
import { businessBody, businessError, businessJson, requireBusinessOrigin } from '../../../lib/business-network-api';
export const runtime = 'nodejs';
export async function PATCH(request: NextRequest) {
    try {
        requireBusinessOrigin(request);
        const session = await getServerSession({ requireActive: false });
        if (!session?.user || !['business','dealer'].includes((await getAccountProfile(session.user)).accountType))
            return businessJson({ error: 'Business account required.' }, 403);
        await saveBusinessDetails(session.user.id, await businessBody(request));
        return businessJson({ ok: true });
    }
    catch (e) {
        return businessError(e);
    }
}
