import { getDb } from './db';

const USER_DATA_TABLES = ['fuel_storage_events', 'fuel_storage_units', 'asset_register_items', 'valuation_runs', 'account_profiles'] as const;

export async function deleteUserWorkspaceData(userId: string): Promise<void> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const existingTables = await client.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = any (current_schemas(false))
          and table_name = any($1::text[])
      `,
      [USER_DATA_TABLES],
    );

    const tableSet = new Set(existingTables.rows.map((row) => row.table_name));

    for (const tableName of USER_DATA_TABLES) {
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
