import { businessWorkspaceSummary } from './business-workspaces';
import { getDb } from './db';
import { getAccountProfile } from './account-profile';
export const BUSINESS_ACCOUNT_SCHEMA = `
CREATE TABLE IF NOT EXISTS business_account_reviews (
 user_id text PRIMARY KEY REFERENCES account_profiles(user_id) ON DELETE CASCADE,
 website text NOT NULL DEFAULT '', evidence text NOT NULL DEFAULT '',
 verified_at timestamptz, verified_by text, verified_email text, review_note text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_account_review_events (
 id bigserial PRIMARY KEY, user_id text NOT NULL REFERENCES account_profiles(user_id) ON DELETE CASCADE,
 actor_id text NOT NULL, action text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);`;
let ready: Promise<void> | undefined;
export function ensureBusinessAccounts() {
    if (!ready)
        ready = getDb().query(BUSINESS_ACCOUNT_SCHEMA).then(() => { }).catch(e => { ready = undefined; throw e; });
    return ready;
}
export type BusinessReview = {
    website: string;
    evidence: string;
    verified_at: string | null;
    verified_by: string | null;
    verified_email: string | null;
    review_note: string;
};
export async function readBusinessAccount(user: {
    id: string;
    name?: string | null;
    email?: string | null;
}) {
    const profile = await getAccountProfile(user);
    if (profile.accountType !== 'business')
        return null;
    await ensureBusinessAccounts();
    const row = (await getDb().query<BusinessReview>('SELECT website,evidence,verified_at,verified_by,verified_email,review_note FROM business_account_reviews WHERE user_id=$1', [user.id])).rows[0];
    return { profile, review: row || { website: '', evidence: '', verified_at: null, verified_by: null, verified_email: null, review_note: '' } };
}
/** Viewing a sender-authorised enquiry does not require business approval. */
export async function canBusinessRead(user: {id:string;email?:string|null;emailVerified?:boolean|null}) {
    if (user.emailVerified !== true) return false;
    const profile = await getAccountProfile(user);
    if (profile.accountType !== 'business' || profile.accountStatus !== 'active') return false;
    const workspace = await businessWorkspaceSummary(user.id);
    return Boolean(workspace && !workspace.suspended);
}
export async function canBusinessContribute(user: {
    id: string;
    email?: string | null;
    emailVerified?: boolean | null;
}) {
    if (!(await canBusinessRead(user)))
        return false;
    const account = await readBusinessAccount(user);
    return Boolean(account && account.profile.accountStatus === 'active' && account.review.verified_at && account.review.verified_email === user.email?.toLowerCase());
}
export async function saveBusinessDetails(userId: string, input: Record<string, unknown>) {
    const name = String(input.businessName || '').trim(), phone = String(input.phone || '').trim();
    const website = String(input.website || '').trim(), evidence = String(input.evidence || '').trim();
    if (!name || name.length > 200 || phone.length > 40 || website.length > 500 || evidence.length > 2000)
        throw new Error('Enter valid business and contact details.');
    if (website) {
        try {
            if (!['https:', 'http:'].includes(new URL(website).protocol))
                throw 0;
        }
        catch {
            throw new Error('Enter a complete website address, starting with https://.');
        }
    }
    await ensureBusinessAccounts();
    const db = await getDb().connect();
    try {
        await db.query('BEGIN');
        const existing = (await db.query("SELECT business_name,phone FROM account_profiles WHERE user_id=$1 AND account_type='business' AND account_status <> 'suspended' FOR UPDATE", [userId])).rows[0];
        if (!existing)
            throw new Error('This business account is unavailable.');
        const prior = (await db.query('SELECT website,evidence FROM business_account_reviews WHERE user_id=$1', [userId])).rows[0];
        const changed = name !== (existing.business_name || '') || phone !== (existing.phone || '') || website !== (prior?.website || '') || evidence !== (prior?.evidence || '');
        await db.query('UPDATE account_profiles SET business_name=$2,phone=$3,updated_at=now() WHERE user_id=$1', [userId, name, phone]);
        await db.query(`INSERT INTO business_account_reviews(user_id,website,evidence) VALUES($1,$2,$3)
      ON CONFLICT(user_id) DO UPDATE SET website=$2,evidence=$3,
      verified_at=CASE WHEN $4 THEN NULL ELSE business_account_reviews.verified_at END,
      verified_by=CASE WHEN $4 THEN NULL ELSE business_account_reviews.verified_by END,updated_at=now()`, [userId, website, evidence, changed]);
        if (changed)
            await db.query("INSERT INTO business_account_review_events(user_id,actor_id,action) VALUES($1,$1,'details_updated')", [userId]);
        await db.query('COMMIT');
    }
    catch (e) {
        await db.query('ROLLBACK');
        throw e;
    }
    finally {
        db.release();
    }
}
export async function listBusinessAccounts() {
    await ensureBusinessAccounts();
    return (await getDb().query(`SELECT p.user_id,p.business_name,p.phone,p.account_status,u.email,u."emailVerified" AS email_verified,
    r.website,r.evidence,CASE WHEN r.verified_email=lower(u.email) AND u."emailVerified" THEN r.verified_at END AS verified_at,r.review_note FROM account_profiles p JOIN "user" u ON u.id=p.user_id
    LEFT JOIN business_account_reviews r ON r.user_id=p.user_id WHERE p.account_type='business' ORDER BY p.created_at DESC LIMIT 500`)).rows;
}
export async function verifyBusinessAccount(actorId: string, input: Record<string, unknown>) {
    if (typeof input.verified !== 'boolean' || typeof input.userId !== 'string')
        throw new Error('Choose a business and verification status.');
    const note = String(input.note || '').trim();
    if (!note || note.length > 2000)
        throw new Error('Enter a short review note explaining your decision.');
    await ensureBusinessAccounts();
    const db = await getDb().connect();
    try {
        await db.query('BEGIN');
        const row = (await db.query(`SELECT u.email,u."emailVerified" AS verified,p.account_status FROM account_profiles p JOIN "user" u ON u.id=p.user_id WHERE p.user_id=$1 AND p.account_type='business' FOR UPDATE OF p,u`, [input.userId])).rows[0];
        if (!row || (input.verified && (!row.verified || row.account_status !== 'active')))
            throw new Error('This business needs a verified email and an active account before approval.');
        await db.query(`INSERT INTO business_account_reviews(user_id,verified_at,verified_by,review_note,verified_email) VALUES($1,CASE WHEN $2 THEN now() END,CASE WHEN $2 THEN $3 END,$4,CASE WHEN $2 THEN $5 END)
      ON CONFLICT(user_id) DO UPDATE SET verified_at=EXCLUDED.verified_at,verified_by=EXCLUDED.verified_by,review_note=$4,verified_email=EXCLUDED.verified_email,updated_at=now()`, [input.userId, input.verified, actorId, note, String(row.email).toLowerCase()]);
        await db.query('INSERT INTO business_account_review_events(user_id,actor_id,action,note) VALUES($1,$2,$3,$4)', [input.userId, actorId, input.verified ? 'verified' : 'verification_removed', note]);
        await db.query('COMMIT');
    }
    catch (e) {
        await db.query('ROLLBACK');
        throw e;
    }
    finally {
        db.release();
    }
}
export async function listBusinessEnquiries(user: {
    id: string;
    email: string;
    emailVerified?: boolean | null;
}) {
    if (!await canBusinessRead(user))
        return [];
    const { ensureGuestLeadSchema } = await import('./guest-lead-schema');
    await ensureGuestLeadSchema();
    return (await getDb().query<{
        token: string;
        request: string;
        sender: string;
        created_at: string;
    }>(`SELECT token,lead_details->>'request' AS request,lead_details->>'replyName' AS sender,created_at FROM asset_share_links s
    WHERE lower(lead_details->>'recipientEmail')=$1 AND (coalesce(lead_details->>'recipientUserId','')='' OR lead_details->>'recipientUserId'=$2) AND revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM unnest(s.asset_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM asset_register_items a WHERE a.id=requested.id AND a.user_id=s.user_id)) ORDER BY created_at DESC LIMIT 50`, [user.email.toLowerCase(),user.id])).rows;
}
