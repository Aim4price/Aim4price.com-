import {NextRequest,NextResponse} from 'next/server';
import {getMaintenanceEmailPreference,setMaintenanceEmailPreference} from '../../../lib/maintenance-email-preferences';
import {AIM4PRICE_EMAIL_FONT_STACK,AIM4PRICE_EMAIL_LOGO_PATH,buildEmailBrandHeader} from '../../../lib/email-brand';
import {getSiteOrigin} from '../../../lib/email';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function page(body:string,status=200) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maintenance email preferences | Aim4price</title></head><body style="margin:0;padding:24px 12px;background:#f2f6f3;color:#173c32;font-family:${AIM4PRICE_EMAIL_FONT_STACK}"><table role="presentation" style="width:100%;max-width:600px;margin:auto;border:1px solid #d7e5dc;border-radius:12px;background:white">${buildEmailBrandHeader(new URL(AIM4PRICE_EMAIL_LOGO_PATH,getSiteOrigin()).toString())}<tr><td style="padding:30px">${body}</td></tr></table></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; img-src 'self' https:; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}

async function render(token:string,saved=false) {
  const preference=await getMaintenanceEmailPreference(token);
  if(!preference)return page('<h1>Link unavailable</h1><p>Please use the preference link in your latest maintenance email.</p>',404);
  const scope=preference.asset_scope?'this asset':'this account';
  const action=preference.enabled?'Stop':'Turn on';
  return page(`<h1 style="font-size:25px;margin-top:0">${saved?'Preference saved':'Maintenance email preferences'}</h1><p>Maintenance emails for ${scope} are <strong>${preference.enabled?'on':'off'}</strong>.</p><p style="color:#64786f;line-height:1.6">${action} maintenance emails for ${scope}? Your maintenance schedules stay saved. Password resets, security messages and other emails are unaffected.</p>${preference.asset_scope?'<p style="color:#64786f;font-size:13px">Account-level opt-out takes priority. To receive emails for this asset, both its reminders and account reminders must be on.</p>':''}<form method="post"><input type="hidden" name="enabled" value="${preference.enabled?'false':'true'}"><button type="submit" style="border:0;border-radius:6px;padding:15px 24px;background:#1a654d;color:white;font:inherit;font-weight:700">${action} maintenance emails for ${scope}</button></form><p style="font-size:13px;color:#64786f">You can revisit this link to change your preference.</p>`);
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
