import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { ensureGuestLeadSchema } from './guest-lead-schema';
import { businessEmail, businessText, businessUrl } from './business-network-shared';
export async function recordBusinessAcceptance(input: Record<string, unknown>) {
 if (input.accepted !== true) throw new Error('Confirm that you represent this business and want it listed.');
 const email = businessEmail(input.email), name = businessText(input.businessName), contact = businessText(input.contactName), phone = businessText(input.phone);
 if (name.length < 2 || name.length > 200 || contact.length < 2 || contact.length > 150 || phone.length > 40) throw new Error('Enter a business name, contact name and valid contact details.');
 if (input.whatsappConfirmed === true && !phone) throw new Error('Enter the phone number you use for WhatsApp.');
 const googlePlaceId = businessText(input.googlePlaceId, 250);
 if (googlePlaceId && !/^[A-Za-z0-9_-]{1,250}$/.test(googlePlaceId)) throw new Error('Choose a valid Google business.');
 if (googlePlaceId && input.googleConfirmed !== true) throw new Error('Confirm that this is your business or enter details manually.');
 const details = { googlePlaceId, googleMapsUrl: businessUrl(input.googleMapsUrl, true), town: businessText(input.town, 150), whatsappConfirmed: input.whatsappConfirmed === true && Boolean(phone) };
 await ensureGuestLeadSchema();
 // A repeated public submission cannot overwrite an earlier acceptance or a published listing.
 await getDb().query(`INSERT INTO business_acceptances(id,email,business_name,contact_name,phone,details) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(email) DO NOTHING`, [randomUUID(),email,name,contact,phone,JSON.stringify(details)]);
}
export async function listBusinessAcceptances() {
 await ensureGuestLeadSchema();
 return (await getDb().query(`SELECT a.*,b.id as business_id,b.status as listing_status FROM business_acceptances a LEFT JOIN business_network b ON b.email=a.email ORDER BY a.accepted_at DESC LIMIT 1000`)).rows;
}
