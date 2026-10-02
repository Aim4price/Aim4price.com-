import {getServerSession} from '../../../../../lib/auth-session';
import {getAssetRegisterAccountAccess} from '../../../../../lib/asset-register-account-access';
import {getAssetRegisterItemById} from '../../../../../lib/asset-register-db';
import {ensureSharedAssetActivity} from '../../../../../lib/shared-asset-activity';
import {getDb} from '../../../../../lib/db';
import {businessJson} from '../../../../../lib/business-network-api';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{assetId:string}}){
 const session=await getServerSession({allowOwnerApp:true,allowDealerApp:true});
 if(!session||!await getAssetRegisterAccountAccess(session))return businessJson({error:'Sign in as the asset owner.'},403);
 if(!await getAssetRegisterItemById(session.user.id,params.assetId))return businessJson({error:'Asset unavailable.'},404);
 await ensureSharedAssetActivity();
 return businessJson({items:(await getDb().query('SELECT actor_name,action,before_data,after_data,created_at FROM shared_asset_activity WHERE owner_id=$1 AND asset_id=$2::uuid ORDER BY created_at DESC LIMIT 100',[session.user.id,params.assetId])).rows});
}
