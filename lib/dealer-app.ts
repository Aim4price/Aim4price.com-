import { resolveAccountAppUsername, withUniqueAppUsername } from './app-login-namespace';
import { normalizeAppLogin } from './app-login-name';
import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { getDb } from './db';

const scryptAsync = promisify(scrypt);
export const DEALER_APP_PASSWORD_MIN_LENGTH = 8;

export type DealerStaffRole = 'owner' | 'sales' | 'parts' | 'technician';

const DEALER_STAFF_ROLES = new Set<DealerStaffRole>(['owner', 'sales', 'parts', 'technician']);
let dealerStaffRoleStoragePromise: Promise<void> | null = null;

type Row = {
  id: string; dealer_user_id: string; display_name: string; username: string;
  username_normalized: string; password_hash: string; is_active: boolean;
  staff_role: DealerStaffRole | null;
  session_version: number; last_login_at: string | Date | null;
  created_at: string | Date; updated_at: string | Date;
};

export type DealerStaffRecord = {
  id: string; dealerUserId: string; displayName: string; username: string;
  role: DealerStaffRole;
  isActive: boolean; sessionVersion: number; lastLoginAtIso: string | null;
  createdAtIso: string; updatedAtIso: string;
};

function text(v: unknown) { return typeof v === 'string' ? v.trim() : ''; }
export function normalizeDealerStaffRole(value: unknown, fallback: DealerStaffRole = 'owner'): DealerStaffRole {
  const role = text(value).toLowerCase() as DealerStaffRole;
  return DEALER_STAFF_ROLES.has(role) ? role : fallback;
}

function requiredDealerStaffRole(value: unknown): DealerStaffRole {
  const role = text(value).toLowerCase() as DealerStaffRole;
  if (!DEALER_STAFF_ROLES.has(role)) throw new Error('Choose a valid Dealer App role.');
  return role;
}

