import { ensureSharingFoundation, recordSharingUsage } from './sharing-foundation';
import { liveShareOwnershipSql } from './asset-share-links';
import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { ensureGuestLeadSchema } from './guest-lead-schema';
import type { ValidatedPublicInvoiceFile } from './public-invoice-drop-security';

export type LeadSubmission = { id:string; kind:string; sender_name:string; sender_contact:string; note:string; file_name:string; status:string; created_at:string };
const validToken = (token:string) => /^[A-Za-z0-9_-]{43}$/.test(token);
// All new submissions are attributed to the verified recipient, never form-supplied identity.
export async function submitLeadDocument(token:string, input:Record<string,unknown>, file:ValidatedPublicInvoiceFile, actorId:string) {
 if(!validToken(token)) throw new Error('This enquiry is unavailable.');
 const {requireExternalLeadAction}=await import('./external-lead-access');
 const {user}=await requireExternalLeadAction(token,'documents');
 if(!actorId||user.id!==actorId)throw new Error('Verified recipient access required.');
 const {getAccountProfile}=await import('./account-profile');
 const profile=await getAccountProfile(user);
 const name=(profile.businessName||user.name||user.email).slice(0,150),contact=user.email,note=String(input.note||'').trim();
 if(!name||name.length>150||!contact||contact.length>254||note.length>2000||!['invoice','quote'].includes(String(input.kind))) throw new Error('Enter your name, contact details and document type.');
 await ensureGuestLeadSchema();await ensureSharingFoundation();const db=await getDb().connect();
 try {
  await db.query('BEGIN');
  const lead=(await db.query(`SELECT user_id FROM asset_share_links s WHERE token=$1 AND revoked_at IS NULL AND lead_details->>'allowSubmissions'='true' AND lower(lead_details->>'recipientEmail')=$2 AND ${liveShareOwnershipSql()} FOR UPDATE`,[token,contact.toLowerCase()])).rows[0];
  if(!lead)throw new Error('This enquiry is unavailable or document submissions are disabled.');
  const submissionId=randomUUID();
  await db.query(`INSERT INTO asset_share_submissions(id,token,kind,sender_name,sender_contact,note,file_name,content_type,file_data,actor_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[submissionId,token,input.kind,name,contact,note,file.fileName,file.contentType,file.data,actorId]);
  await recordSharingUsage({accountId:actorId,actorId,token,metric:'upload',eventKey:submissionId,bytes:file.data.length},db);
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export async function listLeadSubmissions(ownerId:string,token:string):Promise<LeadSubmission[]> {
 if(!validToken(token))return[];
 await ensureGuestLeadSchema();
 return (await getDb().query<LeadSubmission>(`SELECT d.id,d.kind,d.sender_name,d.sender_contact,d.note,d.file_name,d.status,d.created_at FROM asset_share_submissions d JOIN asset_share_links s ON s.token=d.token WHERE s.user_id=$1 AND s.token=$2 ORDER BY d.created_at DESC`,[ownerId,token])).rows;
}
export async function reviewLeadSubmission(ownerId:string,token:string,id:string,status:string){
 if(!validToken(token)||!/^[0-9a-f-]{36}$/i.test(id)||!['accepted','rejected'].includes(status))throw new Error('Choose a document and review decision.');
 await ensureGuestLeadSchema();
 const result=await getDb().query(`UPDATE asset_share_submissions d SET status=$4,reviewed_at=now() FROM asset_share_links s WHERE d.token=s.token AND s.user_id=$1 AND s.token=$2 AND d.id=$3::uuid AND d.status='pending' RETURNING d.id`,[ownerId,token,id,status]);
 if(!result.rows.length)throw new Error('This document is unavailable or has already been reviewed.');
}
export async function downloadLeadSubmission(ownerId:string,token:string,id:string){
 if(!validToken(token)||!/^[0-9a-f-]{36}$/i.test(id))return null;
 await ensureGuestLeadSchema();
 return (await getDb().query(`SELECT d.file_data,d.content_type,d.file_name FROM asset_share_submissions d JOIN asset_share_links s ON s.token=d.token WHERE s.user_id=$1 AND s.token=$2 AND d.id=$3::uuid`,[ownerId,token,id])).rows[0]||null;
}
