import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDealerStaffById } from './dealer-app';
import { normalizeDealerStaffRole, type DealerStaffRole } from './dealer-app';
import { getAccountProfile } from './account-profile';

export const DEALER_APP_COOKIE = 'aim4price_dealer_app';
export const DEALER_APP_MAX_AGE = 60 * 60 * 12;
type Payload = { staffId: string; dealerUserId: string; displayName: string; username: string; version: number; exp: number };
function secret() { return process.env.BETTER_AUTH_SECRET || process.env.DEALER_APP_SECRET || 'aim4price-development-secret-change-me'; }
function sign(raw: string) { return createHmac('sha256', secret()).update(raw).digest('base64url'); }
export function createDealerAppToken(payload: Omit<Payload,'exp'>) {
  const raw = Buffer.from(JSON.stringify({...payload, exp: Math.floor(Date.now()/1000)+DEALER_APP_MAX_AGE})).toString('base64url');
  return `${raw}.${sign(raw)}`;
}
function parse(token: string): Payload | null {
  const [raw,sig] = token.split('.'); if (!raw || !sig) return null;
  const a=Buffer.from(sig); const b=Buffer.from(sign(raw)); if(a.length!==b.length || !timingSafeEqual(a,b)) return null;
  try { const p=JSON.parse(Buffer.from(raw,'base64url').toString()) as Payload; return p.exp > Date.now()/1000 ? p : null; } catch { return null; }
}
export type DealerAppSession = { kind:'dealer-staff'; staffId:string; dealerUserId:string; displayName:string; username:string; role:DealerStaffRole; version:number };
export async function getDealerAppSession(): Promise<DealerAppSession|null> {
  const token=(await cookies()).get(DEALER_APP_COOKIE)?.value; const p=token?parse(token):null; if(!p) return null;
  const row=await getDealerStaffById(p.staffId); if(!row || !row.is_active || row.dealer_user_id!==p.dealerUserId || Number(row.session_version)!==p.version) return null;
  const profile=await getAccountProfile({id:p.dealerUserId,name:null,email:null});
  if(profile.accountType!=='dealer' || profile.accountStatus!=='active') return null;
  return {kind:'dealer-staff',staffId:p.staffId,dealerUserId:p.dealerUserId,displayName:row.display_name,username:row.username,role:normalizeDealerStaffRole(row.staff_role),version:p.version};
}
