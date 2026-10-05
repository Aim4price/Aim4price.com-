import {getServerSession,isOwnerAppSession,isDealerAppSession,isAdminSupportSession} from '../../../../../lib/auth-session';
import {getAssetRegisterAccountAccess} from '../../../../../lib/asset-register-account-access';
import {getAssetRegisterItemById} from '../../../../../lib/asset-register-db';
import {getOwnerAppAccess,ownerAppCan,ownerAppCanAccessAsset} from '../../../../../lib/owner-app-access';
import {listUnifiedAssetHistory} from '../../../../../lib/asset-history';
import {restoreAssetDetails} from '../../../../../lib/asset-history-restore';
import {businessJson,businessBody,requireBusinessOrigin,businessError} from '../../../../../lib/business-network-api';
import type {NextRequest} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:{assetId:string}}){try{
 const session=await getServerSession({allowOwnerApp:true,allowDealerApp:true});
 if(!session||!await getAssetRegisterAccountAccess(session))return businessJson({error:'Sign in as the asset owner.'},403);
 if(isOwnerAppSession(session)){const access=await getOwnerAppAccess();if(!access||!ownerAppCanAccessAsset(access,params.assetId)||!ownerAppCan(access,'manage_assets'))return businessJson({error:'Asset unavailable.'},403);}
 const asset=await getAssetRegisterItemById(session.user.id,params.assetId);
 if(!asset)return businessJson({error:'Asset unavailable.'},404);
 if(request.method==='GET'&&request.nextUrl.searchParams.get('format')==='pdf'){const {assetHistoryPdfResponse}=await import('../../../../../lib/asset-history-report');return await assetHistoryPdfResponse(request,session.user.id,asset,{owner:true,category:request.nextUrl.searchParams.get('category')||undefined});}
 if(request.method==='GET')return businessJson(await listUnifiedAssetHistory(session.user.id,params.assetId,{owner:true,before:request.nextUrl.searchParams.get('before')||undefined,category:request.nextUrl.searchParams.get('category')||undefined}));
 requireBusinessOrigin(request);const body=await businessBody(request);
 if(typeof body.eventId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.eventId))return businessJson({error:'Choose a history entry.'},400);
 const actor={id:isAdminSupportSession(session)?session.adminSupport.adminUserId:isOwnerAppSession(session)?session.ownerApp.ownerAppUserId:isDealerAppSession(session)?session.dealerApp.staffId:session.user.id,name:session.user.name||session.user.email};
 try{return businessJson(await restoreAssetDetails(session.user.id,params.assetId,body.eventId,actor,body.confirmed===true));}catch(e){const message=e instanceof Error?e.message:'';if(/^(Confirm |This history|Asset unavailable|Newer changes|Open the original)/.test(message))return businessJson({error:message},409);throw e;}
 }catch(e){return businessError(e);}}
export const POST=GET;
