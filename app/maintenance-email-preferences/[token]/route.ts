import {NextRequest,NextResponse} from 'next/server';
import {getMaintenanceEmailPreference,setMaintenanceEmailPreference} from '../../../lib/maintenance-email-preferences';
import {AIM4PRICE_EMAIL_FONT_STACK,AIM4PRICE_EMAIL_LOGO_PATH,buildEmailBrandHeader} from '../../../lib/email-brand';
import {getSiteOrigin} from '../../../lib/email';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function page(body:string,status=200) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Asset email preferences | Aim4price</title><style>*{box-sizing:border-box}body{font-size:16px;line-height:1.6}h1{font-size:28px;line-height:1.25;letter-spacing:-.5px;margin:0 0 12px}p{margin:0 0 18px}.content{padding:30px}.scope{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#486357;margin-bottom:10px}.status{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;background:#f2f7f4;border:1px solid #d7e5dc;border-radius:12px;margin:22px 0}.badge{white-space:nowrap;font-size:14px;font-weight:700;padding:4px 12px;border-radius:20px;background:#e3f2e9;color:#18543e}.badge.off{background:#fff0df;color:#8a4b18}.note{font-size:14px;color:#486357;padding:14px 16px;border-left:3px solid #c68a3f;background:#fff8ef;border-radius:0 8px 8px 0}.saved{color:#18543e;font-weight:600;margin-bottom:18px}.action{width:100%;min-height:48px;border:0;border-radius:10px;padding:14px 20px;background:#1a654d;color:white;font:inherit;font-weight:700;cursor:pointer}.action:hover{background:#134e3b}.action:focus-visible,a:focus-visible{outline:3px solid #c68a3f;outline-offset:4px}.footer{margin:16px 0 0;font-size:14px;color:#486357;text-align:center}.return{display:block;margin-top:12px;color:#1a654d;font-weight:600;text-decoration:underline}@media(max-width:480px){.content{padding:24px 20px}h1{font-size:25px}}</style></head><body style="margin:0;padding:24px 12px;background:#f2f6f3;color:#173c32;font-family:${AIM4PRICE_EMAIL_FONT_STACK}"><table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;margin:auto;border:1px solid #d7e5dc;border-radius:16px;overflow:hidden;background:white;box-shadow:0 12px 36px rgba(23,60,50,.06)">${buildEmailBrandHeader(new URL(AIM4PRICE_EMAIL_LOGO_PATH,getSiteOrigin()).toString())}<tr><td class="content">${body}</td></tr></table></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; img-src 'self' https:; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}

async function render(token:string,saved=false) {
  const preference=await getMaintenanceEmailPreference(token);
  if(!preference)return page('<h1>Link unavailable</h1><p>Please use the preference link in your latest maintenance email.</p>',404);
  const isAsset=Boolean(preference.asset_scope);
  const scope=isAsset?'this asset':'your account';
  const label=preference.category==='problems'?'Problem updates':preference.category==='all'?'All asset updates':'Maintenance emails';
  const action=preference.enabled?'Stop emails':'Turn emails back on';
  return page(`<p class="scope">${isAsset?'This asset':'All assets in your account'}</p><h1>${label}</h1><p style="color:#486357">Choose whether to receive ${label.toLowerCase()} for ${scope}.</p>${saved?'<p class="saved" role="status">Your preference has been saved.</p>':''}<div class="status"><strong>${isAsset?'Asset email setting':'Account email setting'}</strong><span class="badge${preference.enabled?'':' off'}">${preference.enabled?'On':'Off'}</span></div><p>Your schedules and problem history stay saved. You can turn these emails back on at any time.</p>${isAsset?'<p class="note">Account opt-outs and “all asset updates” opt-outs take priority. Turning on one category will not override them. Use the matching preference links in your email to turn those back on.</p>':'<p class="note">This applies to this email category across your account. Individual assets you have opted out of will stay off.</p>'}<form method="post"><input type="hidden" name="enabled" value="${preference.enabled?'false':'true'}"><button class="action" type="submit">${action}</button></form><p class="footer">Password resets and other account emails are unaffected.<br>Keep this link to change your preference.<a class="return" href="/maintenance">Open Aim4price</a></p>`);

}
// GET never changes preferences: email security scanners can safely inspect these links.
export async function GET(_request:NextRequest,{params}:{params:{token:string}}){return render(params.token);}
export async function POST(request:NextRequest,{params}:{params:{token:string}}){
  const origin=request.headers.get('origin');
  if(!origin||![new URL(request.url).origin,getSiteOrigin()].includes(origin))return page('<h1>Please use the confirmation page</h1>',403);
  const body=await request.formData();const enabled=body.get('enabled');
  if(enabled!=='true'&&enabled!=='false')return page('<h1>Invalid preference</h1>',400);
  if(!await setMaintenanceEmailPreference(params.token,enabled==='true'))return page('<h1>Link unavailable</h1>',404);
  return render(params.token,true);
}

