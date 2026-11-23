import { NextRequest } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { ensureAccountProfileColumns } from '../../../../lib/account-profile';
import { adminOwnerTrial, restartOwnerTrial } from '../../../../lib/billing';
import { businessBody,businessError,businessJson,requireBusinessOrigin } from '../../../../lib/business-network-api';

export async function GET(req:NextRequest) {
  try {
    const session=await getAnyServerSession();
    if(!session?.user || !isAim4priceAdminEmail(session.user.email)) return businessJson({error:'Admin access required.'},403);
    const owner=req.nextUrl.searchParams.get('owner');
    if(!owner) return businessJson({error:'Select an Owner account.'},400);
    await ensureAccountProfileColumns();
    return businessJson({trial:await adminOwnerTrial(owner)});
  } catch(e){return businessError(e);}
}

export async function POST(req:NextRequest) {
  try {
    requireBusinessOrigin(req);
    const session=await getAnyServerSession();
    if(!session?.user || !isAim4priceAdminEmail(session.user.email)) return businessJson({error:'Admin access required.'},403);
    const {owner,version,confirmed}=await businessBody(req);
    if(typeof owner!=='string' || typeof version!=='string' || confirmed!==true) return businessJson({error:'Confirm the trial restart.'},400);
    await ensureAccountProfileColumns();
    return businessJson({trial:await restartOwnerTrial(owner,session.user.id,version)});
  } catch(e){return businessError(e);}
}
