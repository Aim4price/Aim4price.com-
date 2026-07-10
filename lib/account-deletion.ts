import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDb } from './db';

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};

const USER_ID_TABLES = [
  'asset_register_uploads',
  'fuel_late_entry_evidence',
  'fuel_storage_events',
  'fuel_storage_units',
  'asset_register_items',
  'valuation_runs',
  'marketplace_listings',
  'asset_registers',
  'account_profiles',
] as const;

const PARTNER_ACCESS_TABLES = [
  'asset_leads',
  'asset_partner_notes',
  'asset_register_access_grants',
  'access_audit_events',
] as const;

const USER_COMMUNICATION_TABLES = [
  'account_contact_requests',
  'account_user_messages',
] as const;

async function getExistingTableSet(
  queryable: Queryable,
  tableNames: readonly string[],
): Promise<Set<string>> {
  const result = await queryable.query<{ table_name: string }>(
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

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function deleteByColumn(
  queryable: Queryable,
  tableSet: Set<string>,
  tableName: string,
  columnName: string,
  userId: string,
): Promise<void> {
  if (!tableSet.has(tableName)) {
    return;
  }

  await queryable.query(
    `delete from ${quoteIdentifier(tableName)} where ${quoteIdentifier(columnName)} = $1`,
    [userId],
  );
}

async function deleteUserWorkspaceDataInTransaction(
  queryable: Queryable,
  userId: string,
): Promise<void> {
  const tableSet = await getExistingTableSet(queryable, [
    ...USER_ID_TABLES,
    ...PARTNER_ACCESS_TABLES,
    ...USER_COMMUNICATION_TABLES,
  ]);

  if (tableSet.has('asset_leads')) {
    await queryable.query('delete from asset_leads where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_partner_notes')) {
    await queryable.query('delete from asset_partner_notes where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_register_access_grants')) {
    await queryable.query('delete from asset_register_access_grants where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('access_audit_events')) {
    await queryable.query('delete from access_audit_events where owner_user_id = $1 or actor_user_id = $1', [userId]);
  }

  if (tableSet.has('account_contact_requests')) {
    await queryable.query('delete from account_contact_requests where owner_user_id = $1 or requester_user_id = $1', [userId]);
  }

  if (tableSet.has('account_user_messages')) {
    await queryable.query('delete from account_user_messages where owner_user_id = $1 or sender_user_id = $1', [userId]);
  }

  for (const tableName of USER_ID_TABLES) {
    await deleteByColumn(queryable, tableSet, tableName, 'user_id', userId);
  }
}

export async function deleteUserWorkspaceData(userId: string): Promise<void> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await deleteUserWorkspaceDataInTransaction(client, userId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteUserWorkspaceDataWithClient(
  client: PoolClient,
  userId: string,
): Promise<void> {
  await deleteUserWorkspaceDataInTransaction(client, userId);
}