async function ensureDealerStaffRoleStorage(): Promise<void> {
  if (!dealerStaffRoleStoragePromise) {
    dealerStaffRoleStoragePromise = (async () => {
      await getDb().query(`
        alter table public.dealer_app_staff
          add column if not exists staff_role text not null default 'owner'
      `);
      await getDb().query(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'dealer_app_staff_role_check'
          ) then
            alter table public.dealer_app_staff
              add constraint dealer_app_staff_role_check
              check (staff_role in ('owner', 'sales', 'parts', 'technician'));
          end if;
        end $$
      `);
    })().catch((error) => {
      dealerStaffRoleStoragePromise = null;
      throw error;
    });
  }
  await dealerStaffRoleStoragePromise;
}

export function normalizeDealerUsername(v: unknown) {
  return text(v).toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._@-]/g, '').slice(0, 80);
}
function iso(v: string | Date | null) { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function map(row: Row): DealerStaffRecord {
  return { id: row.id, dealerUserId: row.dealer_user_id, displayName: row.display_name, username: row.username,
    role: normalizeDealerStaffRole(row.staff_role),
    isActive: Boolean(row.is_active), sessionVersion: Number(row.session_version || 1), lastLoginAtIso: iso(row.last_login_at),
    createdAtIso: iso(row.created_at)!, updatedAtIso: iso(row.updated_at)! };
}
async function hashPassword(password: string) {
  const salt = randomBytes(18).toString('base64url');
  const key = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('base64url')}`;
}
export async function verifyDealerPassword(password: string, encoded: string) {
  const [scheme, salt, raw] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !raw) return false;
  const expected = Buffer.from(raw, 'base64url');
  const actual = await scryptAsync(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function validatePassword(v: unknown) {
  const password = typeof v === 'string' ? v : '';
  if (password.length < DEALER_APP_PASSWORD_MIN_LENGTH) throw new Error('Password must be at least 8 characters.');
  if (password.length > 200) throw new Error('Password is too long.');
  return password;
}
export async function listDealerStaff(dealerUserId: string) {
  await ensureDealerStaffRoleStorage();
  const r = await getDb().query<Row>(`select * from dealer_app_staff where dealer_user_id=$1 order by created_at desc`, [dealerUserId]);
  return r.rows.map(map);
}
export async function createDealerStaff(dealerUserId: string, input: Record<string, unknown>) {
  await ensureDealerStaffRoleStorage();
  const displayName = text(input.displayName).replace(/\s+/g, ' ').slice(0, 120);
  const username = await resolveAccountAppUsername(dealerUserId, input.username);
  const role = requiredDealerStaffRole(input.role);
  const password = validatePassword(input.password);
  if (!displayName) throw new Error('Enter the staff display name.');
  if (username.length < 3) throw new Error('Username must be at least 3 characters.');
  try {
    const r = await withUniqueAppUsername(username, 'dealer', null, undefined, async (db) => db.query<Row>(`insert into dealer_app_staff(dealer_user_id,display_name,username,username_normalized,password_hash,staff_role,is_active)
      values($1,$2,$3,$4,$5,$6,true) returning *`, [dealerUserId, displayName, username, username, await hashPassword(password), role]));
    return map(r.rows[0]);
  } catch (e: any) { if (e?.code === '23505') throw new Error('That username is already in use.'); throw e; }
}
export async function updateDealerStaff(dealerUserId: string, id: string, input: Record<string, unknown>) {
  await ensureDealerStaffRoleStorage();
  const current = await getDb().query<Row>(`select * from dealer_app_staff where id=$1 and dealer_user_id=$2`, [id, dealerUserId]);
  if (!current.rows[0]) throw new Error('Staff login not found.');
  const row = current.rows[0];
  const displayName = Object.hasOwn(input,'displayName') ? text(input.displayName).replace(/\s+/g,' ').slice(0,120) : row.display_name;
  const username = Object.hasOwn(input,'username') ? await resolveAccountAppUsername(dealerUserId, input.username, row.username_normalized) : row.username_normalized;
  const role = Object.hasOwn(input,'role') ? requiredDealerStaffRole(input.role) : normalizeDealerStaffRole(row.staff_role);
  if (!displayName) throw new Error('Enter the staff display name.');
  if (username.length < 3) throw new Error('Username must be at least 3 characters.');
  const passwordChanged = Object.hasOwn(input,'password') && text(input.password).length > 0;
  const passwordHash = passwordChanged ? await hashPassword(validatePassword(input.password)) : row.password_hash;
  const active = Object.hasOwn(input,'isActive') ? Boolean(input.isActive) : row.is_active;
  const bump = username !== row.username_normalized || passwordChanged || active !== row.is_active || role !== normalizeDealerStaffRole(row.staff_role);
  try {
    const r = await withUniqueAppUsername(username, 'dealer', id, row.username_normalized, (db) => db.query<Row>(`update dealer_app_staff set display_name=$3, username=$4, username_normalized=$4,
      password_hash=$5, is_active=$6, staff_role=$7, session_version=session_version+$8, updated_at=now()
      where id=$1 and dealer_user_id=$2 returning *`, [id,dealerUserId,displayName,username,passwordHash,active,role,bump?1:0]));
    return map(r.rows[0]);
  } catch (e: any) { if (e?.code === '23505') throw new Error('That username is already in use.'); throw e; }
}
export async function deleteDealerStaff(dealerUserId: string, id: string) {
  await ensureDealerStaffRoleStorage();
  const r = await getDb().query(`delete from dealer_app_staff where id=$1 and dealer_user_id=$2`, [id,dealerUserId]);
  if (!r.rowCount) throw new Error('Staff login not found.');
}
export async function findDealerStaffForLogin(username: string) {
  await ensureDealerStaffRoleStorage();
  const r = await getDb().query<Row>(`select * from dealer_app_staff where username_normalized=$1 limit 1`, [normalizeAppLogin(username)]);
  return r.rows[0] ?? null;
}
export async function getDealerStaffById(id: string) {
  await ensureDealerStaffRoleStorage();
  const r = await getDb().query<Row>(`select * from dealer_app_staff where id=$1 limit 1`, [id]);
  return r.rows[0] ?? null;
}
export async function markDealerStaffLogin(id: string) { await getDb().query(`update dealer_app_staff set last_login_at=now(), updated_at=now() where id=$1`, [id]); }
