import {NextResponse} from 'next/server';
import {getDb} from '../../../../lib/db';
import {ensureBusinessNetwork} from '../../../../lib/business-network';
import {getServerSession} from '../../../../lib/auth-session';
import {isAim4priceAdminEmail} from '../../../../lib/account-constants';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{id:string}}){
 if(!/^[a-f0-9-]{36}$/i.test(params.id))return new NextResponse(null,{status:404});
 await ensureBusinessNetwork();const session=await getServerSession({requireActive:false});
 const row=(await getDb().query(`SELECT l.logo_data FROM account_directory_listings l JOIN business_network b ON b.id=l.business_id WHERE b.id=$1 AND ((b.status='active' AND b.accepted_at IS NOT NULL) OR l.user_id=$2 OR $3)`,[params.id,session?.user.id||'',isAim4priceAdminEmail(session?.user.email)])).rows[0];
 const match=row?.logo_data?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);if(!match)return new NextResponse(null,{status:404});
 return new NextResponse(Buffer.from(match[2],'base64'),{headers:{'Content-Type':match[1],'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
