import {randomUUID} from 'node:crypto';
import {getDb} from './db';
import {requireLiveSharedAsset,lockLiveSharedAsset} from './live-shared-asset-access';
import {ensurePartnerAccessTables} from './partner-access';
import {ensureSharingFoundation,recordSharingUsage} from './sharing-foundation';
import {validatePublicInvoiceFiles} from './public-invoice-drop-security';
export async function sendSharedAssetNote(token:string,assetId:string,form:FormData) {
 const scope=await requireLiveSharedAsset(token,assetId,'reply',true);
 const note=String(form.get('note')||'').trim(),raw=form.get('attachment');
 const file=raw && typeof raw!=='string' && raw.size?raw:null;
 if(!note&&!file)throw new Error('Write a note or attach a PDF quote.');
 if(note.length>4000)throw new Error('Keep your note under 4,000 characters.');
 const attachment=file?(await validatePublicInvoiceFiles([file]))[0]:null;
 if(attachment&&attachment.contentType!=='application/pdf')throw new Error('Choose a PDF quote up to 12 MB.');
 const id=String(form.get('requestId')||randomUUID());
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid save identifier.');
 await ensurePartnerAccessTables();await ensureSharingFoundation();
 const db=await getDb().connect();
 try {
  await db.query('BEGIN');await lockLiveSharedAsset(db,scope);
  const asset=await db.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR SHARE',[assetId,scope.lead.ownerId]);
  if(!asset.rows.length)throw new Error('This asset is no longer available.');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
  const existing=await db.query('SELECT owner_user_id,partner_user_id,asset_register_item_id FROM asset_partner_notes WHERE id=$1::uuid',[id]);
  if(existing.rows[0]){
   const previous=existing.rows[0];
   if(previous.owner_user_id!==scope.lead.ownerId||previous.partner_user_id!==scope.user.id||previous.asset_register_item_id!==assetId)throw new Error('Invalid save identifier.');
  }else{
   await db.query(`INSERT INTO asset_partner_notes(id,owner_user_id,partner_user_id,asset_register_item_id,note_text,status,attachment_file_name,attachment_content_type,attachment_byte_size,attachment_data) VALUES($1::uuid,$2,$3,$4::uuid,$5,'open',$6,$7,$8,$9)`,[id,scope.lead.ownerId,scope.user.id,assetId,note||'PDF quote attached.',attachment?.fileName||null,attachment?.contentType||null,attachment?.data.length||null,attachment?.data||null]);
   const usage={accountId:scope.user.id,actorId:scope.user.id,assetId,token};
   await recordSharingUsage({...usage,metric:'contribution',eventKey:`shared-note:${id}`},db);
   if(attachment)await recordSharingUsage({...usage,metric:'upload',eventKey:`shared-note-file:${id}`,bytes:attachment.data.length},db);
  }
  await db.query('COMMIT');return {id};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
