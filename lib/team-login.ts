import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { ensureTeamAccessSchema } from './team-access-schema';
import { TeamAccessError, type TeamActor } from './team-access-policy';
const derive = promisify(scrypt);
export const TEAM_LOGIN_COOKIE = 'aim4price_desktop_user';
export const TEAM_LOGIN_AGE = 60 * 60 * 24 * 7;
export async function hashTeamPassword(password: string) {
  if (password.length < 10 || password.length > 128 || !password.trim()) throw new TeamAccessError('Use a password between 10 and 128 characters.', 400);
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64) as Buffer;
  return salt + ':' + hash.toString('hex');
}
export async function verifyTeamPassword(password: string, encoded: string) {
  if (password.length > 128) return false;
  const [salt, hex] = encoded.split(':');
  if (!salt || !hex || hex.length !== 128) return false;
  const hash = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}
export function teamTokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export async function getManagedTeamActor(): Promise<TeamActor | null> {
  const token = cookies().get(TEAM_LOGIN_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await ensureTeamAccessSchema();
  const row = (await getDb().query(`SELECT g.id,g.email,g.display_name FROM team_access_sessions s JOIN team_access g ON g.id=s.grant_id WHERE s.token_hash=$1 AND s.expires_at>now() AND g.managed_login=true AND g.status='active' AND (g.expires_at IS NULL OR g.expires_at>now())`, [teamTokenHash(token)])).rows[0];
  return row ? { id: 'desktop:' + row.id, managedGrantId: row.id, email: row.email, name: row.display_name, emailVerified: false } : null;
}
export async function authenticateTeamLogin(business: string, email: string, password: string) {
  await ensureTeamAccessSchema();
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(`SELECT g.id,l.password_hash FROM team_access g JOIN team_access_logins l ON l.grant_id=g.id WHERE g.owner_id=$1 AND g.email=$2 AND g.managed_login=true AND g.status='active' AND (g.expires_at IS NULL OR g.expires_at>now()) FOR UPDATE OF g,l`, [business, email])).rows[0];
    // Equal-cost password check for unknown users; never reveal account existence here.
    const hash = row?.password_hash || '00000000000000000000000000000000:' + '0'.repeat(128);
    if (!await verifyTeamPassword(password, hash) || !row) throw new TeamAccessError('Incorrect email or password, or desktop access is unavailable.', 401);
    const token = randomBytes(32).toString('hex');
    await client.query('DELETE FROM team_access_sessions WHERE grant_id=$1 AND expires_at<=now()', [row.id]);
    await client.query(`INSERT INTO team_access_sessions(token_hash,grant_id,expires_at) VALUES($1,$2,now()+interval '7 days')`, [teamTokenHash(token), row.id]);
    await client.query('COMMIT');
    return token;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
