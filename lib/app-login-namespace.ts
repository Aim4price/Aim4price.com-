import type { Pool, PoolClient } from 'pg';
import { getDb } from './db';
import { accountAppUsername, validateAppAccountName } from './app-login-name';

export type AppLoginKind = 'owner' | 'dealer' | 'field';
const directories = [
  { kind: 'owner', table: 'owner_app_users', owner: 'parent_owner_user_id' },
  { kind: 'dealer', table: 'dealer_app_staff', owner: 'dealer_user_id' },
  { kind: 'field', table: 'field_managers', owner: 'owner_user_id' },
] as const;

let schema: Promise<void> | undefined;
async function ensureNamespaceTable() {
  schema ??= getDb().query(`create table if not exists public.app_login_namespaces (
    account_user_id text primary key references public."user"(id) on delete cascade,
    account_name text not null unique check (account_name ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
    created_at timestamptz not null default now()
  )`).then(() => {}).catch(error => { schema = undefined; throw error; });
  await schema;
}

export async function getAppLoginNamespace(accountUserId: string): Promise<string | null> {
  await ensureNamespaceTable();
  const result = await getDb().query<{ account_name: string }>(
    'select account_name from public.app_login_namespaces where account_user_id = $1', [accountUserId],
  );
  return result.rows[0]?.account_name ?? null;
}

export async function confirmAppLoginNamespace(accountUserId: string, value: unknown): Promise<string> {
  const name = validateAppAccountName(value);
  await ensureNamespaceTable();
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`app-account:${name}`]);
    // Do not claim a business suffix already present on another account's legacy logins.
    for (const directory of directories) {
      const exists = await client.query('select to_regclass($1) as table_name', [`public.${directory.table}`]);
      if (!exists.rows[0].table_name) continue;
      const used = await client.query(`select 1 from public.${directory.table}
        where username_normalized like $1 and ${directory.owner} <> $2 limit 1`, [`%@${name}`, accountUserId]);
      if (used.rowCount) throw new Error('That business login name is already in use. Try a longer name.');
    }
    await client.query(`insert into public.app_login_namespaces(account_user_id, account_name)
      values ($1, $2) on conflict (account_user_id) do nothing`, [accountUserId, name]);
    const saved = await client.query<{ account_name: string }>(
      'select account_name from public.app_login_namespaces where account_user_id = $1', [accountUserId],
    );
    if (saved.rows[0]?.account_name !== name) throw new Error('Your business login name has already been confirmed.');
    await client.query('commit');
    return name;
  } catch (error) {
    await client.query('rollback');
    if ((error as { code?: string }).code === '23505') {
      throw new Error('That business login name is already in use. Try a longer name.');
    }
    throw error;
  } finally { client.release(); }
}

export async function resolveAccountAppUsername(accountUserId: string, value: unknown, previous?: string): Promise<string> {
  const input = String(value ?? '').trim().toLowerCase();
  // Editing a role/password must not rename an existing login implicitly.
  if (previous && input === previous.toLowerCase()) return previous;
  const namespace = await getAppLoginNamespace(accountUserId);
  if (!namespace) throw new Error('Confirm your business login name before creating or renaming a username.');
  return accountAppUsername(value, namespace);
}

/** Serialize username writes across all three directories, including legacy names.
 * The uniqueness check and write use the same transaction/connection. */
export async function withUniqueAppUsername<T>(
  username: string, kind: AppLoginKind, id: string | null, previous: string | undefined,
  write: (db: Pool | PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`app-username:${username}`]);
    if (id && previous !== undefined) {
      const directory = directories.find(directory => directory.kind === kind)!;
      const current = await client.query(`select username_normalized from public.${directory.table} where id::text = $1 for update`, [id]);
      if (current.rows[0]?.username_normalized !== previous) {
        throw new Error('This login changed while you were editing. Reload and try again.');
      }
    }
    for (const directory of directories) {
      // Preserve existing legacy duplicates when the username itself is unchanged.
      if (previous === username) break;
      const exists = await client.query('select to_regclass($1) as table_name', [`public.${directory.table}`]);
      if (!exists.rows[0].table_name) continue;
      const duplicate = await client.query(`select 1 from public.${directory.table}
        where username_normalized = $1 and ($2::text is null or id::text <> $2) limit 1`,
      [username, directory.kind === kind ? id : null]);
      if (duplicate.rowCount) throw new Error('That username is already in use. Choose another name.');
    }
    const result = await write(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
