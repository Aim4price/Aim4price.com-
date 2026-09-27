import { NextRequest } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { listBusinessAccounts, verifyBusinessAccount } from '../../../../lib/business-accounts';
import { ensureAccountProfileColumns } from '../../../../lib/account-profile';
import { businessBody, businessError, businessJson, requireBusinessOrigin } from '../../../../lib/business-network-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const s = await getAnyServerSession();
        if (!s?.user || !isAim4priceAdminEmail(s.user.email))
            return businessJson({ error: 'Admin access required.' }, 403);
        await ensureAccountProfileColumns();
        return businessJson({ accounts: await listBusinessAccounts() });
    }
    catch (e) {
        return businessError(e);
    }
}
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
