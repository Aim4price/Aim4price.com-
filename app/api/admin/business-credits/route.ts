import { NextRequest } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { businessBody,businessError,businessJson,requireBusinessOrigin } from '../../../../lib/business-network-api';
import { creditBalance, creditTransaction, refillBusinessCredits, workspaceForCredits, changeBusinessPlan } from '../../../../lib/business-credits';
export async function GET(req:NextRequest) {
 try {
   const session=await getAnyServerSession();
   if(!session?.user || !isAim4priceAdminEmail(session.user.email)) return businessJson({error:'Admin access required.'},403);
   const owner=req.nextUrl.searchParams.get('owner');
   if(!owner) return businessJson({error:'Select a business account.'},400);
   const data=await creditTransaction(async db=>{
     const workspace=await workspaceForCredits(db,owner);
     if(workspace.role!=='owner') throw Error('Manage the plan on the business owner’s account.');
     const changes=(await db.query(`SELECT c.plan,c.changed_at,u.email AS actor FROM business_plan_changes c
       LEFT JOIN "user" u ON u.id=c.actor_id WHERE c.business_id=$1 ORDER BY c.id DESC LIMIT 10`,[workspace.id])).rows;
     const balance=await creditBalance(db,workspace.id);
     const limit=Number(workspace.monthly_allowance)+Number(balance.bonus);
     return {remaining:Math.max(0,limit-balance.used-balance.held),limit,canRefill:balance.used>0,businessId:workspace.id,paid:Boolean(workspace.desktop || workspace.paid_since),pending:Boolean(workspace.upgrade_requested_at),changes};
   });
   return businessJson(data);
 }catch(e){return businessError(e);}
}
export async function POST(req:NextRequest) {
 try {
   requireBusinessOrigin(req);
   const session=await getAnyServerSession();
   if(!session?.user || !isAim4priceAdminEmail(session.user.email)) return businessJson({error:'Admin access required.'},403);
   const body=await businessBody(req);
   if(body.action==='refill') {
     if(body.confirmed!==true || typeof body.owner!=='string' || typeof body.requestId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) return businessJson({error:'Confirm the credit refill.'},400);
     const {owner,requestId}=body;
     await creditTransaction(db=>refillBusinessCredits(db,owner,session.user.id,requestId));
     return businessJson({ok:true});
   }
   if(body.action!==undefined) return businessJson({error:'Unknown credit action.'},400);
   if(body.confirmed!==true || typeof body.businessId!=='string') return businessJson({error:'Confirm the subscription first.'},400);
   if(body.plan!==undefined && body.plan!=='free' && body.plan!=='paid') return businessJson({error:'Select Free or Paid.'},400);
   await creditTransaction(db=>changeBusinessPlan(db,body.businessId as string,session.user.id,body.plan==='free'?'free':'paid',body.plan===undefined));
   return businessJson({ok:true});
 }catch(e){return businessError(e);}
}
