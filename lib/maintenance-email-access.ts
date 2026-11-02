import type {PoolClient} from 'pg';
import {getDb} from './db';
import {getAccountProfile} from './account-profile';
import {canBusinessRead} from './business-accounts';
import {ensureDealerMaintenanceTrackerTables} from './dealer-maintenance-tracker';
export type AssetEmailKind='reminder'|'problem_logged'|'problem_resolved'|'maintenance_completed';
export async function trackingEmailPermission(ownerId:string,assetId:string,userId:string,kind:AssetEmailKind,write=false,client:Pick<PoolClient,'query'>=getDb()){
 const identity=(await client.query('SELECT id,name,email,"emailVerified" FROM "user" WHERE id=$1',[userId])).rows[0];
 if(!identity)return false;
 const profile=await getAccountProfile(identity);
 if(profile.accountStatus!=='active')return false;
 if(userId===ownerId)return true;
 if(!['dealer','business'].includes(profile.accountType))return false;
 if(profile.accountType==='business'&&!await canBusinessRead(identity))return false;
 await ensureDealerMaintenanceTrackerTables();
 const permission=write?'a.can_add_maintenance=true':kind.startsWith('problem_')?'a.can_view_logged_problems=true':kind==='maintenance_completed'?'a.can_view_maintenance_reports=true':'(a.can_create_maintenance_schedules=true OR a.can_view_maintenance_reports=true)';
 const result=await client.query(`SELECT a.id FROM dealer_maintenance_access a WHERE a.owner_user_id=$1 AND a.asset_register_item_id=$2::uuid AND a.dealer_user_id=$3 AND a.is_active=true AND ${permission} FOR SHARE OF a`,[ownerId,assetId,userId]);
 return result.rows.length>0;
}
export async function assetEmailRecipients(ownerId:string,assetId:string){
 await ensureDealerMaintenanceTrackerTables();
 return (await getDb().query(`SELECT DISTINCT u.id,u.email,u.name FROM "user" u WHERE u.id=$1 OR EXISTS(SELECT 1 FROM dealer_maintenance_access a WHERE a.owner_user_id=$1 AND a.asset_register_item_id=$2::uuid AND a.dealer_user_id=u.id AND a.is_active=true)`,[ownerId,assetId])).rows as {id:string;email:string;name:string}[];
}
