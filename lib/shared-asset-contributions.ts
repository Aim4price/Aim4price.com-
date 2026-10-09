import {setAssetHistoryActor} from './asset-history-schema';
import type { PoolClient } from 'pg';
import { getDb } from './db';
import { getServerSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { ensureDealerMaintenanceTrackerTables } from './dealer-maintenance-tracker';
import { requireLiveSharedAsset, lockLiveSharedAsset } from './live-shared-asset-access';
import { ExternalLeadAccessError } from './external-lead-access';
import { ensurePartnerAccessTables, getAssetLeadForPartner } from './partner-access';
import { appendSharedAssetPhotos } from './asset-register-db';
import { createAssetRegisterUpload, ALLOWED_ASSET_REGISTER_IMAGE_TYPES, MAX_ASSET_REGISTER_UPLOAD_BYTES, MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES } from './asset-register-uploads';
import { createMyInvoice, createInvoiceDocumentRecord, type MyInvoiceDraftInput } from './my-invoices';
import { ensureSharingFoundation, recordSharingUsage } from './sharing-foundation';

export type ContributionTarget = {token:string;assetId:string} | {leadId:string};
type Permission = 'viewParts' | 'addParts' | 'history' | 'maintenanceReports' | 'costOfOwnership' | 'serialNumber' | 'replacementPrice' | 'suggestValue' | 'updateDetails' | 'location' | 'loggedProblems' | 'addPhotos' | 'addCosts' | 'yearModel' | 'usage' | 'condition' | 'addMaintenance';
export async function contributionScope(target: ContributionTarget, permission: Permission) {
  if ('token' in target) {
    const scope = await requireLiveSharedAsset(target.token,target.assetId,permission,!['viewParts','history','maintenanceReports','costOfOwnership'].includes(permission));
    return {ownerId:scope.lead.ownerId,assetId:scope.assetId,user:scope.user,token:target.token,lock:async(client:PoolClient)=>{await lockLiveSharedAsset(client,scope);await setAssetHistoryActor(client,scope.user.id,scope.user.name||scope.user.email,'Shared link');}};
  }
  const session = await getServerSession({allowBusiness:true,allowDealerApp:true});
  if (!session?.user?.id) throw new ExternalLeadAccessError('Sign in to add to this asset.',401);
  const user = session.user;
  const profile = await getAccountProfile(user);
  if (!['dealer','business'].includes(profile.accountType) || profile.accountStatus !== 'active') throw new ExternalLeadAccessError('An active business or dealer account is required.',403);
  const lead = await getAssetLeadForPartner({dealerUserId:user.id,leadId:target.leadId});
  if (!lead) throw new ExternalLeadAccessError('This asset is no longer shared with you.',403);
  await ensureDealerMaintenanceTrackerTables();
  const column = {viewParts:'can_view_parts',addParts:'can_add_parts',history:'can_view_history',maintenanceReports:'can_view_maintenance_reports',costOfOwnership:'can_view_cost_of_ownership',serialNumber:'can_update_serial',replacementPrice:'can_update_replacement_price',suggestValue:'can_suggest_current_value',updateDetails:'can_update_details',location:'can_access_location',loggedProblems:'can_view_logged_problems',addPhotos:'can_add_photos',addCosts:'can_add_costs',yearModel:'can_update_year',usage:'can_update_usage',condition:'can_update_condition',addMaintenance:'can_add_maintenance'}[permission];
  const lock = async (client:Pick<PoolClient,'query'>) => {
    const result = await client.query(`SELECT a.id FROM dealer_maintenance_access a JOIN asset_leads l ON l.owner_user_id=a.owner_user_id AND l.partner_user_id=a.dealer_user_id AND l.asset_register_item_id=a.asset_register_item_id WHERE l.id=$1::uuid AND a.dealer_user_id=$2 AND a.owner_user_id=$3 AND a.asset_register_item_id=$4::uuid AND a.is_active=true AND a.${column}=true FOR SHARE OF a,l`,[target.leadId,user.id,lead.ownerUserId,lead.assetRegisterItemId]);
    if (!result.rows.length) {
      // Older enquiry leads can propose serial/price changes, but never gain direct edit rights.
      const source=[lead.includedSections?.source,lead.assetSnapshot?.source,lead.assetSnapshot?.sharePurpose].join(' ').toLowerCase();
      const tracking=lead.includedSections?.maintenanceTrackingEnabled||lead.assetSnapshot?.maintenanceTrackingEnabled||source.includes('tracking');
      if((permission==='serialNumber'||permission==='replacementPrice')&&!tracking) {
        const legacy=await client.query(`SELECT l.id FROM asset_leads l WHERE l.id=$1::uuid AND l.partner_user_id=$2 AND l.owner_user_id=$3 AND l.asset_register_item_id=$4::uuid AND NOT EXISTS(SELECT 1 FROM dealer_maintenance_access a WHERE a.owner_user_id=l.owner_user_id AND a.dealer_user_id=l.partner_user_id AND a.asset_register_item_id=l.asset_register_item_id) FOR SHARE OF l`,[target.leadId,user.id,lead.ownerUserId,lead.assetRegisterItemId]);
        if(legacy.rows.length)return;
      }
      throw new ExternalLeadAccessError('The owner has not enabled this action.',403);
    }
    if('release' in client)await setAssetHistoryActor(client,user.id,user.name||user.email,'Leads');
  };
  await lock(getDb());
  return {ownerId:lead.ownerUserId,assetId:lead.assetRegisterItemId,user,token:undefined,lock};
}
function requestKey(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('This request needs a valid save identifier.');
  return value;
}
export async function addSharedPhotos(target:ContributionTarget, files:File[], key:unknown) {
  const scope = await contributionScope(target,'addPhotos');
  const requestId = requestKey(key);
  if (!files.length || files.length > 12) throw new Error('Choose between 1 and 12 photos.');
  for (const file of files) if (!ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(file.type) || !file.size || file.size > MAX_ASSET_REGISTER_UPLOAD_BYTES) throw new Error('Choose JPG, PNG or WEBP photos up to 5 MB each.');
  await ensureSharingFoundation();
  await ensurePartnerAccessTables();
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    await scope.lock(client);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${scope.user.id}:${requestId}`]);
    const existing = await client.query(`SELECT id FROM sharing_usage_events WHERE account_id=$1 AND metric='contribution' AND event_key=$2`,[scope.user.id,`${scope.assetId}:photos:${requestId}`]);
    if (existing.rows.length) { await client.query('COMMIT'); return; }
    // Lock and check capacity before storing files. The append helper checks again under the same lock.
    const current = await appendSharedAssetPhotos(client,scope.ownerId,scope.assetId,[]);
    if (current.photos.length + files.length > 12) throw new Error('This asset can have up to 12 photos.');
    const uploads = [];
    for (const file of files) uploads.push(await createAssetRegisterUpload({userId:scope.ownerId,file,category:'shared-asset-photo'}));
    const asset = await appendSharedAssetPhotos(client,scope.ownerId,scope.assetId,uploads.map(file=>file.url));
    await client.query(`UPDATE asset_leads SET asset_snapshot_json=jsonb_set(coalesce(asset_snapshot_json,'{}'::jsonb),'{photos}',$3::jsonb,true),updated_at=now() WHERE owner_user_id=$1 AND asset_register_item_id=$2::uuid`,[scope.ownerId,scope.assetId,JSON.stringify(asset.photos)]);
    for (const upload of uploads) await recordSharingUsage({accountId:scope.user.id,actorId:scope.user.id,token:scope.token,assetId:scope.assetId,metric:'upload',eventKey:upload.id,bytes:upload.byteSize},client);
    await recordSharingUsage({accountId:scope.user.id,actorId:scope.user.id,token:scope.token,assetId:scope.assetId,metric:'contribution',eventKey:`${scope.assetId}:photos:${requestId}`},client);
    await client.query('COMMIT');
  } catch (error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
export async function addSharedCost(target:ContributionTarget, input:MyInvoiceDraftInput, file?:File) {
  const scope = await contributionScope(target,'addCosts');
  const captureRequestId = requestKey(input.captureRequestId);
  const amount = Number(input.subtotalExVat), vat = Number(input.vatAmount);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(vat) || vat < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.invoiceDate))) throw new Error('Enter a valid date, amount and VAT.');
  if (file && (!['application/pdf',...ALLOWED_ASSET_REGISTER_IMAGE_TYPES].includes(file.type) || !file.size || file.size > MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES)) throw new Error('Choose a PDF or image up to 12 MB.');
  await ensureSharingFoundation();
  const actor = {dealerUserId:scope.user.id === scope.ownerId ? null : scope.user.id,displayName:scope.user.name || scope.user.email,ownerApproved:true};
  // The canonical invoice ledger owns the cost and the supporting document; no second expense is created.
  let upload: Awaited<ReturnType<typeof createAssetRegisterUpload>> | undefined;
  let documentId: string | undefined;
  return createMyInvoice(scope.ownerId,{...input,assetId:scope.assetId,captureRequestId,invoiceDocumentId:documentId || null,subtotalExVat:amount,vatAmount:vat,totalIncVat:Math.round((amount+vat)*100)/100,source:'manual'},actor,{
    before:async client=>{
      await scope.lock(client);
      const asset=await client.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR SHARE',[scope.assetId,scope.ownerId]);
      if(!asset.rows.length)throw new Error('This asset is no longer available.');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[captureRequestId]);
      const existing=await client.query(`SELECT id,created_by_dealer_user_id,invoice_document_id FROM asset_invoices WHERE capture_request_id=$1::uuid AND user_id=$2 AND asset_register_item_id=$3::uuid`,[captureRequestId,scope.ownerId,scope.assetId]);
      if(existing.rows.length) {
        if ((existing.rows[0].created_by_dealer_user_id || null) !== actor.dealerUserId) throw new Error('This save identifier has already been used.');
        return;
      }
      if (file) {
        upload=await createAssetRegisterUpload({userId:scope.ownerId,file,category:'shared-cost'});
        const document=await createInvoiceDocumentRecord({userId:scope.ownerId,assetId:scope.assetId,captureRequestId,uploadId:upload.id,uploadUrl:upload.url,fileName:upload.fileName,contentType:upload.contentType,byteSize:upload.byteSize,actor},client);
        documentId=document.id;
        return documentId;
      }
    },
    after: async (client,invoiceId)=>{
      const base={accountId:scope.user.id,actorId:scope.user.id,token:scope.token,assetId:scope.assetId};
      await recordSharingUsage({...base,metric:'contribution',eventKey:`cost:${invoiceId}`},client);
      if (upload) await recordSharingUsage({...base,metric:'upload',eventKey:`cost-document:${documentId}`,bytes:upload.byteSize},client);
    },
  });
}
