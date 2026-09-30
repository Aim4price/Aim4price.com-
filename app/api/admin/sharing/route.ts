import { NextRequest, NextResponse } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { activateSharingDesktop, saveSharingAllowances } from '../../../../lib/sharing-foundation';
export async function PATCH(request: NextRequest) {
    if (!isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin))
        return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
    const session = await getAnyServerSession();
    if (!session || !isAim4priceAdminEmail(session.user.email))
        return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    try {
        const input = await request.json();
        if (input.action === 'activate-desktop') {
            if (typeof input.userId !== 'string' || input.subscriptionConfirmed !== true)
                throw Error('Confirm that the subscription has been arranged.');
            await activateSharingDesktop(session.user.id, input.userId);
        }
        else if (input.action === 'allowances')
            await saveSharingAllowances(session.user.id, input);
        else
            throw Error('Choose a valid action.');
        return NextResponse.json({ ok: true });
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to update sharing settings.' }, { status: 400 });
    }
}
