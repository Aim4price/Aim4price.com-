import { globalBillingControl,listBillingPlans,signupTerms } from '../../../../lib/billing';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({billingHeld:(await globalBillingControl()).held,plans:await listBillingPlans(true),terms:await signupTerms()},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Unable to load signup pricing. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
