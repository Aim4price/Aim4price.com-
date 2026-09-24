import { NextRequest,NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../../lib/asset-register-account-access';
import { businessHeaders,businessJson,businessError,requireBusinessOrigin,businessBody } from '../../../../../lib/business-network-api';
import { limitBusinessAction } from '../../../../../lib/business-network';
import { readLeadPage } from '../../../../../lib/guest-leads';
import { readPublicInvoiceFormData,validatePublicInvoiceFiles } from '../../../../../lib/public-invoice-drop-security';
import { submitLeadDocument,listLeadSubmissions,reviewLeadSubmission,downloadLeadSubmission } from '../../../../../lib/lead-submissions';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:{token:string}};
async function owner(){const s=await getServerSession({requireActive:true,allowOwnerApp:true,allowDealerApp:true});return s?.user&&await getAssetRegisterAccountAccess(s)?s.user:null;}
export async function POST(request:NextRequest,{params}:Context){
 try{
  requireBusinessOrigin(request);
  const lead=await readLeadPage(params.token);
  if(!lead?.details?.allowSubmissions)return businessJson({error:'This enquiry is unavailable or submissions are disabled.'},404);
  await limitBusinessAction(`lead-document:${params.token}`,12);
  const form=await readPublicInvoiceFormData(request);
  const entries=form.getAll('file');
  if(entries.length!==1||typeof entries[0]==='string')throw new Error('Choose one PDF, JPG, PNG or WEBP file, up to 12 MB.');
  const [file]=await validatePublicInvoiceFiles(entries as File[]);
  await submitLeadDocument(params.token,Object.fromEntries(form),file);
  return businessJson({ok:true});
 }catch(e){return businessError(e);}
}
export async function GET(request:NextRequest,{params}:Context){
 const user=await owner();if(!user)return businessJson({error:'Sign in as the owner to review documents.'},401);
 try{
  const id=request.nextUrl.searchParams.get('id');
  if(id){const file=await downloadLeadSubmission(user.id,params.token,id);if(!file)return businessJson({error:'Document not found.'},404);
   return new NextResponse(new Uint8Array(file.file_data),{headers:{...businessHeaders,'Content-Type':file.content_type,'Content-Disposition':`attachment; filename="${file.file_name.replace(/[^a-zA-Z0-9._ -]/g,'_')}"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
  }
  return businessJson({submissions:await listLeadSubmissions(user.id,params.token)});
 }catch(e){return businessError(e);}
}
export async function PATCH(request:NextRequest,{params}:Context){
 try{requireBusinessOrigin(request);const user=await owner();if(!user)return businessJson({error:'Sign in as the owner to review documents.'},401);
 const body=await businessBody(request);await reviewLeadSubmission(user.id,params.token,String(body.id||''),String(body.status||''));return businessJson({ok:true});
 }catch(e){return businessError(e);}
}
