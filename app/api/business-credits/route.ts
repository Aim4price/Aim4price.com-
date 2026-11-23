import { NextRequest } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { canBusinessRead } from '../../../lib/business-accounts';
import { businessBody,businessError,businessJson,requireBusinessOrigin } from '../../../lib/business-network-api';
import { creditTransaction,spendBusinessCredit,workspaceForCredits } from '../../../lib/business-credits';
export async function POST(req:NextRequest) {
  try {
    requireBusinessOrigin(req);
    const session=await getServerSession({requireActive:false});
    if(!session?.user || !await canBusinessRead(session.user)) return businessJson({error:'An active verified Business account is required.'},403);
    const userId=session.user.id;
    const body=await businessBody(req);
    if(body.action==='upgrade') {
      await creditTransaction(async db=>{
        const workspace=await workspaceForCredits(db,userId);
        if(workspace.role!=='owner') throw Error('The business owner can request an upgrade.');
        if(workspace.paid_since || workspace.desktop || workspace.upgrade_requested_at) return;
        let offer=null;
        if(body.planKey!==undefined) {
          const result=await db.query(`select account_type as key,description,amount_cents,interval,version from aim4price_billing_plans
            where account_type=$1 and (account_type='dealer' or account_type in ('business-standard-monthly','business-standard-annual'))
            and enabled and version=$2 for share`,[body.planKey,Number(body.planVersion)]);
          offer=result.rows[0];
          if(!offer) throw Error('This offer changed. Reopen the plans and try again.');
        }
        await db.query('UPDATE business_workspaces SET upgrade_requested_at=now(),requested_plan=$2 WHERE id=$1',[workspace.id,offer]);
      });
      return businessJson({ok:true});
    }
    if ((body.action === 'manage' || body.action === 'report') && body.phase === 'complete') {
      if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) {
        return businessJson({error:'Invalid action identifier.'},400);
      }
      const label = body.action === 'manage' ? 'Opened Manage' : 'Generated a lead report';
      await creditTransaction(db => spendBusinessCredit(db,userId,label,`${body.action}:${userId}:${body.requestId}`));
      return businessJson({ok:true});
    }
    // Closing a visit, checking access and sharing do not consume credits.
    if (['check','manage','send','share'].includes(String(body.action))) return businessJson({ok:true});
    return businessJson({error:'Unknown credit action.'},400);
  } catch(e) {return businessError(e);}
}
