import { getDb } from './db';
export type SharingPlan = 'free' | 'desktop';
export type SharingMetric = 'asset_received' | 'enquiry_opened' | 'upload' | 'contribution' | 'email_attempt' | 'email_accepted' | 'email_failed';
export const SHARING_FOUNDATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS sharing_account_access (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 plan text NOT NULL CHECK (plan IN ('free','desktop')),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by text
);
CREATE TABLE IF NOT EXISTS sharing_usage_events (
 id bigserial PRIMARY KEY, account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 actor_id text NOT NULL, session_id text, token text, asset_id uuid,
 metric text NOT NULL CHECK(metric IN ('asset_received','enquiry_opened','upload','contribution','email_attempt','email_accepted','email_failed')),
 event_key text NOT NULL, quantity bigint NOT NULL DEFAULT 1 CHECK(quantity >= 0),
 bytes bigint NOT NULL DEFAULT 0 CHECK(bytes >= 0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,metric,event_key)
);
CREATE INDEX IF NOT EXISTS sharing_usage_account_time ON sharing_usage_events(account_id,created_at);
CREATE TABLE IF NOT EXISTS sharing_allowances (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 assets integer CHECK(assets >= 0), uploads integer CHECK(uploads >= 0),
 interactions integer CHECK(interactions >= 0), emails integer CHECK(emails >= 0),
 updated_by text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sharing_allowances(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sharing_session_activity(
 session_id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 last_seen_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sharing_revoked_sessions (
 session_id text PRIMARY KEY, user_id text NOT NULL, revoked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sharing_admin_events (
 id bigserial PRIMARY KEY, actor_id text NOT NULL, account_id text, action text NOT NULL,
 detail jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);`;
let ready: Promise<void> | undefined;
export function ensureSharingFoundation() {
    return ready ??= getDb().query(SHARING_FOUNDATION_SCHEMA).then(() => { }).catch(error => { ready = undefined; throw error; });
}
export async function sharingPlan(userId: string, accountType?: string): Promise<SharingPlan> {
    await ensureSharingFoundation();
    const row = (await getDb().query<{
        plan: SharingPlan;
    }>('SELECT plan FROM sharing_account_access WHERE user_id=$1', [userId])).rows[0];
    return row?.plan || (accountType === 'business' ? 'free' : 'desktop');
}
/** Registration may grant free access only. Desktop activation stays administrator-controlled. */
export async function registerFreeSharingAccount(userId: string) {
    await ensureSharingFoundation();
    await getDb().query("INSERT INTO sharing_account_access(user_id,plan) VALUES($1,'free') ON CONFLICT DO NOTHING", [userId]);
}
type Writer = Pick<ReturnType<typeof getDb>, 'query'>;
export async function recordSharingUsage(input: {
    accountId: string;
    actorId: string;
    sessionId?: string;
    token?: string;
    assetId?: string;
    metric: SharingMetric;
    eventKey: string;
    bytes?: number;
}, writer?: Writer) {
    if (!writer)
        await ensureSharingFoundation();
    await (writer || getDb()).query(`INSERT INTO sharing_usage_events(account_id,actor_id,session_id,token,asset_id,metric,event_key,bytes)
 VALUES($1,$2,$3,$4,$5::uuid,$6,$7,$8) ON CONFLICT(account_id,metric,event_key) DO NOTHING`, [input.accountId, input.actorId, input.sessionId || null, input.token || null, input.assetId || null, input.metric, input.eventKey, input.bytes || 0]);
}
export async function sharingUsageSummary(userId: string) {
    await ensureSharingFoundation();
    const rows = (await getDb().query<{
        metric: SharingMetric;
        count: string;
        bytes: string;
    }>(`SELECT metric,sum(quantity)::text AS count,sum(bytes)::text AS bytes FROM sharing_usage_events WHERE account_id=$1 GROUP BY metric`, [userId])).rows;
    return Object.fromEntries(rows.map(row => [row.metric, { count: Number(row.count), bytes: Number(row.bytes) }])) as Partial<Record<SharingMetric, {
        count: number;
        bytes: number;
    }>>;
}
export async function sharingAllowances() {
    await ensureSharingFoundation();
    const row = (await getDb().query('SELECT assets,uploads,interactions,emails FROM sharing_allowances WHERE id=true')).rows[0];
    // Observation is intentionally not an editable setting in this foundation.
    return { ...row, enforcing: false as const };
}
export async function saveSharingAllowances(actorId: string, input: Record<string, unknown>) {
    const values = ['assets', 'uploads', 'interactions', 'emails'].map(key => {
        const value = input[key];
        if (value === null || value === '')
            return null;
        if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1000000)
            throw Error('Use a whole number from 0 to 1,000,000, or leave the allowance blank.');
        return Number(value);
    });
    await ensureSharingFoundation();
    const db = await getDb().connect();
    try {
        await db.query('BEGIN');
        await db.query('UPDATE sharing_allowances SET assets=$1,uploads=$2,interactions=$3,emails=$4,updated_by=$5,updated_at=now() WHERE id=true', [...values, actorId]);
        await db.query("INSERT INTO sharing_admin_events(actor_id,action,detail) VALUES($1,'allowances',$2::jsonb)", [actorId, JSON.stringify(values)]);
        await db.query('COMMIT');
    }
    catch (error) {
        await db.query('ROLLBACK');
        throw error;
    }
    finally {
        db.release();
    }
}
/** An administrator activates Desktop after arranging the subscription. No account or data is copied. */
export async function activateSharingDesktop(actorId: string, userId: string) {
    await ensureSharingFoundation();
    const db = await getDb().connect();
    try {
        await db.query('BEGIN');
        const account = (await db.query("SELECT account_type,account_status FROM account_profiles WHERE user_id=$1 AND account_type IN ('dealer','business') FOR UPDATE", [userId])).rows[0];
        if (!account || account.account_status === 'suspended')
            throw Error('Choose a non-suspended Dealer or Business account.');
        // Business accounts use the existing Dealer Desktop; preserve their identity,
        // workspace memberships, verification and contributions under the same user ID.
        await db.query("UPDATE account_profiles SET account_type='dealer',account_subtype=CASE WHEN account_type='business' THEN 'machinery-dealer' ELSE account_subtype END,account_status='active',updated_at=now() WHERE user_id=$1", [userId]);
        await db.query("INSERT INTO sharing_account_access(user_id,plan,updated_by) VALUES($1,'desktop',$2) ON CONFLICT(user_id) DO UPDATE SET plan='desktop',updated_by=$2,updated_at=now()", [userId, actorId]);
        await db.query("INSERT INTO sharing_admin_events(actor_id,account_id,action,detail) VALUES($1,$2,'desktop_activated',$3::jsonb)", [actorId, userId, JSON.stringify(account)]);
        await db.query('COMMIT');
    }
    catch (error) {
        await db.query('ROLLBACK');
        throw error;
    }
    finally {
        db.release();
    }
}
export async function recordDeliveredAssets(email: string, token: string, assetIds: string[], writer?: Writer) {
    if (!writer)
        await ensureSharingFoundation();
    const db = writer || getDb();
    const recipient = (await db.query<{
        id: string;
    }>(`SELECT id FROM "user" WHERE lower(email)=$1 AND "emailVerified"=true`, [email.toLowerCase()])).rows[0];
    if (!recipient)
        return;
    for (const assetId of assetIds)
        await recordSharingUsage({ accountId: recipient.id, actorId: recipient.id, token, assetId, metric: 'asset_received', eventKey: assetId }, db);
}
/** Free access has a bounded server-side session; closing a window is not a reliable logout signal. */
export async function sharingSessionIsActive(session: {
    user: {
        id: string;
    };
    session: {
        id: string;
        createdAt: Date;
    };
}) {
    await ensureSharingFoundation();
    if ((await getDb().query('SELECT session_id FROM sharing_revoked_sessions WHERE session_id=$1 AND user_id=$2',[session.session.id,session.user.id])).rows.length) return false;
    const account = (await getDb().query(`SELECT p.account_type,a.plan FROM account_profiles p LEFT JOIN sharing_account_access a ON a.user_id=p.user_id WHERE p.user_id=$1`, [session.user.id])).rows[0];
    if (account?.plan !== 'free' && !(account?.account_type === 'business' && !account.plan))
        return true;
    const expiresAt = new Date(new Date(session.session.createdAt).getTime() + 12 * 60 * 60 * 1000);
    const result = await getDb().query(`INSERT INTO sharing_session_activity(session_id,user_id,expires_at)
  SELECT $1,$2,$3::timestamptz WHERE $3::timestamptz>now()
  ON CONFLICT(session_id) DO UPDATE SET last_seen_at=now()
  WHERE sharing_session_activity.user_id=$2 AND sharing_session_activity.last_seen_at>now()-interval '30 minutes'
    AND sharing_session_activity.expires_at>now()
  RETURNING session_id`, [session.session.id, session.user.id, expiresAt]);
    if (result.rows.length)
        return true;
    await getDb().query('DELETE FROM "session" WHERE id=$1 AND "userId"=$2', [session.session.id, session.user.id]);
    return false;
}
