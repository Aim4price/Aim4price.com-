import { NextRequest } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { businessError,businessJson } from '../../../../lib/business-network-api';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { createGuestLead,listOwnerGuestLeads,validateLeadDetails,type LeadPdf } from '../../../../lib/guest-leads';
import { limitBusinessAction } from '../../../../lib/business-network';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function owner(){const s=await getServerSession({requireActive:true,allowOwnerApp:true,allowDealerApp:true});return s?.user&&await getAssetRegisterAccountAccess(s)?s.user:null;}
export async function GET(request:NextRequest){const user=await owner();if(!user)return businessJson({error:'Sign in to manage leads.'},401);try{return businessJson({leads:await listOwnerGuestLeads(user.id,request.nextUrl.searchParams.getAll('assetId')),replyName:user.name||'',replyEmail:user.email||''});}catch(e){return businessError(e);}}
export async function POST(request:NextRequest){
 if(!isTrustedRequestOrigin(request.headers.get('origin'),request.nextUrl.origin))return businessJson({error:'Invalid request origin.'},403);
 const user=await owner();if(!user)return businessJson({error:'Sign in to share assets.'},401);
 try{
 await limitBusinessAction(`lead-create:${user.id}`,30);
 const limit=32*1024*1024;
 if(Number(request.headers.get('content-length'))>limit)return businessJson({error:'The selected reports are too large.'},413);
 const reader=request.body?.getReader();if(!reader)throw new Error('Choose assets to share.');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();return businessJson({error:'The selected reports are too large.'},413);}chunks.push(part.value);}}finally{reader.releaseLock();}
 const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
 const details=validateLeadDetails(JSON.parse(String(form.get('details')||'{}'))),ids=JSON.parse(String(form.get('assetIds')||'[]'));
 const reports:LeadPdf[]=[];
 for(const entry of form.getAll('reports')){if(typeof entry==='string')throw new Error('Choose PDF reports.');reports.push({label:entry.name.replace(/\.pdf$/i,'').slice(0,200),fileName:entry.name.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,200),data:Buffer.from(await entry.arrayBuffer())});}
 const share=await createGuestLead(user.id,ids,form.get('includePhotos')==='true',details,reports);
 return businessJson({share});
 }catch(e){return businessError(e);}
}
