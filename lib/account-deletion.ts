import { getDb } from './db';

const USER_ID_TABLES = ['fuel_storage_events', 'fuel_storage_units', 'asset_register_items', 'valuation_runs', 'account_profiles'] as const;
const PARTNER_ACCESS_TABLES = ['asset_leads', 'asset_register_access_grants', 'access_audit_events'] as const;

async function getExistingTableSet(tableNames: readonly string[]): Promise<Set<string>> {
  const db = getDb();
  const result = await db.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = any (current_schemas(false))
        and table_name = any($1::text[])
    `,
    [tableNames],
  );

  return new Set(result.rows.map((row) => row.table_name));
}

export async function deleteUserWorkspaceData(userId: string): Promise<void> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const tableSet = await getExistingTableSet([...USER_ID_TABLES, ...PARTNER_ACCESS_TABLES]);

    if (tableSet.has('asset_leads')) {
      await client.query('delete from asset_leads where owner_user_id = $1 or partner_user_id = $1', [userId]);
    }

    if (tableSet.has('asset_register_access_grants')) {
      await client.query('delete from asset_register_access_grants where owner_user_id = $1 or partner_user_id = $1', [userId]);
    }

    if (tableSet.has('access_audit_events')) {
      await client.query('delete from access_audit_events where owner_user_id = $1 or actor_user_id = $1', [userId]);
    }

    for (const tableName of USER_ID_TABLES) {
      if (!tableSet.has(tableName)) {
        continue;
      }

      await client.query(`delete from ${tableName} where user_id = $1`, [userId]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
