import {notifyReplacementSuggestion} from './asset-replacement-mail';
import type {NextRequest} from 'next/server';
import {getServerSession,isOwnerAppSession,isDealerAppSession,isAdminSupportSession} from './auth-session';
import {getAssetRegisterAccountAccess} from './asset-register-account-access';
import {getOwnerAppAccess,ownerAppCan,ownerAppCanAccessAsset} from './owner-app-access';
import {businessJson,businessBody,requireBusinessOrigin} from './business-network-api';
import {previewAim4priceReset,decideAssetValue,readAssetValueReview,previewReplacementValue,valueAmount,listValueRequests,suggestAssetValue} from './asset-value-requests';
import {contributionScope,type ContributionTarget} from './shared-asset-contributions';
import {getAssetRegisterItemById} from './asset-register-db';
import {ExternalLeadAccessError} from './external-lead-access';
import {notifyValueSuggestion} from './asset-value-mail';
export function valueApiError(e:unknown){if(e instanceof ExternalLeadAccessError)return businessJson({error:e.message},e.status);const message=e instanceof Error?e.message:'';const safe=/^(Enter |Please |Reopen |Choose |Replacement |Manual |This |The asset|Asset unavailable|Suggestion unavailable|Invalid save|Sign in|Owner access)/.test(message);if(!safe)console.error('Value review failed',e);return businessJson({error:safe?message:'Unable to save this value. Please reload and try again.'},400);}
export async function ownerValueApi(request:NextRequest,assetId?:string){try{
 if(request.method!=='GET')requireBusinessOrigin(request);
 const session=await getServerSession({allowOwnerApp:true,allowDealerApp:true});
 if(!session?.user)return businessJson({error:'Sign in to review values.'},401);
 if(!await getAssetRegisterAccountAccess(session))return businessJson({error:'Owner access required.'},403);
 if(isOwnerAppSession(session)){const access=await getOwnerAppAccess();if(!access||!ownerAppCan(access,'manage_assets')||(assetId&&!ownerAppCanAccessAsset(access,assetId)))return businessJson({error:'Owner access required.'},403);}
 const ownerId=session.user.id;
 if(!assetId)return businessJson({requests:await listValueRequests(ownerId)});
 if(request.method==='GET')return businessJson(await readAssetValueReview(ownerId,assetId,request.nextUrl.searchParams.get('valueRequest')||undefined));
 const body=await businessBody(request);
 if(body.action==='retryNotification'){
  const review=await readAssetValueReview(ownerId,assetId);const id=String(body.notificationId||'');
  if(body.notificationType==='replacement'&&review.replacementRequests.some(r=>r.id===id))await notifyReplacementSuggestion(id);
  else if(body.notificationType==='current'&&review.requests.some(r=>r.id===id&&r.status==='pending'))await notifyValueSuggestion(id);
  else throw Error('Choose a pending value suggestion.');
  return businessJson({ok:true});
 }

 if(body.action==='previewReset')return businessJson(await previewAim4priceReset(ownerId,assetId));
 if(body.action==='previewReplacement')return businessJson(await previewReplacementValue(ownerId,assetId,valueAmount(body.replacementPrice)));
 const support=isAdminSupportSession(session);
 const actor={id:support?session.adminSupport.adminUserId:isOwnerAppSession(session)?session.ownerApp.ownerAppUserId:isDealerAppSession(session)?session.dealerApp.staffId:session.user.id,name:`${support?'Admin: ':''}${support?session.adminSupport.adminEmail:session.user.name||session.user.email}`};
 return businessJson(await decideAssetValue(ownerId,assetId,actor,body));
}catch(e){return valueApiError(e);}}
export async function sharedValueApi(request:NextRequest,target:ContributionTarget){try{
 if(request.method==='GET'){const scope=await contributionScope(target,'suggestValue');const asset=await getAssetRegisterItemById(scope.ownerId,scope.assetId);if(!asset)throw Error('Asset unavailable.');return businessJson({value:asset.value,title:asset.title,manual:asset.selectedMethod==='manual',revision:asset.updatedAtIso});}
 requireBusinessOrigin(request);const result=await suggestAssetValue(target,await businessBody(request));
 // Never turn a saved suggestion into an apparent failure because mail is unavailable.
 if(result.created&&!result.direct)await notifyValueSuggestion(result.id).catch(e=>console.error('Value suggestion email pending',e));
 return businessJson({ok:true,id:result.id,direct:result.direct===true});
}catch(e){return valueApiError(e);}}
