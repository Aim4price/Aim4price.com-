import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { ensureGuestLeadSchema } from './guest-lead-schema';
import { businessEmail, businessText } from './business-network-shared';
import { limitBusinessAction } from './business-network';
import { sendAim4priceEmail } from './email';
export const GUEST_COOKIE = 'aim4price_guest_business';
const hash = (value:string)=>createHash('sha256').update(value).digest('hex');
export async function startGuestLogin(input:Record<string,unknown>, ip:string) {
 const email=businessEmail(input.email),businessName=businessText(input.businessName),contactName=businessText(input.contactName);
 if(businessName.length<2||businessName.length>200||contactName.length<2||contactName.length>150)throw new Error('Enter your business name and contact name.');
 await limitBusinessAction(`guest-login-ip:${ip}`,20);await limitBusinessAction(`guest-login-email:${email}`,5);
 if(!process.env.RESEND_API_KEY)throw new Error('This email verification service is unavailable. Please contact Aim4price.');
 await ensureGuestLeadSchema();
 const code=String(randomInt(100000,1000000));
 await getDb().query(`INSERT INTO guest_login_codes(email,code_hash,profile,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes') ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,profile=excluded.profile,expires_at=excluded.expires_at`,[email,hash(`${email}:${code}`),JSON.stringify({businessName,contactName})]);
 await sendAim4priceEmail({to:email,subject:'Your Aim4price guest sign-in code',text:`Your sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,html:`<p>Your Aim4price guest sign-in code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`});
}
export async function verifyGuestLogin(emailInput:unknown, codeInput:unknown, ip:string) {
 const email=businessEmail(emailInput),code=String(codeInput||'');
 if(!/^\d{6}$/.test(code))throw new Error('Enter the six-digit code from your email.');
 await limitBusinessAction(`guest-verify-ip:${ip}`,30);await limitBusinessAction(`guest-verify-email:${email}`,12);
 await ensureGuestLeadSchema();
 const db=await getDb().connect();
 try {
  await db.query('BEGIN');
  const result=await db.query(`DELETE FROM guest_login_codes WHERE email=$1 AND code_hash=$2 AND expires_at>now() RETURNING profile`,[email,hash(`${email}:${code}`)]);
  if(!result.rows[0])throw new Error('This code is invalid or expired. Request a new code.');
  const profile=result.rows[0].profile;
  await db.query(`INSERT INTO guest_businesses(email,business_name,contact_name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING`,[email,profile.businessName,profile.contactName]);
  const token=randomBytes(32).toString('base64url');
  await db.query(`INSERT INTO guest_business_sessions(token_hash,email,expires_at) VALUES($1,$2,now()+interval '30 days')`,[hash(token),email]);
  await db.query('COMMIT');return token;
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export type GuestBusinessViewer={email:string;business_name:string;contact_name:string;access_until:string|null;suspended:boolean;active:boolean};
export async function readGuestSession(raw:string):Promise<GuestBusinessViewer|null>{
 if(!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
 await ensureGuestLeadSchema();
 return (await getDb().query(`SELECT b.email,b.business_name,b.contact_name,b.access_until,b.suspended,(NOT b.suspended AND b.access_until>now()) IS TRUE as active FROM guest_business_sessions s JOIN guest_businesses b ON b.email=s.email WHERE s.token_hash=$1 AND s.expires_at>now()`,[hash(raw)])).rows[0]||null;
}
export async function getGuestViewer(){return readGuestSession(cookies().get(GUEST_COOKIE)?.value||'');}
export async function endGuestSession(){const token=cookies().get(GUEST_COOKIE)?.value;if(token){await ensureGuestLeadSchema();await getDb().query('DELETE FROM guest_business_sessions WHERE token_hash=$1',[hash(token)]);}}
export async function listGuestBusinesses(){await ensureGuestLeadSchema();return(await getDb().query(`SELECT email,business_name,contact_name,verified_at,access_until,suspended,(NOT suspended AND access_until>now()) IS TRUE as active FROM guest_businesses ORDER BY verified_at DESC LIMIT 1000`)).rows;}
export async function setGuestBusinessAccess(adminId:string,input:Record<string,unknown>){
 const email=businessEmail(input.email),action=String(input.action),note=businessText(input.note);
 if(!['activate','suspend'].includes(action)||note.length>500)throw new Error('Choose activate or suspend.');
 const until=action==='activate'?new Date(String(input.accessUntil)):null;
 if(until&&(!Number.isFinite(until.getTime())||until.getTime()<=Date.now()))throw new Error('Choose a future expiry date.');
 await ensureGuestLeadSchema();
 const result=await getDb().query(`WITH changed AS (
 UPDATE guest_businesses SET suspended=$2,access_until=CASE WHEN $2 THEN access_until ELSE $3::timestamptz END WHERE email=$1 RETURNING email,access_until
 ) INSERT INTO guest_access_actions(id,email,admin_id,action,access_until,note) SELECT $4,email,$5,$6,access_until,$7 FROM changed RETURNING email`,[email,action==='suspend',until?.toISOString()||null,randomUUID(),adminId,action,note]);
 if(!result.rows.length)throw new Error('This business must confirm its email before access can be activated.');
}
