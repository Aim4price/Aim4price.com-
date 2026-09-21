import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { BillingError, listBillingInvoices, getBillingWorkspace, listBillingPlans, createBillingDraft, actOnBillingInvoice, saveBillingPlan, billingHistory, processSignupInvoices, billingPreparationStatus } from '../../../../lib/billing';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
function failure(error:unknown){if(error instanceof BillingError)return json({error:error.message},400);console.error('Billing API failed',error);return json({error:'Billing could not be loaded or saved. Please retry.'},500);}
export async function GET(request:NextRequest){
 const access=await requireAdminApiAccess();if(!access.ok)return access.response;
 try {
  const params=request.nextUrl.searchParams,userId=params.get('account');
  if(params.get('invoice'))return json(await billingHistory(params.get('invoice')!));
  const [list,plans,workspace,preparation]=await Promise.all([listBillingInvoices(userId,true,Number(params.get('page')||1)),listBillingPlans(),userId?getBillingWorkspace(userId):null,billingPreparationStatus()]);
  return json({...list,plans,workspace,preparation});
 }catch(error){return failure(error);}
}
export async function POST(request:NextRequest){
 const access=await requireAdminApiAccess();if(!access.ok)return access.response;
 if(!isTrustedRequestOrigin(request.headers.get('origin'),request.nextUrl.origin))return json({error:'Invalid request origin.'},403);
 try {
  const input=await request.json().catch(()=>{throw new BillingError('Invalid JSON request.');});if(!input||typeof input!=='object'||Array.isArray(input))throw new BillingError('Invalid request.');
  if(input.action==='save_plan')await saveBillingPlan(input);
  else if(input.action==='create_draft')return json({ok:true,id:await createBillingDraft(input,access.actor.userId)});
  else if(input.action==='prepare_signups')await processSignupInvoices();
  else await actOnBillingInvoice(input.id,input,access.actor.userId);
  return json({ok:true});
 }catch(error){return failure(error);}
}
