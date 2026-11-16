import { NextRequest, NextResponse } from 'next/server';
import { openPartsShare } from '../../../../lib/parts-share';
import { PartsError } from '../../../../lib/parts-network';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
export async function POST(request:NextRequest,{params}:{params:{token:string}}) {
 let accountAccess='sign-in';
 try {
  if(!isTrustedRequestOrigin(request.headers.get('origin'),request.nextUrl.origin)) throw new PartsError('Invalid request origin.',403);
  const reader=request.body?.getReader(); if(!reader) throw new PartsError('Request required.');
  const chunks:Uint8Array[]=[]; let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new PartsError('Request too large.',413);}chunks.push(value);}
  let input:Record<string,unknown>;
  try{input=JSON.parse(Buffer.concat(chunks).toString());if(!input||Array.isArray(input)||typeof input!=='object')throw Error();}catch{throw new PartsError('Invalid request.');}
  const session=await getServerSession({requireActive:false,allowAdmin:false});
  const user=session?.user;
  let viewer=null;
  if(user?.id && user.email) {
   const profile=await getAccountProfile(user);
   accountAccess=profile.accountStatus==='suspended'?'suspended':user.emailVerified!==true?'verify-email':'active';
   if(accountAccess==='active') viewer={id:user.id,email:user.email};
  }
  const cookie=`parts-share-${params.token.slice(0,16)}`;
  const data=await openPartsShare(params.token,viewer,request.cookies.get(cookie)?.value||'',input);
  if('proof' in data){
   // Return the unlocked view immediately; do not depend on a second browser request
   // observing the newly set cookie before the password modal can close.
   const view=await openPartsShare(params.token,viewer,data.proof!,{action:'view'});
   if('ownerId' in view) delete (view as {ownerId?:string}).ownerId;
   const response=NextResponse.json({...view,access:accountAccess},{headers});response.cookies.set(cookie,data.proof!,{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:`/api/parts-share/${params.token}`,maxAge:8*3600});return response;}
  if(input.action==='download' && data.rows) {
   const {buildPartsStockReportHtml}=await import('../../../../lib/parts-network-report');
   const {renderReportHtmlToPdf}=await import('../../../../lib/report-pdf');
   const {getAssetRegisterReportLogoUrl}=await import('../../../../lib/asset-registers');
   const {resolveReportLogoUrlForHtml}=await import('../../../../lib/report-logo');
   const logoUrl=await resolveReportLogoUrlForHtml(await getAssetRegisterReportLogoUrl(data.ownerId).catch(()=>''),request.url);
   const displayVat=typeof input.vatIncluded==='boolean'?input.vatIncluded:data.vatIncluded;
   const vat=displayVat?'Incl. VAT':'Excl. VAT';
   const rows=data.rows.map(r=>({part:r.part_number,description:r.description,brand:r.brand,quantity:r.quantity,price:r.price===null?null:Number((Number(r.price)*(displayVat===data.vatIncluded?1:displayVat?1.15:1/1.15)).toFixed(2)),details:r.details,vat,dealer:data.owner,town:''}));
   const html=buildPartsStockReportHtml(data.name,rows,vat,'Shared parts list',new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeZone:'Africa/Johannesburg'}).format(new Date()),{logoUrl});
   const pdf=await renderReportHtmlToPdf(html,{baseUrl:request.url});
   return new NextResponse(pdf,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Shared-parts.pdf"','X-Content-Type-Options':'nosniff'}});
  }
  // Internal owner identity is used for branding only.
  if('ownerId' in data) delete (data as {ownerId?:string}).ownerId;
  return NextResponse.json({...data,access:accountAccess},{headers});
 } catch(error){if(error instanceof PartsError)return NextResponse.json({error:error.message,access:accountAccess==='active'?'wrong-recipient':accountAccess},{status:error.status,headers});console.error('Parts share failed',error);return NextResponse.json({error:'Unable to open this parts link. Please try again.'},{status:500,headers});}
}
