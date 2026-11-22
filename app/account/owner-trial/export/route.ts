import { getAnyServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { readTrialRegister } from '../../../../lib/trial-register';
export const dynamic='force-dynamic';
export async function GET(){
  const session=await getAnyServerSession();
  if(!session?.user)return new Response(null,{status:401});
  const p=await getAccountProfile(session.user);
  if(!p.trialEndsAt||p.accountType!=='owner'||p.accountStatus==='suspended')return new Response(null,{status:403});
  const records=await readTrialRegister(session.user.id);
  return Response.json(records,{headers:{'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="aim4price-register.json"'}});
}
