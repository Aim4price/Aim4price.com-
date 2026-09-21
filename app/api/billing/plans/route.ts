import { listBillingPlans } from '../../../../lib/billing';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({plans:await listBillingPlans(true)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Unable to load signup pricing. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
