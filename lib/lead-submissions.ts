import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { ensureGuestLeadSchema } from './guest-lead-schema';
import type { ValidatedPublicInvoiceFile } from './public-invoice-drop-security';

export type LeadSubmission = { id:string; kind:string; sender_name:string; sender_contact:string; note:string; file_name:string; status:string; created_at:string };
const validToken = (token:string) => /^[A-Za-z0-9_-]{43}$/.test(token);
// The link is a bearer capability. Contact details are self-reported, not a verified business identity.
export async function submitLeadDocument(token:string, input:Record<string,unknown>, file:ValidatedPublicInvoiceFile) {
 if(!validToken(token)) throw new Error('This enquiry is unavailable.');
 const name=String(input.name||'').trim(),contact=String(input.contact||'').trim(),note=String(input.note||'').trim();
 if(!name||name.length>150||!contact||contact.length>254||note.length>2000||!['invoice','quote'].includes(String(input.kind))) throw new Error('Enter your name, contact details and document type.');
 await ensureGuestLeadSchema();const db=await getDb().connect();
 try {
  await db.query('BEGIN');
  const lead=(await db.query(`SELECT user_id FROM asset_share_links s WHERE token=$1 AND revoked_at IS NULL AND lead_details->>'allowSubmissions'='true' AND NOT EXISTS(SELECT 1 FROM unnest(s.asset_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM asset_register_items a WHERE a.id=requested.id AND a.user_id=s.user_id)) FOR UPDATE`,[token])).rows[0];
  if(!lead)throw new Error('This enquiry is unavailable or document submissions are disabled.');
  const count=(await db.query('SELECT count(*)::int AS count FROM asset_share_submissions WHERE token=$1',[token])).rows[0].count;
  if(count>=10)throw new Error('This enquiry has reached its document limit. Contact the owner.');
  await db.query(`INSERT INTO asset_share_submissions(id,token,kind,sender_name,sender_contact,note,file_name,content_type,file_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),token,input.kind,name,contact,note,file.fileName,file.contentType,file.data]);
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
