import { getAnyServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getDb } from '../../../../lib/db';
export const dynamic='force-dynamic';
export async function GET(){
  const session=await getAnyServerSession();
  if(!session?.user)return new Response(null,{status:401});
  const p=await getAccountProfile(session.user);
  if(!p.trialEndsAt||p.accountType!=='owner'||p.accountStatus==='suspended')return new Response(null,{status:403});
  const rows=await getDb().query('select * from asset_register_items where user_id=$1 order by id',[session.user.id]);
  return Response.json(rows.rows,{headers:{'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="aim4price-register.json"'}});
}
