import {getServerSession} from '../../../../../lib/auth-session';
import {getAccountProfile} from '../../../../../lib/account-profile';
import {getAssetLeadForPartner} from '../../../../../lib/partner-access';
import {getAssetRegisterItemById} from '../../../../../lib/asset-register-db';
import {assetShareSnapshot} from '../../../../../lib/asset-share-snapshot';
import {businessJson,businessError} from '../../../../../lib/business-network-api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Basic card facts are readable independently of permission to edit them. */
export async function GET(_request:Request,{params}:{params:{leadId:string}}){
 try {
  const session=await getServerSession({allowBusiness:true,allowDealerApp:true});
  if(!session?.user?.id)return businessJson({error:'Sign in to view this asset.'},401);
  const profile=await getAccountProfile(session.user);
  if(!['dealer','business'].includes(profile.accountType)||profile.accountStatus!=='active')return businessJson({error:'An active business or dealer account is required.'},403);
  const lead=await getAssetLeadForPartner({dealerUserId:session.user.id,leadId:params.leadId});
  if(!lead)return businessJson({error:'This asset is no longer shared with you.'},403);
  const asset=await getAssetRegisterItemById(lead.ownerUserId,lead.assetRegisterItemId);
  if(!asset)return businessJson({error:'Asset unavailable.'},404);
  // Only the basic public facts: never paperwork, finance amounts or GPS coordinates.
  return businessJson({asset:assetShareSnapshot(asset,false)});
 }catch(error){return businessError(error);}
}
