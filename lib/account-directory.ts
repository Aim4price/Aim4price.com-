import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { getAccountProfile } from './account-profile';
import { ensureBusinessNetwork } from './business-network';
import { validateBusinessDetails } from './business-network-shared';
import { validateShowroomLogoDataUrl } from './showroom-logo-validation';
export const ACCOUNT_DIRECTORY_SCHEMA = `CREATE TABLE IF NOT EXISTS account_directory_listings (
 user_id text PRIMARY KEY, business_id uuid NOT NULL UNIQUE REFERENCES business_network(id),
 logo_data text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
);`;
async function ensure() { await ensureBusinessNetwork(); await getDb().query(ACCOUNT_DIRECTORY_SCHEMA); }
export async function directoryIdentity(user: {id:string;email?:string|null;emailVerified?:boolean|null}) {
 const profile=await getAccountProfile(user);
 if(!['business','dealer'].includes(profile.accountType)||profile.accountStatus!=='active'||user.emailVerified!==true) throw new Error('This action requires an active Business or Dealer account with a verified email.');
 return profile;
}
export async function readAccountListing(userId:string) {
 await ensure();
 return (await getDb().query(`SELECT b.id,b.name,b.email,b.status,b.details,l.logo_data FROM account_directory_listings l JOIN business_network b ON b.id=l.business_id WHERE l.user_id=$1`,[userId])).rows[0]||null;
}
export async function saveAccountListing(user:{id:string;email?:string|null;emailVerified?:boolean|null},input:Record<string,unknown>) {
 await directoryIdentity(user); await ensure();
 const db=await getDb().connect();
 try {
  await db.query('BEGIN');
  // Serialise requests for this account, including its first submission.
  await db.query('SELECT user_id FROM account_profiles WHERE user_id=$1 FOR UPDATE',[user.id]);
  const prior=(await db.query('SELECT business_id,logo_data FROM account_directory_listings WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];
  if(input.action==='hide') {
   if(prior) await db.query("UPDATE business_network SET status='paused',updated_at=now() WHERE id=$1",[prior.business_id]);
  } else {
   if(input.accepted!==true) throw new Error('Confirm that you want your business details published in the directory.');
   const details=validateBusinessDetails({...input,locationMode:'town'},String(user.email));
   if(!details.phone||!details.services.length) throw new Error('Add a contact number and at least one service.');
   const logo=input.logoData===undefined?prior?.logo_data||'':validateShowroomLogoDataUrl(String(input.logoData||''));
   const id=prior?.business_id||randomUUID();
   if(!prior) {
    const duplicate=(await db.query('SELECT id FROM business_network WHERE lower(email)=lower($1)',[user.email])).rows[0];
    if(duplicate) throw new Error('This email already has a directory listing. Contact Aim4price to connect it to your account.');
    await db.query("INSERT INTO business_network(id,email,name,status,details,invited_by,accepted_at) VALUES($1,lower($2),$3,'invited',$4,$5,now())",[id,user.email,details.name,JSON.stringify(details),user.id]);
    await db.query('INSERT INTO account_directory_listings(user_id,business_id,logo_data) VALUES($1,$2,$3)',[user.id,id,logo]);
   } else {
    // Every edit requires review; clients cannot publish themselves.
    await db.query("UPDATE business_network SET name=$2,details=$3,status='invited',updated_at=now() WHERE id=$1",[id,details.name,JSON.stringify(details)]);
    await db.query('UPDATE account_directory_listings SET logo_data=$2,updated_at=now() WHERE user_id=$1',[user.id,logo]);
   }
  }
  await db.query('COMMIT');
 } catch(e) {await db.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new Error('This business already has a directory listing. Contact Aim4price.');throw e;} finally{db.release();}
 return readAccountListing(user.id);
}
