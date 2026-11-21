import { NextRequest } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { canBusinessRead } from '../../../lib/business-accounts';
import { businessBody,businessError,businessJson,requireBusinessOrigin } from '../../../lib/business-network-api';
import { creditTransaction,recordCredit,workspaceForCredits,creditBalance,creditLimitsActive,CreditLimitError,MONTHLY_BUSINESS_CREDITS } from '../../../lib/business-credits';
import { readLeadPage } from '../../../lib/guest-leads';
import { externalLeadAccess } from '../../../lib/external-lead-access';
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
        await db.query('UPDATE business_workspaces SET upgrade_requested_at=coalesce(upgrade_requested_at,now()) WHERE id=$1 AND paid_since IS NULL',[workspace.id]);
      });
      return businessJson({ok:true});
    }
    const {action,phase,requestId,token,assetKey,visitId}=body;
    if(action==='check'){
      await creditTransaction(async db=>{
        const workspace=await workspaceForCredits(db,userId);
        const balance=await creditBalance(db,workspace.id);
        if(!workspace.desktop&&!workspace.paid_since&&creditLimitsActive()&&balance.used+balance.held>=MONTHLY_BUSINESS_CREDITS)throw new CreditLimitError();
      });
      return businessJson({ok:true});
    }
    const uuid=/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
    if(visitId!==undefined && (typeof visitId!=='string'||!uuid.test(visitId)||action==='manage'))return businessJson({error:'Invalid Manage visit.'},400);
    const includedMessage=action==='send' && phase==='complete' && typeof visitId==='string';
    if((!includedMessage&&action!=='manage'&&action!=='share') || typeof requestId!=='string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(requestId)
      || typeof assetKey!=='string'||typeof token!=='string'|| !/^[A-Za-z0-9_-]{43}$/.test(token)
      || !(action==='manage'?(phase==='complete'||phase==='close'):(phase==='reserve'||phase==='complete'||phase==='cancel'))) return businessJson({error:'Invalid credit action.'},400);
    const lead=await readLeadPage(token);
    if(!lead || !lead.share.assets.some((asset,index)=>(asset.assetId||String(index))===assetKey)) return businessJson({error:'Share unavailable.'},404);
    const access=await externalLeadAccess(lead);
    if(access.user?.id!==userId || !['active','read-only'].includes(access.access)) return businessJson({error:'Access required.'},403);
    if(includedMessage && !lead.details?.allowReply)return businessJson({error:'Replies are disabled.'},403);
    await creditTransaction(db=>recordCredit(db,{userId,action,requestId,token,assetKey,visitId:typeof visitId==='string'?visitId:undefined},phase as 'complete'|'close'|'cancel'|'reserve'));
    return businessJson({ok:true});
  } catch(e) {return businessError(e);}
}
