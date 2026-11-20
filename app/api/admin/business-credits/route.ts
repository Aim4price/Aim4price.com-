import { NextRequest } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { businessBody,businessError,businessJson,requireBusinessOrigin } from '../../../../lib/business-network-api';
import { creditTransaction } from '../../../../lib/business-credits';
export async function POST(req:NextRequest) {
 try {
   requireBusinessOrigin(req);
   const session=await getAnyServerSession();
   if(!session?.user || !isAim4priceAdminEmail(session.user.email)) return businessJson({error:'Admin access required.'},403);
   const body=await businessBody(req);
   if(body.confirmed!==true || typeof body.businessId!=='string') return businessJson({error:'Confirm the subscription first.'},400);
   await creditTransaction(async db=>{
     const result=await db.query(`UPDATE business_workspaces SET paid_since=now(),activated_by=$2 WHERE id=$1 AND upgrade_requested_at IS NOT NULL AND paid_since IS NULL RETURNING id`,[body.businessId,session.user.id]);
     if(!result.rowCount) throw Error('This upgrade is no longer pending.');
   });
   return businessJson({ok:true});
 }catch(e){return businessError(e);}
}
