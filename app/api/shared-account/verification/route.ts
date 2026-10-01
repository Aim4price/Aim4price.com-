import { getAnyServerSession } from '../../../../lib/auth-session';
import { auth } from '../../../../lib/auth';
import { sharedEnquiryReturnTo } from '../../../../lib/external-share-permissions';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { limitBusinessAction } from '../../../../lib/business-network';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!isTrustedRequestOrigin(request.headers.get('origin'), new URL(request.url).origin)) return Response.json({error:'Invalid origin.'},{status:403});
  const session=await getAnyServerSession();
  if(!session?.user?.email) return Response.json({error:'Sign in to resend verification.'},{status:401});
  try {
    await limitBusinessAction(`shared-verification:${session.user.id}`,3);
    const body=await request.json();
    const callbackURL=sharedEnquiryReturnTo(body.returnTo)||'/shared-enquiries';
    await auth.api.sendVerificationEmail({body:{email:session.user.email,callbackURL},headers:request.headers});
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'Unable to send right now. Please wait and try again.'},{status:429}); }
}
