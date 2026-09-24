import { randomBytes,randomUUID } from 'node:crypto';
import { getDb } from './db';
import { ensureGuestLeadSchema } from './guest-lead-schema';
import { businessEmail,businessText } from './business-network-shared';
import { getAssetRegisterItemsByRefs } from './asset-register-db';
import { assetShareSnapshot,parseShareAssetIds } from './asset-share-snapshot';
import { readPublicAssetShare } from './asset-share-links';
import { getGuestViewer } from './guest-business-access';
import { getServerSession } from './auth-session';
import { getAssetRegisterAccountAccess } from './asset-register-account-access';
export type LeadDetails={recipientName:string;recipientEmail:string;recipientWhatsApp?:string;allowSubmissions?:boolean;request:string;replyName:string;replyEmail:string;replyPhone:string;allowReply:boolean};
export type LeadReport={id:string;label:string};
export type LeadAccess='owner'|'active'|'sign-in'|'wrong-recipient'|'payment-required';
export function validateLeadDetails(input:Record<string,unknown>):LeadDetails{
 const details={recipientName:businessText(input.recipientName),recipientEmail:businessText(input.recipientEmail)?businessEmail(input.recipientEmail):'',recipientWhatsApp:businessText(input.recipientWhatsApp).replace(/[\s()-]/g,''),allowSubmissions:input.allowSubmissions===true,request:String(input.request||'').trim(),replyName:businessText(input.replyName),replyEmail:businessEmail(input.replyEmail),replyPhone:businessText(input.replyPhone),allowReply:input.allowReply===true};
 if(!details.request||details.request.length>3000||!details.replyName||details.replyName.length>150||details.recipientName.length>200||details.replyPhone.length>40)throw new Error('Enter your request, name and valid contact details.');
 if(!details.recipientEmail&&!details.recipientWhatsApp)throw new Error('Enter a recipient email or confirmed WhatsApp number.');
 if(details.recipientWhatsApp&&!/^\+[1-9]\d{7,14}$/.test(details.recipientWhatsApp))throw new Error('Enter the confirmed WhatsApp number with country code, for example +27821234567.');
 return details;
}
export type LeadPdf={label:string;fileName:string;data:Buffer};
export async function createGuestLead(ownerId:string,idsInput:unknown,includePhotos:boolean,details:LeadDetails,reports:LeadPdf[]){
 const ids=parseShareAssetIds(idsInput),safe=validateLeadDetails(details);
 if(reports.length&&!safe.recipientEmail)throw new Error('Enter the recipient email to restrict report access to their verified account.');
 if(reports.length>6||reports.reduce((n,r)=>n+r.data.length,0)>30*1024*1024||reports.some(r=>r.data.length>8*1024*1024||r.data.length<5||r.data.subarray(0,5).toString()!=='%PDF-'||!r.label||r.label.length>200||r.fileName.length>200))throw new Error('Choose up to six PDF reports, each under 8 MB and 30 MB in total.');
 const assets=await getAssetRegisterItemsByRefs(ids.map(assetId=>({userId:ownerId,assetId})));
 if(assets.length!==ids.length)throw new Error('This account does not own all the selected assets.');
 await ensureGuestLeadSchema();const db=await getDb().connect(),token=randomBytes(32).toString('base64url');
 try{await db.query('BEGIN');
 await db.query(`INSERT INTO asset_share_links(token,user_id,selection_key,asset_ids,snapshot,lead_details) VALUES($1,$2,$3,$4::uuid[],$5::jsonb,$6::jsonb)`,[token,ownerId,`lead:${randomUUID()}`,ids,JSON.stringify(ids.map(id=>assetShareSnapshot(assets.find(a=>a.id===id)!,includePhotos))),JSON.stringify(safe)]);
 for(const report of reports)await db.query('INSERT INTO asset_share_reports(id,token,label,file_name,pdf) VALUES($1,$2,$3,$4,$5)',[randomUUID(),token,report.label,report.fileName,report.data]);
 await db.query('COMMIT');return{token,created_at:new Date().toISOString()};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export async function listOwnerGuestLeads(ownerId:string,idsInput:unknown){
 const ids=parseShareAssetIds(idsInput);await ensureGuestLeadSchema();
 return(await getDb().query(`SELECT token,created_at,revoked_at,lead_details->>'recipientName' as recipient_name,lead_details->>'recipientEmail' as recipient_email ,(SELECT count(*)::int FROM asset_share_submissions d WHERE d.token=asset_share_links.token AND d.status='pending') AS pending_documents FROM asset_share_links WHERE user_id=$1 AND asset_ids=$2::uuid[] AND lead_details IS NOT NULL ORDER BY created_at DESC LIMIT 50`,[ownerId,ids])).rows;
}
export async function readLeadPage(token:string){
 const share=await readPublicAssetShare(token);if(!share)return null;
 await ensureGuestLeadSchema();const row=(await getDb().query('SELECT user_id,lead_details FROM asset_share_links WHERE token=$1 AND revoked_at IS NULL',[token])).rows[0];
 if(!row?.lead_details)return{share,details:null,reports:[] as LeadReport[],ownerId:row?.user_id||''};
 const reports=(await getDb().query<LeadReport>('SELECT id,label FROM asset_share_reports WHERE token=$1 ORDER BY label,id',[token])).rows;
 return{share,details:row.lead_details as LeadDetails,reports,ownerId:row.user_id as string};
}
export async function resolveLeadAccess(ownerId:string,recipientEmail:string):Promise<LeadAccess>{
 const session=await getServerSession({requireActive:true,allowOwnerApp:true,allowDealerApp:true});
 if(session?.user?.id===ownerId&&await getAssetRegisterAccountAccess(session))return 'owner';
 // Existing full accounts may use their own verified identity; guest accounts never become full accounts.
 if(session?.user?.emailVerified===true&&session.user.email.toLowerCase()===recipientEmail)return 'active';
 const guest=await getGuestViewer();
 if(!guest)return 'sign-in';if(guest.email!==recipientEmail)return 'wrong-recipient';return guest.active?'active':'payment-required';
}
export async function loadProtectedLeadReport(token:string,reportId:string){
 if(!/^[0-9a-f-]{36}$/i.test(reportId))return{status:404 as const};
 const lead=await readLeadPage(token);if(!lead?.details)return{status:404 as const};
 const access=await resolveLeadAccess(lead.ownerId,lead.details.recipientEmail);
 if(access!=='active'&&access!=='owner')return{status:403 as const};
 const report=(await getDb().query(`SELECT r.pdf,r.file_name FROM asset_share_reports r JOIN asset_share_links s ON s.token=r.token WHERE r.id=$1 AND r.token=$2 AND s.revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM unnest(s.asset_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM asset_register_items a WHERE a.id=requested.id AND a.user_id=s.user_id))`,[reportId,token])).rows[0];
 return report?{status:200 as const,report}:{status:404 as const};
}

// The shared page and this inbox reference the same enquiry, not a copied lead.
export async function listReceivedSharedEnquiries(){
 const session=await getServerSession({requireActive:true,allowDealerApp:true});
 if(!session?.user?.emailVerified||!session.user.email)return[];
 await ensureGuestLeadSchema();
 return (await getDb().query<{token:string;request:string;sender:string;created_at:string}>(`SELECT token,lead_details->>'request' AS request,lead_details->>'replyName' AS sender,created_at FROM asset_share_links s WHERE lower(lead_details->>'recipientEmail')=$1 AND revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM unnest(s.asset_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM asset_register_items a WHERE a.id=requested.id AND a.user_id=s.user_id)) ORDER BY created_at DESC LIMIT 50`,[session.user.email.toLowerCase()])).rows;
}
