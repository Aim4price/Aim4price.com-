import type {NextRequest} from 'next/server';
import {getServerSession,getAnyServerSession,isOwnerAppSession,isDealerAppSession,isAdminSupportSession} from './auth-session';
import {getAssetRegisterAccountAccess} from './asset-register-account-access';
import {getOwnerAppAccess,ownerAppCan} from './owner-app-access';
import {isAim4priceAdminEmail} from './account-constants';
import {businessJson,businessBody,requireBusinessOrigin} from './business-network-api';
import {getDb} from './db';
import {decideAssetValue,readAssetValueReview,previewReplacementValue,valueAmount,listValueRequests,ensureValueRequests,suggestAssetValue} from './asset-value-requests';
import {contributionScope,type ContributionTarget} from './shared-asset-contributions';
import {getAssetRegisterItemById} from './asset-register-db';
import {ExternalLeadAccessError} from './external-lead-access';
import {notifyValueSuggestion} from './asset-value-mail';
export function valueApiError(e:unknown){if(e instanceof ExternalLeadAccessError)return businessJson({error:e.message},e.status);const message=e instanceof Error?e.message:'';const safe=/^(Enter |Please |Reopen |Choose |Replacement |Manual |This |The asset|Asset unavailable|Suggestion unavailable|Invalid save|Sign in|Owner access)/.test(message);if(!safe)console.error('Value review failed',e);return businessJson({error:safe?message:'Unable to save this value. Please reload and try again.'},400);}
export async function ownerValueApi(request:NextRequest,assetId?:string,admin=false){try{
 if(request.method!=='GET')requireBusinessOrigin(request);
 const session=admin?await getAnyServerSession():await getServerSession({allowOwnerApp:true,allowDealerApp:true});
 if(!session?.user)return businessJson({error:'Sign in to review values.'},401);
 if(admin&&!isAim4priceAdminEmail(session.user.email))return businessJson({error:'Admin access required.'},403);
 if(!admin&& !await getAssetRegisterAccountAccess(session))return businessJson({error:'Owner access required.'},403);
 if(!admin&&isOwnerAppSession(session)){const access=await getOwnerAppAccess();if(!access||!ownerAppCan(access,'manage_assets'))return businessJson({error:'Owner access required.'},403);}
 const ownerId=admin?request.nextUrl.searchParams.get('ownerId')||'':session.user.id;
 if(!assetId){
  if(admin){await ensureValueRequests();const q=(request.nextUrl.searchParams.get('search')||'').slice(0,120);return businessJson({items:(await getDb().query(`SELECT a.id,a.user_id,a.title,a.value,u.email,(SELECT count(*)::int FROM asset_value_requests r WHERE r.owner_id=a.user_id AND r.asset_id=a.id AND r.status='pending') AS pending FROM asset_register_items a JOIN "user" u ON u.id=a.user_id WHERE ($1='' OR a.title ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%') ORDER BY a.updated_at DESC LIMIT 50`,[q])).rows});}
  return businessJson({requests:await listValueRequests(ownerId)});
 }
 if(request.method==='GET')return businessJson(await readAssetValueReview(ownerId,assetId));
 const body=await businessBody(request);
 if(body.action==='previewReplacement')return businessJson(await previewReplacementValue(ownerId,assetId,valueAmount(body.replacementPrice)));
 const support=!admin&&isAdminSupportSession(session);
 const actor={id:support?session.adminSupport.adminUserId:!admin&&isOwnerAppSession(session)?session.ownerApp.ownerAppUserId:!admin&&isDealerAppSession(session)?session.dealerApp.staffId:session.user.id,name:`${admin||support?'Admin: ':''}${support?session.adminSupport.adminEmail:session.user.name||session.user.email}`};
 return businessJson(await decideAssetValue(ownerId,assetId,actor,body));
}catch(e){return valueApiError(e);}}
export async function sharedValueApi(request:NextRequest,target:ContributionTarget){try{
 if(request.method==='GET'){const scope=await contributionScope(target,'suggestValue');const asset=await getAssetRegisterItemById(scope.ownerId,scope.assetId);if(!asset)throw Error('Asset unavailable.');return businessJson({value:asset.value,title:asset.title});}
 requireBusinessOrigin(request);const result=await suggestAssetValue(target,await businessBody(request));
 // Never turn a saved suggestion into an apparent failure because mail is unavailable.
 if(result.created)await notifyValueSuggestion(result.id).catch(e=>console.error('Value suggestion email pending',e));
 return businessJson({ok:true,id:result.id});
}catch(e){return valueApiError(e);}}
