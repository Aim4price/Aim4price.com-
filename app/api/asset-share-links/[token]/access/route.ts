import { NextRequest } from 'next/server';
import { businessJson, businessError, businessBody, requireBusinessOrigin } from '../../../../../lib/business-network-api';
import { ExternalLeadAccessError, listExternalAccessRequests, requestExternalLeadAccess, reviewExternalAccessRequest } from '../../../../../lib/external-lead-access';
import { limitBusinessAction } from '../../../../../lib/business-network';
import { getServerSession } from '../../../../../lib/auth-session';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const failure = (e: unknown) => e instanceof ExternalLeadAccessError ? businessJson({error:e.message},e.status) : businessError(e);
export async function GET(_request: NextRequest, {params}: {params:{token:string}}) {
  try { return businessJson({requests:await listExternalAccessRequests(params.token)}); } catch(e) { return failure(e); }
}
export async function POST(request: NextRequest, {params}: {params:{token:string}}) {
  try {
    requireBusinessOrigin(request);
    const session = await getServerSession({requireActive:false,allowOwnerApp:true,allowDealerApp:true});
    if (!session?.user) return businessJson({error:'Sign in to request access.'},401);
    await limitBusinessAction(`share-access:${session.user.id}`,12);
    await requestExternalLeadAccess(params.token);
    return businessJson({ok:true});
  } catch(e) { return failure(e); }
}
export async function PATCH(request: NextRequest, {params}: {params:{token:string}}) {
  try {
    requireBusinessOrigin(request);
    const body = await businessBody(request);
    await reviewExternalAccessRequest(params.token,String(body.userId||''),String(body.decision||''));
    return businessJson({ok:true});
  } catch(e) { return failure(e); }
}
