import { NextRequest } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { listGuestBusinesses,setGuestBusinessAccess } from '../../../../lib/guest-business-access';
import { listBusinessAcceptances } from '../../../../lib/business-acceptances';
import { businessBody,businessError,businessJson } from '../../../../lib/business-network-api';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function admin(){const session=await getAnyServerSession();return session?.user&&isAim4priceAdminEmail(session.user.email)?session.user:null;}
export async function GET(){if(!await admin())return businessJson({error:'Admin access required.'},403);try{return businessJson({guests:await listGuestBusinesses(),acceptances:await listBusinessAcceptances()});}catch(error){return businessError(error);}}
export async function POST(request:NextRequest){const user=await admin();if(!user)return businessJson({error:'Admin access required.'},403);if(!isTrustedRequestOrigin(request.headers.get('origin'),request.nextUrl.origin))return businessJson({error:'Invalid origin.'},403);try{await setGuestBusinessAccess(user.id,await businessBody(request));return businessJson({ok:true});}catch(error){return businessError(error);}}
